import { useLocation } from 'react-router-dom'
import { Sun, Moon, Bell, Search } from 'lucide-react'
import { NAV_ITEMS } from '@/constants/navItems'
import { useTheme } from '@/hooks/useTheme'

// Derive page title from current pathname
function usePageTitle(): string {
  const { pathname } = useLocation()
  if (pathname === '/') return 'Dashboard'
  const match = NAV_ITEMS.find((item) => item.path !== '/' && pathname.startsWith(item.path))
  return match?.label ?? 'Seller Manager'
}

export function Header() {
  const { theme, toggle } = useTheme()
  const pageTitle = usePageTitle()

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b bg-card px-6">
      <h1 className="text-base font-semibold">{pageTitle}</h1>

      <div className="flex items-center gap-1">
        {/* Global search — placeholder, functional in Phase 2 */}
        <button
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
          title="Tìm kiếm (Phase 2)"
        >
          <Search className="h-4 w-4" />
        </button>

        {/* Notification bell — placeholder */}
        <button
          className="relative flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
          title="Thông báo"
        >
          <Bell className="h-4 w-4" />
        </button>

        {/* Dark / light toggle */}
        <button
          onClick={toggle}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
          title={theme === 'dark' ? 'Chế độ sáng' : 'Chế độ tối'}
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>
    </header>
  )
}
