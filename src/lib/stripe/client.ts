import Stripe from 'stripe';

/**
 * Server-only Stripe client.
 * Never import this module in client components.
 */
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  apiVersion: '2026-08-26.dahlia' as any,
  typescript: true,
});
