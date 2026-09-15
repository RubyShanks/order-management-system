'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCart } from '@/components/cart/CartProvider';
import { formatPrice } from '@/lib/utils/format';
import { ShoppingCart, Check, PackageX } from 'lucide-react';

export interface ProductCardProps {
  product: {
    id: string;
    sku: string;
    name: string;
    description: string | null;
    price_amount: number;
    image_path: string | null;
    available: number;
  };
}

export function ProductCard({ product }: ProductCardProps) {
  const { addItem } = useCart();
  const [justAdded, setJustAdded] = useState(false);

  const isOutOfStock = product.available <= 0;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isOutOfStock) return;

    addItem({
      product_id: product.id,
      name: product.name,
      price_amount: product.price_amount,
      image_path: product.image_path,
      available: product.available,
    }, 1);

    setJustAdded(true);
    setTimeout(() => {
      setJustAdded(false);
    }, 1500);
  };

  return (
    <Card className="group flex flex-col overflow-hidden border transition-all duration-200 hover:shadow-md hover:border-primary/30">
      {/* Product Image */}
      <Link
        href={`/products/${product.id}`}
        className="relative aspect-square w-full overflow-hidden bg-muted block"
      >
        {product.image_path ? (
          <Image
            src={product.image_path}
            alt={product.name}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
            <span className="text-sm font-medium">No image</span>
          </div>
        )}

        {/* Stock Badge Overlay */}
        <div className="absolute top-3 right-3">
          {isOutOfStock ? (
            <Badge variant="destructive" className="flex items-center gap-1 shadow-sm font-semibold">
              <PackageX className="w-3 h-3" />
              Out of stock
            </Badge>
          ) : product.available <= 5 ? (
            <Badge variant="secondary" className="bg-amber-100 text-amber-900 border-amber-300 font-semibold shadow-sm">
              Only {product.available} left
            </Badge>
          ) : (
            <Badge variant="secondary" className="bg-background/90 backdrop-blur-xs text-foreground shadow-sm">
              {product.available} in stock
            </Badge>
          )}
        </div>
      </Link>

      {/* Content */}
      <CardContent className="flex flex-1 flex-col p-4">
        <div className="flex-1 space-y-1">
          <Link
            href={`/products/${product.id}`}
            className="line-clamp-2 text-base font-semibold text-foreground transition-colors hover:text-primary group-hover:underline"
          >
            {product.name}
          </Link>
          {product.description && (
            <p className="line-clamp-2 text-xs text-muted-foreground">
              {product.description}
            </p>
          )}
        </div>

        <div className="mt-3 flex items-baseline justify-between pt-2">
          <span className="text-lg font-bold text-foreground">
            {formatPrice(product.price_amount)}
          </span>
          <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-mono">
            {product.sku}
          </span>
        </div>
      </CardContent>

      {/* Footer / Actions */}
      <CardFooter className="p-4 pt-0">
        <Button
          onClick={handleAddToCart}
          disabled={isOutOfStock}
          variant={justAdded ? 'secondary' : 'default'}
          className="w-full transition-all"
        >
          {justAdded ? (
            <>
              <Check className="mr-2 h-4 w-4 text-green-600" />
              Added to Cart
            </>
          ) : isOutOfStock ? (
            'Out of Stock'
          ) : (
            <>
              <ShoppingCart className="mr-2 h-4 w-4" />
              Add to Cart
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
