import { TableSkeleton, StatCardSkeleton } from '@/components/shared/Skeleton'

interface PageLayoutProps {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
  loading?: boolean
  skeletonType?: 'table' | 'stats+table'
}

export function PageLayout({ title, action, children, loading, skeletonType = 'table' }: PageLayoutProps) {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">{title}</h2>
        </div>
        {action && <div className="flex items-center gap-2 shrink-0">{action}</div>}
      </div>

      {loading ? (
        <div className="space-y-5">
          {skeletonType === 'stats+table' && <StatCardSkeleton />}
          <TableSkeleton />
        </div>
      ) : (
        children
      )}
    </div>
  )
}
