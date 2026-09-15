import { createServerSupabaseClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatPrice, formatDate, getStatusColor, formatOrderId } from '@/lib/utils/format'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Pagination } from '@/components/admin/Pagination'

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const resolvedParams = await searchParams
  const supabase = await createServerSupabaseClient()
  
  let page = typeof resolvedParams.page === 'string' ? parseInt(resolvedParams.page, 10) : 1
  if (isNaN(page) || page < 1) page = 1
  const limit = 20
  const offset = (page - 1) * limit
  
  const queryParam = typeof resolvedParams.q === 'string' ? resolvedParams.q : ''
  const statusParam = typeof resolvedParams.status === 'string' ? resolvedParams.status : 'all'

  let query = supabase
    .from('orders')
    .select('id, customer_id, email_snapshot, status, total_amount, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (statusParam && statusParam !== 'all') {
    query = query.eq('status', statusParam as 'pending_payment' | 'paid' | 'fulfilled' | 'cancelled' | 'refunded')
  }

  // Sanitize to prevent PostgREST comma and parenthesis injection
  const safeQueryParam = queryParam.replace(/[,()]/g, '')
  if (safeQueryParam) {
    query = query.or(`id.ilike.%${safeQueryParam}%,email_snapshot.ilike.%${safeQueryParam}%`)
  }

  const { data: orders, count } = await query

  const totalPages = count ? Math.ceil(count / limit) : 0

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Orders</h1>

      <div className="flex flex-col sm:flex-row gap-4 items-end">
        <form className="flex-1 flex gap-4" method="GET" action="/admin/orders">
          <div className="flex-1 space-y-1">
            <label className="text-sm font-medium">Search</label>
            <Input 
              name="q" 
              defaultValue={queryParam} 
              placeholder="Order ID or Email..." 
            />
          </div>
          <div className="w-48 space-y-1">
            <label className="text-sm font-medium">Status</label>
            <select 
              name="status" 
              defaultValue={statusParam}
              className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="all">All Statuses</option>
              <option value="pending_payment">Pending Payment</option>
              <option value="paid">Paid</option>
              <option value="fulfilled">Fulfilled</option>
              <option value="refunded">Refunded</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div className="pb-[2px]">
            <Button type="submit">Filter</Button>
          </div>
        </form>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order ID</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders?.map((order: { id: string, email_snapshot: string, created_at: string, total_amount: number, status: string }) => (
              <TableRow key={order.id}>
                <TableCell className="font-mono text-sm">{formatOrderId(order.id)}</TableCell>
                <TableCell>{order.email_snapshot || 'Unknown'}</TableCell>
                <TableCell>{formatDate(order.created_at)}</TableCell>
                <TableCell>{formatPrice(order.total_amount)}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={getStatusColor(order.status)}>
                    {order.status.replace('_', ' ')}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/admin/orders/${order.id}`}>
                      View
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!orders?.length && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                  No orders found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Pagination 
        currentPage={page} 
        totalPages={totalPages} 
        basePath="/admin/orders" 
        searchParams={{
          ...(queryParam ? { q: queryParam } : {}),
          ...(statusParam !== 'all' ? { status: statusParam } : {})
        }}
      />
    </div>
  )
}
