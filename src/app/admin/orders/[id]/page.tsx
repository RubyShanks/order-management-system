import { createServerSupabaseClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatPrice, formatDate, getStatusColor } from '@/lib/utils/format'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { OrderActions } from './OrderActions'

export default async function OrderDetailsPage({ params }: { params: { id: string } }) {
  const supabase = await createServerSupabaseClient()
  
  const { data: order, error } = await supabase
    .from('orders')
    .select(`
      *,
      order_items(
        *,
        products(name, sku)
      ),
      order_status_history(*),
      refund_requests(*)
    `)
    .eq('id', params.id)
    .single()

  if (error || !order) {
    notFound()
  }

  const pendingRefund = order.refund_requests?.find((r: { status: string }) => r.status === 'pending')
  const activeOrSucceededRefund = pendingRefund || order.refund_requests?.find((r: { status: string }) => r.status === 'succeeded')

  const canFulfill = order.status === 'paid' && !pendingRefund
  const canRefund = order.status === 'paid' && !activeOrSucceededRefund

  // Sort history newest first
  const history = [...(order.order_status_history || [])].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            Order <span className="font-mono text-xl text-muted-foreground">{order.id}</span>
          </h1>
          <p className="text-muted-foreground mt-1">
            Placed on {formatDate(order.created_at)}
          </p>
        </div>
        <Badge variant="outline" className={`text-base px-3 py-1 ${getStatusColor(order.status)}`}>
          {order.status.replace('_', ' ').toUpperCase()}
        </Badge>
      </div>

      {pendingRefund && (
        <Alert className="border-yellow-500 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400">
          <AlertCircle className="h-4 w-4" color="currentColor" />
          <AlertTitle>Refund in progress</AlertTitle>
          <AlertDescription>
            A refund has been initiated and is currently pending. Order actions are disabled.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Order Items</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.order_items?.map((item: { id: string, name_snapshot: string, sku_snapshot: string, unit_price_snapshot: number, quantity: number }) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name_snapshot}</TableCell>
                      <TableCell>{item.sku_snapshot}</TableCell>
                      <TableCell className="text-right">{formatPrice(item.unit_price_snapshot)}</TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">{formatPrice(item.unit_price_snapshot * item.quantity)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="mt-4 flex justify-end">
                <div className="text-xl font-bold">
                  Total: {formatPrice(order.total_amount)}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Status History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {history.map((h: { id: string, new_status: string, created_at: string, description: string | null }, idx: number) => (
                  <div key={h.id} className="flex gap-4 relative">
                    {idx !== history.length - 1 && (
                      <div className="absolute top-6 left-[11px] bottom-[-16px] w-0.5 bg-border"></div>
                    )}
                    <div className="mt-1 h-6 w-6 rounded-full border-2 border-primary bg-background z-10 flex-shrink-0"></div>
                    <div>
                      <div className="font-medium capitalize">{h.new_status.replace('_', ' ')}</div>
                      <div className="text-sm text-muted-foreground">{formatDate(h.created_at)}</div>
                      {h.description && <div className="text-sm mt-1">{h.description}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Customer Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <div className="text-sm font-medium text-muted-foreground">Email</div>
                <div>{order.email_snapshot}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">Customer ID</div>
                <div className="text-sm font-mono truncate">{order.customer_id}</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payment Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <div className="text-sm font-medium text-muted-foreground">Stripe Session ID</div>
                <div className="text-sm font-mono truncate" title={order.stripe_session_id || 'N/A'}>
                  {order.stripe_session_id || 'N/A'}
                </div>
              </div>
              {order.stripe_payment_intent_id && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Payment Intent ID</div>
                  <div className="text-sm font-mono truncate" title={order.stripe_payment_intent_id}>
                    {order.stripe_payment_intent_id}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <OrderActions 
                orderId={order.id} 
                canFulfill={canFulfill} 
                canRefund={canRefund} 
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
