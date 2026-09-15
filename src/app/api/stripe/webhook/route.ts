import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe/client';
import { createAdminClient } from '@/lib/supabase/admin';
import { Json } from '@/lib/supabase/types';
import Stripe from 'stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let event: Stripe.Event;

  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
    }

    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error('Webhook signature verification failed.', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const adminClient = createAdminClient();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const orderId = session.metadata?.order_id;
        
        if (!orderId) {
          throw new Error('No order_id in session metadata');
        }

        if (session.payment_status === 'paid') {
          const { error } = await adminClient.rpc('process_payment_success', {
            p_order_id: orderId,
            p_event_id: event.id,
            p_payment_intent_id: session.payment_intent as string,
            p_amount: session.amount_total ?? 0,
            p_currency: session.currency ?? 'usd'
          });
          
          if (error) throw error;

          // Capture shipping address if provided by customer in Stripe Checkout
          const sessionWithShipping = session as unknown as { shipping_details?: Record<string, unknown> | null };
          if (sessionWithShipping.shipping_details) {
            const { error: shippingError } = await adminClient
              .from('orders')
              .update({ shipping_address: sessionWithShipping.shipping_details as unknown as Json })
              .eq('id', orderId);

            if (shippingError) {
              console.error(`Failed to update shipping address for order ${orderId}:`, shippingError);
            }
          }
        }
        break;
      }
      
      case 'payment_intent.payment_failed': {
        // NOTE: We intentionally do NOT cancel the order here.
        // Stripe Checkout keeps the session open after a card failure,
        // allowing the customer to retry with a different card.
        // Cancelling the order on first failure would cause subsequent
        // successful payments to be rejected (order already cancelled).
        // Rely solely on checkout.session.expired for cancellation.
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const failedOrderId = paymentIntent.metadata?.order_id;
        console.log(
          `Payment attempt failed for order ${failedOrderId}. ` +
          `Session remains open for retry. No action taken.`
        );
        break;
      }
      
      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session;
        const orderId = session.metadata?.order_id;
        
        if (!orderId) {
          throw new Error('No order_id in session metadata');
        }
        
        const { error } = await adminClient.rpc('process_cancellation', {
          p_order_id: orderId,
          p_event_id: event.id,
          p_reason: 'Checkout session expired'
        });
        
        if (error) throw error;
        break;
      }
      
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        // Verify it's a full refund
        if (charge.amount_refunded === charge.amount) {
          let orderId = charge.metadata?.order_id;
          
          if (!orderId && charge.payment_intent) {
            // Need to fetch payment intent to get metadata
            const pi = await stripe.paymentIntents.retrieve(charge.payment_intent as string);
            orderId = pi.metadata?.order_id;
          }
          
          if (!orderId) {
            throw new Error('No order_id in charge or payment_intent metadata');
          }
          
          const { error } = await adminClient.rpc('process_refund_success', {
            p_order_id: orderId,
            p_event_id: event.id,
            p_refund_id: (charge.refunds?.data[0]?.id || '') as string
          });
          if (error) throw error;
        }
        break;
      }
      
      default:
        // Unhandled event type
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error(`Error processing webhook event ${event.type}:`, err);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}
