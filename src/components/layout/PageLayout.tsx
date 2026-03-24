interface PageLayoutProps {
  title: string
  action?: React.ReactNode // primary action button (e.g. "Add new")
  children: React.ReactNode
}

// Wrapper used by every page: consistent title bar + content area
export function PageLayout({ title, action, children }: PageLayoutProps) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{title}</h2>
        {action && <div>{action}</div>}
      </div>
      {children}
    </div>
  )
}
