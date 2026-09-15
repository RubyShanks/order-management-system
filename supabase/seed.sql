-- ============================================================
-- Seed Data: supabase/seed.sql
-- Description: Sample catalog products, initial inventory, stock movement audit records,
--              and instructions for creating an administrator user.
-- ============================================================

-- ============================================================
-- ADMIN CREATION INSTRUCTIONS:
-- ------------------------------------------------------------
-- To create or promote an admin user in Supabase:
--
-- Option 1: Via SQL (after registering user through the web app at /signup)
--   UPDATE public.profiles
--   SET role = 'admin'
--   WHERE id = (SELECT id FROM auth.users WHERE email = 'admin@example.com');
--
-- Option 2: Direct Insert into auth.users (local development)
--   INSERT INTO auth.users (
--     instance_id, id, aud, role, email, encrypted_password,
--     email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
--     created_at, updated_at
--   ) VALUES (
--     '00000000-0000-0000-0000-000000000000',
--     '00000000-0000-0000-0000-000000000001',
--     'authenticated',
--     'authenticated',
--     'admin@example.com',
--     crypt('AdminPassword123!', gen_salt('bf')),
--     now(),
--     '{"provider":"email","providers":["email"]}',
--     '{"display_name":"System Administrator"}',
--     now(),
--     now()
--   ) ON CONFLICT (id) DO NOTHING;
--
--   UPDATE public.profiles
--   SET role = 'admin'
--   WHERE id = '00000000-0000-0000-0000-000000000001';
-- ============================================================

-- Fixed deterministic UUIDs for seed products
DO $$
DECLARE
  v_prod1 uuid := 'a0000000-0000-0000-0000-000000000001';
  v_prod2 uuid := 'a0000000-0000-0000-0000-000000000002';
  v_prod3 uuid := 'a0000000-0000-0000-0000-000000000003';
  v_prod4 uuid := 'a0000000-0000-0000-0000-000000000004';
  v_prod5 uuid := 'a0000000-0000-0000-0000-000000000005';
  v_prod6 uuid := 'a0000000-0000-0000-0000-000000000006';
BEGIN
  -- 1. Insert Products
  INSERT INTO public.products (id, sku, name, description, price_amount, image_path, is_active)
  VALUES
    (
      v_prod1,
      'PROD-MECH-KB',
      'Mechanical Keyboard',
      'Ergonomic tenkeyless mechanical keyboard featuring tactile hot-swappable switches, sound-dampening foam, and per-key RGB backlighting.',
      14900, -- $149.00
      'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&auto=format&fit=crop&q=80',
      true
    ),
    (
      v_prod2,
      'PROD-WRLS-MS',
      'Wireless Precision Mouse',
      'Ultra-lightweight wireless optical mouse with 26,000 DPI sensor, low-latency 2.4GHz connection, and 80 hours of continuous battery life.',
      7999, -- $79.99
      'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=800&auto=format&fit=crop&q=80',
      true
    ),
    (
      v_prod3,
      'PROD-DSK-MAT',
      'Premium Desk Mat',
      'Water-resistant micro-woven cloth desk pad (900x400mm) with precision-stitched edges and anti-slip rubber backing.',
      2950, -- $29.50
      'https://images.unsplash.com/photo-1629429408209-1f912961dbd8?w=800&auto=format&fit=crop&q=80',
      true
    ),
    (
      v_prod4,
      'PROD-HDPH-NC',
      'Noise-Cancelling Headphones',
      'High-fidelity over-ear wireless headphones with hybrid active noise cancellation, transparency mode, and 30-hour playback.',
      24900, -- $249.00
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80',
      true
    ),
    (
      v_prod5,
      'PROD-ALU-STD',
      'Aluminum Laptop Stand',
      'Precision-machined aircraft-grade aluminum riser designed to elevate laptops to eye level for optimal ergonomics and cooling.',
      4900, -- $49.00
      'https://images.unsplash.com/photo-1544816155-12df9643f363?w=800&auto=format&fit=crop&q=80',
      true
    ),
    (
      v_prod6,
      'PROD-USB-HUB',
      '10-in-1 Thunderbolt Hub',
      'High-speed aluminum docking station with dual 4K@60Hz HDMI, 100W Power Delivery, Gigabit Ethernet, SD card reader, and USB 3.2 Gen 2 ports.',
      8900, -- $89.00
      'https://images.unsplash.com/photo-1574944985070-8f3ebc6b79d2?w=800&auto=format&fit=crop&q=80',
      true
    )
  ON CONFLICT (sku) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    price_amount = EXCLUDED.price_amount,
    image_path = EXCLUDED.image_path,
    is_active = EXCLUDED.is_active;

  -- 2. Insert Inventory
  INSERT INTO public.inventory (product_id, on_hand, reserved)
  VALUES
    (v_prod1, 25, 0),
    (v_prod2, 40, 0),
    (v_prod3, 60, 0),
    (v_prod4, 15, 0),
    (v_prod5, 30, 0),
    (v_prod6, 20, 0)
  ON CONFLICT (product_id) DO UPDATE SET
    on_hand = EXCLUDED.on_hand,
    reserved = EXCLUDED.reserved;

  -- 3. Insert Initial Stock Movements (Audit Trail)
  INSERT INTO public.stock_movements (product_id, on_hand_delta, reserved_delta, reason)
  VALUES
    (v_prod1, 25, 0, 'Initial inventory seed'),
    (v_prod2, 40, 0, 'Initial inventory seed'),
    (v_prod3, 60, 0, 'Initial inventory seed'),
    (v_prod4, 15, 0, 'Initial inventory seed'),
    (v_prod5, 30, 0, 'Initial inventory seed'),
    (v_prod6, 20, 0, 'Initial inventory seed')
  ON CONFLICT DO NOTHING;

END $$;
