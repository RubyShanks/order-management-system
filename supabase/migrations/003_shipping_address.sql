-- ============================================================
-- Migration: 003_shipping_address.sql
-- Description: Adds shipping_address JSONB column to public.orders
-- ============================================================

ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS shipping_address JSONB;

COMMENT ON COLUMN public.orders.shipping_address IS 'Customer delivery details captured from Stripe Checkout (name, address line1/2, city, state, postal code, country)';
