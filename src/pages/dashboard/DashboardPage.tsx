import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import {
  ShoppingCart,
  TrendingUp,
  DollarSign,
  Package,
  AlertTriangle,
  Clock,
  BarChart2,
  Receipt,
} from 'lucide-react'
import { PageLayout } from '@/components/layout/PageLayout'
import { StatCard } from '@/components/shared/StatCard'
import { ChannelBadge } from '@/components/shared/ChannelBadge'
import { useOrderStore, type OrderSummary } from '@/stores/useOrderStore'
import { useInventoryStore } from '@/stores/useInventoryStore'
import { useChannelStore } from '@/stores/useChannelStore'
import { useProductStore } from '@/stores/useProductStore'
import { usePriceStore } from '@/stores/usePriceStore'
import { useExpenseStore } from '@/stores/useExpenseStore'
import { formatVND, formatPct, formatDate } from '@/utils/formatters'
import db from '@/db/db'
import type { OrderItem } from '@/types'

// ----------------------------------------------------------------
// Date helpers
// ----------------------------------------------------------------

function toDate(v: Date | string): Date {
  return v instanceof Date ? v : new Date(v)
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function inYearMonth(d: Date, year: number, month: number) {
  return d.getFullYear() === year && d.getMonth() === month
}

// Format large numbers for chart Y-axis ticks
function fmtAxis(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`
  return String(v)
}

// Calc trend %: ((current - prev) / prev) * 100, 0 if prev = 0
function trend(current: number, prev: number) {
  if (prev === 0) return 0
  return ((current - prev) / prev) * 100
}

// ----------------------------------------------------------------
// Custom chart tooltip
// ----------------------------------------------------------------

interface TooltipPayload {
  name: string
  value: number
  color: string
  dataKey: string
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: TooltipPayload[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-card px-3 py-2.5 text-sm shadow-lg">
      <p className="mb-1.5 font-medium">{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2 text-xs">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium">{formatVND(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

// ----------------------------------------------------------------
// Status badge for orders
// ----------------------------------------------------------------

const STATUS_LABEL: Record<string, string> = {
  pending: 'Chờ xử lý',
  confirmed: 'Đã xác nhận',
  shipping: 'Đang giao',
  delivered: 'Đã giao',
  cancelled: 'Đã huỷ',
  returned: 'Hoàn hàng',
}

const STATUS_CLASS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  confirmed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  shipping: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  delivered: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  cancelled: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  returned: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

// ================================================================
// DashboardPage
// ================================================================

export default function DashboardPage() {
  const navigate = useNavigate()
  const { orders, load: loadOrders } = useOrderStore()
  const { items: inventoryItems, load: loadInventory } = useInventoryStore()
  const { channels, load: loadChannels } = useChannelStore()
  const { products, load: loadProducts } = useProductStore()
  const { configs: priceConfigs, load: loadPrices } = usePriceStore()
  const { expenses, load: loadExpenses } = useExpenseStore()

  const [selectedChannelId, setSelectedChannelId] = useState('')
  const [allOrderItems, setAllOrderItems] = useState<OrderItem[]>([])

  useEffect(() => {
    loadOrders()
    loadInventory()
    loadChannels()
    loadProducts()
    loadPrices()
    loadExpenses()
    db.orderItems.toArray().then(setAllOrderItems)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Stable date references (per render cycle) ----
  const today = new Date()
  const thisY = today.getFullYear()
  const thisM = today.getMonth()
  const lastM = thisM === 0 ? 11 : thisM - 1
  const lastY = thisM === 0 ? thisY - 1 : thisY

  // ---- Filter non-cancelled orders by channel ----
  const filteredOrders = useMemo(
    () =>
      orders.filter(
        (o) => o.status !== 'cancelled' && (!selectedChannelId || o.channelId === selectedChannelId),
      ),
    [orders, selectedChannelId],
  )

  // ---- Period-segmented orders ----
  const todayOrders = useMemo(
    () => filteredOrders.filter((o) => sameDay(toDate(o.orderDate), today)),
    [filteredOrders], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const thisMonthOrders = useMemo(
    () => filteredOrders.filter((o) => inYearMonth(toDate(o.orderDate), thisY, thisM)),
    [filteredOrders, thisY, thisM],
  )

  const lastMonthOrders = useMemo(
    () => filteredOrders.filter((o) => inYearMonth(toDate(o.orderDate), lastY, lastM)),
    [filteredOrders, lastY, lastM],
  )

  // ---- KPI aggregation helpers ----
  const sumRevenue = (arr: OrderSummary[]) => arr.reduce((s, o) => s + o.totalRevenue, 0)
  const sumProfit = (arr: OrderSummary[]) => arr.reduce((s, o) => s + o.netProfit, 0)
  const avgMargin = (arr: OrderSummary[]) =>
    arr.length > 0 ? arr.reduce((s, o) => s + o.profitMargin, 0) / arr.length : 0

  const todayRevenue = sumRevenue(todayOrders)
  const todayProfit = sumProfit(todayOrders)
  const todayMargin = avgMargin(todayOrders)

  const monthRevenue = sumRevenue(thisMonthOrders)
  const monthProfit = sumProfit(thisMonthOrders)
  const monthMargin = avgMargin(thisMonthOrders)
  const lastMonthRevenue = sumRevenue(lastMonthOrders)
  const lastMonthProfit = sumProfit(lastMonthOrders)

  // ---- Expenses tháng này (lọc theo kênh nếu đang filter) ----
  const monthExpenses = useMemo(() => {
    return expenses
      .filter((e) => {
        const d = toDate(e.date)
        if (!inYearMonth(d, thisY, thisM)) return false
        // Nếu đang lọc kênh: tính chi phí của kênh đó + chi phí chung (không kênh)
        if (selectedChannelId) {
          return !e.channelId || e.channelId === selectedChannelId
        }
        return true
      })
      .reduce((s, e) => s + e.amount, 0)
  }, [expenses, thisY, thisM, selectedChannelId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Lợi nhuận ròng sau chi phí = lợi nhuận gộp đơn hàng - chi phí vận hành tháng
  const monthNetProfitAfterExpenses = monthProfit - monthExpenses

  // Cùng tính cho tháng trước để so sánh trend
  const lastMonthExpenses = useMemo(() => {
    return expenses
      .filter((e) => {
        const d = toDate(e.date)
        if (!inYearMonth(d, lastY, lastM)) return false
        if (selectedChannelId) {
          return !e.channelId || e.channelId === selectedChannelId
        }
        return true
      })
      .reduce((s, e) => s + e.amount, 0)
  }, [expenses, lastY, lastM, selectedChannelId]) // eslint-disable-line react-hooks/exhaustive-deps

  const lastMonthNetProfitAfterExpenses = lastMonthProfit - lastMonthExpenses

  // ---- 30-day chart data ----
  const chartData30 = useMemo(() => {
    const rows = []
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i)
      const dayOrders = filteredOrders.filter((o) => sameDay(toDate(o.orderDate), d))
      rows.push({
        date: `${d.getDate()}/${d.getMonth() + 1}`,
        revenue: dayOrders.reduce((s, o) => s + o.totalRevenue, 0),
        profit: dayOrders.reduce((s, o) => s + o.netProfit, 0),
      })
    }
    return rows
  }, [filteredOrders]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Donut: revenue by channel (all-channel view only) ----
  const channelChartData = useMemo(() => {
    if (selectedChannelId) return []
    const byChannel: Record<string, number> = {}
    for (const o of filteredOrders) {
      byChannel[o.channelId] = (byChannel[o.channelId] ?? 0) + o.totalRevenue
    }
    return Object.entries(byChannel)
      .map(([cid, value]) => ({
        name: channels.find((c) => c.id === cid)?.name ?? cid,
        color: channels.find((c) => c.id === cid)?.color ?? '#888888',
        value,
      }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value)
  }, [filteredOrders, channels, selectedChannelId])

  // ---- Top 5 products ----
  const topProducts = useMemo(() => {
    const filteredIds = new Set(filteredOrders.map((o) => o.id))
    const byProduct: Record<string, { qty: number; revenue: number }> = {}
    for (const item of allOrderItems) {
      if (!filteredIds.has(item.orderId)) continue
      if (!byProduct[item.productId]) byProduct[item.productId] = { qty: 0, revenue: 0 }
      byProduct[item.productId].qty += item.quantity
      byProduct[item.productId].revenue += item.sellingPrice * item.quantity
    }
    return Object.entries(byProduct)
      .map(([productId, s]) => ({
        productId,
        name: products.find((p) => p.id === productId)?.name ?? '—',
        ...s,
      }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5)
  }, [allOrderItems, filteredOrders, products])

  // ---- Low stock items ----
  const lowStockItems = useMemo(
    () => inventoryItems.filter((i) => i.isLow || i.availableQty === 0).slice(0, 8),
    [inventoryItems],
  )

  // ---- Recent 10 orders ----
  const recentOrders = useMemo(() => filteredOrders.slice(0, 10), [filteredOrders])

  // ---- Alerts ----
  const priceBelowFloor = useMemo(
    () =>
      priceConfigs
        .filter((c) => c.minSellingPrice > 0 && c.sellingPrice < c.minSellingPrice)
        .map((c) => ({ config: c, name: products.find((p) => p.id === c.productId)?.name ?? '—' }))
        .slice(0, 5),
    [priceConfigs, products],
  )

  const pendingOrders = useMemo(
    () => orders.filter((o) => o.status === 'pending').slice(0, 5),
    [orders],
  )

  const channelMap = useMemo(() => new Map(channels.map((c) => [c.id, c])), [channels])
  const activeChannels = channels.filter((c) => c.isActive)
  const totalAlerts = priceBelowFloor.length + lowStockItems.length + pendingOrders.length

  // ----------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------

  return (
    <PageLayout title="Dashboard">
      {/* ---- Channel filter ---- */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setSelectedChannelId('')}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            !selectedChannelId
              ? 'bg-primary text-primary-foreground'
              : 'border hover:bg-muted'
          }`}
        >
          Tất cả kênh
        </button>
        {activeChannels.map((ch) => (
          <button
            key={ch.id}
            onClick={() => setSelectedChannelId(ch.id)}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
              selectedChannelId === ch.id ? 'ring-2 ring-offset-1' : 'hover:bg-muted'
            }`}
            style={
              selectedChannelId === ch.id
                ? { borderColor: ch.color, color: ch.color, ringColor: ch.color }
                : {}
            }
          >
            {ch.name}
          </button>
        ))}
      </div>

      {/* ---- KPI — Hôm nay ---- */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Hôm nay
        </h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            title="Doanh thu"
            value={formatVND(todayRevenue)}
            icon={DollarSign}
            subtitle={`${todayOrders.length} đơn`}
            variant={todayRevenue > 0 ? 'success' : 'default'}
          />
          <StatCard
            title="Lợi nhuận"
            value={formatVND(todayProfit)}
            icon={TrendingUp}
            variant={todayProfit > 0 ? 'success' : todayProfit < 0 ? 'danger' : 'default'}
          />
          <StatCard
            title="Số đơn"
            value={todayOrders.length}
            icon={ShoppingCart}
            subtitle="đơn hàng"
          />
          <StatCard
            title="Margin TB"
            value={formatPct(todayMargin, 1)}
            icon={BarChart2}
            variant={todayMargin >= 20 ? 'success' : todayMargin > 0 ? 'warning' : 'default'}
          />
        </div>
      </div>

      {/* ---- KPI — Tháng này ---- */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Tháng này
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard
            title="Doanh thu"
            value={formatVND(monthRevenue)}
            icon={DollarSign}
            trend={{ value: trend(monthRevenue, lastMonthRevenue), label: 'so tháng trước' }}
          />
          <StatCard
            title="Lợi nhuận gộp"
            value={formatVND(monthProfit)}
            icon={TrendingUp}
            trend={{ value: trend(monthProfit, lastMonthProfit), label: 'so tháng trước' }}
            variant={monthProfit > 0 ? 'success' : monthProfit < 0 ? 'danger' : 'default'}
          />
          <StatCard
            title="Chi phí"
            value={formatVND(monthExpenses)}
            icon={Receipt}
            trend={{ value: trend(monthExpenses, lastMonthExpenses), label: 'so tháng trước' }}
            variant={monthExpenses > 0 ? 'danger' : 'default'}
          />
          <StatCard
            title="Lợi nhuận ròng"
            value={formatVND(monthNetProfitAfterExpenses)}
            icon={TrendingUp}
            trend={{
              value: trend(monthNetProfitAfterExpenses, lastMonthNetProfitAfterExpenses),
              label: 'so tháng trước',
            }}
            variant={
              monthNetProfitAfterExpenses > 0
                ? 'success'
                : monthNetProfitAfterExpenses < 0
                  ? 'danger'
                  : 'default'
            }
          />
          <StatCard
            title="Số đơn"
            value={thisMonthOrders.length}
            icon={ShoppingCart}
            trend={{
              value: trend(thisMonthOrders.length, lastMonthOrders.length),
              label: 'so tháng trước',
            }}
          />
          <StatCard
            title="Margin TB"
            value={formatPct(monthMargin, 1)}
            icon={BarChart2}
            variant={monthMargin >= 20 ? 'success' : monthMargin > 0 ? 'warning' : 'default'}
          />
        </div>
      </div>

      {/* ---- Charts ---- */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Revenue + profit trend (30 days) */}
        <div className="rounded-xl border bg-card p-5 lg:col-span-2">
          <h3 className="mb-4 font-medium">Doanh thu & Lợi nhuận — 30 ngày gần nhất</h3>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={chartData30} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                interval={4}
              />
              <YAxis
                tickFormatter={fmtAxis}
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                width={50}
              />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="revenue" name="Doanh thu" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              <Line
                dataKey="profit"
                name="Lợi nhuận"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Donut: revenue by channel */}
        <div className="rounded-xl border bg-card p-5">
          <h3 className="mb-4 font-medium">Doanh thu theo kênh</h3>
          {channelChartData.length === 0 ? (
            <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
              {selectedChannelId ? 'Đang xem 1 kênh' : 'Chưa có dữ liệu'}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={channelChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  dataKey="value"
                  nameKey="name"
                >
                  {channelChartData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string) => [formatVND(value), name]}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={(value) => (
                    <span style={{ fontSize: 12 }}>{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ---- Top products + Low stock ---- */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top 5 products */}
        <div className="rounded-xl border bg-card">
          <div className="flex items-center gap-2 border-b px-5 py-4">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-medium">Top 5 sản phẩm bán chạy</h3>
          </div>
          <div className="p-5">
            {topProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Chưa có dữ liệu bán hàng.</p>
            ) : (
              <div className="space-y-3">
                {topProducts.map((p, i) => (
                  <div
                    key={p.productId}
                    className="flex cursor-pointer items-center gap-3 rounded-lg p-2 hover:bg-muted/50"
                    onClick={() => navigate(`/products/${p.productId}`)}
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{formatVND(p.revenue)}</p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold">{p.qty} {products.find(pr => pr.id === p.productId)?.unit ?? 'cái'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Low stock */}
        <div className="rounded-xl border bg-card">
          <div className="flex items-center gap-2 border-b px-5 py-4">
            <Package className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-medium">Hàng sắp hết / hết hàng</h3>
          </div>
          <div className="p-5">
            {lowStockItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">Không có sản phẩm cần chú ý.</p>
            ) : (
              <div className="space-y-2">
                {lowStockItems.map((item) => (
                  <div
                    key={item.record.id}
                    className="flex cursor-pointer items-center justify-between rounded-lg p-2 hover:bg-muted/50"
                    onClick={() => navigate(`/products/${item.product.id}`)}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.product.name}</p>
                      {item.variantName && (
                        <p className="text-xs text-muted-foreground">{item.variantName}</p>
                      )}
                    </div>
                    <span
                      className={`ml-3 shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        item.availableQty === 0
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                      }`}
                    >
                      {item.availableQty === 0 ? 'Hết hàng' : `Còn ${item.availableQty}`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ---- Recent orders ---- */}
      <div className="rounded-xl border bg-card">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-medium">10 đơn hàng gần nhất</h3>
          </div>
          <button
            onClick={() => navigate('/orders')}
            className="text-sm text-primary hover:underline"
          >
            Xem tất cả
          </button>
        </div>
        <div className="overflow-x-auto">
          {recentOrders.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">Chưa có đơn hàng.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="px-5 py-3 font-medium text-muted-foreground">Mã đơn</th>
                  <th className="px-5 py-3 font-medium text-muted-foreground">Kênh</th>
                  <th className="px-5 py-3 font-medium text-muted-foreground">Ngày</th>
                  <th className="px-5 py-3 text-right font-medium text-muted-foreground">Doanh thu</th>
                  <th className="px-5 py-3 text-right font-medium text-muted-foreground">Lợi nhuận</th>
                  <th className="px-5 py-3 font-medium text-muted-foreground">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {recentOrders.map((o) => {
                  const ch = channelMap.get(o.channelId)
                  return (
                    <tr
                      key={o.id}
                      className="cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => navigate(`/orders/${o.id}`)}
                    >
                      <td className="px-5 py-3 font-mono text-xs">{o.orderCode}</td>
                      <td className="px-5 py-3">
                        {ch ? (
                          <ChannelBadge name={ch.name} color={ch.color} />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {formatDate(toDate(o.orderDate))}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums font-medium">
                        {formatVND(o.totalRevenue)}
                      </td>
                      <td
                        className={`px-5 py-3 text-right tabular-nums font-medium ${
                          o.netProfit >= 0
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-500'
                        }`}
                      >
                        {formatVND(o.netProfit)}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            STATUS_CLASS[o.status] ?? ''
                          }`}
                        >
                          {STATUS_LABEL[o.status] ?? o.status}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ---- Alert panel ---- */}
      {totalAlerts > 0 && (
        <div className="rounded-xl border border-yellow-300 bg-yellow-50 p-5 dark:border-yellow-800 dark:bg-yellow-900/10">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            <h3 className="font-semibold text-yellow-800 dark:text-yellow-300">
              Cảnh báo ({totalAlerts})
            </h3>
          </div>
          <div className="space-y-3">
            {/* Price below floor */}
            {priceBelowFloor.length > 0 && (
              <div>
                <p className="mb-1.5 text-sm font-medium text-yellow-800 dark:text-yellow-300">
                  Giá bán dưới giá sàn ({priceBelowFloor.length} sản phẩm)
                </p>
                <div className="space-y-1">
                  {priceBelowFloor.map(({ config, name }) => (
                    <div
                      key={config.id}
                      className="flex items-center justify-between rounded-lg bg-white/60 px-3 py-2 text-sm dark:bg-black/20"
                    >
                      <span
                        className="cursor-pointer text-yellow-900 hover:underline dark:text-yellow-200"
                        onClick={() => navigate(`/products/${config.productId}`)}
                      >
                        {name}
                      </span>
                      <span className="text-xs text-yellow-700 dark:text-yellow-400">
                        {formatVND(config.sellingPrice)} &lt; sàn {formatVND(config.minSellingPrice)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Low stock alert summary */}
            {lowStockItems.filter((i) => i.availableQty === 0).length > 0 && (
              <p className="text-sm text-yellow-800 dark:text-yellow-300">
                <span className="font-semibold">
                  {lowStockItems.filter((i) => i.availableQty === 0).length} sản phẩm hết hàng
                </span>{' '}
                —{' '}
                <button
                  onClick={() => navigate('/inventory')}
                  className="underline hover:text-yellow-900 dark:hover:text-yellow-100"
                >
                  Xem tồn kho
                </button>
              </p>
            )}

            {/* Pending orders */}
            {pendingOrders.length > 0 && (
              <p className="text-sm text-yellow-800 dark:text-yellow-300">
                <span className="font-semibold">{pendingOrders.length} đơn đang chờ xử lý</span>{' '}
                —{' '}
                <button
                  onClick={() => navigate('/orders')}
                  className="underline hover:text-yellow-900 dark:hover:text-yellow-100"
                >
                  Xem đơn hàng
                </button>
              </p>
            )}
          </div>
        </div>
      )}
    </PageLayout>
  )
}
