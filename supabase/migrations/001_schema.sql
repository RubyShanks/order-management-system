-- ============================================================
-- Migration: 001_schema.sql
-- Description: Core schema, enums, tables, indexes, and RLS policies
-- ============================================================

-- Ensure required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. Custom Enum Types
-- ============================================================

DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM ('customer', 'admin');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.order_status AS ENUM (
    'pending_payment',
    'paid',
    'fulfilled',
    'refunded',
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.integration_state AS ENUM (
    'awaiting_session',
    'session_created',
    'recovery_needed',
    'cancellation_pending'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.refund_status AS ENUM ('pending', 'succeeded', 'failed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================
-- 2. Utility Functions & Triggers
-- ============================================================

-- Reusable timestamp updater
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$;

-- ============================================================
-- 3. Application Tables
-- ============================================================

-- Profiles Table (Extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.user_role NOT NULL DEFAULT 'customer',
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Products Table
CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  price_amount integer NOT NULL CHECK (price_amount > 0),
  image_path text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Inventory Table
CREATE TABLE IF NOT EXISTS public.inventory (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  on_hand integer NOT NULL DEFAULT 0 CHECK (on_hand >= 0),
  reserved integer NOT NULL DEFAULT 0 CHECK (reserved >= 0),
  available integer GENERATED ALWAYS AS (on_hand - reserved) STORED,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_reserved_le_on_hand CHECK (reserved <= on_hand)
);

CREATE OR REPLACE TRIGGER trg_inventory_updated_at
  BEFORE UPDATE ON public.inventory
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Orders Table
CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.profiles(id),
  email_snapshot text NOT NULL,
  status public.order_status NOT NULL DEFAULT 'pending_payment',
  total_amount integer NOT NULL CHECK (total_amount >= 0),
  currency text NOT NULL DEFAULT 'usd',
  checkout_request_key text NOT NULL,
  cart_fingerprint text NOT NULL,
  stripe_session_id text UNIQUE,
  stripe_payment_intent_id text UNIQUE,
  session_expires_at timestamptz,
  integration_state public.integration_state NOT NULL DEFAULT 'awaiting_session',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_orders_customer_checkout_key UNIQUE (customer_id, checkout_request_key)
);

CREATE OR REPLACE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Order Items Table (Immutable historical snapshots)
CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id),
  sku_snapshot text NOT NULL,
  name_snapshot text NOT NULL,
  unit_price_snapshot integer NOT NULL CHECK (unit_price_snapshot > 0),
  quantity integer NOT NULL CHECK (quantity > 0)
);

-- Stock Movements Table (Append-only audit trail)
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id),
  on_hand_delta integer NOT NULL,
  reserved_delta integer NOT NULL,
  reason text NOT NULL,
  order_id uuid REFERENCES public.orders(id),
  actor_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Order Status History Table (Audit and customer timeline)
CREATE TABLE IF NOT EXISTS public.order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  previous_status public.order_status,
  new_status public.order_status NOT NULL,
  description text NOT NULL,
  actor text,
  is_customer_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Stripe Events Table (Idempotency and webhook processing)
CREATE TABLE IF NOT EXISTS public.stripe_events (
  id text PRIMARY KEY,
  event_type text NOT NULL,
  object_id text NOT NULL,
  order_id uuid REFERENCES public.orders(id),
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Refund Requests Table (Admin-initiated refund tracking)
CREATE TABLE IF NOT EXISTS public.refund_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id),
  idempotency_key text UNIQUE NOT NULL,
  stripe_refund_id text,
  status public.refund_status NOT NULL DEFAULT 'pending',
  admin_id uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE TRIGGER trg_refund_requests_updated_at
  BEFORE UPDATE ON public.refund_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Constraint: Prevent overlapping active/successful refunds per order
CREATE UNIQUE INDEX IF NOT EXISTS idx_refund_requests_single_active_or_succeeded
  ON public.refund_requests (order_id)
  WHERE (status IN ('pending', 'succeeded'));

-- ============================================================
-- 4. Indexes
-- ============================================================

-- Orders Indexes
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders (customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_email_snapshot ON public.orders (email_snapshot);
CREATE INDEX IF NOT EXISTS idx_orders_stripe_session_id ON public.orders (stripe_session_id) WHERE stripe_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_stripe_payment_intent_id ON public.orders (stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_recovery ON public.orders (integration_state, session_expires_at);

-- Order Items Indexes
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON public.order_items (product_id);

-- Stock Movements Indexes
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON public.stock_movements (product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_order_id ON public.stock_movements (order_id);

-- Order Status History Indexes
CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id ON public.order_status_history (order_id);

-- Refund Requests Indexes
CREATE INDEX IF NOT EXISTS idx_refund_requests_order_id ON public.refund_requests (order_id);
CREATE INDEX IF NOT EXISTS idx_refund_requests_status ON public.refund_requests (status);

-- ============================================================
-- 5. Profile Creation Trigger on auth.users
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (id, role, display_name)
  VALUES (
    new.id,
    'customer',
    COALESCE(new.raw_user_meta_data->>'display_name', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

-- Drop and recreate the trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 6. Helper Function: is_admin()
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- ============================================================
-- 7. Row Level Security (RLS) Policies
-- ============================================================

-- Enable RLS on all 9 tables
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- Products Policies
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Active products are viewable by everyone" ON public.products;
CREATE POLICY "Active products are viewable by everyone"
  ON public.products FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "Admins have full access to products" ON public.products;
CREATE POLICY "Admins have full access to products"
  ON public.products FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ------------------------------------------------------------
-- Profiles Policies
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid() AND
    -- Prevent customers from escalating role
    role = (SELECT role FROM public.profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Admins have full access to profiles" ON public.profiles;
CREATE POLICY "Admins have full access to profiles"
  ON public.profiles FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ------------------------------------------------------------
-- Inventory Policies
-- No direct access for anon/customer; Admins can read
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can view inventory" ON public.inventory;
CREATE POLICY "Admins can view inventory"
  ON public.inventory FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- ------------------------------------------------------------
-- Orders Policies
-- Customers can view their own orders
-- Admins can view all orders and perform restricted updates
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Customers can view own orders" ON public.orders;
CREATE POLICY "Customers can view own orders"
  ON public.orders FOR SELECT
  TO authenticated
  USING (customer_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all orders" ON public.orders;
CREATE POLICY "Admins can view all orders"
  ON public.orders FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update orders with restrictions" ON public.orders;
CREATE POLICY "Admins can update orders with restrictions"
  ON public.orders FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ------------------------------------------------------------
-- Order Items Policies
-- Customers can view items for their own orders
-- Admins can view all order items
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Customers can view own order items" ON public.order_items;
CREATE POLICY "Customers can view own order items"
  ON public.order_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_items.order_id
        AND orders.customer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can view all order items" ON public.order_items;
CREATE POLICY "Admins can view all order items"
  ON public.order_items FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- ------------------------------------------------------------
-- Stock Movements Policies
-- Admin SELECT only (mutations happen through functions)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can view stock movements" ON public.stock_movements;
CREATE POLICY "Admins can view stock movements"
  ON public.stock_movements FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- ------------------------------------------------------------
-- Order Status History Policies
-- Customers can view visible history entries for their own orders
-- Admins can view all status history
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Customers can view visible status history for own orders" ON public.order_status_history;
CREATE POLICY "Customers can view visible status history for own orders"
  ON public.order_status_history FOR SELECT
  TO authenticated
  USING (
    is_customer_visible = true
    AND EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_status_history.order_id
        AND orders.customer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can view all status history" ON public.order_status_history;
CREATE POLICY "Admins can view all status history"
  ON public.order_status_history FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- ------------------------------------------------------------
-- Stripe Events Policies
-- Strictly service role only — no RLS access for anon or authenticated
-- ------------------------------------------------------------
-- (No policies created: default deny applies to anon and authenticated)

-- ------------------------------------------------------------
-- Refund Requests Policies
-- Admins SELECT only
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can view refund requests" ON public.refund_requests;
CREATE POLICY "Admins can view refund requests"
  ON public.refund_requests FOR SELECT
  TO authenticated
  USING (public.is_admin());
