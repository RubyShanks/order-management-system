import React from 'react';
import Link from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { formatPrice, formatDate, formatOrderId, getStatusColor } from '@/lib/utils/format';
import { CheckCircle2, Clock, XCircle, ArrowRight, RotateCw, ShoppingBag, Package } from 'lucide-react';
import { ReturnRefresher } from './ReturnRefresher';

interface CheckoutReturnPageProps {
  searchParams: Promise<{
    order_id?: string;
    status?: string;
  }>;
}

export const dynamic = 'force-dynamic';

export default async function CheckoutReturnPage({ searchParams }: CheckoutReturnPageProps) {
  const { order_id, status: urlStatus } = await searchParams;

  if (!order_id) {
    return (
      <div className="container mx-auto px-4 py-16 text-center max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle>Order Not Found</CardTitle>
            <CardDescription>
              No order identifier was provided in the return URL.
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Button asChild>
              <Link href="/">Return to Catalog</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const supabase = await createServerSupabaseClient();

  // Fetch the order from the database
  const { data: order, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('id', order_id)
    .maybeSingle();

  if (error || !order) {
    return (
      <div className="container mx-auto px-4 py-16 text-center max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle>Order Information Unavailable</CardTitle>
            <CardDescription>
              We could not find the order details for reference {formatOrderId(order_id)}.
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center gap-3">
            <Button variant="outline" asChild>
              <Link href="/account/orders">My Orders</Link>
            </Button>
            <Button asChild>
              <Link href="/">Back to Shop</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const isPaid = order.status === 'paid' || order.status === 'fulfilled';
  const isPending = order.status === 'pending_payment';
  const isCancelled = order.status === 'cancelled' || urlStatus === 'cancel';

  return (
    <div className="container mx-auto px-4 py-12 max-w-2xl sm:px-6">
      {/* Auto-refresh if payment is still pending webhook confirmation */}
      {isPending && <ReturnRefresher />}

      <Card className="overflow-hidden border-2 shadow-sm">
        {/* Status Header */}
        <div className="p-6 text-center sm:p-8">
          {isPaid ? (
            <div className="flex flex-col items-center space-y-3">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Payment Successful!
              </h1>
              <p className="text-sm text-muted-foreground max-w-md">
                Thank you for your order. We have received your payment and are preparing your shipment.
              </p>
            </div>
          ) : isPending ? (
            <div className="flex flex-col items-center space-y-3">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100 text-yellow-600 animate-pulse">
                <Clock className="h-10 w-10" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Payment Processing
              </h1>
              <p className="text-sm text-muted-foreground max-w-md">
                We are waiting for final confirmation from the payment processor. This page will refresh automatically.
              </p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                <RotateCw className="h-3.5 w-3.5 animate-spin" />
                <span>Checking status every 3 seconds...</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-3">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600">
                <XCircle className="h-10 w-10" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Payment Not Completed
              </h1>
              <p className="text-sm text-muted-foreground max-w-md">
                The payment session was cancelled or timed out. Your items have been returned to available inventory.
              </p>
            </div>
          )}
        </div>

        <Separator />

        {/* Order Details Body */}
        <CardContent className="space-y-6 p-6 sm:p-8">
          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <div>
              <span className="text-xs text-muted-foreground">Order ID</span>
              <p className="font-mono font-semibold text-foreground">
                {formatOrderId(order.id)}
              </p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Date Placed</span>
              <p className="font-medium text-foreground">
                {formatDate(order.created_at)}
              </p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Status</span>
              <div>
                <Badge variant="outline" className={`font-semibold capitalize ${getStatusColor(order.status)}`}>
                  {order.status.replace('_', ' ')}
                </Badge>
              </div>
            </div>
          </div>

          <Separator />

          {/* Items List */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Order Items</h3>
            <div className="divide-y rounded-lg border bg-muted/20">
              {order.order_items && order.order_items.length > 0 ? (
                order.order_items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 text-sm">
                    <div className="space-y-0.5">
                      <p className="font-medium text-foreground">{item.name_snapshot}</p>
                      <p className="text-xs text-muted-foreground">
                        Qty: {item.quantity} &times; {formatPrice(item.unit_price_snapshot)}
                      </p>
                    </div>
                    <span className="font-semibold text-foreground">
                      {formatPrice(item.unit_price_snapshot * item.quantity)}
                    </span>
                  </div>
                ))
              ) : (
                <div className="p-3 text-sm text-muted-foreground">No item details available.</div>
              )}
            </div>
          </div>

          {/* Total */}
          <div className="flex justify-between items-center pt-2">
            <span className="text-base font-semibold text-foreground">Total Paid:</span>
            <span className="text-xl font-bold text-foreground">
              {formatPrice(order.total_amount, order.currency)}
            </span>
          </div>
        </CardContent>

        <Separator />

        {/* Card Footer Actions */}
        <CardFooter className="flex flex-col sm:flex-row justify-between gap-3 p-6 bg-muted/30">
          <Button variant="outline" asChild className="w-full sm:w-auto">
            <Link href="/" className="gap-2">
              <ShoppingBag className="h-4 w-4" />
              Continue Shopping
            </Link>
          </Button>

          {isCancelled ? (
            <Button asChild className="w-full sm:w-auto">
              <Link href="/checkout" className="gap-2">
                Try Checkout Again
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          ) : (
            <Button asChild className="w-full sm:w-auto">
              <Link href={`/account/orders/${order.id}`} className="gap-2">
                <Package className="h-4 w-4" />
                View Order in Account
              </Link>
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
