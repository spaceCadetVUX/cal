import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  subMonths,
  subWeeks,
  subYears,
  differenceInDays,
  addDays,
  getISOWeek,
  format,
  eachDayOfInterval,
  eachWeekOfInterval,
  eachMonthOfInterval,
  eachQuarterOfInterval,
  eachYearOfInterval,
} from 'date-fns'
import { vi } from 'date-fns/locale'
import db from '@/db/db'
import type { Order, OrderItem, Expense, SalesChannel } from '@/types'

// --------------- Types ---------------

export type GroupBy = 'day' | 'week' | 'month' | 'quarter' | 'year'

export interface DateRange {
  start: Date
  end: Date
  label: string
}

export interface PeriodData {
  period: string                           // display label (e.g. "T03/2026")
  sortKey: string                          // YYYY-MM-DD for ordering
  revenue: number
  grossProfit: number
  orderCount: number
  margin: number                           // grossProfit / revenue × 100
  channelRevenue: Record<string, number>   // channelId → revenue
  channelProfit: Record<string, number>    // channelId → grossProfit
}

export interface ChannelSummary {
  channelId: string
  channelName: string
  color: string
  orderCount: number
  revenue: number
  grossProfit: number
  profitMargin: number
  platformFees: number
  paymentFees: number
}

export interface BreakEvenData {
  totalExpenses: number
  currentGrossProfit: number
  currentRevenue: number
  breakEvenRevenue: number   // = totalExpenses / avgMarginPct × 100
  avgMarginPct: number
  progressPct: number        // currentGrossProfit / totalExpenses × 100 (capped at 100 for display)
  daysLeft: number           // days left in current month
  totalDaysInMonth: number
}

// --------------- Preset date ranges ---------------

export const DATE_PRESETS = [
  { key: 'today',      label: 'Hôm nay' },
  { key: 'week',       label: 'Tuần này' },
  { key: 'month',      label: 'Tháng này' },
  { key: 'lastMonth',  label: 'Tháng trước' },
  { key: '3months',    label: '3 tháng qua' },
  { key: 'year',       label: 'Năm nay' },
  { key: 'lastYear',   label: 'Năm ngoái' },
] as const

export type DatePresetKey = typeof DATE_PRESETS[number]['key']

export function getPresetRange(preset: DatePresetKey): DateRange {
  const now = new Date()
  switch (preset) {
    case 'today':
      return { start: startOfDay(now), end: endOfDay(now), label: 'Hôm nay' }
    case 'week':
      return {
        start: startOfWeek(now, { weekStartsOn: 1 }),
        end: endOfWeek(now, { weekStartsOn: 1 }),
        label: 'Tuần này',
      }
    case 'month':
      return { start: startOfMonth(now), end: endOfMonth(now), label: 'Tháng này' }
    case 'lastMonth': {
      const lm = subMonths(now, 1)
      return { start: startOfMonth(lm), end: endOfMonth(lm), label: 'Tháng trước' }
    }
    case '3months': {
      const from = startOfMonth(subMonths(now, 2))
      return { start: from, end: endOfMonth(now), label: '3 tháng qua' }
    }
    case 'year':
      return { start: startOfYear(now), end: endOfYear(now), label: 'Năm nay' }
    case 'lastYear': {
      const ly = subYears(now, 1)
      return { start: startOfYear(ly), end: endOfYear(ly), label: 'Năm ngoái' }
    }
  }
}

/** Shift a range back by the same duration (comparison period) */
export function getComparisonRange(range: DateRange): DateRange {
  const duration = differenceInDays(range.end, range.start)
  const end = subDays(range.start, 1)
  const start = subDays(end, duration)
  return { start, end, label: 'Cùng kỳ trước' }
}

function subDays(date: Date, n: number): Date {
  return addDays(date, -n)
}

/** Auto-pick groupBy based on date range duration */
export function autoGroupBy(range: DateRange): GroupBy {
  const days = differenceInDays(range.end, range.start) + 1
  if (days <= 14) return 'day'
  if (days <= 90) return 'week'
  if (days <= 500) return 'month'
  return 'quarter'
}

// --------------- Period helpers ---------------

function periodLabel(date: Date, groupBy: GroupBy): string {
  switch (groupBy) {
    case 'day': return format(date, 'dd/MM', { locale: vi })
    case 'week': return `T${getISOWeek(date)}/${format(date, 'yyyy')}`
    case 'month': return format(date, 'MM/yyyy', { locale: vi })
    case 'quarter': {
      const q = Math.ceil((date.getMonth() + 1) / 3)
      return `Q${q}/${format(date, 'yyyy')}`
    }
    case 'year': return format(date, 'yyyy')
  }
}

function periodSortKey(date: Date, groupBy: GroupBy): string {
  switch (groupBy) {
    case 'day': return format(date, 'yyyy-MM-dd')
    case 'week': return format(date, "yyyy-'W'II")
    case 'month': return format(date, 'yyyy-MM')
    case 'quarter': {
      const q = Math.ceil((date.getMonth() + 1) / 3)
      return `${format(date, 'yyyy')}-Q${q}`
    }
    case 'year': return format(date, 'yyyy')
  }
}

function getPeriodStart(date: Date, groupBy: GroupBy): Date {
  switch (groupBy) {
    case 'day': return startOfDay(date)
    case 'week': return startOfWeek(date, { weekStartsOn: 1 })
    case 'month': return startOfMonth(date)
    case 'quarter': return startOfMonth(new Date(date.getFullYear(), Math.floor(date.getMonth() / 3) * 3, 1))
    case 'year': return startOfYear(date)
  }
}

/** Generate all period start dates within a range (ensures no gaps in chart) */
function generatePeriodStarts(range: DateRange, groupBy: GroupBy): Date[] {
  const opts = { weekStartsOn: 1 as const }
  try {
    switch (groupBy) {
      case 'day': return eachDayOfInterval({ start: range.start, end: range.end })
      case 'week': return eachWeekOfInterval({ start: range.start, end: range.end }, opts)
      case 'month': return eachMonthOfInterval({ start: range.start, end: range.end })
      case 'quarter': return eachQuarterOfInterval({ start: range.start, end: range.end })
      case 'year': return eachYearOfInterval({ start: range.start, end: range.end })
    }
  } catch {
    return [range.start]
  }
}

// --------------- Main aggregation ---------------

/** Load and aggregate orders + items for a given date range and optional channelId filter */
export async function loadReportData(
  range: DateRange,
  channelId?: string,
): Promise<{ orders: Order[]; itemsByOrder: Record<string, OrderItem[]> }> {
  let ordersQuery = db.orders
    .where('orderDate')
    .between(range.start, range.end, true, true)

  const orders = await ordersQuery.toArray()
  const filteredOrders = channelId
    ? orders.filter((o) => o.channelId === channelId)
    : orders

  if (filteredOrders.length === 0) return { orders: [], itemsByOrder: {} }

  const orderIds = filteredOrders.map((o) => o.id)
  const allItems = await db.orderItems
    .where('orderId')
    .anyOf(orderIds)
    .toArray()

  const itemsByOrder: Record<string, OrderItem[]> = {}
  for (const item of allItems) {
    if (!itemsByOrder[item.orderId]) itemsByOrder[item.orderId] = []
    itemsByOrder[item.orderId].push(item)
  }

  return { orders: filteredOrders, itemsByOrder }
}

/** Aggregate orders into time-series periods */
export function aggregateByPeriod(
  orders: Order[],
  itemsByOrder: Record<string, OrderItem[]>,
  range: DateRange,
  groupBy: GroupBy,
): PeriodData[] {
  // Initialize all period buckets (no gaps)
  const periodStarts = generatePeriodStarts(range, groupBy)
  const buckets = new Map<string, PeriodData>()

  for (const ps of periodStarts) {
    const key = periodSortKey(ps, groupBy)
    buckets.set(key, {
      period: periodLabel(ps, groupBy),
      sortKey: key,
      revenue: 0,
      grossProfit: 0,
      orderCount: 0,
      margin: 0,
      channelRevenue: {},
      channelProfit: {},
    })
  }

  // Fill buckets with actual data
  for (const order of orders) {
    const ps = getPeriodStart(new Date(order.orderDate), groupBy)
    const key = periodSortKey(ps, groupBy)

    let bucket = buckets.get(key)
    if (!bucket) {
      bucket = {
        period: periodLabel(ps, groupBy),
        sortKey: key,
        revenue: 0,
        grossProfit: 0,
        orderCount: 0,
        margin: 0,
        channelRevenue: {},
        channelProfit: {},
      }
      buckets.set(key, bucket)
    }

    const items = itemsByOrder[order.id] ?? []
    const gp = items.reduce((s, i) => s + i.grossProfit, 0)

    bucket.revenue += order.totalRevenue
    bucket.grossProfit += gp
    bucket.orderCount += 1
    bucket.channelRevenue[order.channelId] = (bucket.channelRevenue[order.channelId] ?? 0) + order.totalRevenue
    bucket.channelProfit[order.channelId] = (bucket.channelProfit[order.channelId] ?? 0) + gp
  }

  // Compute margin per period
  const result = [...buckets.values()].sort((a, b) => a.sortKey.localeCompare(b.sortKey))
  for (const p of result) {
    p.margin = p.revenue > 0 ? (p.grossProfit / p.revenue) * 100 : 0
  }

  return result
}

/** Summarize performance per channel */
export function summarizeChannels(
  orders: Order[],
  itemsByOrder: Record<string, OrderItem[]>,
  channels: SalesChannel[],
): ChannelSummary[] {
  const map = new Map<string, ChannelSummary>()

  for (const ch of channels) {
    map.set(ch.id, {
      channelId: ch.id,
      channelName: ch.name,
      color: ch.color,
      orderCount: 0,
      revenue: 0,
      grossProfit: 0,
      profitMargin: 0,
      platformFees: 0,
      paymentFees: 0,
    })
  }

  for (const order of orders) {
    if (!map.has(order.channelId)) continue
    const ch = map.get(order.channelId)!
    const items = itemsByOrder[order.id] ?? []
    const gp = items.reduce((s, i) => s + i.grossProfit, 0)
    const pf = items.reduce((s, i) => s + i.platformFee, 0)
    const tf = items.reduce((s, i) => s + i.paymentFee, 0)

    ch.orderCount += 1
    ch.revenue += order.totalRevenue
    ch.grossProfit += gp
    ch.platformFees += pf
    ch.paymentFees += tf
  }

  const results = [...map.values()].filter((c) => c.orderCount > 0)
  for (const c of results) {
    c.profitMargin = c.revenue > 0 ? (c.grossProfit / c.revenue) * 100 : 0
  }
  return results.sort((a, b) => b.revenue - a.revenue)
}

/** Break-even calculation for current month */
export async function calcBreakEven(): Promise<BreakEvenData> {
  const now = new Date()
  const monthStart = startOfMonth(now)
  const monthEnd = endOfMonth(now)

  // Load expenses for current month
  const expenses: Expense[] = await db.expenses
    .where('date')
    .between(monthStart, monthEnd, true, true)
    .toArray()
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)

  // Load orders for current month
  const { orders, itemsByOrder } = await loadReportData({ start: monthStart, end: monthEnd, label: '' })
  const currentRevenue = orders.reduce((s, o) => s + o.totalRevenue, 0)
  const currentGrossProfit = orders.reduce((s, o) => {
    return s + (itemsByOrder[o.id] ?? []).reduce((ss, i) => ss + i.grossProfit, 0)
  }, 0)

  const avgMarginPct = currentRevenue > 0 ? (currentGrossProfit / currentRevenue) * 100 : 0
  const breakEvenRevenue = avgMarginPct > 0 ? (totalExpenses / avgMarginPct) * 100 : 0
  const progressPct = totalExpenses > 0 ? Math.min(100, (currentGrossProfit / totalExpenses) * 100) : 100

  const daysLeft = differenceInDays(monthEnd, now)
  const totalDaysInMonth = differenceInDays(monthEnd, monthStart) + 1

  return {
    totalExpenses,
    currentGrossProfit,
    currentRevenue,
    breakEvenRevenue,
    avgMarginPct,
    progressPct,
    daysLeft,
    totalDaysInMonth,
  }
}
