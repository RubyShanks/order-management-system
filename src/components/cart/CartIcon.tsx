'use client';

import React from 'react';
import { ShoppingCart } from 'lucide-react';
import { useCart } from './CartProvider';
import { Button } from '@/components/ui/button';

export function CartIcon() {
  const { getItemCount, openCart } = useCart();
  const count = getItemCount();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={openCart}
      className="relative"
      aria-label={`Shopping cart with ${count} items`}
    >
      <ShoppingCart className="w-5 h-5" />
      {count > 0 && (
        <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground shadow-sm animate-in zoom-in-50">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Button>
  );
}
