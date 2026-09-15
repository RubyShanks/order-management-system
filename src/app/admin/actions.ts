'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { 
  createProductSchema, 
  updateProductSchema, 
  stockAdjustmentSchema, 
  fulfillOrderSchema, 
  refundOrderSchema 
} from '@/lib/validation'
import { initiateRefund } from '@/lib/services/refund'
import { revalidatePath } from 'next/cache'

async function verifyAdmin() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
    
  if (profile?.role !== 'admin') throw new Error('Forbidden')
  
  return { supabase, user }
}

export async function createProduct(formData: FormData) {
  try {
    const { supabase, user } = await verifyAdmin()
    
    const rawData = {
      sku: formData.get('sku'),
      name: formData.get('name'),
      description: formData.get('description'),
      price_amount: Number(formData.get('price')),
    }
    
    const image_path = formData.get('image_url') as string || null;
    const on_hand = Number(formData.get('on_hand')) || 0;
    
    const validatedData = createProductSchema.parse(rawData)
    
    // Insert product
    const { data: product, error: productError } = await supabase
      .from('products')
      .insert({
        sku: validatedData.sku,
        name: validatedData.name,
        description: validatedData.description,
        price_amount: validatedData.price_amount,
        image_path: image_path,
        is_active: true
      })
      .select('id')
      .single()
      
    if (productError) throw productError
    
    // Insert inventory
    const { error: invError } = await supabase
      .from('inventory')
      .insert({
        product_id: product.id,
        on_hand: on_hand,
        reserved: 0
      })
      
    if (invError) throw invError
    
    // Insert stock movement
    const { error: smError } = await supabase
      .from('stock_movements')
      .insert({
        product_id: product.id,
        on_hand_delta: on_hand,
        reserved_delta: 0,
        reason: 'Initial stock',
        actor_id: user.id
      })
      
    if (smError) throw smError
    
    revalidatePath('/admin/products')
    return { success: true, product_id: product.id }
  } catch (error: unknown) {
    console.error('createProduct error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to create product' }
  }
}

export async function updateProduct(formData: FormData) {
  try {
    const { supabase } = await verifyAdmin()
    
    const rawData: Record<string, unknown> = {
      id: formData.get('id'),
      sku: formData.get('sku'),
      name: formData.get('name'),
      description: formData.get('description'),
    }
    if (formData.get('price')) {
      rawData.price_amount = Number(formData.get('price'));
    }
    
    const image_path = formData.get('image_url') as string | null;
    
    const { id, ...dataToValidate } = rawData
    const validatedData = updateProductSchema.partial().parse(dataToValidate)
    
    const updatePayload = { ...validatedData } as Record<string, unknown>;
    if (image_path !== null && image_path !== undefined) {
      updatePayload.image_path = image_path;
    }
    
    const { error } = await supabase
      .from('products')
      .update(updatePayload as Record<string, never>)
      .eq('id', id as string)
      
    if (error) throw error
    
    revalidatePath('/admin/products')
    revalidatePath(`/admin/products/${id}/edit`)
    return { success: true }
  } catch (error: unknown) {
    console.error('updateProduct error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to update product' }
  }
}

export async function toggleProductActive(productId: string, isActive: boolean) {
  try {
    const { supabase } = await verifyAdmin()
    
    const { error } = await supabase
      .from('products')
      .update({ is_active: isActive })
      .eq('id', productId)
      
    if (error) throw error
    
    revalidatePath('/admin/products')
    revalidatePath(`/admin/products/${productId}/edit`)
    return { success: true }
  } catch (error: unknown) {
    console.error('toggleProductActive error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to toggle product status' }
  }
}

export async function adjustStock(formData: FormData) {
  try {
    const { supabase } = await verifyAdmin()
    
    const rawData = {
      product_id: formData.get('product_id'),
      on_hand_delta: Number(formData.get('delta')),
      reason: formData.get('reason'),
    }
    
    const validatedData = stockAdjustmentSchema.parse(rawData)
    
    const { error } = await supabase.rpc('adjust_stock', {
      p_product_id: validatedData.product_id,
      p_on_hand_delta: validatedData.on_hand_delta,
      p_reason: validatedData.reason
    })
    
    if (error) throw error
    
    revalidatePath(`/admin/products/${validatedData.product_id}/inventory`)
    revalidatePath('/admin/products')
    return { success: true }
  } catch (error: unknown) {
    console.error('adjustStock error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to adjust stock' }
  }
}

export async function fulfillOrder(formData: FormData) {
  try {
    const { supabase } = await verifyAdmin()
    
    const rawData = {
      order_id: formData.get('order_id'),
    }
    
    const validatedData = fulfillOrderSchema.parse(rawData)
    
    const { error } = await supabase.rpc('fulfill_order', {
      p_order_id: validatedData.order_id
    })
    
    if (error) throw error
    
    revalidatePath(`/admin/orders/${validatedData.order_id}`)
    revalidatePath('/admin/orders')
    return { success: true }
  } catch (error: unknown) {
    console.error('fulfillOrder error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to fulfill order' }
  }
}

export async function initiateRefundAction(formData: FormData) {
  try {
    const { user } = await verifyAdmin()
    
    const rawData = {
      order_id: formData.get('order_id'),
    }
    
    const validatedData = refundOrderSchema.parse(rawData)
    
    await initiateRefund(validatedData.order_id, user.id)
    
    revalidatePath(`/admin/orders/${validatedData.order_id}`)
    revalidatePath('/admin/orders')
    return { success: true }
  } catch (error: unknown) {
    console.error('initiateRefundAction error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to initiate refund' }
  }
}

export async function uploadProductImage(formData: FormData) {
  try {
    const { supabase } = await verifyAdmin()
    const file = formData.get('file') as File
    
    if (!file) {
      return { success: false, error: 'No file provided' }
    }
    
    if (file.size > 5 * 1024 * 1024) {
      return { success: false, error: 'File size exceeds 5MB limit' }
    }
    
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      return { success: false, error: 'Invalid file type. Only JPEG, PNG, and WebP are supported.' }
    }
    
    const fileExt = file.name.split('.').pop()
    const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`
    const filePath = `${fileName}`
    
    const { error } = await supabase.storage
      .from('product-images')
      .upload(filePath, file)
      
    if (error) throw error
    
    const { data: { publicUrl } } = supabase.storage
      .from('product-images')
      .getPublicUrl(filePath)
      
    return { success: true, url: publicUrl }
  } catch (error: unknown) {
    console.error('uploadProductImage error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to upload image' }
  }
}
