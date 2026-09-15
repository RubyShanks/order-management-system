import React from 'react';
import Link from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { formatPrice, formatDate, formatOrderId, getStatusColor } from '@/lib/utils/format';
import { Package, ChevronLeft, ChevronRight, Eye, ShoppingBag } from 'lucide-react';

interface OrdersPageProps {
  searchParams: Promise<{
    page?: string;
  }>;
}

export const dynamic = 'force-dynamic';

export default async function CustomerOrdersPage({ searchParams }: OrdersPageProps) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam || '1', 10) || 1);
  const pageSize = 10;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const {
    data: orders,
    count,
  } = await supabase
    .from('orders')
    .select('id, status, total_amount, currency, created_at', { count: 'exact' })
    .eq('customer_id', user?.id || '')
    .order('created_at', { ascending: false })
    .range(from, to);

  const totalOrders = count ?? 0;
  const totalPages = Math.ceil(totalOrders / pageSize) || 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            My Orders
          </h1>
          <p className="text-sm text-muted-foreground">
            Track and view details of your past and current purchases.
          </p>
        </div>

        <Button variant="outline" size="sm" asChild className="self-start">
          <Link href="/">
            <ShoppingBag className="mr-2 h-4 w-4" />
            Continue Shopping
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="border-b pb-4">
          <CardTitle className="text-lg">Order History</CardTitle>
          <CardDescription>
            {totalOrders} {totalOrders === 1 ? 'order' : 'orders'} placed in total
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {!orders || orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground mb-3">
                <Package className="h-7 w-7" />
              </div>
              <h3 className="font-semibold text-base text-foreground">No orders yet</h3>
              <p className="mt-1 text-sm text-muted-foreground max-w-sm">
                When you make a purchase, your orders and their live statuses will appear here.
              </p>
              <Button asChild className="mt-5" size="sm">
                <Link href="/">Start Shopping</Link>
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Order Ref</TableHead>
                    <TableHead>Date Placed</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="w-[100px] text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id} className="hover:bg-muted/40">
                      <TableCell className="font-mono font-medium">
                        {formatOrderId(order.id)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs sm:text-sm">
                        {formatDate(order.created_at)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`font-semibold capitalize text-xs ${getStatusColor(
                            order.status
                          )}`}
                        >
                          {order.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-foreground">
                        {formatPrice(order.total_amount, order.currency)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/account/orders/${order.id}`} className="gap-1.5">
                            <Eye className="h-3.5 w-3.5" />
                            <span>View</span>
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3 sm:px-6">
            <div className="text-xs text-muted-foreground">
              Page <span className="font-semibold text-foreground">{page}</span> of{' '}
              <span className="font-semibold text-foreground">{totalPages}</span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                asChild={page > 1}
              >
                {page > 1 ? (
                  <Link href={`/account/orders?page=${page - 1}`} className="gap-1">
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Link>
                ) : (
                  <span className="flex items-center gap-1">
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </span>
                )}
              </Button>

              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                asChild={page < totalPages}
              >
                {page < totalPages ? (
                  <Link href={`/account/orders?page=${page + 1}`} className="gap-1">
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <span className="flex items-center gap-1">
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </span>
                )}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
