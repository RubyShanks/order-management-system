'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createProduct, uploadProductImage } from '@/app/admin/actions'
import { toast } from '@/components/ui/toast'
import Link from 'next/link'
import Image from 'next/image'

export default function NewProductPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [imageUrl, setImageUrl] = useState('')

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
    // Convert price to cents
    const priceDollars = parseFloat(formData.get('price_dollars') as string)
    formData.set('price', Math.round(priceDollars * 100).toString())
    if (imageUrl) {
      formData.set('image_url', imageUrl)
    }

    const result = await createProduct(formData)
    setLoading(false)
    
    if (result.success) {
      toast.add({ title: 'Product created successfully' })
      router.push('/admin/products')
      router.refresh()
    } else {
      toast.add({ title: 'Failed to create product', description: result.error, type: 'error' })
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Add New Product</h1>
        <Button variant="outline" asChild>
          <Link href="/admin/products">Cancel</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Product Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sku">SKU</Label>
                <Input id="sku" name="sku" required placeholder="e.g., TSHIRT-BL-M" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price_dollars">Price ($)</Label>
                <Input id="price_dollars" name="price_dollars" type="number" step="0.01" min="0" required placeholder="0.00" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="on_hand">Initial Stock (On Hand)</Label>
              <Input id="on_hand" name="on_hand" type="number" min="0" required defaultValue="0" />
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

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Saving...' : 'Create Product'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
