import React from 'react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatPrice, formatDate, formatOrderId, getStatusColor } from '@/lib/utils/format';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Package,
  AlertTriangle,
  RotateCcw,
  MapPin,
} from 'lucide-react';

interface OrderDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export const dynamic = 'force-dynamic';

export default async function CustomerOrderDetailPage({ params }: OrderDetailPageProps) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirect=/account/orders/${id}`);
  }

  // Fetch the order and verify customer ownership
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (orderError || !order || order.customer_id !== user.id) {
    notFound();
  }

  // Fetch order items snapshots
  const { data: orderItems } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', id)
    .order('name_snapshot');

  // Fetch customer-visible status history
  const { data: statusHistory } = await supabase
    .from('order_status_history')
    .select('*')
    .eq('order_id', id)
    .eq('is_customer_visible', true)
    .order('created_at', { ascending: true });

  // Check if there is an active/pending refund request
  let isRefundProcessing = false;
  try {
    const { data: refundRequests } = await supabase
      .from('refund_requests')
      .select('status')
      .eq('order_id', id)
      .eq('status', 'pending');

    isRefundProcessing = Boolean(refundRequests && refundRequests.length > 0);
  } catch {
    // If customer RLS denies direct select on refund_requests, fallback safely
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div>
        <Button variant="ghost" size="sm" asChild className="gap-2">
          <Link href="/account/orders">
            <ArrowLeft className="h-4 w-4" />
            Back to Orders
          </Link>
        </Button>
      </div>

      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Order #{formatOrderId(order.id)}
            </h1>
            <Badge
              variant="outline"
              className={`font-semibold capitalize text-xs ${getStatusColor(order.status)}`}
            >
              {order.status.replace('_', ' ')}
            </Badge>

            {/* Refund pending indicator */}
            {order.status === 'paid' && isRefundProcessing && (
              <Badge
                variant="secondary"
                className="bg-amber-100 text-amber-900 border-amber-300 font-semibold text-xs flex items-center gap-1 animate-pulse"
              >
                <RotateCcw className="w-3 h-3" />
                Refund Processing
              </Badge>
            )}
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5" />
            Placed on {formatDate(order.created_at)}
          </p>
        </div>

        <div className="text-left sm:text-right">
          <span className="text-xs text-muted-foreground">Total Amount</span>
          <p className="text-2xl font-bold text-foreground">
            {formatPrice(order.total_amount, order.currency)}
          </p>
        </div>
      </div>

      {/* Refund processing banner */}
      {order.status === 'paid' && isRefundProcessing && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-600 mt-0.5" />
            <div className="text-sm space-y-1">
              <p className="font-semibold">Refund In Progress</p>
              <p className="text-xs text-amber-800 dark:text-amber-300">
                A refund has been initiated by our customer care team. The status will update once Stripe completes the refund transfer.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Items Table Card */}
      <Card>
        <CardHeader className="border-b pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Items in this Order
          </CardTitle>
          <CardDescription>
            Authoritative snapshots preserved from time of purchase
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product Name</TableHead>
                <TableHead className="w-[120px]">SKU</TableHead>
                <TableHead className="text-right w-[100px]">Unit Price</TableHead>
                <TableHead className="text-center w-[80px]">Quantity</TableHead>
                <TableHead className="text-right w-[120px]">Subtotal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orderItems && orderItems.length > 0 ? (
                orderItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium text-foreground">
                      {item.name_snapshot}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {item.sku_snapshot}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatPrice(item.unit_price_snapshot)}
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      {item.quantity}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-foreground">
                      {formatPrice(item.unit_price_snapshot * item.quantity)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                    No items recorded for this order.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* Totals Breakdown */}
          <div className="border-t p-4 sm:p-6 bg-muted/20">
            <div className="max-w-xs ml-auto space-y-2 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>{formatPrice(order.total_amount, order.currency)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Shipping</span>
                <span className="text-green-600 font-medium">Free</span>
              </div>
              <Separator />
              <div className="flex justify-between text-base font-bold text-foreground">
                <span>Total</span>
                <span>{formatPrice(order.total_amount, order.currency)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delivery Destination (if captured) */}
      {order.shipping_address && (
        <Card>
          <CardHeader className="border-b pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Delivery Destination
            </CardTitle>
            <CardDescription>
              Shipping address provided for this order
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="text-sm space-y-1">
              {order.shipping_address.name && (
                <div className="font-semibold text-foreground text-base mb-1">
                  {order.shipping_address.name}
                </div>
              )}
              {order.shipping_address.address?.line1 && (
                <div>{order.shipping_address.address.line1}</div>
              )}
              {order.shipping_address.address?.line2 && (
                <div className="text-muted-foreground">{order.shipping_address.address.line2}</div>
              )}
              <div>
                {[
                  order.shipping_address.address?.city,
                  order.shipping_address.address?.state,
                  order.shipping_address.address?.postal_code,
                ]
                  .filter(Boolean)
                  .join(', ')}
              </div>
              {order.shipping_address.address?.country && (
                <div className="font-medium text-muted-foreground uppercase text-xs tracking-wider mt-1">
                  {order.shipping_address.address.country}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Order Status History Timeline */}
      <Card>
        <CardHeader className="border-b pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Order Timeline
          </CardTitle>
          <CardDescription>
            Track status updates and milestones for your package
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          {!statusHistory || statusHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No public status history entries available for this order.
            </p>
          ) : (
            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
              {statusHistory.map((entry, index) => {
                const isLatest = index === statusHistory.length - 1;
                return (
                  <div key={entry.id} className="relative group">
                    {/* Bullet marker */}
                    <div
                      className={`absolute -left-6 top-1.5 flex h-5 w-5 items-center justify-center rounded-full border-2 bg-background ${
                        isLatest
                          ? 'border-primary text-primary'
                          : 'border-muted-foreground/40 text-muted-foreground'
                      }`}
                    >
                      <div
                        className={`h-2 w-2 rounded-full ${
                          isLatest ? 'bg-primary' : 'bg-muted-foreground/60'
                        }`}
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant="outline"
                          className={`text-[11px] font-semibold capitalize ${getStatusColor(
                            entry.new_status
                          )}`}
                        >
                          {entry.new_status.replace('_', ' ')}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(entry.created_at)}
                        </span>
                      </div>
                      <p className="text-sm text-foreground/90 font-medium">
                        {entry.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
