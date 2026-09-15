# Technical Decisions

## 1. Stock Reservation & Concurrency

### Approach
Stock reservation uses a single PostgreSQL transaction function (`create_order_with_reservation`) that atomically validates availability, creates the order with item snapshots, increments inventory reservations, and records stock movements — all within one transaction that either fully succeeds or fully rolls back.

### Concurrency Control
The function acquires `SELECT ... FOR UPDATE` locks on inventory rows **in ascending `product_id` order**. This consistent locking order is maintained across all operations (checkout, cancellation, payment confirmation, refund, stock adjustment) to prevent deadlocks. Two concurrent buyers attempting to purchase the last unit will serialize at the row lock — the first acquires the lock, reserves the stock, and commits; the second finds `on_hand - reserved < requested` and the entire transaction rolls back with an explicit error.

### Inventory Invariants
The `inventory` table enforces three database-level constraints:
- `on_hand >= 0`
- `reserved >= 0`  
- `reserved <= on_hand`

The `available` quantity is a `GENERATED ALWAYS AS (on_hand - reserved) STORED` column, ensuring consistency across all queries without application-level computation.

### Stock Lifecycle
- **Reservation**: `reserved += quantity` (checkout)
- **Payment confirmed**: `on_hand -= quantity`, `reserved -= quantity` (webhook)
- **Cancellation/Expiry**: `reserved -= quantity` (webhook/recovery)
- **Refund**: `on_hand += quantity` (webhook)
- **Fulfillment**: No stock change (already decremented at payment)

Every stock change is recorded in `stock_movements` as an append-only audit trail.

---

## 2. Webhook Idempotency

### Event Deduplication
The `stripe_events` table stores each Stripe event ID as a primary key. Every webhook handler function (`process_payment_success`, `process_cancellation`, `process_refund_success`) checks for the event ID before processing. If already present with a `processed_at` timestamp, the function returns without side effects.

### Transactional Commitment
The `stripe_events` record is inserted **within the same transaction** as the state change it triggers. This means either both the order transition and the event record commit together, or neither does. This prevents the case where an event is marked as processed but the state change failed.

### Order-Level Idempotency
Different Stripe event IDs describing the same logical outcome (e.g., two `checkout.session.completed` events for the same session) are also safe because each handler validates the current order status before applying a transition. A second event for an already-paid order finds `status != 'pending_payment'` and is a no-op.

### Checkout Request Idempotency
The `checkout_request_key` (unique per customer) prevents duplicate orders from repeated form submissions. If a key already exists with a non-cancelled order, the function returns the existing order. If the cart fingerprint differs, it rejects the request. If the key belongs to a cancelled order, it requires a fresh key (per the retry-after-cancellation policy).

---

## 3. RLS Policy Design

### Strategy
Row-Level Security is enabled on all 9 application tables. Access is layered:

- **Anonymous**: Read-only access to active products (via `get_product_catalog()` function, not direct table access)
- **Customers**: Read own orders, order items (via order ownership join), and customer-visible status history. No access to inventory, stock movements, Stripe events, or refund requests.
- **Admins**: Full read access to all tables, write access via controlled server actions and database functions.
- **Service role**: Bypasses RLS entirely — used only in webhook handlers and recovery endpoints.

### Column-Level Protection
RLS restricts rows but not columns. Sensitive fields (like `integration_state`, internal status history entries) are protected by:
- The `is_customer_visible` flag on `order_status_history` entries
- Database functions that return only safe projections (e.g., `get_product_catalog` exposes `available` but not raw `on_hand`/`reserved`)

### Server Action Protection
Every admin server action independently verifies the caller's admin role by querying the `profiles` table, in addition to RLS. Middleware provides supplementary route-level protection but is not relied upon as the sole authorization boundary.

---

## 4. A Tricky RLS Policy: Order Items Access

### The Challenge
Customers need to see their own order items, but `order_items` doesn't have a `customer_id` column — it only has `order_id`. A naive policy like `auth.uid() = customer_id` isn't possible on this table.

### The Solution
The RLS policy uses a subquery join:
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

### Why It Was Tricky
1. **Performance concern**: The `EXISTS` subquery runs for every row access. Without a proper index on `order_items.order_id`, this could be slow for tables with millions of rows.
2. **Policy interaction**: When combined with the admin policy (`role = 'admin'`), we had to ensure the policies use `OR` semantics (multiple `FOR SELECT` policies are OR'd by default in PostgreSQL) rather than `AND`.
3. **RLS on the joined table**: The `orders` table itself has RLS. PostgreSQL evaluates the subquery against `orders` with RLS applied, which means a customer's subquery naturally only matches their own orders — providing defense-in-depth.

### Verification
Tested by:
- Customer A viewing their order items → succeeds
- Customer A querying with Customer B's order_id → returns empty (subquery finds no matching order)
- Admin viewing any order items → succeeds via separate admin policy
- Unauthenticated user → denied by role check

---

## 5. Failure Cancellation & Stale Event Handling

### Payment Failure Flow
When `payment_intent.payment_failed` arrives:
1. The handler verifies the order is still `pending_payment`
2. Marks `integration_state = 'cancellation_pending'`
3. **Outside any database transaction**: attempts to expire the Checkout Session via Stripe API
4. If the session has already completed (payment succeeded) → aborts cancellation, lets the success webhook handle it
5. If the session is confirmed expired → executes `process_cancellation` to release stock
6. If expiration times out → retains reservation, marks for recovery

This sequence is critical because a `payment_failed` event doesn't prove the Checkout Session is dead — the customer may retry with a different card within the same session.

### Stale Event Handling
Events are not assumed to arrive in order. The system handles:
- **Late failure after success**: If `payment_intent.payment_failed` arrives after `checkout.session.completed` already marked the order `paid`, the failure handler finds `status != 'pending_payment'` and returns without action.
- **Duplicate events**: Deduplicated via `stripe_events` table.
- **Late success after cancellation**: If `checkout.session.completed` arrives for an already-cancelled order, `process_payment_success` finds `status != 'pending_payment'` and rejects the transition. This is safe because cancellation only occurs after confirming the session is expired/unpayable.

---

## 6. What Would Change With Another Week

1. **Comprehensive integration tests**: Currently the system relies on TypeScript compilation, linting, and manual Stripe CLI testing. With more time, I'd add Vitest/Jest integration tests using Supabase local and Stripe test fixtures for all 16 verification scenarios in the spec.
2. **Cart persistence across sessions**: Currently client-side only (localStorage). Would add a `cart` table in Supabase for logged-in users with server-side merge on login.
3. **Email notifications**: Order confirmation, payment receipt, refund confirmation, and shipping notification emails via Supabase Edge Functions or a transactional email service.
4. **Optimistic UI updates**: Admin actions currently require full page refreshes. Would add React Query or SWR for optimistic mutations.
5. **Cron-based recovery**: Currently manual via the recovery endpoint. Would configure Vercel Cron to run reconciliation every 5 minutes.
6. **Image optimization**: Product images would benefit from Next.js Image component with Supabase Storage loader for automatic resizing and format conversion.

---

## 7. What Was Cut for Time

1. **Automated integration tests** — Focused on type safety and lint verification instead. The spec's 16 test scenarios are documented but not automated.
2. **Shipping, tax, discounts** — Explicitly out of scope per the assessment brief.
3. **Multi-currency** — Uses USD only as specified.
4. **Customer-initiated cancellation** — Out of scope per the spec.
5. **Email notifications** — No transactional email integration.
6. **Vercel Cron for recovery** — Recovery endpoint exists but requires manual invocation.

---

## Technology Choices

| Choice | Rationale |
|---|---|
| **Supabase Auth** | Default per spec. JWT claims integrate naturally with RLS. |
| **Direct Supabase client** | No ORM overhead. Database functions handle transactional logic where an ORM would add complexity without benefit. |
| **shadcn/ui** | Accessible, keyboard-navigable, Tailwind-native components. Meets the spec's accessibility requirements without a heavy library. |
| **Hosted Stripe Checkout** | Default per spec. Eliminates PCI scope, handles card UI, and provides built-in expiry management. |
| **Supabase Storage** | Keeps the entire stack in one platform. Public bucket for product images with size/type restrictions enforced at upload. |
| **Node.js runtime** | Explicitly set on webhook and recovery routes to avoid Edge runtime compatibility issues with Stripe SDK and Supabase transactions. |
