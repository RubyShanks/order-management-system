// This service handles the two-phase order creation:
// Phase 1 (DB): Create order with atomic stock reservation via DB function
// Phase 2 (Stripe): Create Checkout Session from saved order snapshots

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  stripe,
  STRIPE_CURRENCY,
  CHECKOUT_SESSION_EXPIRY_SECONDS,
  PAYMENT_METHOD_TYPES,
  getCheckoutSuccessUrl,
  getCheckoutCancelUrl,
} from '@/lib/stripe';
import { CheckoutRequest } from '@/lib/validation';
import crypto from 'crypto';
import Stripe from 'stripe';

export interface CreateCheckoutSessionResult {
  url: string;
  order_id: string;
}

/**
 * Checks whether an error from Stripe represents a network/connection timeout.
 */
function isStripeTimeout(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: string; type?: string; name?: string; message?: string };
  return (
    e.code === 'ETIMEDOUT' ||
    e.code === 'ECONNRESET' ||
    e.type === 'StripeConnectionError' ||
    e.name === 'StripeConnectionError' ||
    Boolean(e.message && /timeout|network|socket/i.test(e.message))
  );
}

/**
 * Creates an order with atomic stock reservation and initiates a Stripe Checkout Session.
 * Follows Rule 1: Never hold DB locks while calling Stripe.
 * Follows Rule 8: If retrying after cancellation, a new order is started.
 * Follows Rule 7: Line items are built authoritatively from DB snapshots, not client data.
 */
export async function createCheckoutSession(
  input: CheckoutRequest
): Promise<CreateCheckoutSessionResult> {
  // 1. Get the current user from Supabase auth (throw if not authenticated)
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user || !user.email) {
    throw new Error('Unauthorized: User must be authenticated with a valid email to checkout');
  }

  // 2. Generate a cart_fingerprint by hashing sorted cart items (for idempotency)
  const sortedItems = [...input.items].sort((a, b) => a.product_id.localeCompare(b.product_id));
  const cartFingerprint = crypto
    .createHash('sha256')
    .update(JSON.stringify(sortedItems))
    .digest('hex');

  // 3. Call the create_order_with_reservation DB function via RPC
  const { data: orderResult, error: rpcError } = await supabase.rpc(
    'create_order_with_reservation',
    {
      p_customer_id: user.id,
      p_email: user.email,
      p_checkout_request_key: input.checkout_request_key,
      p_cart_fingerprint: cartFingerprint,
      p_items: sortedItems.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
      })),
    }
  );

  if (rpcError || !orderResult) {
    console.error('Failed to create order with reservation:', rpcError);
    throw new Error(rpcError?.message || 'Failed to create order reservation');
  }

  const orderId = orderResult.order_id;

  // 4. If is_existing=true and order already has a stripe_session_id with non-expired session, return that URL
  if (orderResult.is_existing) {
    const { data: existingOrder } = await supabase
      .from('orders')
      .select('id, stripe_session_id, session_expires_at, status, integration_state')
      .eq('id', orderId)
      .single();

    if (existingOrder?.stripe_session_id) {
      try {
        const existingSession = await stripe.checkout.sessions.retrieve(
          existingOrder.stripe_session_id
        );
        const nowSec = Math.floor(Date.now() / 1000);
        const isNotExpired =
          existingSession.status === 'open' &&
          typeof existingSession.expires_at === 'number' &&
          existingSession.expires_at > nowSec;

        if (isNotExpired && existingSession.url) {
          return {
            url: existingSession.url,
            order_id: orderId,
          };
        }
      } catch (retrieveErr) {
        console.warn('Failed to retrieve existing Stripe session, will create new session:', retrieveErr);
      }
    }
  }

  // 5. Build Stripe Checkout Session:
  // Fetch order items from DB to build line_items (use saved snapshots, NOT client data)
  const { data: orderItems, error: itemsError } = await supabase
    .from('order_items')
    .select('product_id, sku_snapshot, name_snapshot, unit_price_snapshot, quantity')
    .eq('order_id', orderId);

  if (itemsError || !orderItems || orderItems.length === 0) {
    console.error('Order items not found for order:', orderId, itemsError);
    throw new Error('Order items could not be retrieved from database');
  }

  const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = orderItems.map((item) => ({
    price_data: {
      currency: STRIPE_CURRENCY,
      product_data: {
        name: item.name_snapshot,
        metadata: {
          product_id: item.product_id,
          sku: item.sku_snapshot,
        },
      },
      unit_amount: item.unit_price_snapshot, // integer minor units (cents)
    },
    quantity: item.quantity,
  }));

  const expiresAtSec = Math.floor(Date.now() / 1000) + CHECKOUT_SESSION_EXPIRY_SECONDS;
  const idempotencyKey = `checkout_${input.checkout_request_key}_${user.id}`;

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    payment_method_types: [...PAYMENT_METHOD_TYPES],
    mode: 'payment',
    expires_at: expiresAtSec,
    success_url: getCheckoutSuccessUrl(orderId),
    cancel_url: getCheckoutCancelUrl(orderId),
    customer_email: user.email,
    line_items,
    metadata: {
      order_id: orderId,
    },
    payment_intent_data: {
      metadata: {
        order_id: orderId,
      },
    },
    shipping_address_collection: {
      allowed_countries: ['US', 'CA', 'GB', 'IN', 'AU', 'DE', 'FR'],
    },
    billing_address_collection: 'auto',
  };

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.create(sessionParams, {
      idempotencyKey,
    });
  } catch (stripeError: unknown) {
    console.error('Stripe Checkout Session creation failed:', stripeError);
    const adminClient = createAdminClient();

    if (isStripeTimeout(stripeError)) {
      // If Stripe times out → update order integration_state to 'recovery_needed'
      await adminClient
        .from('orders')
        .update({ integration_state: 'recovery_needed' })
        .eq('id', orderId);

      throw new Error(
        'Payment gateway timed out. Your order reservation is held, please try again or check your orders.'
      );
    } else {
      // If Stripe throws a definitive error → cancel order via admin client RPC call to process_cancellation
      try {
        await adminClient.rpc('process_cancellation', {
          p_order_id: orderId,
          p_event_id: null,
          p_reason: `Stripe session creation error: ${(stripeError as Error)?.message || 'Unknown error'}`,
        });
      } catch (cancelErr) {
        console.error('Failed to cancel order after definitive Stripe error:', cancelErr);
      }

      throw new Error('Unable to start payment session. Order has been cancelled and items released.');
    }
  }

  if (!session.url) {
    throw new Error('Stripe Checkout Session created without a redirect URL');
  }

  // 6. Update order with stripe_session_id, stripe_payment_intent_id (from session.payment_intent), session_expires_at, integration_state='session_created'
  const paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id || null;

  try {
    const adminClient = createAdminClient();
    const { error: updateError } = await adminClient
      .from('orders')
      .update({
        stripe_session_id: session.id,
        stripe_payment_intent_id: paymentIntentId,
        session_expires_at: new Date(session.expires_at * 1000).toISOString(),
        integration_state: 'session_created',
      })
      .eq('id', orderId);

    if (updateError) {
      // CRITICAL: We must persist the session reference. Without it, the recovery
      // endpoint cannot find the session and may cancel the order while the user
      // is paying, causing a charge with no corresponding order.
      console.error('Failed to persist Stripe session references to order:', updateError);
      throw new Error(
        'Payment session was created but we could not save its reference. ' +
        'Please contact support with your order ID: ' + orderId
      );
    }
  } catch (dbUpdateErr) {
    // Re-throw if it's our own error from above
    if (dbUpdateErr instanceof Error && dbUpdateErr.message.includes('Payment session was created')) {
      throw dbUpdateErr;
    }
    console.error('Failed to persist Stripe session references to order (exception):', dbUpdateErr);
    throw new Error(
      'Payment session was created but we could not save its reference. ' +
      'Please contact support with your order ID: ' + orderId
    );
  }

  // 7. Return { url: session.url, order_id: orderId }
  return {
    url: session.url,
    order_id: orderId,
  };
}
