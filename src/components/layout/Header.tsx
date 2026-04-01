import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Sun, Moon, Bell, Search, Plus } from 'lucide-react'
import { NAV_ITEMS } from '@/constants/navItems'
import { useTheme } from '@/hooks/useTheme'
import { GlobalSearch } from '@/components/shared/GlobalSearch'

// Derive page title from current pathname
function usePageTitle(): string {
  const { pathname } = useLocation()
  if (pathname === '/') return 'Dashboard'
  const match = NAV_ITEMS.find((item) => item.path !== '/' && pathname.startsWith(item.path))
  return match?.label ?? 'Seller Manager'
}

// Context-aware "create new" target based on current path
function useCreateNewPath(): string | null {
  const { pathname } = useLocation()
  if (pathname.startsWith('/orders')) return '/orders/new'
  if (pathname.startsWith('/products')) return '/products'   // opens add dialog — just navigate to list for now
  if (pathname.startsWith('/imports')) return '/imports/new'
  if (pathname.startsWith('/customers')) return '/customers'
  if (pathname.startsWith('/suppliers')) return '/suppliers'
  return null
}

export function Header() {
  const { theme, toggle } = useTheme()
  const pageTitle = usePageTitle()
  const navigate = useNavigate()
  const createPath = useCreateNewPath()

  const [searchOpen, setSearchOpen] = useState(false)

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl+K — open global search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
      // Ctrl+N — context-aware create new
      if ((e.ctrlKey || e.metaKey) && e.key === 'n' && createPath) {
        e.preventDefault()
        navigate(createPath)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [createPath, navigate])

  return (
    <>
      <header className="flex h-14 shrink-0 items-center justify-between border-b bg-card px-6">
        <h1 className="text-base font-semibold">{pageTitle}</h1>

        <div className="flex items-center gap-1">
          {/* Global search trigger */}
          <button
            onClick={() => setSearchOpen(true)}
            className="hidden sm:flex items-center gap-2 rounded-lg border bg-background px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            title="Tìm kiếm (Ctrl+K)"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="text-xs">Tìm kiếm...</span>
            <kbd className="ml-2 rounded border px-1.5 py-0.5 text-xs font-mono">⌃K</kbd>
          </button>
          {/* Mobile search icon */}
          <button
            onClick={() => setSearchOpen(true)}
            className="flex sm:hidden h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
            title="Tìm kiếm (Ctrl+K)"
          >
            <Search className="h-4 w-4" />
          </button>

          {/* Ctrl+N shortcut hint */}
          {createPath && (
            <button
              onClick={() => navigate(createPath)}
              className="hidden lg:flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
              title="Tạo mới (Ctrl+N)"
            >
              <Plus className="h-4 w-4" />
            </button>
          )}

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

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  )
}
