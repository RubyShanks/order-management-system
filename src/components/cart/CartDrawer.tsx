'use client';

import React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useCart } from './CartProvider';
import { formatPrice } from '@/lib/utils/format';
import { Plus, Minus, Trash2, ShoppingBag, ArrowRight } from 'lucide-react';

export function CartDrawer() {
  const router = useRouter();
  const {
    items,
    removeItem,
    updateQuantity,
    getTotal,
    getItemCount,
    isOpen,
    setIsOpen,
    closeCart,
  } = useCart();

  const total = getTotal();
  const itemCount = getItemCount();

  const handleCheckout = () => {
    closeCart();
    router.push('/checkout');
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetContent side="right" className="flex flex-col w-full sm:max-w-md p-0">
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="flex items-center gap-2 text-lg">
            <ShoppingBag className="w-5 h-5 text-primary" />
            Shopping Cart {itemCount > 0 && <span className="text-sm text-muted-foreground font-normal">({itemCount} {itemCount === 1 ? 'item' : 'items'})</span>}
          </SheetTitle>
          <SheetDescription className="sr-only">
            Review your shopping cart items and proceed to checkout.
          </SheetDescription>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
              <ShoppingBag className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold text-lg">Your cart is empty</h3>
              <p className="text-sm text-muted-foreground">
                Looks like you haven&apos;t added any items to your cart yet.
              </p>
            </div>
            <Button variant="outline" onClick={closeCart}>
              Continue Shopping
            </Button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto divide-y px-4">
              {items.map((item) => {
                const isMax = item.quantity >= item.available;
                return (
                  <div key={item.product_id} className="py-4 flex gap-4 items-start">
                    <div className="relative w-16 h-16 rounded-md overflow-hidden bg-muted flex-shrink-0 border">
                      {item.image_path ? (
                        <Image
                          src={item.image_path}
                          alt={item.name}
                          fill
                          className="object-cover"
                          sizes="64px"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs font-medium">
                          No img
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <h4 className="text-sm font-medium text-foreground line-clamp-1">
                        {item.name}
                      </h4>
                      <p className="text-sm font-semibold text-primary">
                        {formatPrice(item.price_amount)}
                      </p>

                      <div className="flex items-center gap-2 pt-1">
                        <div className="flex items-center border rounded-md">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                            className="p-1 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="px-2 text-xs font-medium min-w-6 text-center select-none">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                            disabled={isMax}
                            className="p-1 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            aria-label="Increase quantity"
                            title={isMax ? `Only ${item.available} in stock` : undefined}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {isMax && (
                          <span className="text-[11px] text-amber-600 dark:text-amber-500 font-medium">
                            Max ({item.available})
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end justify-between h-16">
                      <button
                        type="button"
                        onClick={() => removeItem(item.product_id)}
                        className="text-muted-foreground hover:text-destructive transition-colors p-1"
                        aria-label={`Remove ${item.name} from cart`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <span className="text-xs font-medium text-muted-foreground">
                        {formatPrice(item.price_amount * item.quantity)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <SheetFooter className="p-4 border-t space-y-3 bg-muted/30">
              <div className="space-y-1.5 w-full">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{formatPrice(total)}</span>
                </div>
                <div className="flex justify-between text-base font-semibold text-foreground">
                  <span>Total</span>
                  <span>{formatPrice(total)}</span>
                </div>
              </div>

              <Button
                onClick={handleCheckout}
                className="w-full flex items-center justify-center gap-2"
                size="lg"
              >
                Proceed to Checkout
                <ArrowRight className="w-4 h-4" />
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
