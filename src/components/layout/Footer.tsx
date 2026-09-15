import React from 'react';
import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t bg-muted/30 py-8 text-sm text-muted-foreground">
      <div className="container mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-center sm:text-left">
          &copy; {new Date().getFullYear()} Order Management System. All rights reserved.
        </p>
        <div className="flex items-center gap-6 text-xs text-muted-foreground">
          <Link href="/" className="hover:underline">
            Catalog
          </Link>
          <Link href="/account/orders" className="hover:underline">
            Orders
          </Link>
          <span>Privacy &amp; Terms</span>
        </div>
      </div>
    </footer>
  );
}
