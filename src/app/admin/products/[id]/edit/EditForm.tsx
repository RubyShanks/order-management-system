'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { updateProduct, toggleProductActive, uploadProductImage } from '@/app/admin/actions'
import { toast } from '@/components/ui/toast'
import Link from 'next/link'
import Image from 'next/image'

export function EditProductForm({ product }: { product: { id: string, sku: string, name: string, description: string | null, price_amount: number, image_path: string | null, is_active: boolean } }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [imageUrl, setImageUrl] = useState(product.image_path || '')
  const [isActive, setIsActive] = useState(product.is_active)

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)
    
    setLoading(true)
    const result = await uploadProductImage(formData)
    setLoading(false)
    
    if (result.success && result.url) {
      setImageUrl(result.url)
      toast.add({ title: 'Image uploaded successfully' })
    } else {
      toast.add({ title: 'Upload failed', description: result.error, type: 'error' })
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    
    const formData = new FormData(e.currentTarget)
    formData.set('id', product.id)
    const priceDollars = parseFloat(formData.get('price_dollars') as string)
    if (!isNaN(priceDollars)) {
      formData.set('price', Math.round(priceDollars * 100).toString())
    }
    if (imageUrl) {
      formData.set('image_url', imageUrl)
    }

    const result = await updateProduct(formData)
    setLoading(false)
    
    if (result.success) {
      toast.add({ title: 'Product updated successfully' })
      router.push('/admin/products')
      router.refresh()
    } else {
      toast.add({ title: 'Failed to update product', description: result.error, type: 'error' })
    }
  }

  async function onToggleActive() {
    setLoading(true)
    const result = await toggleProductActive(product.id, !isActive)
    setLoading(false)
    
    if (result.success) {
      setIsActive(!isActive)
      toast.add({ title: `Product ${!isActive ? 'activated' : 'deactivated'} successfully` })
      router.refresh()
    } else {
      toast.add({ title: 'Failed to toggle status', description: result.error, type: 'error' })
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Status: {isActive ? 'Active' : 'Inactive'}</h2>
        <Button type="button" variant={isActive ? "destructive" : "default"} onClick={onToggleActive} disabled={loading}>
          {isActive ? 'Deactivate' : 'Activate'}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="sku">SKU</Label>
          <Input id="sku" name="sku" required defaultValue={product.sku} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="price_dollars">Price ($)</Label>
          <Input id="price_dollars" name="price_dollars" type="number" step="0.01" min="0" required defaultValue={(product.price_amount / 100).toFixed(2)} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" required defaultValue={product.name} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" defaultValue={product.description || ''} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="image">Product Image</Label>
        <Input id="image" type="file" accept="image/jpeg, image/png, image/webp" onChange={handleImageUpload} disabled={loading} />
        {imageUrl && (
          <div className="mt-2">
            <Image src={imageUrl} alt="Preview" width={128} height={128} unoptimized className="h-32 w-32 object-cover rounded border" />
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" asChild>
          <Link href="/admin/products">Cancel</Link>
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </form>
  )
}
