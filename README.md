# Order Management System

A production-shaped full-stack e-commerce system built with **Next.js 16** (App Router, TypeScript), **Supabase** (Postgres + Row-Level Security + Auth + Storage), and **Stripe** (test-mode hosted Checkout), deployed on **Vercel**.

- **Production Live URL**: [https://order-management-system-pink-zeta.vercel.app](https://order-management-system-pink-zeta.vercel.app)
- **GitHub Repository**: [https://github.com/RubyShanks/order-management-system](https://github.com/RubyShanks/order-management-system)

---

## 1. Test Credentials

### Demo Accounts
| Surface | Email | Password | Role | Permissions |
|---|---|---|---|---|
| **Admin Panel** (`/admin`) | `admin@oms-test.com` | `Password123!` | `admin` | Full CRUD on products, inventory adjustments, orders fulfillment & refunds |
| **Customer Storefront** (`/`) | `customer@oms-test.com` | `Password123!` | `customer` | Browsing, ordering, viewing own orders, password updates |

### Stripe Test Payment Cards
| Card Number | Expiry / CVC | Intended Test Outcome |
|---|---|---|
| `4242 4242 4242 4242` | Any future date / `123` | **Successful payment** (`checkout.session.completed`) |
| `4000 0000 0000 0002` | Any future date / `123` | **Declined card** (allows user retry; session stays open) |

---

## 2. Features & Architecture

### Customer Storefront (`/`)
- **Product Catalog**: Real-time inventory calculation (`on_hand - reserved`), active product filtering, stock status badges (In stock vs Out of stock).
- **Product Detail**: Authoritative inventory checks; prevents adding out-of-stock items or exceeding available units.
- **Cart**: Multi-tab synced client-side state via `localStorage` and `useSyncExternalStore`.
- **Checkout & Address Collection**:
  - Two-phase order creation: Phase 1 reserves stock atomically in Postgres; Phase 2 creates Stripe Checkout Session.
  - Stripe Checkout collects recipient name and full delivery address across 7 countries (`US`, `CA`, `GB`, `IN`, `AU`, `DE`, `FR`).
- **Post-Payment Return & Confirmation**: Polls order fulfillment status after redirect from Stripe.
- **Customer Account (`/account`)**:
  - Email/password authentication, profile overview, and update password flow (`/account/reset-password`).
  - Order history with status badges and order details with items, financial totals, delivery destination, and customer-visible milestone timeline.

### Admin Dashboard (`/admin`)
- **Strict Role Verification**: Server-side role inspection on layout, server actions, and API routes via database `profiles.role = 'admin'` (not client tokens).
- **Product CRUD**:
  - Create new products with automated SKU validation and initial inventory.
  - Edit product details, change price in minor units (cents), and upload product images to Supabase Storage with size/type validation.
  - Activate / deactivate products with immediate storefront and admin list revalidation.
- **Audited Stock Adjustment**: Modify physical on-hand units with mandatory reason logged to `stock_movements`.
- **Order Management**:
  - Real-time search by UUID or customer email, status filtering, and pagination.
  - Detailed line items, customer email, Stripe session & payment intent references, and shipping destination.
  - One-click fulfillment (`paid -> fulfilled`) and full refund processing (`paid -> refunded`) via Stripe API.
  - Safe button locking while refunds are pending.

### Backend Correctness & Security
- **Atomic Stock Reservation**: PostgreSQL function `create_order_with_reservation` acquires row locks (`SELECT ... FOR UPDATE` in ascending `product_id` order) to prevent deadlocks and overselling.
- **Stripe Webhook Handler**:
  - Signature verification using `STRIPE_WEBHOOK_SECRET`.
  - Idempotent processing with `stripe_events` deduplication table.
  - Orders are marked paid *strictly via verified webhooks*, never on frontend redirect.
  - Captures customer delivery address to `orders.shipping_address`.
- **Self-Healing Reconciliation API (`/api/internal/reconcile`)**:
  - Background worker secured with `RECOVERY_API_KEY`.
  - Recovers uncertain sessions, releases overdue reservations, retries stalled cancellations, and finalizes dangling refunds.
- **Row-Level Security (RLS)**: Enforced on all tables with defense-in-depth policies.

---

## 3. Local Development Setup

### Prerequisites
- Node.js 20+ (LTS)
- npm 9+
- [Stripe CLI](https://stripe.com/docs/stripe-cli)
- [Supabase CLI](https://supabase.com/docs/guides/cli) or remote Supabase project

### 1. Clone & Install
```bash
git clone https://github.com/RubyShanks/order-management-system.git
cd order-management-system
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env.local` and provide your credentials:
```bash
cp .env.example .env.local
```

Required variables:
| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key (server-only) |
| `STRIPE_SECRET_KEY` | Stripe test secret key (`sk_test_...`) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret (`whsec_...`) |
| `RECOVERY_API_KEY` | Secret token for `/api/internal/reconcile` |
| `NEXT_PUBLIC_APP_URL` | Application base URL (`http://localhost:3000`) |
| `NEXT_PUBLIC_SITE_URL` | Base URL for auth password reset redirects |

### 3. Database Migrations & Seed
Apply migrations in numerical sequence:
```bash
# 1. Base tables & RLS policies
supabase db execute --file supabase/migrations/001_schema.sql

# 2. Transactional RPC functions
supabase db execute --file supabase/migrations/002_functions.sql

# 3. Delivery address column
supabase db execute --file supabase/migrations/003_shipping_address.sql

# 4. Seed initial catalog and stock
supabase db execute --file supabase/seed.sql
```

### 4. Supabase Storage Setup
1. Create a bucket named `product-images`.
2. Toggle bucket setting to **Public**.
3. Allowed MIME types: `image/jpeg`, `image/png`, `image/webp` (Max 5MB).

### 5. Seeding an Admin User
1. Register a user at `/signup` (e.g. `admin@example.com`).
2. Promote the user profile in PostgreSQL:
```sql
UPDATE public.profiles
SET role = 'admin'
WHERE id = (SELECT id FROM auth.users WHERE email = 'admin@example.com');
```

### 6. Stripe CLI Webhook Forwarding
Forward Stripe test webhook events to your local API route:
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```
Copy the printed `whsec_...` secret to `STRIPE_WEBHOOK_SECRET` in `.env.local`.

### 7. Run the Development Server
```bash
npm run dev
```
Visit [http://localhost:3000](http://localhost:3000).

---

## 4. Verification & Testing

```bash
# Typecheck
npx tsc --noEmit

# Lint
npm run lint

# Production build
npm run build
```

---

## 5. Recovery Operations

```bash
curl -X POST https://order-management-system-pink-zeta.vercel.app/api/internal/reconcile \
  -H "Authorization: Bearer $RECOVERY_API_KEY"
```

---

## 6. Architecture & Decision Documentation
For comprehensive details on concurrency control, RLS policy design, webhook idempotency, and lessons learned, see [DECISIONS.md](./DECISIONS.md) and [DATABASE_AND_FLOWS.md](./DATABASE_AND_FLOWS.md).