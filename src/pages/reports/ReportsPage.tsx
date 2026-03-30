import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  ComposedChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { BarChart2, Download, FileSpreadsheet, FileText, TrendingDown, TrendingUp } from 'lucide-react'
import { PageLayout } from '@/components/layout/PageLayout'
import { StatCard } from '@/components/shared/StatCard'
import { useChannelStore } from '@/stores/useChannelStore'
import {
  DATE_PRESETS,
  autoGroupBy,
  aggregateByPeriod,
  calcBreakEven,
  getComparisonRange,
  getPresetRange,
  loadReportData,
  summarizeChannels,
  loadProductReport,
  loadInventoryReport,
  loadExpenseReport,
  loadSupplierDebtReport,
  loadCustomerReport,
  type BreakEvenData,
  type ChannelSummary,
  type DatePresetKey,
  type DateRange,
  type GroupBy,
  type PeriodData,
  type ProductReport,
  type ProductSalesRow,
  type InventoryReport,
  type ExpenseReportData,
  type SupplierDebtRow,
  type CustomerReportRow,
} from '@/utils/reportAggregator'
import { exportToXlsx, exportToPdf } from '@/utils/exportUtils'
import { formatVND, formatPct, formatDate } from '@/utils/formatters'

// --------------- Types ---------------

type TabId = 'revenue' | 'profit' | 'channels' | 'products' | 'inventory' | 'expenses' | 'debt' | 'customers' | 'breakeven'

const TABS: { id: TabId; label: string }[] = [
  { id: 'revenue',   label: '10.1 Doanh thu' },
  { id: 'profit',    label: '10.2 Lợi nhuận' },
  { id: 'channels',  label: '10.3 Kênh bán' },
  { id: 'products',  label: '10.4 Sản phẩm' },
  { id: 'inventory', label: '10.5 Tồn kho' },
  { id: 'expenses',  label: '10.6 Chi phí' },
  { id: 'debt',      label: '10.7 Công nợ NCC' },
  { id: 'customers', label: '10.8 Khách hàng' },
  { id: 'breakeven', label: '10.9 Break-even' },
]

const GROUPBY_LABELS: Record<GroupBy, string> = {
  day: 'Ngày', week: 'Tuần', month: 'Tháng', quarter: 'Quý', year: 'Năm',
}

const CHANNEL_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16',
]

// Short VND formatter for chart axes
function fmtShort(val: number): string {
  if (Math.abs(val) >= 1_000_000_000) return `${(val / 1_000_000_000).toFixed(1)}T`
  if (Math.abs(val) >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}Tr`
  if (Math.abs(val) >= 1_000) return `${(val / 1_000).toFixed(0)}k`
  return String(val)
}

function pctChange(current: number, prev: number): number | null {
  if (prev === 0) return null
  return ((current - prev) / prev) * 100
}

// --------------- Main component ---------------

export default function ReportsPage() {
  const { channels, load: loadChannels } = useChannelStore()

  const [activeTab, setActiveTab] = useState<TabId>('revenue')
  const [preset, setPreset] = useState<DatePresetKey>('month')
  const [range, setRange] = useState<DateRange>(() => getPresetRange('month'))
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [filterChannelId, setFilterChannelId] = useState('')
  const [groupBy, setGroupBy] = useState<GroupBy>('day')
  const [showComparison, setShowComparison] = useState(true)

  const [periods, setPeriods] = useState<PeriodData[]>([])
  const [compPeriods, setCompPeriods] = useState<PeriodData[]>([])
  const [channelSummaries, setChannelSummaries] = useState<ChannelSummary[]>([])
  const [breakEven, setBreakEven] = useState<BreakEvenData | null>(null)
  const [productReport, setProductReport] = useState<ProductReport | null>(null)
  const [inventoryReport, setInventoryReport] = useState<InventoryReport | null>(null)
  const [expenseReport, setExpenseReport] = useState<ExpenseReportData | null>(null)
  const [debtReport, setDebtReport] = useState<SupplierDebtRow[] | null>(null)
  const [customerReport, setCustomerReport] = useState<CustomerReportRow[] | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (channels.length === 0) loadChannels()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadData = useCallback(async (r: DateRange, cid: string, tab: TabId) => {
    setLoading(true)
    try {
      const gb = autoGroupBy(r)
      setGroupBy(gb)

      const chs = channels.length > 0 ? channels : await (async () => {
        await loadChannels()
        return useChannelStore.getState().channels
      })()

      const [mainData, compData, beData] = await Promise.all([
        loadReportData(r, cid || undefined),
        showComparison ? loadReportData(getComparisonRange(r), cid || undefined) : Promise.resolve(null),
        tab === 'breakeven' ? calcBreakEven() : Promise.resolve(null),
      ])

      setPeriods(aggregateByPeriod(mainData.orders, mainData.itemsByOrder, r, gb))
      setChannelSummaries(summarizeChannels(mainData.orders, mainData.itemsByOrder, chs))
      if (compData) {
        setCompPeriods(aggregateByPeriod(compData.orders, compData.itemsByOrder, getComparisonRange(r), gb))
      } else {
        setCompPeriods([])
      }
      if (beData) setBreakEven(beData)

      // Lazy-load tab-specific data
      if (tab === 'products') {
        loadProductReport(r, cid || undefined).then(setProductReport)
      } else if (tab === 'inventory') {
        loadInventoryReport().then(setInventoryReport)
      } else if (tab === 'expenses') {
        loadExpenseReport(r).then(setExpenseReport)
      } else if (tab === 'debt') {
        loadSupplierDebtReport().then(setDebtReport)
      } else if (tab === 'customers') {
        loadCustomerReport(r).then(setCustomerReport)
      }
    } finally {
      setLoading(false)
    }
  }, [channels, showComparison]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadData(range, filterChannelId, activeTab)
  }, [range, filterChannelId, activeTab, showComparison]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reload tab-specific data when switching tabs (if not already loaded for current params)
  useEffect(() => {
    if (activeTab === 'breakeven' && !breakEven) {
      calcBreakEven().then(setBreakEven)
    } else if (activeTab === 'products' && !productReport) {
      loadProductReport(range, filterChannelId || undefined).then(setProductReport)
    } else if (activeTab === 'inventory' && !inventoryReport) {
      loadInventoryReport().then(setInventoryReport)
    } else if (activeTab === 'expenses' && !expenseReport) {
      loadExpenseReport(range).then(setExpenseReport)
    } else if (activeTab === 'debt' && !debtReport) {
      loadSupplierDebtReport().then(setDebtReport)
    } else if (activeTab === 'customers' && !customerReport) {
      loadCustomerReport(range).then(setCustomerReport)
    }
  }, [activeTab]) // eslint-disable-line react-hooks/exhaustive-deps

  const handlePreset = (key: DatePresetKey) => {
    setPreset(key)
    setRange(getPresetRange(key))
  }

  const handleCustomRange = () => {
    if (!customStart || !customEnd) return
    const [sy, sm, sd] = customStart.split('-').map(Number)
    const [ey, em, ed] = customEnd.split('-').map(Number)
    const start = new Date(sy, sm - 1, sd, 0, 0, 0)
    const end = new Date(ey, em - 1, ed, 23, 59, 59)
    if (start > end) return
    setPreset('month') // reset preset visual
    setRange({ start, end, label: `${formatDate(start)} – ${formatDate(end)}` })
  }

  // Totals
  const totals = useMemo(() => {
    const revenue = periods.reduce((s, p) => s + p.revenue, 0)
    const grossProfit = periods.reduce((s, p) => s + p.grossProfit, 0)
    const orderCount = periods.reduce((s, p) => s + p.orderCount, 0)
    const margin = revenue > 0 ? (grossProfit / revenue) * 100 : 0
    return { revenue, grossProfit, orderCount, margin }
  }, [periods])

  const compTotals = useMemo(() => {
    const revenue = compPeriods.reduce((s, p) => s + p.revenue, 0)
    const grossProfit = compPeriods.reduce((s, p) => s + p.grossProfit, 0)
    const orderCount = compPeriods.reduce((s, p) => s + p.orderCount, 0)
    return { revenue, grossProfit, orderCount }
  }, [compPeriods])

  // Per-channel chart data
  const channelColors = useMemo(() => {
    const map: Record<string, string> = {}
    channels.forEach((c, i) => { map[c.id] = c.color || CHANNEL_COLORS[i % CHANNEL_COLORS.length] })
    return map
  }, [channels])

  const inputCls = 'rounded-lg border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring'
  const btnCls = 'rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-muted'

  return (
    <PageLayout title="Báo cáo">
      {/* ---- Filter bar ---- */}
      <div className="space-y-3">
        {/* Preset buttons */}
        <div className="flex flex-wrap gap-2">
          {DATE_PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => handlePreset(p.key)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium border transition-colors ${
                preset === p.key
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'hover:bg-muted'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom range + channel filter */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Tùy chỉnh:</span>
          <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className={inputCls} />
          <span className="text-muted-foreground">–</span>
          <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className={inputCls} />
          <button onClick={handleCustomRange} className={btnCls}>Áp dụng</button>

          <div className="ml-auto flex items-center gap-2">
            <select
              value={filterChannelId}
              onChange={(e) => setFilterChannelId(e.target.value)}
              className={inputCls}
            >
              <option value="">Tất cả kênh</option>
              {channels.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={showComparison}
                onChange={(e) => setShowComparison(e.target.checked)}
                className="rounded"
              />
              So sánh cùng kỳ
            </label>
          </div>
        </div>

        {/* Active range info */}
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{range.label}</span>
          <span>·</span>
          <span>Nhóm: {GROUPBY_LABELS[groupBy]}</span>
          {loading && <span className="text-xs animate-pulse">Đang tải...</span>}
        </div>
      </div>

      {/* ---- Tab navigation ---- */}
      <div className="flex border-b">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ---- Tab content ---- */}
      {activeTab === 'revenue' && (
        <RevenueTab
          periods={periods}
          compPeriods={compPeriods}
          totals={totals}
          compTotals={compTotals}
          showComparison={showComparison}
          channelColors={channelColors}
          channels={channels}
          range={range}
        />
      )}

      {activeTab === 'profit' && (
        <ProfitTab
          periods={periods}
          compPeriods={compPeriods}
          totals={totals}
          compTotals={compTotals}
          showComparison={showComparison}
          channelSummaries={channelSummaries}
          range={range}
        />
      )}

      {activeTab === 'channels' && (
        <ChannelsTab channelSummaries={channelSummaries} range={range} />
      )}

      {activeTab === 'products' && (
        <ProductsTab data={productReport} range={range} />
      )}

      {activeTab === 'inventory' && (
        <InventoryTab data={inventoryReport} />
      )}

      {activeTab === 'expenses' && (
        <ExpensesReportTab data={expenseReport} range={range} />
      )}

      {activeTab === 'debt' && (
        <DebtTab data={debtReport} />
      )}

      {activeTab === 'customers' && (
        <CustomersTab data={customerReport} range={range} />
      )}

      {activeTab === 'breakeven' && (
        <BreakevenTab data={breakEven} />
      )}
    </PageLayout>
  )
}

// --------------- Revenue Tab (10.1) ---------------

function RevenueTab({
  periods,
  compPeriods,
  totals,
  compTotals,
  showComparison,
  channelColors,
  channels,
  range,
}: {
  periods: PeriodData[]
  compPeriods: PeriodData[]
  totals: { revenue: number; grossProfit: number; orderCount: number; margin: number }
  compTotals: { revenue: number; grossProfit: number; orderCount: number }
  showComparison: boolean
  channelColors: Record<string, string>
  channels: { id: string; name: string }[]
  range: DateRange
}) {
  const revChange = pctChange(totals.revenue, compTotals.revenue)
  const orderChange = pctChange(totals.orderCount, compTotals.orderCount)
  const avgOrder = totals.orderCount > 0 ? totals.revenue / totals.orderCount : 0
  const compAvgOrder = compTotals.orderCount > 0 ? compTotals.revenue / compTotals.orderCount : 0
  const avgChange = pctChange(avgOrder, compAvgOrder)

  const chartData = periods.map((p, i) => ({
    period: p.period,
    'Doanh thu': p.revenue,
    'Cùng kỳ': compPeriods[i]?.revenue ?? 0,
  }))

  const handleExportXlsx = async () => {
    await exportToXlsx(
      'Doanh thu',
      ['Kỳ', 'Doanh thu', 'Số đơn', 'Doanh thu TB/đơn'],
      periods.map((p) => [p.period, p.revenue, p.orderCount, p.orderCount > 0 ? Math.round(p.revenue / p.orderCount) : 0]),
      `bao-cao-doanh-thu-${range.label}.xlsx`,
    )
  }

  const handleExportPdf = async () => {
    await exportToPdf(
      `Báo cáo Doanh thu — ${range.label}`,
      ['Kỳ', 'Doanh thu', 'Số đơn', 'DT TB/đơn'],
      periods.map((p) => [p.period, formatVND(p.revenue), p.orderCount, formatVND(p.orderCount > 0 ? Math.round(p.revenue / p.orderCount) : 0)]),
      `bao-cao-doanh-thu-${range.label}.pdf`,
    )
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          title="Doanh thu"
          value={formatVND(totals.revenue)}
          trend={revChange !== null ? { value: revChange, label: 'vs cùng kỳ' } : undefined}
        />
        <StatCard
          title="Số đơn"
          value={String(totals.orderCount)}
          trend={orderChange !== null ? { value: orderChange, label: 'vs cùng kỳ' } : undefined}
        />
        <StatCard
          title="DT TB / đơn"
          value={formatVND(avgOrder)}
          trend={avgChange !== null ? { value: avgChange, label: 'vs cùng kỳ' } : undefined}
        />
        <StatCard title="Biên lợi nhuận" value={formatPct(totals.margin)} />
      </div>

      {/* Revenue chart */}
      <ChartCard
        title="Doanh thu theo kỳ"
        onExportXlsx={handleExportXlsx}
        onExportPdf={handleExportPdf}
      >
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="period" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11 }} width={60} />
            <Tooltip
              formatter={(v: number, name: string) => [formatVND(v), name]}
              contentStyle={{ borderRadius: 8, fontSize: 12 }}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="Doanh thu"
              stroke="#3b82f6"
              fill="#3b82f620"
              strokeWidth={2}
            />
            {showComparison && compPeriods.length > 0 && (
              <Area
                type="monotone"
                dataKey="Cùng kỳ"
                stroke="#94a3b8"
                fill="transparent"
                strokeWidth={1.5}
                strokeDasharray="5 5"
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Data table */}
      <SectionCard title="Bảng dữ liệu">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Kỳ</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Doanh thu</th>
                {showComparison && <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Cùng kỳ</th>}
                {showComparison && <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Thay đổi</th>}
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Số đơn</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {periods.map((p, i) => {
                const comp = compPeriods[i]
                const chg = comp ? pctChange(p.revenue, comp.revenue) : null
                return (
                  <tr key={p.sortKey} className="hover:bg-muted/20">
                    <td className="px-4 py-2.5 font-medium">{p.period}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{formatVND(p.revenue)}</td>
                    {showComparison && <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{comp ? formatVND(comp.revenue) : '—'}</td>}
                    {showComparison && (
                      <td className="px-4 py-2.5 text-right">
                        {chg !== null ? <TrendBadge value={chg} /> : '—'}
                      </td>
                    )}
                    <td className="px-4 py-2.5 text-right tabular-nums">{p.orderCount}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="border-t-2 bg-muted/20">
              <tr>
                <td className="px-4 py-2.5 font-semibold">Tổng</td>
                <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{formatVND(totals.revenue)}</td>
                {showComparison && <td className="px-4 py-2.5 text-right tabular-nums">{formatVND(compTotals.revenue)}</td>}
                {showComparison && (
                  <td className="px-4 py-2.5 text-right">
                    {pctChange(totals.revenue, compTotals.revenue) !== null
                      ? <TrendBadge value={pctChange(totals.revenue, compTotals.revenue)!} />
                      : '—'}
                  </td>
                )}
                <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{totals.orderCount}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </SectionCard>
    </div>
  )
}

// --------------- Profit Tab (10.2) ---------------

function ProfitTab({
  periods,
  compPeriods,
  totals,
  compTotals,
  showComparison,
  channelSummaries,
  range,
}: {
  periods: PeriodData[]
  compPeriods: PeriodData[]
  totals: { revenue: number; grossProfit: number; orderCount: number; margin: number }
  compTotals: { revenue: number; grossProfit: number; orderCount: number }
  showComparison: boolean
  channelSummaries: ChannelSummary[]
  range: DateRange
}) {
  const profitChange = pctChange(totals.grossProfit, compTotals.grossProfit)

  const chartData = periods.map((p, i) => ({
    period: p.period,
    'Lợi nhuận': p.grossProfit,
    'Biên LN%': parseFloat(p.margin.toFixed(1)),
    'Cùng kỳ': compPeriods[i]?.grossProfit ?? 0,
  }))

  const channelBarData = channelSummaries.map((c) => ({
    name: c.channelName,
    'Doanh thu': c.revenue,
    'LN gộp': c.grossProfit,
  }))

  const handleExportXlsx = async () => {
    await exportToXlsx(
      'Lợi nhuận',
      ['Kỳ', 'LN gộp', 'Biên LN%', 'Doanh thu'],
      periods.map((p) => [p.period, p.grossProfit, parseFloat(p.margin.toFixed(1)), p.revenue]),
      `bao-cao-loi-nhuan-${range.label}.xlsx`,
    )
  }

  const handleExportPdf = async () => {
    await exportToPdf(
      `Báo cáo Lợi nhuận — ${range.label}`,
      ['Kỳ', 'LN gộp', 'Biên LN%', 'Doanh thu'],
      periods.map((p) => [p.period, formatVND(p.grossProfit), formatPct(p.margin), formatVND(p.revenue)]),
      `bao-cao-loi-nhuan-${range.label}.pdf`,
    )
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          title="LN gộp"
          value={formatVND(totals.grossProfit)}
          trend={profitChange !== null ? { value: profitChange, label: 'vs cùng kỳ' } : undefined}
          variant={totals.grossProfit >= 0 ? 'success' : 'danger'}
        />
        <StatCard title="Biên LN TB" value={formatPct(totals.margin)} />
        <StatCard title="Doanh thu" value={formatVND(totals.revenue)} />
        <StatCard title="Số đơn" value={String(totals.orderCount)} />
      </div>

      {/* Profit over time chart */}
      <ChartCard
        title="Lợi nhuận theo kỳ"
        onExportXlsx={handleExportXlsx}
        onExportPdf={handleExportPdf}
      >
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={chartData} margin={{ top: 5, right: 40, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="period" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="left" tickFormatter={fmtShort} tick={{ fontSize: 11 }} width={60} />
            <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} width={45} />
            <Tooltip
              formatter={(v: number, name: string) =>
                name === 'Biên LN%' ? [`${v}%`, name] : [formatVND(v), name]
              }
              contentStyle={{ borderRadius: 8, fontSize: 12 }}
            />
            <Legend />
            <Bar yAxisId="left" dataKey="Lợi nhuận" fill="#10b981" radius={[3, 3, 0, 0]} />
            {showComparison && compPeriods.length > 0 && (
              <Bar yAxisId="left" dataKey="Cùng kỳ" fill="#94a3b820" stroke="#94a3b8" strokeWidth={1} radius={[3, 3, 0, 0]} />
            )}
            <Line yAxisId="right" type="monotone" dataKey="Biên LN%" stroke="#f59e0b" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Profit by channel bar chart */}
      {channelBarData.length > 0 && (
        <ChartCard title="Lợi nhuận theo kênh">
          <ResponsiveContainer width="100%" height={Math.max(200, channelBarData.length * 60)}>
            <BarChart
              layout="vertical"
              data={channelBarData}
              margin={{ top: 5, right: 20, left: 60, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" horizontal={false} />
              <XAxis type="number" tickFormatter={fmtShort} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
              <Tooltip formatter={(v: number, n: string) => [formatVND(v), n]} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Legend />
              <Bar dataKey="Doanh thu" fill="#3b82f630" stroke="#3b82f6" strokeWidth={1} radius={[0, 3, 3, 0]} />
              <Bar dataKey="LN gộp" fill="#10b981" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </div>
  )
}

// --------------- Channels Tab (10.3) ---------------

function ChannelsTab({
  channelSummaries,
  range,
}: {
  channelSummaries: ChannelSummary[]
  range: DateRange
}) {
  const handleExportXlsx = async () => {
    await exportToXlsx(
      'Kênh bán',
      ['Kênh', 'Số đơn', 'Doanh thu', 'LN gộp', 'Biên LN%', 'Phí sàn', 'Phí TT'],
      channelSummaries.map((c) => [
        c.channelName, c.orderCount, c.revenue, c.grossProfit,
        parseFloat(c.profitMargin.toFixed(1)), c.platformFees, c.paymentFees,
      ]),
      `bao-cao-kenh-ban-${range.label}.xlsx`,
    )
  }

  const handleExportPdf = async () => {
    await exportToPdf(
      `Báo cáo Kênh bán — ${range.label}`,
      ['Kênh', 'Đơn', 'Doanh thu', 'LN gộp', 'Biên', 'Phí sàn'],
      channelSummaries.map((c) => [
        c.channelName, c.orderCount, formatVND(c.revenue), formatVND(c.grossProfit),
        formatPct(c.profitMargin), formatVND(c.platformFees),
      ]),
      `bao-cao-kenh-ban-${range.label}.pdf`,
    )
  }

  if (channelSummaries.length === 0) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        Không có dữ liệu kênh trong kỳ này
      </div>
    )
  }

  const totalRevenue = channelSummaries.reduce((s, c) => s + c.revenue, 0)

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard title="Kênh có đơn" value={String(channelSummaries.length)} />
        <StatCard title="Tổng đơn" value={String(channelSummaries.reduce((s, c) => s + c.orderCount, 0))} />
        <StatCard title="Tổng phí sàn" value={formatVND(channelSummaries.reduce((s, c) => s + c.platformFees, 0))} />
        <StatCard title="Tổng phí TT" value={formatVND(channelSummaries.reduce((s, c) => s + c.paymentFees, 0))} />
      </div>

      {/* Channel comparison table */}
      <SectionCard
        title="So sánh kênh bán"
        action={
          <div className="flex gap-2">
            <ExportBtn icon="xlsx" onClick={handleExportXlsx} />
            <ExportBtn icon="pdf" onClick={handleExportPdf} />
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Kênh</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Đơn</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Doanh thu</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Tỷ trọng</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">LN gộp</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Biên LN</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Phí sàn</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Phí TT</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {channelSummaries.map((c) => {
                const share = totalRevenue > 0 ? (c.revenue / totalRevenue) * 100 : 0
                return (
                  <tr key={c.channelId} className="hover:bg-muted/20">
                    <td className="px-4 py-2.5">
                      <span
                        className="rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                        style={{ backgroundColor: c.color || '#3b82f6' }}
                      >
                        {c.channelName}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{c.orderCount}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium">{formatVND(c.revenue)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-1.5 w-20 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${share}%` }}
                          />
                        </div>
                        <span className="tabular-nums text-xs text-muted-foreground w-10 text-right">
                          {formatPct(share, 0)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      <span className={c.grossProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600'}>
                        {formatVND(c.grossProfit)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      <span className={c.profitMargin >= 20 ? 'text-green-600 dark:text-green-400' : c.profitMargin >= 10 ? 'text-yellow-600' : 'text-red-600'}>
                        {formatPct(c.profitMargin)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{formatVND(c.platformFees)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{formatVND(c.paymentFees)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  )
}

// --------------- Break-even Tab (10.9) ---------------

function BreakevenTab({ data }: { data: BreakEvenData | null }) {
  if (!data) {
    return <div className="py-16 text-center text-muted-foreground">Đang tính toán...</div>
  }

  const progressPct = Math.min(100, Math.max(0, data.progressPct))
  const reachedBreakeven = data.currentGrossProfit >= data.totalExpenses

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          title="Chi phí tháng này"
          value={formatVND(data.totalExpenses)}
          subtitle={data.totalExpenses === 0 ? 'Chưa có dữ liệu chi phí' : undefined}
        />
        <StatCard
          title="LN gộp hiện tại"
          value={formatVND(data.currentGrossProfit)}
          variant={data.currentGrossProfit >= 0 ? 'success' : 'danger'}
        />
        <StatCard
          title="DT cần đạt break-even"
          value={data.avgMarginPct > 0 ? formatVND(data.breakEvenRevenue) : '—'}
        />
        <StatCard
          title="Còn lại trong tháng"
          value={`${data.daysLeft} ngày`}
          subtitle={`/ ${data.totalDaysInMonth} ngày`}
        />
      </div>

      {/* Progress bar */}
      <SectionCard title={`Tiến độ break-even — Tháng ${new Date().getMonth() + 1}/${new Date().getFullYear()}`}>
        <div className="space-y-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">LN gộp / Chi phí</span>
            <span className={`font-semibold ${reachedBreakeven ? 'text-green-600' : ''}`}>
              {formatVND(data.currentGrossProfit)} / {formatVND(data.totalExpenses)}
            </span>
          </div>

          <div className="relative h-6 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                reachedBreakeven
                  ? 'bg-green-500'
                  : progressPct >= 70
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
              }`}
              style={{ width: `${progressPct}%` }}
            />
            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white drop-shadow">
              {formatPct(progressPct, 0)}
            </span>
          </div>

          {reachedBreakeven ? (
            <div className="rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950/20">
              <p className="text-sm font-medium text-green-700 dark:text-green-400">
                ✓ Đã đạt break-even tháng này! Lợi nhuận ròng: {formatVND(data.currentGrossProfit - data.totalExpenses)}
              </p>
            </div>
          ) : (
            <div className="rounded-xl border bg-muted/40 p-4 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Còn thiếu để break-even</span>
                <span className="font-medium tabular-nums">
                  {formatVND(Math.max(0, data.totalExpenses - data.currentGrossProfit))}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Biên LN TB hiện tại</span>
                <span className="font-medium tabular-nums">{formatPct(data.avgMarginPct)}</span>
              </div>
              {data.avgMarginPct > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cần thêm doanh thu</span>
                  <span className="font-medium tabular-nums text-blue-600">
                    {formatVND(Math.max(0, data.breakEvenRevenue - data.currentRevenue))}
                  </span>
                </div>
              )}
              {data.daysLeft > 0 && data.avgMarginPct > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">DT cần/ngày còn lại</span>
                  <span className="font-medium tabular-nums">
                    {formatVND(Math.max(0, (data.breakEvenRevenue - data.currentRevenue) / data.daysLeft))}
                  </span>
                </div>
              )}
            </div>
          )}

          {data.totalExpenses === 0 && (
            <p className="text-sm text-muted-foreground">
              * Chưa có dữ liệu chi phí. Vào module <strong>Chi phí</strong> để thêm chi phí vận hành.
            </p>
          )}
        </div>
      </SectionCard>
    </div>
  )
}

// --------------- Products Tab (10.4) ---------------

const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  packaging: 'Đóng gói', shipping: 'Vận chuyển', marketing: 'Marketing',
  software: 'Phần mềm', salary: 'Lương', rent: 'Mặt bằng', other: 'Khác',
}

function ProductsTab({ data, range }: { data: ProductReport | null; range: DateRange }) {
  if (!data) return <div className="py-16 text-center text-muted-foreground">Đang tải...</div>

  const handleExportXlsx = async () => {
    const { exportMultiSheetXlsx } = await import('@/utils/exportUtils')
    await exportMultiSheetXlsx(
      [
        {
          name: 'Top bán chạy',
          headers: ['Sản phẩm', 'Biến thể', 'SL bán', 'Doanh thu', 'LN gộp', 'Biên LN%'],
          rows: data.topBySales.map((r) => [r.productName, r.variantName ?? '', r.totalQty, r.totalRevenue, r.totalGrossProfit, parseFloat(r.profitMargin.toFixed(1))]),
        },
        {
          name: 'Top lợi nhuận',
          headers: ['Sản phẩm', 'Biến thể', 'SL bán', 'Doanh thu', 'LN gộp', 'Biên LN%'],
          rows: data.topByProfit.map((r) => [r.productName, r.variantName ?? '', r.totalQty, r.totalRevenue, r.totalGrossProfit, parseFloat(r.profitMargin.toFixed(1))]),
        },
        {
          name: 'Chưa bán',
          headers: ['Sản phẩm', 'Biến thể'],
          rows: data.unsold.map((r) => [r.productName, r.variantName ?? '']),
        },
      ],
      `bao-cao-san-pham-${range.label}.xlsx`,
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard title="SP bán chạy nhất" value={data.topBySales[0]?.productName ?? '—'} subtitle={data.topBySales[0] ? `${data.topBySales[0].totalQty} cái` : undefined} />
        <StatCard title="SP lợi nhuận cao nhất" value={data.topByProfit[0]?.productName ?? '—'} subtitle={data.topByProfit[0] ? formatVND(data.topByProfit[0].totalGrossProfit) : undefined} />
        <StatCard title="SP chưa bán" value={String(data.unsold.length)} variant={data.unsold.length > 0 ? 'warning' : 'default'} />
      </div>

      <SectionCard
        title="Top 20 sản phẩm bán chạy (theo số lượng)"
        action={<ExportBtn icon="xlsx" onClick={handleExportXlsx} />}
      >
        <SimpleProductTable rows={data.topBySales} />
      </SectionCard>

      <SectionCard title="Top 20 sản phẩm lợi nhuận cao nhất">
        <SimpleProductTable rows={data.topByProfit} />
      </SectionCard>

      {data.unsold.length > 0 && (
        <SectionCard title={`Sản phẩm chưa bán trong kỳ (${data.unsold.length})`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Sản phẩm</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Biến thể</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.unsold.slice(0, 50).map((r, i) => (
                  <tr key={`${r.productId}-${r.variantId ?? i}`} className="hover:bg-muted/20">
                    <td className="px-4 py-2.5">{r.productName}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{r.variantName ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.unsold.length > 50 && (
              <p className="px-4 py-2 text-xs text-muted-foreground">… và {data.unsold.length - 50} sản phẩm khác</p>
            )}
          </div>
        </SectionCard>
      )}
    </div>
  )
}

function SimpleProductTable({ rows }: { rows: ProductSalesRow[] }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground py-4 text-center">Không có dữ liệu</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/40">
          <tr>
            <th className="px-4 py-2.5 text-left font-medium text-muted-foreground w-8">#</th>
            <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Sản phẩm</th>
            <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">SL bán</th>
            <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Doanh thu</th>
            <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">LN gộp</th>
            <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Biên LN</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r, i) => (
            <tr key={`${r.productId}-${r.variantId ?? i}`} className="hover:bg-muted/20">
              <td className="px-4 py-2.5 text-muted-foreground text-xs">{i + 1}</td>
              <td className="px-4 py-2.5">
                <div className="font-medium">{r.productName}</div>
                {r.variantName && <div className="text-xs text-muted-foreground">{r.variantName}</div>}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums font-medium">{r.totalQty.toLocaleString()}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{formatVND(r.totalRevenue)}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">
                <span className={r.totalGrossProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600'}>
                  {formatVND(r.totalGrossProfit)}
                </span>
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums text-sm">
                <span className={r.profitMargin >= 20 ? 'text-green-600 dark:text-green-400' : r.profitMargin >= 10 ? 'text-yellow-600' : 'text-muted-foreground'}>
                  {formatPct(r.profitMargin)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// --------------- Inventory Tab (10.5) ---------------

function InventoryTab({ data }: { data: InventoryReport | null }) {
  if (!data) return <div className="py-16 text-center text-muted-foreground">Đang tải...</div>

  const handleExportXlsx = async () => {
    const { exportToXlsx } = await import('@/utils/exportUtils')
    await exportToXlsx(
      'Tồn kho',
      ['Sản phẩm', 'Biến thể', 'Tồn kho', 'Giá vốn', 'Giá trị tồn', 'Đã bán 30 ngày', 'Vòng quay (ngày)'],
      data.rows.map((r) => [
        r.productName, r.variantName ?? '', r.quantity, r.costPrice,
        r.totalValue, r.soldQty30d, r.turnoverDays !== null ? Math.round(r.turnoverDays) : 'N/A',
      ]),
      'bao-cao-ton-kho.xlsx',
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard title="Tổng giá trị tồn kho" value={formatVND(data.totalValue)} />
        <StatCard title="Tổng số lượng tồn" value={data.totalQty.toLocaleString()} />
        <StatCard title="Số mặt hàng" value={String(data.rows.length)} />
      </div>

      <SectionCard
        title="Chi tiết tồn kho"
        action={<ExportBtn icon="xlsx" onClick={handleExportXlsx} />}
      >
        {data.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Chưa có dữ liệu tồn kho</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Sản phẩm</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Tồn kho</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Giá vốn</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Giá trị tồn</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Bán 30 ngày</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Vòng quay</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.rows.map((r, i) => (
                  <tr key={`${r.productId}-${r.variantId ?? i}`} className="hover:bg-muted/20">
                    <td className="px-4 py-2.5">
                      <div className="font-medium">{r.productName}</div>
                      {r.variantName && <div className="text-xs text-muted-foreground">{r.variantName}</div>}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium">{r.quantity.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{r.costPrice > 0 ? formatVND(r.costPrice) : '—'}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium">{r.costPrice > 0 ? formatVND(r.totalValue) : '—'}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{r.soldQty30d > 0 ? r.soldQty30d.toLocaleString() : '—'}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {r.turnoverDays !== null ? (
                        <span className={r.turnoverDays <= 30 ? 'text-green-600 dark:text-green-400' : r.turnoverDays <= 90 ? 'text-yellow-600' : 'text-red-600'}>
                          {Math.round(r.turnoverDays)} ngày
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">Không có bán</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 bg-muted/20">
                <tr>
                  <td className="px-4 py-2.5 font-semibold">Tổng</td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{data.totalQty.toLocaleString()}</td>
                  <td />
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{formatVND(data.totalValue)}</td>
                  <td />
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  )
}

// --------------- Expenses Report Tab (10.6) ---------------

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']

function ExpensesReportTab({ data, range }: { data: ExpenseReportData | null; range: DateRange }) {
  if (!data) return <div className="py-16 text-center text-muted-foreground">Đang tải...</div>

  const handleExportXlsx = async () => {
    const { exportMultiSheetXlsx } = await import('@/utils/exportUtils')
    await exportMultiSheetXlsx(
      [
        {
          name: 'Theo danh mục',
          headers: ['Danh mục', 'Số lần', 'Tổng chi'],
          rows: data.byCategory.map((r) => [EXPENSE_CATEGORY_LABELS[r.category] ?? r.category, r.count, r.total]),
        },
        {
          name: 'Theo kênh',
          headers: ['Kênh', 'Số lần', 'Tổng chi'],
          rows: [...data.byChannel.map((r) => [r.channelName, r.count, r.total]), ['Chung (không theo kênh)', '', data.general]],
        },
      ],
      `bao-cao-chi-phi-${range.label}.xlsx`,
    )
  }

  const pieData = data.byCategory.map((r) => ({
    name: EXPENSE_CATEGORY_LABELS[r.category] ?? r.category,
    value: r.total,
  }))

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard title="Tổng chi phí" value={formatVND(data.total)} />
        <StatCard title="Chi phí theo kênh" value={formatVND(data.byChannel.reduce((s, r) => s + r.total, 0))} />
        <StatCard title="Chi phí chung" value={formatVND(data.general)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pie chart */}
        {pieData.length > 0 && (
          <SectionCard title="Phân bổ chi phí theo danh mục">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {pieData.map((_, index) => (
                    <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatVND(v)} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </SectionCard>
        )}

        {/* By channel */}
        {data.byChannel.length > 0 && (
          <SectionCard title="Chi phí theo kênh">
            <div className="space-y-3 py-1">
              {data.byChannel.map((r) => {
                const pct = data.total > 0 ? (r.total / data.total) * 100 : 0
                return (
                  <div key={r.channelId} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>{r.channelName}</span>
                      <span className="tabular-nums font-medium">{formatVND(r.total)}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
              {data.general > 0 && (
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Chung (không theo kênh)</span>
                    <span className="tabular-nums font-medium">{formatVND(data.general)}</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-muted-foreground" style={{ width: `${data.total > 0 ? (data.general / data.total) * 100 : 0}%` }} />
                  </div>
                </div>
              )}
            </div>
          </SectionCard>
        )}
      </div>

      {/* Category detail table */}
      <SectionCard
        title="Chi tiết theo danh mục"
        action={<ExportBtn icon="xlsx" onClick={handleExportXlsx} />}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Danh mục</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Số lần</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Tổng chi</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Tỷ trọng</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.byCategory.map((r) => (
                <tr key={r.category} className="hover:bg-muted/20">
                  <td className="px-4 py-2.5 font-medium">{EXPENSE_CATEGORY_LABELS[r.category] ?? r.category}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{r.count}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-medium">{formatVND(r.total)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                    {data.total > 0 ? formatPct((r.total / data.total) * 100, 0) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 bg-muted/20">
              <tr>
                <td className="px-4 py-2.5 font-semibold">Tổng</td>
                <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{data.byCategory.reduce((s, r) => s + r.count, 0)}</td>
                <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{formatVND(data.total)}</td>
                <td className="px-4 py-2.5 text-right font-semibold">100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </SectionCard>
    </div>
  )
}

// --------------- Debt Tab (10.7) ---------------

function DebtTab({ data }: { data: SupplierDebtRow[] | null }) {
  if (!data) return <div className="py-16 text-center text-muted-foreground">Đang tải...</div>

  const handleExportXlsx = async () => {
    const { exportToXlsx } = await import('@/utils/exportUtils')
    await exportToXlsx(
      'Công nợ NCC',
      ['Nhà cung cấp', 'Đã nhập hàng', 'Đã trả', 'Còn nợ', 'Lô hàng', 'Ngày TT cuối', 'Ngày chưa TT'],
      data.map((r) => [
        r.supplierName, r.totalImported, r.totalPaid, r.debt, r.batchCount,
        r.lastPaymentDate ? formatDate(r.lastPaymentDate) : 'Chưa thanh toán',
        r.daysSinceLastPayment !== null ? r.daysSinceLastPayment : 'N/A',
      ]),
      'bao-cao-cong-no-ncc.xlsx',
    )
  }

  if (data.length === 0) {
    return <div className="py-16 text-center text-muted-foreground">Không có công nợ nhà cung cấp</div>
  }

  const totalDebt = data.reduce((s, r) => s + r.debt, 0)
  const overdueCount = data.filter((r) => r.debt > 0 && r.daysSinceLastPayment !== null && r.daysSinceLastPayment > 30).length

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard title="Tổng nợ NCC" value={formatVND(totalDebt)} variant={totalDebt > 0 ? 'danger' : 'success'} />
        <StatCard title="Số NCC có nợ" value={String(data.filter((r) => r.debt > 0).length)} />
        <StatCard title="Quá hạn > 30 ngày" value={String(overdueCount)} variant={overdueCount > 0 ? 'warning' : 'default'} />
      </div>

      <SectionCard
        title="Danh sách công nợ nhà cung cấp"
        action={<ExportBtn icon="xlsx" onClick={handleExportXlsx} />}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Nhà cung cấp</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Đã nhập</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Đã trả</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Còn nợ</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Ngày TT cuối</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Số ngày</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.map((r) => {
                const overdue = r.debt > 0 && r.daysSinceLastPayment !== null && r.daysSinceLastPayment > 30
                return (
                  <tr key={r.supplierId} className={`hover:bg-muted/20 ${overdue ? 'bg-red-50/30 dark:bg-red-950/10' : ''}`}>
                    <td className="px-4 py-2.5">
                      <div className="font-medium">{r.supplierName}</div>
                      <div className="text-xs text-muted-foreground">{r.batchCount} lô nhập</div>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{formatVND(r.totalImported)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-green-600 dark:text-green-400">{formatVND(r.totalPaid)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-semibold">
                      <span className={r.debt > 0 ? 'text-red-600' : 'text-green-600 dark:text-green-400'}>
                        {r.debt > 0 ? formatVND(r.debt) : 'Đã thanh toán'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground text-xs">
                      {r.lastPaymentDate ? formatDate(r.lastPaymentDate) : <span className="text-red-500">Chưa TT</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {r.daysSinceLastPayment !== null ? (
                        <span className={overdue ? 'text-red-600 font-semibold' : 'text-muted-foreground'}>
                          {r.daysSinceLastPayment} ngày
                          {overdue && ' ⚠'}
                        </span>
                      ) : (
                        <span className="text-red-500 font-medium">Chưa TT</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="border-t-2 bg-muted/20">
              <tr>
                <td className="px-4 py-2.5 font-semibold">Tổng</td>
                <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{formatVND(data.reduce((s, r) => s + r.totalImported, 0))}</td>
                <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{formatVND(data.reduce((s, r) => s + r.totalPaid, 0))}</td>
                <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-red-600">{formatVND(totalDebt)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      </SectionCard>
    </div>
  )
}

// --------------- Customers Tab (10.8) ---------------

function CustomersTab({ data, range }: { data: CustomerReportRow[] | null; range: DateRange }) {
  if (!data) return <div className="py-16 text-center text-muted-foreground">Đang tải...</div>

  const handleExportXlsx = async () => {
    const { exportToXlsx } = await import('@/utils/exportUtils')
    await exportToXlsx(
      'Khách hàng',
      ['Khách hàng', 'Số đơn', 'Tổng chi', 'TB/đơn', 'Đặt lần cuối', 'Ngày kể từ đặt', 'Mua lại', 'Nguy cơ rời'],
      data.map((r) => [
        r.customerName, r.orderCount, r.totalSpent,
        Math.round(r.avgOrderValue),
        r.lastOrderDate ? formatDate(r.lastOrderDate) : '',
        r.daysSinceLastOrder ?? '',
        r.isRepeat ? 'Có' : 'Không',
        r.isChurnRisk ? 'Có' : 'Không',
      ]),
      `bao-cao-khach-hang-${range.label}.xlsx`,
    )
  }

  if (data.length === 0) {
    return <div className="py-16 text-center text-muted-foreground">Không có dữ liệu khách hàng trong kỳ này</div>
  }

  const repeatCount = data.filter((r) => r.isRepeat).length
  const churnCount = data.filter((r) => r.isChurnRisk).length

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard title="Tổng khách hàng" value={String(data.length)} />
        <StatCard title="Mua lại" value={String(repeatCount)} subtitle={`${data.length > 0 ? Math.round((repeatCount / data.length) * 100) : 0}% khách`} variant="success" />
        <StatCard title="Nguy cơ rời bỏ" value={String(churnCount)} variant={churnCount > 0 ? 'warning' : 'default'} />
        <StatCard title="Doanh thu TB/KH" value={formatVND(data.length > 0 ? data.reduce((s, r) => s + r.totalSpent, 0) / data.length : 0)} />
      </div>

      <SectionCard
        title="Top khách hàng theo doanh thu"
        action={<ExportBtn icon="xlsx" onClick={handleExportXlsx} />}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground w-8">#</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Khách hàng</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Số đơn</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Tổng chi</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">TB/đơn</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Đặt lần cuối</th>
                <th className="px-4 py-2.5 text-center font-medium text-muted-foreground">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.slice(0, 50).map((r, i) => (
                <tr key={r.customerId} className="hover:bg-muted/20">
                  <td className="px-4 py-2.5 text-muted-foreground text-xs">{i + 1}</td>
                  <td className="px-4 py-2.5 font-medium">{r.customerName}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{r.orderCount}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-medium">{formatVND(r.totalSpent)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{formatVND(Math.round(r.avgOrderValue))}</td>
                  <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">
                    {r.lastOrderDate ? formatDate(r.lastOrderDate) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <div className="flex justify-center gap-1 flex-wrap">
                      {r.isRepeat && (
                        <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                          Mua lại
                        </span>
                      )}
                      {r.isChurnRisk && (
                        <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                          Nguy cơ rời
                        </span>
                      )}
                      {!r.isRepeat && !r.isChurnRisk && (
                        <span className="text-xs text-muted-foreground">Mới</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.length > 50 && (
            <p className="px-4 py-2 text-xs text-muted-foreground">… và {data.length - 50} khách hàng khác</p>
          )}
        </div>
      </SectionCard>
    </div>
  )
}

// --------------- Shared UI helpers ---------------

function ChartCard({
  title,
  children,
  onExportXlsx,
  onExportPdf,
}: {
  title: string
  children: React.ReactNode
  onExportXlsx?: () => void
  onExportPdf?: () => void
}) {
  return (
    <SectionCard
      title={title}
      action={
        (onExportXlsx || onExportPdf) ? (
          <div className="flex gap-2">
            {onExportXlsx && <ExportBtn icon="xlsx" onClick={onExportXlsx} />}
            {onExportPdf && <ExportBtn icon="pdf" onClick={onExportPdf} />}
          </div>
        ) : undefined
      }
    >
      {children}
    </SectionCard>
  )
}

function SectionCard({
  title,
  children,
  action,
}: {
  title: string
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b">
        <h3 className="text-sm font-semibold">{title}</h3>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function ExportBtn({ icon, onClick }: { icon: 'xlsx' | 'pdf'; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={icon === 'xlsx' ? 'Xuất Excel' : 'Xuất PDF'}
      className="flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs font-medium hover:bg-muted"
    >
      {icon === 'xlsx' ? <FileSpreadsheet className="h-3.5 w-3.5 text-green-600" /> : <FileText className="h-3.5 w-3.5 text-red-500" />}
      {icon.toUpperCase()}
    </button>
  )
}

function TrendBadge({ value }: { value: number }) {
  const isPos = value >= 0
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${isPos ? 'text-green-600 dark:text-green-400' : 'text-red-600'}`}>
      {isPos ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {Math.abs(value).toFixed(1)}%
    </span>
  )
}
