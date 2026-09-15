'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  currentPage: number
  totalPages: number
  basePath: string
  searchParams: Record<string, string>
}

export function Pagination({ currentPage, totalPages, basePath, searchParams }: PaginationProps) {
  if (totalPages <= 1) return null

  const createQueryString = (page: number) => {
    const params = new URLSearchParams(searchParams)
    params.set('page', page.toString())
    return `${basePath}?${params.toString()}`
  }

  return (
    <div className="flex items-center justify-center gap-2 mt-4">
      <Button
        variant="outline"
        size="icon"
        asChild
        disabled={currentPage <= 1}
      >
        <Link 
          href={currentPage <= 1 ? '#' : createQueryString(currentPage - 1)}
          className={currentPage <= 1 ? 'pointer-events-none opacity-50' : ''}
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
      </Button>
      
      <div className="flex items-center gap-1">
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
          <Button
            key={page}
            variant={page === currentPage ? 'default' : 'outline'}
            size="sm"
            asChild
          >
            <Link href={createQueryString(page)}>
              {page}
            </Link>
          </Button>
        ))}
      </div>

      <Button
        variant="outline"
        size="icon"
        asChild
        disabled={currentPage >= totalPages}
      >
        <Link 
          href={currentPage >= totalPages ? '#' : createQueryString(currentPage + 1)}
          className={currentPage >= totalPages ? 'pointer-events-none opacity-50' : ''}
        >
          <ChevronRight className="h-4 w-4" />
        </Link>
      </Button>
    </div>
  )
}
