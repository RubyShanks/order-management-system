'use server';

import { createCheckoutSession } from './checkout';
import { checkoutRequestSchema, CheckoutRequest } from '@/lib/validation';

export interface CheckoutActionResult {
  success: boolean;
  url?: string;
  order_id?: string;
  error?: string;
}

/**
 * Server action to initiate checkout with stock reservation and Stripe session creation.
 */
export async function processCheckoutAction(input: CheckoutRequest): Promise<CheckoutActionResult> {
  try {
    const validated = checkoutRequestSchema.parse(input);
    const result = await createCheckoutSession(validated);
    return {
      success: true,
      url: result.url,
      order_id: result.order_id,
    };
  } catch (err: unknown) {
    console.error('Checkout action error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'An unexpected error occurred during checkout',
    };
  }
}
