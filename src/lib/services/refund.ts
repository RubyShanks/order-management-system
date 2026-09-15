import { createAdminClient } from '@/lib/supabase/admin';
import { stripe } from '@/lib/stripe/client';

export async function initiateRefund(orderId: string, adminId: string) {
  const adminClient = createAdminClient();

  // 1. Fetch order, verify status = 'paid'
  const { data: order, error: orderError } = await adminClient
    .from('orders')
    .select('status, stripe_payment_intent_id')
    .eq('id', orderId)
    .single();

  if (orderError || !order) {
    throw new Error(`Failed to fetch order ${orderId}`);
  }

  if (order.status !== 'paid') {
    throw new Error('Order must be in paid status to be refunded');
  }

  if (!order.stripe_payment_intent_id) {
    throw new Error('Order missing stripe_payment_intent_id');
  }

  // 2. Check no existing pending/succeeded refund_request for this order
  const { data: existingRefunds, error: refundsError } = await adminClient
    .from('refund_requests')
    .select('id')
    .eq('order_id', orderId)
    .in('status', ['pending', 'succeeded']);

  if (refundsError) {
    throw new Error('Failed to check existing refund requests');
  }

  if (existingRefunds && existingRefunds.length > 0) {
    throw new Error('A refund is already pending or succeeded for this order');
  }

  // 3. Generate deterministic idempotency_key (not timestamp-based, to prevent
  // duplicate refunds if a network timeout occurs and admin retries)
  const idempotencyKey = `refund_${orderId}`;

  // 4. Insert refund_request with status='pending'
  const { data: refundRequest, error: insertError } = await adminClient
    .from('refund_requests')
    .insert({
      order_id: orderId,
      idempotency_key: idempotencyKey,
      admin_id: adminId,
      status: 'pending'
    })
    .select()
    .single();

  if (insertError || !refundRequest) {
    throw new Error('Failed to create refund_request record');
  }

  // 5. Call Stripe to create refund
  try {
    const refund = await stripe.refunds.create(
      { payment_intent: order.stripe_payment_intent_id },
      { idempotencyKey }
    );

    // 6. On success -> update refund_request with stripe_refund_id
    await adminClient
      .from('refund_requests')
      .update({ stripe_refund_id: refund.id })
      .eq('id', refundRequest.id);

  } catch (stripeError: unknown) {
    console.error('Stripe refund failed:', stripeError);
    // 7. On Stripe error -> update refund_request status to 'failed'
    await adminClient
      .from('refund_requests')
      .update({ status: 'failed' })
      .eq('id', refundRequest.id);
      
    const message = stripeError instanceof Error ? stripeError.message : 'Unknown error';
    throw new Error(`Refund failed: ${message}`);
  }

  return refundRequest;
}
