// ============================================================
// Skeleton.tsx — Loading skeletons for pages and tables
// ============================================================

import { cn } from '@/lib/utils'

export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div className={cn('animate-pulse rounded-md bg-muted', className)} style={style} />
  )
}

export function TableSkeleton({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-3">
      {/* Fake search bar */}
      <Skeleton className="h-9 w-64" />

      {/* Table */}
      <div className="overflow-hidden rounded-lg border">
        {/* Header */}
        <div className="bg-muted/50 px-4 py-3 flex gap-4">
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} className="h-4 flex-1" style={{ maxWidth: `${80 + (i % 3) * 40}px` }} />
          ))}
        </div>
        {/* Rows */}
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-4 border-t px-4 py-3">
            {Array.from({ length: cols }).map((_, j) => (
              <Skeleton
                key={j}
                className="h-4 flex-1"
                style={{ maxWidth: `${60 + ((i + j) % 4) * 30}px`, opacity: 1 - i * 0.05 }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function StatCardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className={`grid gap-4 grid-cols-2 sm:grid-cols-${Math.min(count, 4)}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border bg-card p-4 space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-32" />
        </div>
      ))}
    </div>
  )
}
