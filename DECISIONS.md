# Technical Decisions

This document details the architectural decisions, concurrency models, security boundaries, and trade-offs implemented in the Order Management System per the technical assessment requirements.

---

## 1. Stock Reservation & Concurrency

### Approach
Stock reservation employs a two-phase transactional model designed around the principle: **Never hold database locks across external third-party HTTP calls (Rule 1)**.
- **Phase 1 (Postgres RPC `create_order_with_reservation`)**: Atomically validates inventory, reserves units, creates the order and item snapshots, and commits before any network call to Stripe.
- **Phase 2 (Stripe Checkout Session)**: Initiates the checkout session with an explicit 30-minute expiry time (`expires_at`), using item snapshots retrieved authoritatively from the database rather than trusting client-submitted totals.

### Concurrency Control & Deadlock Prevention
Concurrency is strictly managed at the PostgreSQL engine level using row locks:
```sql
SELECT product_id, on_hand, reserved 
FROM public.inventory
WHERE product_id IN (...)
ORDER BY product_id ASC
FOR UPDATE;
```
1. **Sorted Lock Acquisition**: All concurrent operations (order reservation, payment fulfillment, manual stock adjustments, cancellations, and refunds) always lock inventory rows in ascending `product_id` order. This eliminates deadlock cycles.
2. **Serializing the Last Unit**: When two buyers attempt to purchase the final unit simultaneously, both requests serialize at the row lock. The first transaction verifies `(on_hand - reserved) >= requested_quantity`, increments `reserved`, logs to `stock_movements`, and commits. The second transaction unblocks, re-evaluates the stock check against the updated `reserved` count, finds zero available, and immediately rolls back with an explicit exception: `Insufficient stock for product...`.

### Database Invariants
The `inventory` table enforces strict constraints:
- `on_hand >= 0`
- `reserved >= 0`
- `CONSTRAINT chk_reserved_le_on_hand CHECK (reserved <= on_hand)`
- `available` is defined as `GENERATED ALWAYS AS (on_hand - reserved) STORED`, ensuring immutable consistency across all queries.

---

## 2. Webhook Idempotency

### Dedicated Event Deduplication
Every incoming Stripe webhook event is handled within an idempotent database transaction using the `stripe_events` table:
1. When an event arrives, the webhook handler verifies the cryptographic HMAC signature using `stripe.webhooks.constructEvent()`.
2. The event ID (`evt_...`) is checked in `public.stripe_events`.
3. If an entry exists with a populated `processed_at`, the handler immediately returns HTTP 200 without executing side effects.
4. If unprocessed, the state change (e.g. marking the order `paid`, decrementing physical stock) and the `stripe_events` record are committed together in the same atomic PostgreSQL transaction (`process_payment_success` / `process_cancellation` / `process_refund_success`).

### Order-Level State Machine Defense
In addition to event ID deduplication, each database function acts as a guarded state machine:
- An order can only transition from `pending_payment` to `paid`.
- If a duplicate or replayed webhook arrives, the query checks `status = 'pending_payment'`. If the order is already `paid`, the update is safely ignored and the event record is refreshed idempotently.
- Orders become `paid` **strictly through verified webhooks**, never on frontend redirect from Stripe.

---

## 3. RLS Policy Design & "The Tricky Policy"

### Layered Authorization Matrix
Row-Level Security is active across all 9 application tables:
- **`anon`**: SELECT-only on active products (`is_active = true`) via the `get_product_catalog()` RPC. Zero access to internal inventory numbers, orders, or user profiles.
- **`authenticated (Customer)`**: Can SELECT only their own orders (`customer_id = auth.uid()`), order items (via join on owned orders), and customer-visible status history (`is_customer_visible = true`).
- **`authenticated (Admin)`**: Full SELECT/UPDATE/INSERT access to products and orders. Mutations to `inventory` and `stock_movements` are restricted to dedicated stored procedures or Service Role execution to prevent inventory corruption.
- **`service_role`**: Full bypass reserved for webhooks and the `/api/internal/reconcile` recovery worker.

### The Tricky Policy: Order Items & Inventory Mutations
1. **Order Items Traversal**: `order_items` contains no `customer_id` column—only an `order_id`. To enforce that customers only read items from orders they own without introducing performance bottlenecks, we implemented an `EXISTS` subquery:
   ```sql
   CREATE POLICY "Customers can view own order items"
   ON public.order_items FOR SELECT TO authenticated
   USING (
     EXISTS (
       SELECT 1 FROM public.orders
       WHERE orders.id = order_items.order_id
       AND orders.customer_id = auth.uid()
     )
   );
   ```
   *Why it was tricky*: PostgreSQL evaluates this policy per row. An unindexed foreign key on `order_items.order_id` would result in full table scans. Furthermore, because `orders` also has RLS enabled, PostgreSQL nests RLS evaluation, requiring careful query structure to prevent recursion while maintaining multi-tenant isolation.
2. **Admin Mutation Constraints on Inventory**: By design, even authenticated administrators cannot run ad-hoc `UPDATE public.inventory SET on_hand = ...`. All physical stock updates must flow through `adjust_stock(product_id, delta, reason)` to guarantee an immutable audit trail in `stock_movements`.

---

## 4. Payment Failure & Stale Event Handling

### Failed Payments vs. Expired Sessions
- When `payment_intent.payment_failed` is received, the order is **not** immediately cancelled. Stripe Checkout allows customers to retry with an alternate card within the same 30-minute session. Cancelling on the first card failure would reject subsequent successful card attempts.
- An order's reservation is only released when Stripe confirms session expiration (`checkout.session.expired`), cancellation, or when the background reconciliation cron detects an expired session past its timeout window.

---

## 5. What We Would Do Differently With Another Week

1. **Automated End-to-End Test Suite**: Add comprehensive Playwright / Vitest test suites executing the 16 multi-step concurrency and failure scenarios using local Supabase and Stripe CLI mock fixtures.
2. **Persistent Server-Side Cart**: Migrate from `localStorage` to a database-backed `cart_items` table with automatic guest-to-authenticated session merging on login.
3. **Automated Vercel Cron Scheduling**: Wire up Vercel Cron (`cron.json`) to trigger `/api/internal/reconcile` every 5 minutes automatically rather than relying on manual worker execution.
4. **Transactional Email Pipeline**: Integrate Resend or AWS SES to dispatch order receipts, shipping confirmations, and refund notices with PDF invoices.
5. **Real-Time WebSockets**: Leverage Supabase Realtime to update admin order lists and customer timelines without manual page refreshes.

---

## 6. What Was Cut for Time & Why

1. **Multi-Currency & Regional Tax Calculations**: Kept currency locked to USD minor units (`cents`) and used Stripe Checkout's standard address collection without dynamic tax registration to keep the assessment focused on core order-state reliability.
2. **Customer Self-Service Cancellation**: The brief requires admin-driven cancellation and refund flows. Customer self-cancellation was excluded to simplify checkout state transitions.
3. **Complex Product Variants**: Focused on single-SKU inventory tracking to demonstrate rock-solid locking and audit logging without complicating the data model with parent-child matrix variations.