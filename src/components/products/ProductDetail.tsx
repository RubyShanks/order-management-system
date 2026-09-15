'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useCart } from '@/components/cart/CartProvider';
import { formatPrice } from '@/lib/utils/format';
import {
  ShoppingCart,
  Check,
  PackageX,
  PackageCheck,
  Plus,
  Minus,
  ArrowLeft,
  ShieldCheck,
  Truck,
} from 'lucide-react';

export interface ProductDetailProps {
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

export function ProductDetail({ product }: ProductDetailProps) {
  const { addItem, openCart } = useCart();
  const [quantity, setQuantity] = useState<number>(1);
  const [justAdded, setJustAdded] = useState<boolean>(false);
  const [imgError, setImgError] = useState<boolean>(false);

  const isOutOfStock = product.available <= 0;
  const maxSelectable = Math.max(1, Math.min(product.available, 99));

  const handleDecrease = () => {
    setQuantity((prev) => Math.max(1, prev - 1));
  };

  const handleIncrease = () => {
    setQuantity((prev) => Math.min(maxSelectable, prev + 1));
  };

  const handleAddToCart = () => {
    if (isOutOfStock) return;

    addItem(
      {
        product_id: product.id,
        name: product.name,
        price_amount: product.price_amount,
        image_path: product.image_path,
        available: product.available,
      },
      quantity
    );

    setJustAdded(true);
    setTimeout(() => {
      setJustAdded(false);
    }, 2500);
  };

  return (
    <div className="space-y-8">
      {/* Back button */}
      <div>
        <Link
          href="/"
          className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'gap-2' })}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Catalog
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:gap-16">
        {/* Left Column: Product Image */}
        <div className="relative aspect-square w-full overflow-hidden rounded-2xl border bg-muted shadow-sm">
          {product.image_path && !imgError ? (
            <Image
              src={product.image_path}
              alt={product.name}
              fill
              priority
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
              <span className="text-base font-medium">No image available</span>
            </div>
          )}
        </div>

        {/* Right Column: Details & Purchasing */}
        <div className="flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            {/* SKU and Stock Badge */}
            <div className="flex items-center justify-between gap-4">
              <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
                SKU: {product.sku}
              </span>

              {isOutOfStock ? (
                <Badge variant="destructive" className="flex items-center gap-1.5 px-3 py-1 text-xs">
                  <PackageX className="w-3.5 h-3.5" />
                  Out of Stock
                </Badge>
              ) : product.available <= 5 ? (
                <Badge variant="secondary" className="bg-amber-100 text-amber-900 border-amber-300 px-3 py-1 text-xs font-semibold">
                  Only {product.available} units remaining
                </Badge>
              ) : (
                <Badge variant="secondary" className="bg-green-100 text-green-900 border-green-300 px-3 py-1 text-xs font-semibold flex items-center gap-1.5">
                  <PackageCheck className="w-3.5 h-3.5 text-green-700" />
                  {product.available} in stock
                </Badge>
              )}
            </div>

            {/* Product Title */}
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
              {product.name}
            </h1>

            {/* Price */}
            <div className="text-3xl font-extrabold text-foreground">
              {formatPrice(product.price_amount)}
            </div>

            <Separator className="my-6" />

            {/* Description */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Description
              </h3>
              <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">
                {product.description || 'No detailed description provided for this product.'}
              </p>
            </div>
          </div>

          {/* Purchasing Controls */}
          <div className="space-y-4 pt-4">
            {!isOutOfStock && (
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-foreground">Quantity:</span>
                <div className="flex items-center border rounded-lg overflow-hidden bg-background">
                  <button
                    type="button"
                    onClick={handleDecrease}
                    disabled={quantity <= 1}
                    className="p-2.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-40"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-12 text-center text-sm font-semibold select-none">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={handleIncrease}
                    disabled={quantity >= maxSelectable}
                    className="p-2.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label="Increase quantity"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <span className="text-xs text-muted-foreground">
                  (Max {maxSelectable})
                </span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={handleAddToCart}
                disabled={isOutOfStock}
                size="lg"
                variant={justAdded ? 'secondary' : 'default'}
                className="flex-1 text-base font-medium transition-all"
              >
                {justAdded ? (
                  <>
                    <Check className="mr-2 h-5 w-5 text-green-600" />
                    Added ({quantity}) to Cart
                  </>
                ) : isOutOfStock ? (
                  'Currently Unavailable'
                ) : (
                  <>
                    <ShoppingCart className="mr-2 h-5 w-5" />
                    Add {quantity > 1 ? `${quantity} items` : 'to Cart'} &bull; {formatPrice(product.price_amount * quantity)}
                  </>
                )}
              </Button>

              {justAdded && (
                <Button
                  onClick={openCart}
                  size="lg"
                  variant="outline"
                  className="sm:w-auto"
                >
                  View Cart
                </Button>
              )}
            </div>

            {/* Reassurance perks */}
            <div className="mt-8 grid grid-cols-2 gap-4 rounded-xl border bg-muted/20 p-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-primary" />
                <span>Fast, verified shipping</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <span>Secure Stripe payment</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
