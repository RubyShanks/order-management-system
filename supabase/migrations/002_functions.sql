-- ============================================================
-- Migration: 002_functions.sql
-- Description: Core transactional business logic and SECURITY DEFINER functions
-- ============================================================

-- ============================================================
-- 1. create_order_with_reservation
-- Atomically validates cart items, checks stock, prevents deadlocks by
-- ordering locks, creates order and order_items snapshots, and reserves stock.
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_order_with_reservation(
  p_customer_id uuid,
  p_email text,
  p_checkout_request_key text,
  p_cart_fingerprint text,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing_order record;
  v_order_id uuid;
  v_total_amount integer := 0;
  v_product record;
  v_item_count integer;
BEGIN
  -- 1. Authorization check: caller must own this customer ID or be an admin
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required to create an order';
  END IF;

  IF p_customer_id != auth.uid() AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized to create order for another customer';
  END IF;

  -- 2. Input validation
  IF p_checkout_request_key IS NULL OR length(trim(p_checkout_request_key)) = 0 THEN
    RAISE EXCEPTION 'Checkout request key is required';
  END IF;

  IF p_cart_fingerprint IS NULL OR length(trim(p_cart_fingerprint)) = 0 THEN
    RAISE EXCEPTION 'Cart fingerprint is required';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) != 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Cart cannot be empty';
  END IF;

  -- 3. Check for existing order with same (customer_id, checkout_request_key)
  SELECT id, status, cart_fingerprint, stripe_session_id
  INTO v_existing_order
  FROM public.orders
  WHERE customer_id = p_customer_id
    AND checkout_request_key = p_checkout_request_key;

  IF FOUND THEN
    -- If existing order was cancelled -> reject key reuse (Rule 8: retries must use a fresh key)
    IF v_existing_order.status = 'cancelled' THEN
      RAISE EXCEPTION 'Checkout key used on cancelled order, use a new key';
    END IF;

    -- If cart contents changed for this checkout key -> reject
    IF v_existing_order.cart_fingerprint != p_cart_fingerprint THEN
      RAISE EXCEPTION 'Cart contents changed';
    END IF;

    -- Return existing order idempotently
    RETURN jsonb_build_object(
      'order_id', v_existing_order.id,
      'is_existing', true
    );
  END IF;

  -- 4. Temporary table to aggregate duplicates and validate quantities
  CREATE TEMPORARY TABLE temp_order_items (
    product_id uuid PRIMARY KEY,
    quantity integer NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO temp_order_items (product_id, quantity)
  SELECT
    (item->>'product_id')::uuid,
    sum((item->>'quantity')::integer)::integer
  FROM jsonb_array_elements(p_items) AS item
  GROUP BY (item->>'product_id')::uuid;

  IF EXISTS (SELECT 1 FROM temp_order_items WHERE quantity <= 0) THEN
    RAISE EXCEPTION 'Item quantities must be positive integers';
  END IF;

  SELECT count(*) INTO v_item_count FROM temp_order_items;
  IF v_item_count = 0 THEN
    RAISE EXCEPTION 'Cart cannot be empty';
  END IF;

  -- 5. Lock inventory and products in strictly ascending product_id order (deadlock prevention)
  FOR v_product IN
    SELECT
      p.id,
      p.sku,
      p.name,
      p.price_amount,
      p.is_active,
      i.on_hand,
      i.reserved,
      t.quantity AS requested_quantity
    FROM temp_order_items t
    JOIN public.products p ON p.id = t.product_id
    JOIN public.inventory i ON i.product_id = t.product_id
    ORDER BY t.product_id ASC
    FOR UPDATE OF p, i
  LOOP
    IF NOT v_product.is_active THEN
      RAISE EXCEPTION 'Product "%" (%) is no longer active', v_product.name, v_product.sku;
    END IF;

    IF v_product.price_amount <= 0 THEN
      RAISE EXCEPTION 'Invalid price for product "%"', v_product.name;
    END IF;

    -- Check availability: (on_hand - reserved) >= requested
    IF (v_product.on_hand - v_product.reserved) < v_product.requested_quantity THEN
      RAISE EXCEPTION 'Insufficient stock for product "%" (Available: %, Requested: %)',
        v_product.name,
        (v_product.on_hand - v_product.reserved),
        v_product.requested_quantity;
    END IF;

    v_total_amount := v_total_amount + (v_product.price_amount * v_product.requested_quantity);
  END LOOP;

  -- Verify all requested items exist in database
  IF (SELECT count(*) FROM temp_order_items t JOIN public.products p ON p.id = t.product_id) < v_item_count THEN
    RAISE EXCEPTION 'One or more items in the cart were not found';
  END IF;

  -- 6. Insert new order
  INSERT INTO public.orders (
    customer_id,
    email_snapshot,
    status,
    total_amount,
    currency,
    checkout_request_key,
    cart_fingerprint,
    integration_state,
    session_expires_at
  ) VALUES (
    p_customer_id,
    p_email,
    'pending_payment',
    v_total_amount,
    'usd',
    p_checkout_request_key,
    p_cart_fingerprint,
    'awaiting_session',
    now() + interval '30 minutes'
  )
  RETURNING id INTO v_order_id;

  -- 7. Insert item snapshots, reserve stock, and record stock movements
  FOR v_product IN
    SELECT
      t.product_id,
      t.quantity,
      p.sku,
      p.name,
      p.price_amount
    FROM temp_order_items t
    JOIN public.products p ON p.id = t.product_id
    ORDER BY t.product_id ASC
  LOOP
    -- Snapshots
    INSERT INTO public.order_items (
      order_id,
      product_id,
      sku_snapshot,
      name_snapshot,
      unit_price_snapshot,
      quantity
    ) VALUES (
      v_order_id,
      v_product.product_id,
      v_product.sku,
      v_product.name,
      v_product.price_amount,
      v_product.quantity
    );

    -- Increase reservation
    UPDATE public.inventory
    SET reserved = reserved + v_product.quantity,
        updated_at = now()
    WHERE product_id = v_product.product_id;

    -- Audit trail
    INSERT INTO public.stock_movements (
      product_id,
      on_hand_delta,
      reserved_delta,
      reason,
      order_id,
      actor_id
    ) VALUES (
      v_product.product_id,
      0,
      v_product.quantity,
      'Stock reservation for order ' || v_order_id,
      v_order_id,
      p_customer_id
    );
  END LOOP;

  -- 8. Record initial status history
  INSERT INTO public.order_status_history (
    order_id,
    previous_status,
    new_status,
    description,
    actor,
    is_customer_visible
  ) VALUES (
    v_order_id,
    NULL,
    'pending_payment',
    'Order created with stock reservation',
    'customer:' || p_customer_id::text,
    true
  );

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'is_existing', false
  );
END;
$$;

-- ============================================================
-- 2. process_payment_success
-- Idempotently marks order paid, decrements on_hand and reserved stock,
-- logs audit movements, status history, and records stripe event.
-- Service-role only (no public/client execute).
-- ============================================================
CREATE OR REPLACE FUNCTION public.process_payment_success(
  p_order_id uuid,
  p_event_id text,
  p_payment_intent_id text,
  p_amount integer,
  p_currency text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order record;
  v_item record;
BEGIN
  -- 1. Idempotency check: Return if this event was already processed
  IF EXISTS (
    SELECT 1 FROM public.stripe_events
    WHERE id = p_event_id AND processed_at IS NOT NULL
  ) THEN
    RETURN;
  END IF;

  -- 2. Lock and retrieve order
  SELECT id, status, total_amount, currency, customer_id
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found: %', p_order_id;
  END IF;

  -- If order already paid, record event idempotently and return
  IF v_order.status = 'paid' THEN
    INSERT INTO public.stripe_events (id, event_type, object_id, order_id, processed_at)
    VALUES (p_event_id, 'checkout.session.completed', p_payment_intent_id, p_order_id, now())
    ON CONFLICT (id) DO UPDATE SET processed_at = now(), order_id = p_order_id;
    RETURN;
  END IF;

  -- 3. Verify current status is pending_payment
  IF v_order.status != 'pending_payment' THEN
    RAISE EXCEPTION 'Cannot mark order as paid: current status is %', v_order.status;
  END IF;

  -- 4. Verify amount and currency
  IF v_order.total_amount != p_amount THEN
    RAISE EXCEPTION 'Payment amount mismatch: expected %, received %', v_order.total_amount, p_amount;
  END IF;

  IF lower(v_order.currency) != lower(p_currency) THEN
    RAISE EXCEPTION 'Payment currency mismatch: expected %, received %', v_order.currency, p_currency;
  END IF;

  -- 5. Transition order to 'paid'
  UPDATE public.orders
  SET status = 'paid',
      integration_state = 'session_created',
      stripe_payment_intent_id = COALESCE(p_payment_intent_id, stripe_payment_intent_id),
      updated_at = now()
  WHERE id = p_order_id;

  -- 6. Lock inventory in ascending product_id order; decrement on_hand and reserved
  FOR v_item IN
    SELECT oi.product_id, oi.quantity
    FROM public.order_items oi
    WHERE oi.order_id = p_order_id
    ORDER BY oi.product_id ASC
  LOOP
    PERFORM 1 FROM public.inventory
    WHERE product_id = v_item.product_id
    FOR UPDATE;

    UPDATE public.inventory
    SET on_hand = on_hand - v_item.quantity,
        reserved = reserved - v_item.quantity,
        updated_at = now()
    WHERE product_id = v_item.product_id;

    INSERT INTO public.stock_movements (
      product_id,
      on_hand_delta,
      reserved_delta,
      reason,
      order_id,
      actor_id
    ) VALUES (
      v_item.product_id,
      -v_item.quantity,
      -v_item.quantity,
      'Payment confirmed for order ' || p_order_id,
      p_order_id,
      v_order.customer_id
    );
  END LOOP;

  -- 7. Add order status history entry
  INSERT INTO public.order_status_history (
    order_id,
    previous_status,
    new_status,
    description,
    actor,
    is_customer_visible
  ) VALUES (
    p_order_id,
    'pending_payment',
    'paid',
    'Payment confirmed via Stripe webhook',
    'stripe_webhook',
    true
  );

  -- 8. Mark stripe event as processed
  INSERT INTO public.stripe_events (id, event_type, object_id, order_id, processed_at)
  VALUES (p_event_id, 'checkout.session.completed', p_payment_intent_id, p_order_id, now())
  ON CONFLICT (id) DO UPDATE SET
    processed_at = now(),
    order_id = p_order_id;
END;
$$;

-- ============================================================
-- 3. process_cancellation
-- Releases stock reservations when an order expires or payment fails.
-- Service-role only (no public/client execute).
-- ============================================================
CREATE OR REPLACE FUNCTION public.process_cancellation(
  p_order_id uuid,
  p_event_id text DEFAULT NULL,
  p_reason text DEFAULT 'Session expired or cancelled'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order record;
  v_item record;
BEGIN
  -- 1. Idempotency check if event_id is supplied
  IF p_event_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.stripe_events
    WHERE id = p_event_id AND processed_at IS NOT NULL
  ) THEN
    RETURN;
  END IF;

  -- 2. Lock and retrieve order
  SELECT id, status, customer_id
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found: %', p_order_id;
  END IF;

  -- If already cancelled, return cleanly (idempotent)
  IF v_order.status = 'cancelled' THEN
    IF p_event_id IS NOT NULL THEN
      INSERT INTO public.stripe_events (id, event_type, object_id, order_id, processed_at)
      VALUES (p_event_id, 'checkout.session.expired', p_order_id::text, p_order_id, now())
      ON CONFLICT (id) DO UPDATE SET processed_at = now(), order_id = p_order_id;
    END IF;
    RETURN;
  END IF;

  -- Only pending_payment orders can be cancelled and have reservations released
  IF v_order.status != 'pending_payment' THEN
    RAISE EXCEPTION 'Cannot cancel order: current status is %', v_order.status;
  END IF;

  -- 3. Transition order to 'cancelled'
  UPDATE public.orders
  SET status = 'cancelled',
      integration_state = 'session_created',
      updated_at = now()
  WHERE id = p_order_id;

  -- 4. Release inventory reservations in ascending product_id order
  FOR v_item IN
    SELECT oi.product_id, oi.quantity
    FROM public.order_items oi
    WHERE oi.order_id = p_order_id
    ORDER BY oi.product_id ASC
  LOOP
    PERFORM 1 FROM public.inventory
    WHERE product_id = v_item.product_id
    FOR UPDATE;

    UPDATE public.inventory
    SET reserved = reserved - v_item.quantity,
        updated_at = now()
    WHERE product_id = v_item.product_id;

    INSERT INTO public.stock_movements (
      product_id,
      on_hand_delta,
      reserved_delta,
      reason,
      order_id,
      actor_id
    ) VALUES (
      v_item.product_id,
      0,
      -v_item.quantity,
      'Reservation released on cancellation: ' || COALESCE(p_reason, 'unspecified'),
      p_order_id,
      v_order.customer_id
    );
  END LOOP;

  -- 5. Add status history
  INSERT INTO public.order_status_history (
    order_id,
    previous_status,
    new_status,
    description,
    actor,
    is_customer_visible
  ) VALUES (
    p_order_id,
    'pending_payment',
    'cancelled',
    'Order cancelled: ' || COALESCE(p_reason, 'Session expired or cancelled'),
    'system',
    true
  );

  -- 6. Record stripe event if provided
  IF p_event_id IS NOT NULL THEN
    INSERT INTO public.stripe_events (id, event_type, object_id, order_id, processed_at)
    VALUES (p_event_id, 'checkout.session.expired', p_order_id::text, p_order_id, now())
    ON CONFLICT (id) DO UPDATE SET
      processed_at = now(),
      order_id = p_order_id;
  END IF;
END;
$$;

-- ============================================================
-- 4. process_refund_success
-- Restores on_hand inventory for a successfully refunded paid order.
-- Service-role only (no public/client execute).
-- ============================================================
CREATE OR REPLACE FUNCTION public.process_refund_success(
  p_order_id uuid,
  p_event_id text DEFAULT NULL,
  p_refund_id text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order record;
  v_refund_req record;
  v_item record;
BEGIN
  -- 1. Idempotency check
  IF p_event_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.stripe_events
    WHERE id = p_event_id AND processed_at IS NOT NULL
  ) THEN
    RETURN;
  END IF;

  -- 2. Lock order
  SELECT id, status
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found: %', p_order_id;
  END IF;

  -- If already refunded, return cleanly
  IF v_order.status = 'refunded' THEN
    IF p_event_id IS NOT NULL THEN
      INSERT INTO public.stripe_events (id, event_type, object_id, order_id, processed_at)
      VALUES (p_event_id, 'charge.refunded', COALESCE(p_refund_id, p_order_id::text), p_order_id, now())
      ON CONFLICT (id) DO UPDATE SET processed_at = now(), order_id = p_order_id;
    END IF;
    RETURN;
  END IF;

  IF v_order.status != 'paid' THEN
    RAISE EXCEPTION 'Cannot refund order: current status is % (only paid orders can be refunded)', v_order.status;
  END IF;

  -- 3. Try to find matching pending refund request (may not exist for external refunds)
  SELECT id, admin_id
  INTO v_refund_req
  FROM public.refund_requests
  WHERE order_id = p_order_id AND status = 'pending'
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    -- Handle external refunds (initiated from Stripe Dashboard, not from our admin panel).
    -- Create a system-generated refund_request record so the order can still transition.
    INSERT INTO public.refund_requests (order_id, idempotency_key, stripe_refund_id, status, admin_id)
    VALUES (
      p_order_id,
      'external_refund_' || p_order_id || '_' || p_event_id,
      p_refund_id,
      'succeeded',
      v_order.customer_id  -- No admin actor for external refunds; record customer_id as reference
    )
    RETURNING id, admin_id INTO v_refund_req;
  END IF;

  -- 4. Update order to refunded
  UPDATE public.orders
  SET status = 'refunded',
      updated_at = now()
  WHERE id = p_order_id;

  -- 5. Update refund request to succeeded
  UPDATE public.refund_requests
  SET status = 'succeeded',
      stripe_refund_id = COALESCE(p_refund_id, stripe_refund_id),
      updated_at = now()
  WHERE id = v_refund_req.id;

  -- 6. Restore on_hand stock in ascending product_id order
  FOR v_item IN
    SELECT oi.product_id, oi.quantity
    FROM public.order_items oi
    WHERE oi.order_id = p_order_id
    ORDER BY oi.product_id ASC
  LOOP
    PERFORM 1 FROM public.inventory
    WHERE product_id = v_item.product_id
    FOR UPDATE;

    UPDATE public.inventory
    SET on_hand = on_hand + v_item.quantity,
        updated_at = now()
    WHERE product_id = v_item.product_id;

    INSERT INTO public.stock_movements (
      product_id,
      on_hand_delta,
      reserved_delta,
      reason,
      order_id,
      actor_id
    ) VALUES (
      v_item.product_id,
      v_item.quantity,
      0,
      'Stock restoration for refunded order ' || p_order_id,
      p_order_id,
      v_refund_req.admin_id
    );
  END LOOP;

  -- 7. Add status history
  INSERT INTO public.order_status_history (
    order_id,
    previous_status,
    new_status,
    description,
    actor,
    is_customer_visible
  ) VALUES (
    p_order_id,
    'paid',
    'refunded',
    'Order refunded in full. Stock restored to inventory.',
    'stripe_webhook',
    true
  );

  -- 8. Record stripe event if provided
  IF p_event_id IS NOT NULL THEN
    INSERT INTO public.stripe_events (id, event_type, object_id, order_id, processed_at)
    VALUES (p_event_id, 'charge.refunded', COALESCE(p_refund_id, p_order_id::text), p_order_id, now())
    ON CONFLICT (id) DO UPDATE SET
      processed_at = now(),
      order_id = p_order_id;
  END IF;
END;
$$;

-- ============================================================
-- 5. adjust_stock
-- Audited administrative stock adjustment with reason.
-- Ensures on_hand stock never falls below reserved stock.
-- Authenticated admins only.
-- ============================================================
CREATE OR REPLACE FUNCTION public.adjust_stock(
  p_product_id uuid,
  p_on_hand_delta integer,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_inv record;
BEGIN
  -- 1. Authorization: Admin only
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only administrators can adjust stock';
  END IF;

  -- 2. Validate reason
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'A non-empty reason is required for stock adjustments';
  END IF;

  -- 3. Lock inventory row
  SELECT product_id, on_hand, reserved
  INTO v_inv
  FROM public.inventory
  WHERE product_id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory row not found for product %', p_product_id;
  END IF;

  -- 4. Verify invariant: resulting on_hand >= reserved
  IF (v_inv.on_hand + p_on_hand_delta) < v_inv.reserved THEN
    RAISE EXCEPTION 'Cannot adjust stock: resulting on-hand (%) would be less than reserved (%)',
      (v_inv.on_hand + p_on_hand_delta),
      v_inv.reserved;
  END IF;

  IF (v_inv.on_hand + p_on_hand_delta) < 0 THEN
    RAISE EXCEPTION 'Cannot adjust stock: resulting on-hand cannot be negative';
  END IF;

  -- 5. Update inventory
  UPDATE public.inventory
  SET on_hand = on_hand + p_on_hand_delta,
      updated_at = now()
  WHERE product_id = p_product_id;

  -- 6. Record stock movement
  INSERT INTO public.stock_movements (
    product_id,
    on_hand_delta,
    reserved_delta,
    reason,
    actor_id
  ) VALUES (
    p_product_id,
    p_on_hand_delta,
    0,
    p_reason,
    auth.uid()
  );
END;
$$;

-- ============================================================
-- 6. fulfill_order
-- Marks a paid order as fulfilled. Rejects if active pending refund exists.
-- Authenticated admins only.
-- ============================================================
CREATE OR REPLACE FUNCTION public.fulfill_order(
  p_order_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order record;
BEGIN
  -- 1. Authorization: Admin only
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only administrators can fulfill orders';
  END IF;

  -- 2. Lock order
  SELECT id, status
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found: %', p_order_id;
  END IF;

  -- 3. Verify status = 'paid'
  IF v_order.status != 'paid' THEN
    RAISE EXCEPTION 'Only paid orders can be fulfilled (current status: %)', v_order.status;
  END IF;

  -- 4. Verify no active pending refund request exists
  IF EXISTS (
    SELECT 1 FROM public.refund_requests
    WHERE order_id = p_order_id AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'Cannot fulfill order with an active pending refund request';
  END IF;

  -- 5. Transition order to 'fulfilled'
  UPDATE public.orders
  SET status = 'fulfilled',
      updated_at = now()
  WHERE id = p_order_id;

  -- 6. Record status history
  INSERT INTO public.order_status_history (
    order_id,
    previous_status,
    new_status,
    description,
    actor,
    is_customer_visible
  ) VALUES (
    p_order_id,
    'paid',
    'fulfilled',
    'Order fulfilled and dispatched by administrator',
    'admin:' || auth.uid()::text,
    true
  );
END;
$$;

-- ============================================================
-- 7. get_product_catalog
-- Public view returning active products with computed available stock.
-- Available to anon and authenticated users.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_product_catalog()
RETURNS TABLE (
  id uuid,
  sku text,
  name text,
  description text,
  price_amount integer,
  image_path text,
  available integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT
    p.id,
    p.sku,
    p.name,
    p.description,
    p.price_amount,
    p.image_path,
    i.available
  FROM public.products p
  JOIN public.inventory i ON i.product_id = p.id
  WHERE p.is_active = true
  ORDER BY p.name ASC;
$$;

-- ============================================================
-- Function Permissions / Grants
-- ============================================================

-- create_order_with_reservation: authenticated customers
GRANT EXECUTE ON FUNCTION public.create_order_with_reservation TO authenticated;

-- adjust_stock & fulfill_order: authenticated users (internal checks enforce admin role)
GRANT EXECUTE ON FUNCTION public.adjust_stock TO authenticated;
GRANT EXECUTE ON FUNCTION public.fulfill_order TO authenticated;

-- get_product_catalog: public catalog viewing
GRANT EXECUTE ON FUNCTION public.get_product_catalog TO anon, authenticated;

-- Service role only functions: revoke execution from anon, authenticated, and public
REVOKE ALL ON FUNCTION public.process_payment_success FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.process_cancellation FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.process_refund_success FROM PUBLIC, anon, authenticated;
