'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useCart } from '@/components/cart/CartProvider';
import { formatPrice } from '@/lib/utils/format';
import { cn } from '@/lib/utils';
import { processCheckoutAction } from '@/lib/services/actions';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  ShieldCheck,
  ShoppingBag,
  ArrowLeft,
  AlertCircle,
  Loader2,
  Lock,
} from 'lucide-react';

interface CheckoutClientProps {
  userEmail: string;
}

export function CheckoutClient({ userEmail }: CheckoutClientProps) {
  const { items, getTotal, getItemCount, clearCart } = useCart();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const total = getTotal();
  const itemCount = getItemCount();

  const handlePlaceOrder = async () => {
    if (items.length === 0 || isProcessing) return;

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      // 1. Generate unique checkout request key
      const checkout_request_key = crypto.randomUUID();

      // 2. Format items for checkout schema
      const checkoutItems = items.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
      }));

      // 3. Call server action
      const result = await processCheckoutAction({
        items: checkoutItems,
        checkout_request_key,
      });

      if (!result.success || !result.url) {
        setErrorMessage(
          result.error || 'Failed to initialize checkout session. Please review your cart and try again.'
        );
        setIsProcessing(false);
        return;
      }

      // 4. On success, clear cart and redirect to Stripe
      clearCart();
      window.location.href = result.url;
    } catch (err: unknown) {
      console.error('Checkout error:', err);
      setErrorMessage(
        err instanceof Error ? err.message : 'An unexpected error occurred during checkout'
      );
      setIsProcessing(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted text-muted-foreground mb-4">
          <ShoppingBag className="h-10 w-10" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Your cart is empty</h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-sm">
          You don&apos;t have any items in your cart to checkout. Browse our catalog to find items you love.
        </p>
        <Link href="/" className={cn(buttonVariants(), 'mt-6')}>
          Browse Products
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'gap-2')}
        >
          <ArrowLeft className="h-4 w-4" />
          Continue Shopping
        </Link>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="w-3.5 h-3.5 text-green-600" />
          <span>256-bit Encrypted Checkout</span>
        </div>
      </div>

      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Review &amp; Checkout</h1>
        <p className="text-sm text-muted-foreground">
          Signed in as <span className="font-medium text-foreground">{userEmail}</span>
        </p>
      </div>

      {/* Error display */}
      {errorMessage && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Checkout Conflict</AlertTitle>
          <AlertDescription className="mt-1">{errorMessage}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left Column: Cart items review */}
        <div className="lg:col-span-7 space-y-4">
          <Card>
            <CardHeader className="border-b pb-4">
              <CardTitle className="text-lg font-semibold flex items-center justify-between">
                <span>Order Items</span>
                <span className="text-sm text-muted-foreground font-normal">
                  ({itemCount} {itemCount === 1 ? 'item' : 'items'})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y p-0">
              {items.map((item) => (
                <div key={item.product_id} className="p-4 flex gap-4 items-center">
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
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                        No img
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-foreground line-clamp-1">
                      {item.name}
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Quantity: {item.quantity} &times; {formatPrice(item.price_amount)}
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-sm font-semibold text-foreground">
                      {formatPrice(item.price_amount * item.quantity)}
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Order Summary */}
        <div className="lg:col-span-5 space-y-6">
          <Card>
            <CardHeader className="border-b pb-4">
              <CardTitle className="text-lg font-semibold">Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Items Subtotal</span>
                <span>{formatPrice(total)}</span>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Shipping</span>
                <span className="text-green-600 font-medium">Free</span>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Taxes</span>
                <span>Calculated at Stripe</span>
              </div>

              <Separator className="my-2" />

              <div className="flex justify-between text-base font-bold text-foreground">
                <span>Total Due</span>
                <span className="text-primary">{formatPrice(total)}</span>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3 pt-2">
              <Button
                onClick={handlePlaceOrder}
                disabled={isProcessing}
                size="lg"
                className="w-full text-base font-semibold"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Reserving Stock &amp; Redirecting...
                  </>
                ) : (
                  <>
                    <Lock className="mr-2 h-4 w-4" />
                    Proceed to Payment &bull; {formatPrice(total)}
                  </>
                )}
              </Button>

              <p className="text-center text-[11px] text-muted-foreground">
                By clicking proceed, inventory is reserved for 30 minutes while you complete checkout on Stripe.
              </p>
            </CardFooter>
          </Card>

          <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-4 text-xs text-muted-foreground">
            <ShieldCheck className="h-5 w-5 flex-shrink-0 text-primary" />
            <span>
              Transactions are authorized securely through Stripe Checkout. No credit card details touch our servers.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
