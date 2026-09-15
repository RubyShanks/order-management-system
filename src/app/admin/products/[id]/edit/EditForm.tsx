'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { updateProduct, toggleProductActive, uploadProductImage } from '@/app/admin/actions'
import { toast } from '@/components/ui/toast'
import Link from 'next/link'
import Image from 'next/image'
import { Upload, Trash2, Loader2, Image as ImageIcon } from 'lucide-react'

export function EditProductForm({ product }: { product: { id: string, sku: string, name: string, description: string | null, price_amount: number, image_path: string | null, is_active: boolean } }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [imageUrl, setImageUrl] = useState(product.image_path || '')
  const [isActive, setIsActive] = useState(product.is_active)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast({ title: 'Invalid file format', description: 'Please upload a JPEG, PNG, or WebP image.', type: 'error' })
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Maximum file size is 5MB.', type: 'error' })
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

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
                <span>Image attached</span>
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
