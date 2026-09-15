import { createServerSupabaseClient } from '@/lib/supabase/server'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Plus, Edit, Package } from 'lucide-react'
import { formatPrice } from '@/lib/utils/format'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export default async function AdminProductsPage() {
  const supabase = await createServerSupabaseClient()
  
  const { data: products, error } = await supabase
    .from('products')
    .select('*, inventory(on_hand, reserved)')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching products:', error)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Products</h1>
        <Button asChild>
          <Link href="/admin/products/new">
            <Plus className="mr-2 h-4 w-4" /> Add Product
          </Link>
        </Button>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">Image</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Stock (Available)</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products?.map((product: { id: string; sku: string; name: string; description: string | null; price_amount: number; image_path: string | null; is_active: boolean; created_at: string; updated_at: string; inventory: { on_hand: number; reserved: number; }[] | { on_hand: number; reserved: number; } | null }) => {
              const inv = Array.isArray(product.inventory) ? product.inventory[0] : product.inventory;
              const onHand = inv?.on_hand || 0;
              const reserved = inv?.reserved || 0;
              const available = onHand - reserved;

              return (
                <TableRow key={product.id}>
                  <TableCell>
                    {product.image_path ? (
                      <Image src={product.image_path} alt={product.name} width={40} height={40} unoptimized className="w-10 h-10 object-cover rounded" />
                    ) : (
                      <div className="w-10 h-10 bg-muted rounded flex items-center justify-center">
                        <Package className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>{product.sku}</TableCell>
                  <TableCell>{formatPrice(product.price_amount)}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span>{available}</span>
                      <span className="text-xs text-muted-foreground">
                        ({onHand} total, {reserved} rsv)
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={product.is_active ? 'default' : 'secondary'}>
                      {product.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/admin/products/${product.id}/inventory`}>
                          Inventory
                        </Link>
                      </Button>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/admin/products/${product.id}/edit`}>
                          <Edit className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
            {!products?.length && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                  No products found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
