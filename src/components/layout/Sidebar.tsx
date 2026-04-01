import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import * as Tooltip from '@radix-ui/react-tooltip'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { APP_CONFIG } from '@/constants/appConfig'
import { NAV_ITEMS } from '@/constants/navItems'
import { cn } from '@/lib/utils'

// Nav items grouped by section for visual separation
const NAV_SECTIONS = [
  {
    items: ['/', '/channels', '/categories', '/suppliers', '/customers'],
  },
  {
    items: ['/products', '/imports', '/inventory', '/pricing'],
  },
  {
    items: ['/orders', '/expenses', '/reports'],
  },
  {
    items: ['/settings'],
  },
]

const ITEM_ORDER = NAV_SECTIONS.flatMap((s) => s.items)
const SECTION_ENDS = new Set(NAV_SECTIONS.flatMap((s) => s.items.slice(-1)))

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem('sidebar-collapsed') === 'true'
  })

  const toggle = () => {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('sidebar-collapsed', String(next))
  }

  const orderedNav = [...NAV_ITEMS].sort(
    (a, b) => ITEM_ORDER.indexOf(a.path) - ITEM_ORDER.indexOf(b.path),
  )

  return (
    <Tooltip.Provider delayDuration={100}>
      <aside
        className={cn(
          'bg-sidebar flex h-full flex-col transition-[width] duration-200 ease-in-out',
          collapsed ? 'w-[60px]' : 'w-[220px]',
        )}
        style={{ borderRight: '1px solid hsl(var(--sidebar-border))' }}
      >
        {/* ── Logo ─────────────────────────────────────────── */}
        <div
          className={cn(
            'flex h-14 shrink-0 items-center',
            collapsed ? 'justify-center px-0' : 'gap-2.5 px-4',
          )}
          style={{ borderBottom: '1px solid hsl(var(--sidebar-border))' }}
        >
          {/* Brand mark */}
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
            style={{ background: 'hsl(var(--sidebar-accent))' }}
          >
            S
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-none">
              <span className="text-[13px] font-semibold text-white">{APP_CONFIG.name}</span>
              <span className="text-[10px]" style={{ color: 'hsl(var(--sidebar-fg))' }}>Quản lý bán hàng</span>
            </div>
          )}
        </div>

        {/* ── Nav ──────────────────────────────────────────── */}
        <nav className="flex-1 overflow-y-auto py-3">
          {orderedNav.map((item) => {
            const Icon = item.icon
            const isLastInSection = SECTION_ENDS.has(item.path) && item.path !== '/settings'

            const navLink = (
              <NavLink
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  cn(
                    'group relative flex items-center gap-2.5 rounded-lg text-[13px] font-medium transition-all duration-150',
                    collapsed ? 'mx-auto w-9 h-9 justify-center p-0' : 'mx-2 px-3 py-2',
                    isActive
                      ? 'bg-sidebar-active text-sidebar-active'   // marker handled below
                      : 'text-sidebar hover:bg-sidebar-hover hover:text-sidebar-active',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {/* Left accent bar */}
                    {!collapsed && isActive && (
                      <span
                        className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full"
                        style={{ background: 'hsl(var(--sidebar-accent))' }}
                      />
                    )}

                    {/* Icon */}
                    <Icon
                      className={cn(
                        'h-4 w-4 shrink-0 transition-colors',
                        isActive ? 'text-sidebar-accent' : '',
                      )}
                    />

                    {/* Label */}
                    {!collapsed && (
                      <span className={cn(isActive ? 'text-white' : '')}>{item.label}</span>
                    )}
                  </>
                )}
              </NavLink>
            )

            return (
              <div key={item.path}>
                {collapsed ? (
                  <Tooltip.Root>
                    <Tooltip.Trigger asChild>{navLink}</Tooltip.Trigger>
                    <Tooltip.Portal>
                      <Tooltip.Content
                        side="right"
                        sideOffset={10}
                        className="z-50 rounded-lg px-2.5 py-1.5 text-xs font-medium shadow-card-md animate-fade-in"
                        style={{
                          background: 'hsl(var(--popover))',
                          color: 'hsl(var(--popover-foreground))',
                          border: '1px solid hsl(var(--border))',
                        }}
                      >
                        {item.label}
                        <Tooltip.Arrow className="fill-[hsl(var(--popover))]" />
                      </Tooltip.Content>
                    </Tooltip.Portal>
                  </Tooltip.Root>
                ) : (
                  navLink
                )}

                {/* Section divider */}
                {!collapsed && isLastInSection && (
                  <div className="mx-4 my-2" style={{ borderTop: '1px solid hsl(var(--sidebar-border))' }} />
                )}
                {collapsed && isLastInSection && (
                  <div className="mx-3 my-1.5" style={{ borderTop: '1px solid hsl(var(--sidebar-border))' }} />
                )}
              </div>
            )
          })}
        </nav>

        {/* ── Collapse toggle ───────────────────────────────── */}
        <div
          className="shrink-0 p-2"
          style={{ borderTop: '1px solid hsl(var(--sidebar-border))' }}
        >
          <button
            onClick={toggle}
            className={cn(
              'flex w-full items-center rounded-lg p-2 text-sm transition-all duration-150',
              'hover:bg-sidebar-hover',
            )}
            style={{ color: 'hsl(var(--sidebar-fg))' }}
            title={collapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4 mx-auto" />
            ) : (
              <div className="flex w-full items-center gap-2">
                <ChevronLeft className="h-4 w-4 shrink-0" />
                <span className="text-[12px]">Thu gọn</span>
              </div>
            )}
          </button>
        </div>
      </aside>
    </Tooltip.Provider>
  )
}
