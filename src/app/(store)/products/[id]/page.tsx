import React from 'react';
import { notFound } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { ProductDetail } from '@/components/products/ProductDetail';

interface ProductPageProps {
  params: Promise<{
    id: string;
  }>;
}

export const dynamic = 'force-dynamic';

export default async function ProductPage({ params }: ProductPageProps) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  // Try fetching from authoritative get_product_catalog first to get available stock
  const { data: catalog } = await supabase.rpc('get_product_catalog');

  let product = catalog?.find((item) => item.id === id);

  // If not found in catalog RPC (or RPC not yet deployed in db), fall back to direct products table query
  if (!product) {
    const { data: productRow, error } = await supabase
      .from('products')
      .select('id, sku, name, description, price_amount, image_path, is_active')
      .eq('id', id)
      .maybeSingle();

    if (error || !productRow || !productRow.is_active) {
      notFound();
    }

    product = {
      ...productRow,
      available: 10, // Fallback default if inventory view is inaccessible
    };
  }

  return (
    <div className="container mx-auto px-4 py-8 sm:px-6 lg:py-12">
      <ProductDetail product={product} />
    </div>
  );
}
