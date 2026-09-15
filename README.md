# Order Management System

A full-stack order management system built with **Next.js 16** (App Router, TypeScript), **Supabase** (Postgres + RLS + Auth + Storage), and **Stripe** (test-mode hosted Checkout), deployed on **Vercel**.

## Features

### Storefront
- Product catalog with images, prices, and real-time availability
- Client-side cart with quantity editing, removal, and localStorage persistence
- Authenticated checkout with atomic stock reservation
- Stripe hosted Checkout (card-only, 30-minute session expiry)
- Post-payment return page with processing state handling

### Customer Account
- Email/password authentication (signup, login, password reset)
- Paginated order history with status badges
- Order details with items, totals, and customer-visible status timeline
- Refund processing indicator

### Admin Panel
- Role-verified admin layout (server-side enforcement)
- Product CRUD with image upload (Supabase Storage)
- Stock adjustment with mandatory reason and full audit trail
- Order management with search, status filtering, and pagination
- One-click fulfillment and refund initiation with confirmation dialogs
- Refund-pending state surfacing with action button locking

### Backend
- Atomic stock reservation via PostgreSQL transaction functions
- Stripe webhook processing (checkout.completed, payment_failed, session.expired, charge.refunded)
- Payment failure cancellation with Stripe session expiration
- Recovery endpoint for all failure scenarios
- Full Row-Level Security on all 9 tables
- Idempotent operations (checkout, webhooks, refunds)

---

## Local Development Setup

### Prerequisites
- Node.js 20+ (LTS recommended)
- npm 9+
- [Supabase CLI](https://supabase.com/docs/guides/cli) (for local development)
- [Stripe CLI](https://stripe.com/docs/stripe-cli) (for webhook testing)

### 1. Clone and Install
```bash
git clone <repository-url>
cd order-management-system
npm install
```

### 2. Environment Variables
Copy the example and fill in your values:
```bash
cp .env.example .env.local
```

Required variables:
| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only) |
| `STRIPE_SECRET_KEY` | Stripe test-mode secret key (`sk_test_...`) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret (`whsec_...`) |
| `RECOVERY_API_KEY` | API key for the recovery endpoint |
| `NEXT_PUBLIC_APP_URL` | Application URL (`http://localhost:3000` for dev) |

> **Note**: `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is intentionally omitted — hosted Stripe Checkout uses server-side session creation and redirect, so no client-side Stripe SDK is needed.

### 3. Database Setup
Run the migrations against your Supabase instance:
```bash
# Using Supabase CLI (local)
supabase start
supabase db reset  # Applies migrations + seed

# Or apply manually via Supabase Dashboard SQL editor:
# 1. Run supabase/migrations/001_schema.sql
# 2. Run supabase/migrations/002_functions.sql
# 3. Run supabase/seed.sql
```

### 4. Supabase Storage
Create a `product-images` bucket in your Supabase Storage dashboard:
- Set to **public** (for product image URLs)
- Allow file types: `image/jpeg`, `image/png`, `image/webp`
- Max file size: 5MB

### 5. Admin User Seeding
After creating a user account through the signup page:
```sql
-- Promote a user to admin
UPDATE public.profiles 
SET role = 'admin' 
WHERE id = '<user-uuid-from-auth.users>';
```

### 6. Stripe CLI Webhook Forwarding
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```
Copy the webhook signing secret (`whsec_...`) to your `.env.local`.

### 7. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000).

---

## Test Credentials

### Stripe Test Cards
| Card | Result |
|---|---|
| `4242 4242 4242 4242` | Successful payment |
| `4000 0000 0000 0002` | Declined payment |

Use any future expiry date and any 3-digit CVC.

---

## Auth Redirect Configuration
In your Supabase Dashboard → Authentication → URL Configuration:
- **Site URL**: `http://localhost:3000` (or your production URL)
- **Redirect URLs**: Add `http://localhost:3000/callback` and your production callback URL

---

## Recovery Operations

The system includes a protected recovery endpoint for resolving edge cases:

```bash
# Run recovery manually
curl -X POST https://your-app.vercel.app/api/internal/reconcile \
  -H "Authorization: Bearer $RECOVERY_API_KEY"
```

Recovery operations include:
- Uncertain Stripe session creation recovery
- Overdue pending order cleanup (verifies Stripe state before releasing)
- Stalled cancellation retry
- Dangling refund request resolution
- Missing webhook event replay

> **Important**: Recovery never independently marks orders as paid. It preserves the verified-webhook boundary.

---

## Project Structure

```
src/
  app/
    (store)/          # Storefront pages (products, checkout)
    (auth)/           # Auth pages (login, signup, reset)
    account/          # Customer account (orders, profile)
    admin/            # Admin panel (products, orders)
    api/
      stripe/webhook/ # Stripe webhook handler
      internal/       # Recovery endpoint
  components/
    ui/               # shadcn/ui components
    cart/             # Cart system (provider, drawer, icon)
    layout/           # Header, Footer
    products/         # Product card, detail
    admin/            # Admin sidebar, pagination
  lib/
    auth/             # Auth server actions
    supabase/         # Supabase clients + types
    stripe/           # Stripe client + config
    services/         # Business logic (checkout, refund, recovery)
    validation/       # Zod schemas
    utils/            # Formatting utilities

supabase/
  migrations/         # SQL schema + functions
  seed.sql            # Sample data
```

---

## Verification

```bash
# Type checking
npx tsc --noEmit

# Linting
npm run lint

# Production build
npm run build
```

---

## Deployment (Vercel)

1. Push to a Git repository
2. Import into Vercel
3. Set environment variables in Vercel dashboard
4. Configure Stripe webhook endpoint: `https://your-domain.vercel.app/api/stripe/webhook`
5. Update Supabase auth redirect URLs to include production domain
