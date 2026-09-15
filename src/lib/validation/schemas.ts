import { z } from 'zod';

const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
export const uuidSchema = (message: string = 'Invalid ID') =>
  z.string().regex(uuidRegex, message);

// ============================================================
// Cart & Checkout Validation
// ============================================================

export const cartItemSchema = z.object({
  product_id: uuidSchema('Invalid product ID'),
  quantity: z.number().int().positive('Quantity must be a positive integer').max(99, 'Maximum 99 per item'),
});

export const checkoutRequestSchema = z.object({
  items: z
    .array(cartItemSchema)
    .min(1, 'Cart cannot be empty')
    .max(50, 'Maximum 50 different items per order'),
  checkout_request_key: z
    .string()
    .min(1, 'Checkout request key is required')
    .max(255, 'Checkout request key too long'),
});

export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>;

// ============================================================
// Product Validation (Admin)
// ============================================================

export const createProductSchema = z.object({
  sku: z
    .string()
    .min(1, 'SKU is required')
    .max(50, 'SKU too long')
    .regex(/^[A-Za-z0-9-_]+$/, 'SKU can only contain letters, numbers, hyphens, and underscores'),
  name: z.string().min(1, 'Product name is required').max(200, 'Product name too long'),
  description: z.string().max(2000, 'Description too long').nullable().optional(),
  price_amount: z
    .number()
    .int('Price must be in whole cents')
    .nonnegative('Price cannot be negative')
    .max(99999999, 'Price exceeds maximum'), // Max ~$999,999.99
  is_active: z.boolean().optional().default(true),
});

export const updateProductSchema = createProductSchema.partial().extend({
  id: uuidSchema('Invalid product ID'),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

// ============================================================
// Stock Adjustment Validation (Admin)
// ============================================================

export const stockAdjustmentSchema = z.object({
  product_id: uuidSchema('Invalid product ID'),
  on_hand_delta: z.number().int('Stock adjustment must be a whole number'),
  reason: z
    .string()
    .min(1, 'Reason is required for stock adjustments')
    .max(500, 'Reason too long'),
});

export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;

// ============================================================
// Order Action Validation (Admin)
// ============================================================

export const fulfillOrderSchema = z.object({
  order_id: uuidSchema('Invalid order ID'),
});

export const refundOrderSchema = z.object({
  order_id: uuidSchema('Invalid order ID'),
});

export type FulfillOrderInput = z.infer<typeof fulfillOrderSchema>;
export type RefundOrderInput = z.infer<typeof refundOrderSchema>;

// ============================================================
// Auth Validation
// ============================================================

export const signUpSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password too long'),
  display_name: z.string().min(1, 'Display name is required').max(100, 'Display name too long'),
});

export const signInSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const resetPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

// ============================================================
// Pagination
// ============================================================

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  per_page: z.coerce.number().int().positive().max(100).default(20),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

// ============================================================
// Search / Filter
// ============================================================

export const orderFilterSchema = z.object({
  status: z.enum(['pending_payment', 'paid', 'fulfilled', 'refunded', 'cancelled']).optional(),
  search: z.string().max(200).optional(), // order ID or customer email
  page: z.coerce.number().int().positive().default(1),
  per_page: z.coerce.number().int().positive().max(100).default(20),
});

export type OrderFilterInput = z.infer<typeof orderFilterSchema>;
