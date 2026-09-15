import React from 'react';
import Link from 'next/link';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 p-4 sm:p-6 md:p-10">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center space-y-2 text-center">
          <Link
            href="/"
            className="text-2xl font-bold tracking-tight text-foreground hover:opacity-80 transition-opacity"
          >
            Order Management System
          </Link>
          <p className="text-sm text-muted-foreground">
            Fast, reliable, and secure e-commerce orders
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
