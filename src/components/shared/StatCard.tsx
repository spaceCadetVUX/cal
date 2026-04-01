import type { LucideIcon } from 'lucide-react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: LucideIcon
  trend?: { value: number; label: string }
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info'
}

const variantConfig = {
  default: {
    value:    'text-foreground',
    iconBg:   'bg-primary/10',
    iconText: 'text-primary',
  },
  success: {
    value:    'text-emerald-600 dark:text-emerald-400',
    iconBg:   'bg-emerald-100 dark:bg-emerald-900/30',
    iconText: 'text-emerald-600 dark:text-emerald-400',
  },
  warning: {
    value:    'text-amber-600 dark:text-amber-400',
    iconBg:   'bg-amber-100 dark:bg-amber-900/30',
    iconText: 'text-amber-600 dark:text-amber-400',
  },
  danger: {
    value:    'text-red-600 dark:text-red-400',
    iconBg:   'bg-red-100 dark:bg-red-900/30',
    iconText: 'text-red-600 dark:text-red-400',
  },
  info: {
    value:    'text-blue-600 dark:text-blue-400',
    iconBg:   'bg-blue-100 dark:bg-blue-900/30',
    iconText: 'text-blue-600 dark:text-blue-400',
  },
}

export function StatCard({ title, value, subtitle, icon: Icon, trend, variant = 'default' }: StatCardProps) {
  const cfg = variantConfig[variant]

  return (
    <div className="group rounded-xl border bg-card p-5 shadow-card transition-shadow hover:shadow-card-md">
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
        {Icon && (
          <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', cfg.iconBg)}>
            <Icon className={cn('h-4 w-4', cfg.iconText)} />
          </div>
        )}
      </div>

      <p className={cn('mt-3 text-2xl font-bold tabular tracking-tight', cfg.value)}>{value}</p>

      {(subtitle || trend) && (
        <div className="mt-2 flex items-center gap-2">
          {trend && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold',
                trend.value >= 0
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
              )}
            >
              {trend.value >= 0
                ? <TrendingUp className="h-3 w-3" />
                : <TrendingDown className="h-3 w-3" />
              }
              {Math.abs(trend.value).toFixed(1)}%
            </span>
          )}
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      )}
    </div>
  )
}
