import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Sun, Moon, Bell, Search, Plus } from 'lucide-react'
import { NAV_ITEMS } from '@/constants/navItems'
import { useTheme } from '@/hooks/useTheme'
import { GlobalSearch } from '@/components/shared/GlobalSearch'

function usePageTitle(): string {
  const { pathname } = useLocation()
  if (pathname === '/') return 'Dashboard'
  const match = NAV_ITEMS.find((item) => item.path !== '/' && pathname.startsWith(item.path))
  return match?.label ?? 'Seller Manager'
}

function useCreateNewPath(): string | null {
  const { pathname } = useLocation()
  if (pathname.startsWith('/orders')) return '/orders/new'
  if (pathname.startsWith('/imports')) return '/imports/new'
  return null
}

export function Header() {
  const { theme, toggle } = useTheme()
  const pageTitle = usePageTitle()
  const navigate = useNavigate()
  const createPath = useCreateNewPath()
  const [searchOpen, setSearchOpen] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'n' && createPath) {
        e.preventDefault()
        navigate(createPath)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [createPath, navigate])

  const iconBtn = 'flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-theme hover:bg-accent hover:text-accent-foreground'

  return (
    <>
      <header className="flex h-14 shrink-0 items-center justify-between border-b bg-card/70 backdrop-blur-sm px-5 gap-4">
        {/* Page title */}
        <h1 className="text-sm font-semibold text-foreground truncate">{pageTitle}</h1>

        {/* Right controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Search trigger — pill style */}
          <button
            onClick={() => setSearchOpen(true)}
            className="hidden md:flex items-center gap-2 rounded-lg border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-theme hover:border-primary/40 hover:text-foreground hover:shadow-sm"
            title="Tìm kiếm (Ctrl+K)"
          >
            <Search className="h-3.5 w-3.5" />
            <span>Tìm kiếm...</span>
            <span className="ml-1 flex items-center gap-0.5">
              <kbd className="rounded border border-border/60 bg-muted px-1.5 py-0.5 text-[10px] font-mono leading-none text-muted-foreground">⌃</kbd>
              <kbd className="rounded border border-border/60 bg-muted px-1.5 py-0.5 text-[10px] font-mono leading-none text-muted-foreground">K</kbd>
            </span>
          </button>

          {/* Mobile search */}
          <button onClick={() => setSearchOpen(true)} className={`md:hidden ${iconBtn}`} title="Tìm kiếm">
            <Search className="h-4 w-4" />
          </button>

          {/* Create new shortcut */}
          {createPath && (
            <button
              onClick={() => navigate(createPath)}
              className="hidden lg:flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-all hover:opacity-90 active:scale-95"
              title="Tạo mới (Ctrl+N)"
            >
              <Plus className="h-3.5 w-3.5" />
              Tạo mới
            </button>
          )}

          {/* Divider */}
          <div className="mx-0.5 h-5 w-px bg-border" />

          {/* Bell */}
          <button className={iconBtn} title="Thông báo">
            <Bell className="h-4 w-4" />
          </button>

          {/* Theme toggle */}
          <button
            onClick={toggle}
            className={iconBtn}
            title={theme === 'dark' ? 'Chế độ sáng' : 'Chế độ tối'}
          >
            {theme === 'dark'
              ? <Sun className="h-4 w-4" />
              : <Moon className="h-4 w-4" />
            }
          </button>
        </div>
      </header>

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  )
}
