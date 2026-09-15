import { createAdminClient } from '@/lib/supabase/admin';
import { stripe } from '@/lib/stripe/client';

export async function handlePaymentFailure(orderId: string, eventId: string) {
  const adminClient = createAdminClient();

  // 1. Check order is still pending_payment
  const { data: order, error: orderError } = await adminClient
    .from('orders')
    .select('status, stripe_session_id')
    .eq('id', orderId)
    .single();

  if (orderError) {
    console.error(`Failed to fetch order ${orderId}:`, orderError);
    return;
  }

  if (order.status !== 'pending_payment') {
    return; // Already handled
  }

  // 2. Update integration_state to 'cancellation_pending'
  const { error: updateError } = await adminClient
    .from('orders')
    .update({ integration_state: 'cancellation_pending' })
    .eq('id', orderId);

  if (updateError) {
    console.error(`Failed to update order ${orderId} state:`, updateError);
    return;
  }

  // 3. Outside DB transaction: Try to expire the Stripe Checkout Session
  if (order.stripe_session_id) {
    try {
      await stripe.checkout.sessions.expire(order.stripe_session_id);
    } catch (err: unknown) {
      const error = err as { code?: string, message?: string };
      // If session already completed, don't cancel, success webhook will handle it
      if (error?.code === 'resource_missing' || error?.message?.includes('completed')) {
        return; 
      }
      
      // If can't expire for another reason, mark recovery_needed
      console.error(`Failed to expire session ${order.stripe_session_id}:`, err);
      await adminClient
        .from('orders')
        .update({ integration_state: 'recovery_needed' })
        .eq('id', orderId);
      return;
    }
  }

  // 4. Call process_cancellation RPC
  const { error: cancelError } = await adminClient.rpc('process_cancellation', {
    p_order_id: orderId,
    p_event_id: eventId,
    p_reason: 'Payment failed'
  });

  if (cancelError) {
    console.error(`Failed to cancel order ${orderId}:`, cancelError);
  }
}
