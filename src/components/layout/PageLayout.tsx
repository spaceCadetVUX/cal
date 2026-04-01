import { TableSkeleton, StatCardSkeleton } from '@/components/shared/Skeleton'

interface PageLayoutProps {
  title: string
  action?: React.ReactNode // primary action button (e.g. "Add new")
  children: React.ReactNode
  loading?: boolean         // show skeleton instead of children
  skeletonType?: 'table' | 'stats+table'
}

// Wrapper used by every page: consistent title bar + content area
export function PageLayout({ title, action, children, loading, skeletonType = 'table' }: PageLayoutProps) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{title}</h2>
        {action && <div>{action}</div>}
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
