'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Package, ShoppingCart } from 'lucide-react'
import { cn } from '@/lib/utils'

export function AdminSidebar() {
  const pathname = usePathname()

  const links = [
    { href: '/admin/products', label: 'Products', icon: Package },
    { href: '/admin/orders', label: 'Orders', icon: ShoppingCart },
  ]

  return (
    <aside className="w-full md:w-64 border-r bg-card/50">
      <div className="h-full px-3 py-4 flex flex-col gap-2">
        <div className="mb-4 px-4 py-2">
          <h2 className="text-lg font-bold tracking-tight">Admin Panel</h2>
        </div>
        <nav className="flex-1 space-y-1">
          {links.map((link) => {
            const Icon = link.icon
            const isActive = pathname.startsWith(link.href)
            
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-secondary text-secondary-foreground'
                    : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                {link.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}
