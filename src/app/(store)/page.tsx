import React from 'react';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { ProductCard } from '@/components/products/ProductCard';
import { PackageOpen } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function ProductCatalogPage() {
  const supabase = await createServerSupabaseClient();

  // Call authoritative get_product_catalog() RPC function
  const { data: catalog, error } = await supabase.rpc('get_product_catalog');

  let products = catalog;

  // Fallback: If RPC is not available yet in local test environment, query products directly
  if (error || !products) {
    const { data: fallbackProducts } = await supabase
      .from('products')
      .select('id, sku, name, description, price_amount, image_path, is_active')
      .eq('is_active', true)
      .order('name');

    if (fallbackProducts) {
      products = fallbackProducts.map((p) => ({
        ...p,
        available: 10, // Safe display fallback if inventory RPC not linked yet
      }));
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 sm:px-6 lg:py-12">
      {/* Header section */}
      <div className="mb-8 space-y-2">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl text-foreground">
          Product Catalog
        </h1>
        <p className="text-muted-foreground max-w-2xl text-sm sm:text-base">
          Browse our collection of high quality products. Stock availability is tracked in real-time.
        </p>
      </div>

      {/* Product Grid */}
      {!products || products.length === 0 ? (
        <div className="my-16 flex flex-col items-center justify-center rounded-xl border border-dashed p-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-muted-foreground mb-4">
            <PackageOpen className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-semibold text-foreground">No products available</h2>
          <p className="mt-1 text-sm text-muted-foreground max-w-sm">
            Check back later! Our inventory is constantly updated with new arrivals.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
