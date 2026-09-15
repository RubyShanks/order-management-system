'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Package, User, KeyRound } from 'lucide-react';

interface AccountNavProps {
  userEmail: string;
}

export function AccountNav({ userEmail }: AccountNavProps) {
  const pathname = usePathname();

  const navItems = [
    {
      label: 'My Orders',
      href: '/account/orders',
      icon: Package,
      active: pathname.startsWith('/account/orders'),
    },
    {
      label: 'Profile & Settings',
      href: '/account/profile',
      icon: User,
      active: pathname === '/account/profile',
    },
    {
      label: 'Update Password',
      href: '/account/reset-password',
      icon: KeyRound,
      active: pathname === '/account/reset-password',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-4 shadow-xs">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
          Signed In Account
        </div>
        <p className="font-semibold text-sm text-foreground truncate">{userEmail}</p>
      </div>

      <nav className="flex flex-col space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors',
                item.active
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
