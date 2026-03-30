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
import type { Order, OrderItem, Expense, SalesChannel, ExpenseCategory } from '@/types'

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

// --------------- Sprint 2.3 Types ---------------

export interface ProductSalesRow {
  productId: string
  productName: string
  variantId?: string
  variantName?: string
  totalQty: number
  totalRevenue: number
  totalGrossProfit: number
  profitMargin: number
}

export interface ProductReport {
  topBySales: ProductSalesRow[]    // top 20 by qty
  topByProfit: ProductSalesRow[]   // top 20 by grossProfit
  unsold: ProductSalesRow[]        // active products with 0 sales in range
}

export interface InventoryValueRow {
  productId: string
  productName: string
  variantId?: string
  variantName?: string
  quantity: number
  costPrice: number
  totalValue: number
  soldQty30d: number
  turnoverDays: number | null  // quantity / (soldQty30d / 30), null if no sales
}

export interface InventoryReport {
  rows: InventoryValueRow[]
  totalValue: number
  totalQty: number
}

export interface ExpenseByCategoryRow {
  category: ExpenseCategory
  total: number
  count: number
}

export interface ExpenseByChannelRow {
  channelId: string
  channelName: string
  total: number
  count: number
}

export interface ExpenseReportData {
  byCategory: ExpenseByCategoryRow[]
  byChannel: ExpenseByChannelRow[]
  general: number   // expenses with no channelId
  total: number
}

export interface SupplierDebtRow {
  supplierId: string
  supplierName: string
  totalImported: number
  totalPaid: number
  debt: number
  batchCount: number
  lastBatchDate?: Date
  lastPaymentDate?: Date
  daysSinceLastPayment: number | null
}

export interface CustomerReportRow {
  customerId: string
  customerName: string
  orderCount: number
  totalSpent: number
  avgOrderValue: number
  lastOrderDate?: Date
  daysSinceLastOrder: number | null
  isRepeat: boolean
  isChurnRisk: boolean
}

// --------------- Sprint 2.3 Functions ---------------

/** Products report: top sellers + unsold active products */
export async function loadProductReport(
  range: DateRange,
  channelId?: string,
): Promise<ProductReport> {
  const { orders, itemsByOrder } = await loadReportData(range, channelId)

  // Accumulate per productId+variantId key
  const map = new Map<string, ProductSalesRow>()
  for (const order of orders) {
    const items = itemsByOrder[order.id] ?? []
    for (const item of items) {
      const key = item.variantId ? `${item.productId}::${item.variantId}` : item.productId
      const existing = map.get(key)
      if (existing) {
        existing.totalQty += item.quantity
        existing.totalRevenue += item.sellingPrice * item.quantity
        existing.totalGrossProfit += item.grossProfit
      } else {
        map.set(key, {
          productId: item.productId,
          productName: '',
          variantId: item.variantId,
          variantName: undefined,
          totalQty: item.quantity,
          totalRevenue: item.sellingPrice * item.quantity,
          totalGrossProfit: item.grossProfit,
          profitMargin: 0,
        })
      }
    }
  }

  // Load product/variant names
  const productIds = [...new Set([...map.values()].map((r) => r.productId))]
  const [products, variants] = await Promise.all([
    productIds.length > 0 ? db.products.where('id').anyOf(productIds).toArray() : Promise.resolve([]),
    productIds.length > 0 ? db.productVariants.where('productId').anyOf(productIds).toArray() : Promise.resolve([]),
  ])
  const productNameMap = new Map(products.map((p) => [p.id, p.name]))
  const variantNameMap = new Map(variants.map((v) => [v.id, v.name]))

  for (const row of map.values()) {
    row.productName = productNameMap.get(row.productId) ?? row.productId
    if (row.variantId) row.variantName = variantNameMap.get(row.variantId)
    row.profitMargin = row.totalRevenue > 0 ? (row.totalGrossProfit / row.totalRevenue) * 100 : 0
  }

  const soldKeys = new Set(map.keys())
  const rows = [...map.values()]
  const topBySales = [...rows].sort((a, b) => b.totalQty - a.totalQty).slice(0, 20)
  const topByProfit = [...rows].sort((a, b) => b.totalGrossProfit - a.totalGrossProfit).slice(0, 20)

  // Unsold: active products not in soldKeys
  const allActiveProducts = await db.products.filter((p) => p.isActive).toArray()
  const allActiveVariants = await db.productVariants.filter((v) => v.isActive).toArray()
  const variantsByProduct = new Map<string, typeof allActiveVariants>()
  for (const v of allActiveVariants) {
    if (!variantsByProduct.has(v.productId)) variantsByProduct.set(v.productId, [])
    variantsByProduct.get(v.productId)!.push(v)
  }

  const unsold: ProductSalesRow[] = []
  for (const p of allActiveProducts) {
    const pvs = variantsByProduct.get(p.id) ?? []
    if (pvs.length > 0) {
      for (const v of pvs) {
        const key = `${p.id}::${v.id}`
        if (!soldKeys.has(key)) {
          unsold.push({ productId: p.id, productName: p.name, variantId: v.id, variantName: v.name, totalQty: 0, totalRevenue: 0, totalGrossProfit: 0, profitMargin: 0 })
        }
      }
    } else {
      if (!soldKeys.has(p.id)) {
        unsold.push({ productId: p.id, productName: p.name, totalQty: 0, totalRevenue: 0, totalGrossProfit: 0, profitMargin: 0 })
      }
    }
  }

  return { topBySales, topByProfit, unsold }
}

/** Inventory value report: current stock × cost price + 30d turnover */
export async function loadInventoryReport(): Promise<InventoryReport> {
  const now = new Date()
  const thirtyDaysAgo = addDays(now, -30)

  const [inventoryRecords, allProducts, allVariants, recentMovements, allBatches, allImportItems] =
    await Promise.all([
      db.inventoryRecords.toArray(),
      db.products.toArray(),
      db.productVariants.toArray(),
      db.stockMovements
        .where('createdAt')
        .between(thirtyDaysAgo, now, true, true)
        .toArray(),
      db.importBatches.where('status').equals('received').toArray(),
      db.importItems.toArray(),
    ])

  const productNameMap = new Map(allProducts.map((p) => [p.id, p.name]))
  const variantNameMap = new Map(allVariants.map((v) => [v.id, v.name]))

  // Latest costPrice per productId+variantId from received batches
  // Sort batches newest first, then pick first importItem found for each product/variant
  const sortedBatches = allBatches.sort(
    (a, b) => new Date(b.importDate).getTime() - new Date(a.importDate).getTime(),
  )
  const batchDateMap = new Map(sortedBatches.map((b) => [b.id, new Date(b.importDate)]))

  // Map batchId → importDate for sorting
  const itemsWithDate = allImportItems
    .filter((i) => batchDateMap.has(i.batchId))
    .map((i) => ({ ...i, importDate: batchDateMap.get(i.batchId)! }))
    .sort((a, b) => b.importDate.getTime() - a.importDate.getTime())

  const costMap = new Map<string, number>()
  for (const item of itemsWithDate) {
    const key = item.variantId ? `${item.productId}::${item.variantId}` : item.productId
    if (!costMap.has(key)) costMap.set(key, item.costPrice)
  }

  // 30d sale movements per productId+variantId
  const saleMoves = recentMovements.filter((m) => m.type === 'sale')
  const soldQtyMap = new Map<string, number>()
  for (const m of saleMoves) {
    const key = m.variantId ? `${m.productId}::${m.variantId}` : m.productId
    soldQtyMap.set(key, (soldQtyMap.get(key) ?? 0) + Math.abs(m.quantity))
  }

  const rows: InventoryValueRow[] = inventoryRecords.map((rec) => {
    const key = rec.variantId ? `${rec.productId}::${rec.variantId}` : rec.productId
    const costPrice = costMap.get(key) ?? 0
    const soldQty30d = soldQtyMap.get(key) ?? 0
    const dailySales = soldQty30d / 30
    const turnoverDays = dailySales > 0 ? rec.quantity / dailySales : null

    return {
      productId: rec.productId,
      productName: productNameMap.get(rec.productId) ?? rec.productId,
      variantId: rec.variantId,
      variantName: rec.variantId ? variantNameMap.get(rec.variantId) : undefined,
      quantity: rec.quantity,
      costPrice,
      totalValue: rec.quantity * costPrice,
      soldQty30d,
      turnoverDays,
    }
  }).sort((a, b) => b.totalValue - a.totalValue)

  const totalValue = rows.reduce((s, r) => s + r.totalValue, 0)
  const totalQty = rows.reduce((s, r) => s + r.quantity, 0)

  return { rows, totalValue, totalQty }
}

/** Expense report: breakdown by category + channel for a date range */
export async function loadExpenseReport(
  range: DateRange,
): Promise<ExpenseReportData> {
  const expenses = await db.expenses
    .where('date')
    .between(range.start, range.end, true, true)
    .toArray()

  const catMap = new Map<ExpenseCategory, { total: number; count: number }>()
  const chMap = new Map<string, { total: number; count: number }>()
  let general = 0

  for (const exp of expenses) {
    // By category
    const cat = catMap.get(exp.category) ?? { total: 0, count: 0 }
    cat.total += exp.amount
    cat.count += 1
    catMap.set(exp.category, cat)

    // By channel or general
    if (exp.channelId) {
      const ch = chMap.get(exp.channelId) ?? { total: 0, count: 0 }
      ch.total += exp.amount
      ch.count += 1
      chMap.set(exp.channelId, ch)
    } else {
      general += exp.amount
    }
  }

  // Resolve channel names
  const channelIds = [...chMap.keys()]
  const channels = channelIds.length > 0
    ? await db.salesChannels.where('id').anyOf(channelIds).toArray()
    : []
  const chNameMap = new Map(channels.map((c) => [c.id, c.name]))

  const byCategory: ExpenseByCategoryRow[] = [...catMap.entries()]
    .map(([category, d]) => ({ category, total: d.total, count: d.count }))
    .sort((a, b) => b.total - a.total)

  const byChannel: ExpenseByChannelRow[] = [...chMap.entries()]
    .map(([channelId, d]) => ({
      channelId,
      channelName: chNameMap.get(channelId) ?? channelId,
      total: d.total,
      count: d.count,
    }))
    .sort((a, b) => b.total - a.total)

  const total = expenses.reduce((s, e) => s + e.amount, 0)

  return { byCategory, byChannel, general, total }
}

/** Supplier debt report: all suppliers with received batches */
export async function loadSupplierDebtReport(): Promise<SupplierDebtRow[]> {
  const [suppliers, batches, payments] = await Promise.all([
    db.suppliers.toArray(),
    db.importBatches.where('status').equals('received').toArray(),
    db.supplierPayments.toArray(),
  ])

  const supplierMap = new Map(suppliers.map((s) => [s.id, s.name]))

  // Group batches by supplierId
  const batchMap = new Map<string, typeof batches>()
  for (const b of batches) {
    if (!batchMap.has(b.supplierId)) batchMap.set(b.supplierId, [])
    batchMap.get(b.supplierId)!.push(b)
  }

  // Group payments by supplierId
  const paymentMap = new Map<string, typeof payments>()
  for (const p of payments) {
    if (!paymentMap.has(p.supplierId)) paymentMap.set(p.supplierId, [])
    paymentMap.get(p.supplierId)!.push(p)
  }

  const now = new Date()
  const rows: SupplierDebtRow[] = []

  for (const supplierId of new Set([...batchMap.keys()])) {
    const supplierBatches = batchMap.get(supplierId) ?? []
    const supplierPayments = paymentMap.get(supplierId) ?? []

    const totalImported = supplierBatches.reduce((s, b) => s + b.totalAmount, 0)
    const totalPaid = supplierPayments.reduce((s, p) => s + p.amount, 0)
    const debt = totalImported - totalPaid

    const lastBatch = supplierBatches.sort(
      (a, b) => new Date(b.importDate).getTime() - new Date(a.importDate).getTime(),
    )[0]
    const lastPayment = supplierPayments.sort(
      (a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime(),
    )[0]

    const lastPaymentDate = lastPayment ? new Date(lastPayment.paymentDate) : undefined
    const daysSinceLastPayment = lastPaymentDate
      ? differenceInDays(now, lastPaymentDate)
      : null

    rows.push({
      supplierId,
      supplierName: supplierMap.get(supplierId) ?? supplierId,
      totalImported,
      totalPaid,
      debt,
      batchCount: supplierBatches.length,
      lastBatchDate: lastBatch ? new Date(lastBatch.importDate) : undefined,
      lastPaymentDate,
      daysSinceLastPayment,
    })
  }

  return rows.sort((a, b) => b.debt - a.debt)
}

/** Customer report: spending + retention signals within a date range */
export async function loadCustomerReport(
  range: DateRange,
): Promise<CustomerReportRow[]> {
  const orders = await db.orders
    .where('orderDate')
    .between(range.start, range.end, true, true)
    .toArray()

  const activeOrders = orders.filter((o) => o.status !== 'cancelled' && o.customerId)

  // Group by customerId
  const custMap = new Map<string, { totalSpent: number; orderCount: number; lastOrderDate: Date }>()
  for (const order of activeOrders) {
    const cid = order.customerId!
    const existing = custMap.get(cid)
    const orderDate = new Date(order.orderDate)
    if (existing) {
      existing.totalSpent += order.totalRevenue
      existing.orderCount += 1
      if (orderDate > existing.lastOrderDate) existing.lastOrderDate = orderDate
    } else {
      custMap.set(cid, { totalSpent: order.totalRevenue, orderCount: 1, lastOrderDate: orderDate })
    }
  }

  if (custMap.size === 0) return []

  const customerIds = [...custMap.keys()]
  const customers = await db.customers.where('id').anyOf(customerIds).toArray()
  const customerNameMap = new Map(customers.map((c) => [c.id, c.name]))

  const now = new Date()
  const rows: CustomerReportRow[] = [...custMap.entries()].map(([customerId, d]) => {
    const daysSinceLastOrder = differenceInDays(now, d.lastOrderDate)
    return {
      customerId,
      customerName: customerNameMap.get(customerId) ?? customerId,
      orderCount: d.orderCount,
      totalSpent: d.totalSpent,
      avgOrderValue: d.orderCount > 0 ? d.totalSpent / d.orderCount : 0,
      lastOrderDate: d.lastOrderDate,
      daysSinceLastOrder,
      isRepeat: d.orderCount > 1,
      isChurnRisk: d.orderCount >= 2 && daysSinceLastOrder > 60,
    }
  })

  return rows.sort((a, b) => b.totalSpent - a.totalSpent)
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
