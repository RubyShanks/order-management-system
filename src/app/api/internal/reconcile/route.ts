import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { stripe } from '@/lib/stripe/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  // Check authorization
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = authHeader.split(' ')[1];
  if (token !== process.env.RECOVERY_API_KEY) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const adminClient = createAdminClient();
  const summary = {
    uncertain_sessions_processed: 0,
    overdue_pending_processed: 0,
    cancellation_pending_processed: 0,
    dangling_refunds_processed: 0,
    errors: [] as string[]
  };

  try {
    // 1. Uncertain sessions: older than 5 minutes
    const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    const { data: uncertainOrders, error: uncertainError } = await adminClient
      .from('orders')
      .select('*')
      .in('integration_state', ['recovery_needed', 'awaiting_session'])
      .lt('created_at', fiveMinsAgo)
      .eq('status', 'pending_payment');

    if (uncertainError) throw uncertainError;

    if (uncertainOrders) {
      for (const order of uncertainOrders) {
        summary.uncertain_sessions_processed++;
        let sessionFound = false;
        
        if (order.stripe_session_id) {
          try {
            const session = await stripe.checkout.sessions.retrieve(order.stripe_session_id);
            if (session.payment_status === 'paid') {
              // Wait for webhook or manual if paid
              sessionFound = true;
            } else if (session.status === 'expired') {
               await adminClient.rpc('process_cancellation', {
                p_order_id: order.id,
                p_event_id: null,
                p_reason: 'Recovery API: Session expired'
              });
              sessionFound = true;
            }
          } catch {
            // Error retrieving session, could be missing
          }
        }
        
        if (!sessionFound) {
           await adminClient.rpc('process_cancellation', {
            p_order_id: order.id,
            p_event_id: null,
            p_reason: 'Recovery API: Uncertain session cancelled'
          });
        }
      }
    }

    // 2. Overdue pending: session_expires_at < NOW() - 5 mins
    const { data: overdueOrders, error: overdueError } = await adminClient
      .from('orders')
      .select('*')
      .eq('status', 'pending_payment')
      .lt('session_expires_at', fiveMinsAgo);

    if (overdueError) throw overdueError;

    if (overdueOrders) {
      for (const order of overdueOrders) {
        summary.overdue_pending_processed++;
        let isPaid = false;
        
        if (order.stripe_session_id) {
          try {
            const session = await stripe.checkout.sessions.retrieve(order.stripe_session_id);
            if (session.payment_status === 'paid') {
              isPaid = true;
              summary.errors.push(`Warning: Order ${order.id} is paid in Stripe but pending_payment in DB.`);
            }
          } catch {
             // Ignored
          }
        }
        
        if (!isPaid) {
          await adminClient.rpc('process_cancellation', {
            p_order_id: order.id,
            p_event_id: null,
            p_reason: 'Recovery API: Session overdue'
          });
        }
      }
    }

    // 3. Cancellation pending
    const { data: cancellationPendingOrders, error: cPendingError } = await adminClient
      .from('orders')
      .select('*')
      .eq('integration_state', 'cancellation_pending');

    if (cPendingError) throw cPendingError;

    if (cancellationPendingOrders) {
      for (const order of cancellationPendingOrders) {
        summary.cancellation_pending_processed++;
        
        if (order.stripe_session_id) {
          try {
            await stripe.checkout.sessions.expire(order.stripe_session_id);
          } catch {
             // Ignored if already completed or expired
          }
        }
        
        await adminClient.rpc('process_cancellation', {
          p_order_id: order.id,
          p_event_id: null,
          p_reason: 'Recovery API: Retrying cancellation'
        });
      }
    }

    // 4. Dangling refunds: pending and updated_at < NOW() - 10 mins
    const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: danglingRefunds, error: refundsError } = await adminClient
      .from('refund_requests')
      .select('*')
      .eq('status', 'pending')
      .lt('updated_at', tenMinsAgo);

    if (refundsError) throw refundsError;

    if (danglingRefunds) {
      for (const refund of danglingRefunds) {
        summary.dangling_refunds_processed++;
        
        if (refund.stripe_refund_id) {
          try {
            const stripeRefund = await stripe.refunds.retrieve(refund.stripe_refund_id);
            if (stripeRefund.status === 'succeeded') {
              await adminClient.rpc('process_refund_success', {
                p_order_id: refund.order_id,
                p_event_id: null,
                p_refund_id: stripeRefund.id
              });
            } else if (stripeRefund.status === 'failed') {
               await adminClient
                .from('refund_requests')
                .update({ status: 'failed' })
                .eq('id', refund.id);
            }
          } catch {
             // Ignored
          }
        }
      }
    }

    return NextResponse.json({ success: true, summary });
  } catch (error: unknown) {
    console.error('Reconciliation API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
