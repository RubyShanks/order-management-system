import { createServerSupabaseClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { InventoryAdjustmentForm } from './InventoryForm'
import { formatDate } from '@/lib/utils/format'

export default async function InventoryPage({ params }: { params: { id: string } }) {
  const supabase = await createServerSupabaseClient()
  
  const { data: product, error: pError } = await supabase
    .from('products')
    .select('id, name, sku')
    .eq('id', params.id)
    .single()

  if (pError || !product) {
    notFound()
  }

  const { data: inventory } = await supabase
    .from('inventory')
    .select('*')
    .eq('product_id', params.id)
    .single()

  const { data: movements } = await supabase
    .from('stock_movements')
    .select('*, order:orders(id)')
    .eq('product_id', params.id)
    .order('created_at', { ascending: false })
    .limit(50)

  const onHand = inventory?.on_hand || 0
  const reserved = inventory?.reserved || 0
  const available = onHand - reserved

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Inventory: {product.name}</h1>
        <p className="text-muted-foreground">SKU: {product.sku}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Available</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{available}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">On Hand</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{onHand}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Reserved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reserved}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Adjust Stock</CardTitle>
        </CardHeader>
        <CardContent>
          <InventoryAdjustmentForm productId={product.id} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Stock Movement History</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>On-Hand Δ</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Actor / Order</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements?.map((mov: { id: string; product_id: string; on_hand_delta: number; reserved_delta: number; reason: string; order_id: string | null; actor_id: string | null; created_at: string; order?: unknown }) => {
                const quantity = mov.on_hand_delta;
                const orderObj = mov.order as { id?: string } | undefined;
                return (
                  <TableRow key={mov.id}>
                    <TableCell>{formatDate(mov.created_at)}</TableCell>
                    <TableCell className={quantity > 0 ? 'text-green-600' : quantity < 0 ? 'text-red-600' : ''}>
                      {quantity > 0 ? '+' : ''}{quantity}
                    </TableCell>
                    <TableCell>{mov.reason}</TableCell>
                    <TableCell>
                      {mov.order_id ? `Order: ${orderObj?.id?.substring(0,8) || mov.order_id.substring(0,8)}` : (mov.actor_id ? 'Admin' : 'System')}
                    </TableCell>
                  </TableRow>
                )
              })}
              {!movements?.length && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-4">No movements found</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
