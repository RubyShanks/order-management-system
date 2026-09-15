'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AlertCircle, RotateCcw, ShoppingBag } from 'lucide-react';

export default function AccountError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Account section error:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-3">
        <AlertCircle className="h-7 w-7" />
      </div>
      <h3 className="font-semibold text-lg text-foreground">Could not load account details</h3>
      <p className="mt-1 text-sm text-muted-foreground max-w-sm">
        {error?.message || 'We encountered an error loading your account information.'}
      </p>
      <div className="mt-5 flex gap-3">
        <Button onClick={() => reset()} size="sm" variant="default">
          <RotateCcw className="mr-2 h-4 w-4" />
          Retry
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href="/">
            <ShoppingBag className="mr-2 h-4 w-4" />
            Catalog
          </Link>
        </Button>
      </div>
    </div>
  );
}
