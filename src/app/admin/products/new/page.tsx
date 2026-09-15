'use client'

import { useState, useRef } from 'react'
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
import { Upload, Trash2, Loader2, Image as ImageIcon } from 'lucide-react'

export default function NewProductPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [imageUrl, setImageUrl] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)
    
    setUploading(true)
    try {
      const result = await uploadProductImage(formData)
      if (result.success && result.url) {
        setImageUrl(result.url)
        toast({ title: 'Image uploaded successfully' })
      } else {
        toast({ title: 'Upload failed', description: result.error, type: 'error' })
      }
    } catch (err: unknown) {
      toast({ title: 'Upload failed', description: err instanceof Error ? err.message : 'Upload failed', type: 'error' })
    } finally {
      setUploading(false)
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    
    try {
      const formData = new FormData(e.currentTarget)
      // Convert price to cents
      const priceDollars = parseFloat(formData.get('price_dollars') as string)
      formData.set('price', Math.round(priceDollars * 100).toString())
      if (imageUrl) {
        formData.set('image_url', imageUrl)
      }

      const result = await createProduct(formData)
      if (result.success) {
        toast({ title: 'Product created successfully' })
        router.push('/admin/products')
        router.refresh()
      } else {
        toast({ title: 'Failed to create product', description: result.error, type: 'error' })
      }
    } catch (err: unknown) {
      toast({ title: 'Failed to create product', description: err instanceof Error ? err.message : 'An unexpected error occurred', type: 'error' })
    } finally {
      setLoading(false)
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
              <Label>Product Image</Label>
              <input
                ref={fileInputRef}
                id="image"
                type="file"
                accept="image/jpeg, image/png, image/webp"
                onChange={handleImageUpload}
                disabled={loading || uploading}
                className="hidden"
              />

              {!imageUrl ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center border-2 border-dashed border-input hover:border-primary/60 hover:bg-muted/30 transition-all rounded-xl p-6 cursor-pointer text-center group"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted group-hover:bg-primary/10 group-hover:text-primary transition-colors text-muted-foreground mb-2">
                    {uploading ? (
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    ) : (
                      <Upload className="h-6 w-6" />
                    )}
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    {uploading ? 'Uploading image...' : 'Click to select an image or drag & drop'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Supports JPEG, PNG, or WebP (max 5MB)
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3 pointer-events-none"
                    disabled={loading || uploading}
                  >
                    <Upload className="w-3.5 h-3.5 mr-1.5" />
                    Choose File
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-4 p-3 border rounded-xl bg-muted/20">
                  <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg border bg-background">
                    <Image
                      src={imageUrl}
                      alt="Product preview"
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                      <ImageIcon className="w-4 h-4 text-primary" />
                      <span>Image uploaded successfully</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{imageUrl}</p>
                    <div className="flex gap-2 mt-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={loading || uploading}
                      >
                        {uploading ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Upload className="w-3.5 h-3.5 mr-1" />}
                        Change Image
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => {
                          setImageUrl('')
                          if (fileInputRef.current) fileInputRef.current.value = ''
                        }}
                        disabled={loading || uploading}
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" />
                        Remove
                      </Button>
                    </div>
                  </div>
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
