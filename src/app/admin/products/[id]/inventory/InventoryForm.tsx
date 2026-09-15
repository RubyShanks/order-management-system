'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { adjustStock } from '@/app/admin/actions'
import { toast } from '@/components/ui/toast'
import { useRouter } from 'next/navigation'

export function InventoryAdjustmentForm({ productId }: { productId: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    formData.append('product_id', productId)

    const result = await adjustStock(formData)
    setLoading(false)

    if (result.success) {
      toast.add({ title: 'Stock adjusted successfully' })
      ;(e.target as HTMLFormElement).reset()
      router.refresh()
    } else {
      toast.add({ title: 'Failed to adjust stock', description: result.error, type: 'error' })
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="delta">Quantity to Adjust (+ or -)</Label>
          <Input id="delta" name="delta" type="number" required placeholder="e.g., 10 or -5" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="reason">Reason (Mandatory)</Label>
          <Textarea id="reason" name="reason" required placeholder="e.g., Restock, Damaged goods, etc." />
        </div>
      </div>
      <Button type="submit" disabled={loading}>
        {loading ? 'Adjusting...' : 'Adjust Stock'}
      </Button>
    </form>
  )
}
