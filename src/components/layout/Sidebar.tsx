import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import * as Tooltip from '@radix-ui/react-tooltip'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { APP_CONFIG } from '@/constants/appConfig'
import { NAV_ITEMS } from '@/constants/navItems'
import { cn } from '@/lib/utils'

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem('sidebar-collapsed') === 'true'
  })

  const toggle = () => {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('sidebar-collapsed', String(next))
  }

  return (
    <Tooltip.Provider delayDuration={100}>
      <aside
        className={cn(
          'flex h-full flex-col border-r bg-card transition-[width] duration-200',
          collapsed ? 'w-16' : 'w-60',
        )}
      >
        {/* Logo */}
        <div
          className={cn(
            'flex h-14 shrink-0 items-center border-b px-4',
            collapsed ? 'justify-center' : 'gap-3',
          )}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
            S
          </div>
          {!collapsed && (
            <span className="truncate text-sm font-semibold">{APP_CONFIG.name}</span>
          )}
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto py-2">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const navLink = (
              <NavLink
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                    collapsed ? 'mx-auto w-10 justify-center' : 'mx-2',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  )
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </NavLink>
            )

            if (collapsed) {
              return (
                <div key={item.path}>
                  <Tooltip.Root>
                    <Tooltip.Trigger asChild>{navLink}</Tooltip.Trigger>
                    <Tooltip.Portal>
                      <Tooltip.Content
                        side="right"
                        sideOffset={8}
                        className="z-50 rounded-md bg-popover px-2.5 py-1.5 text-xs font-medium text-popover-foreground shadow-md"
                      >
                        {item.label}
                        <Tooltip.Arrow className="fill-popover" />
                      </Tooltip.Content>
                    </Tooltip.Portal>
                  </Tooltip.Root>
                </div>
              )
            }

            return <div key={item.path}>{navLink}</div>
          })}
        </nav>

        {/* Collapse toggle button */}
        <div className="shrink-0 border-t p-2">
          <button
            onClick={toggle}
            className="flex w-full items-center justify-center rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
            title={collapsed ? 'Mở rộng' : 'Thu gọn'}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
      </aside>
    </Tooltip.Provider>
  )
}
