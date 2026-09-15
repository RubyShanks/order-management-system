/**
 * Stripe configuration constants.
 * All monetary amounts are in minor units (cents).
 */

/** The currency used for all transactions (ISO 4217 lowercase) */
export const STRIPE_CURRENCY = 'usd';

/** Checkout session expiry in seconds (30 minutes) */
export const CHECKOUT_SESSION_EXPIRY_SECONDS = 30 * 60;

/** Card-only payment method types */
export const PAYMENT_METHOD_TYPES = ['card'] as const;

/** Get the app URL for Stripe redirect URLs */
export function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}

/** Build success URL for Stripe Checkout */
export function getCheckoutSuccessUrl(orderId: string): string {
  return `${getAppUrl()}/checkout/return?order_id=${orderId}&status=success`;
}

/** Build cancel URL for Stripe Checkout */
export function getCheckoutCancelUrl(orderId: string): string {
  return `${getAppUrl()}/checkout/return?order_id=${orderId}&status=cancelled`;
}
