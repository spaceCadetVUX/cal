import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { AlertTriangle, Calculator, Plus, Trash2 } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { PageLayout } from '@/components/layout/PageLayout'
import { DataTable } from '@/components/shared/DataTable'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { ChannelBadge } from '@/components/shared/ChannelBadge'
import { usePriceStore, type PriceConfigInput } from '@/stores/usePriceStore'
import { useProductStore } from '@/stores/useProductStore'
import { useChannelStore } from '@/stores/useChannelStore'
import { useCategoryStore } from '@/stores/useCategoryStore'
import { useSettingsStore } from '@/stores/useSettingsStore'
import { calcMinSellingPrice, calcSuggestedPrice } from '@/utils/priceCalculator'
import { calcProfitPerUnit } from '@/utils/profitCalculator'
import { resolveChannelFee } from '@/utils/channelFeeResolver'
import { formatVND, formatPct } from '@/utils/formatters'
import db from '@/db/db'
import type { PriceConfig, ProductVariant } from '@/types'

// --------------- Types ---------------

type Tab = 'overview' | 'calculator' | 'assign'

const inputCls = 'w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring'
const labelCls = 'text-sm font-medium'

// --------------- Assign form schema ---------------

const assignSchema = z.object({
  productId: z.string().min(1, 'Chọn sản phẩm'),
  variantId: z.string().optional(),
  channelId: z.string().optional(),
  sellingPrice: z.coerce.number().min(0, 'Giá bán phải ≥ 0'),
  packagingCost: z.coerce.number().min(0).default(0),
  otherCost: z.coerce.number().min(0).default(0),
  minMarginPct: z.coerce.number().min(0).max(100).default(20),
})
type AssignFields = z.infer<typeof assignSchema>

// --------------- Main Component ---------------

export default function PricingPage() {
  const { configs, latestCostPrices, loading, load, upsert, remove, getLatestCostPrice, refreshCostPrices } = usePriceStore()
  const { products } = useProductStore()
  const { channels } = useChannelStore()
  const { categories } = useCategoryStore()
  const { settings } = useSettingsStore()

  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [deleteTarget, setDeleteTarget] = useState<PriceConfig | null>(null)
  const [variantsMap, setVariantsMap] = useState<Record<string, ProductVariant[]>>({})

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const activeChannels = channels.filter((c) => c.isActive)
  const channelMap = useMemo(() => Object.fromEntries(channels.map((c) => [c.id, c])), [channels])
  const productMap = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products])
  const categoryMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c.name])), [categories])

  const handleDelete = async () => {
    if (!deleteTarget) return
    await remove(deleteTarget.id)
    toast.success('Đã xóa cấu hình giá')
    setDeleteTarget(null)
  }

  // --------------- OVERVIEW: deduplicate configs ---------------

  const deduplicatedConfigs = useMemo(() => {
    const map = new Map<string, PriceConfig>()
    for (const c of configs) {
      const key = `${c.productId}|${c.variantId ?? ''}|${c.channelId ?? ''}`
      const existing = map.get(key)
      if (!existing || c.effectiveFrom > existing.effectiveFrom) map.set(key, c)
    }
    return Array.from(map.values())
  }, [configs])

  const overviewColumns: ColumnDef<PriceConfig>[] = useMemo(
    () => [
      {
        header: 'Sản phẩm',
        accessorFn: (row) => productMap[row.productId]?.name ?? '—',
        cell: ({ row }) => {
          const p = productMap[row.original.productId]
          return (
            <div>
              <p className="font-medium">{p?.name ?? '—'}</p>
              <p className="font-mono text-xs text-muted-foreground">{p?.sku ?? ''}</p>
            </div>
          )
        },
      },
      {
        header: 'Kênh',
        accessorKey: 'channelId',
        cell: ({ getValue }) => {
          const cid = getValue() as string | undefined
          if (!cid) return <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">Base</span>
          const ch = channelMap[cid]
          if (!ch) return <span className="text-xs text-muted-foreground">{cid}</span>
          return <ChannelBadge name={ch.name} color={ch.color} />
        },
      },
      {
        header: 'Giá vốn',
        id: 'costPrice',
        cell: ({ row }) => {
          const cost = latestCostPrices[row.original.productId]
          return cost != null ? (
            <span className="tabular-nums text-sm text-muted-foreground">{formatVND(cost)}</span>
          ) : (
            <span className="text-xs text-muted-foreground italic">—</span>
          )
        },
      },
      {
        header: 'Giá bán',
        accessorKey: 'sellingPrice',
        cell: ({ getValue }) => <span className="font-semibold tabular-nums">{formatVND(getValue() as number)}</span>,
      },
      {
        header: 'Giá sàn',
        id: 'minSellingPrice',
        cell: ({ row }) => {
          const cfg = row.original
          const costPrice = latestCostPrices[cfg.productId]
          if (costPrice == null) return <span className="text-muted-foreground text-xs">—</span>
          const ch = cfg.channelId ? channelMap[cfg.channelId] : null
          const minPrice = calcMinSellingPrice({
            costPrice,
            packagingCost: cfg.packagingCost,
            otherCost: cfg.otherCost,
            platformFeePct: ch?.platformFeePct ?? 0,
            paymentFeePct: ch?.paymentFeePct ?? 0,
          })
          const below = cfg.sellingPrice < minPrice
          return (
            <span className={`tabular-nums text-sm ${below ? 'font-semibold text-red-500' : 'text-muted-foreground'}`}>
              {formatVND(minPrice)}
              {below && <AlertTriangle className="inline ml-1 h-3.5 w-3.5" />}
            </span>
          )
        },
      },
      {
        header: 'Margin',
        id: 'margin',
        cell: ({ row }) => {
          const cfg = row.original
          const costPrice = latestCostPrices[cfg.productId]
          if (costPrice == null || cfg.sellingPrice === 0) return <span className="text-muted-foreground">—</span>
          const ch = cfg.channelId ? channelMap[cfg.channelId] : null
          const { profitMarginPerUnit } = calcProfitPerUnit({
            sellingPrice: cfg.sellingPrice,
            costPrice,
            platformFeePct: ch?.platformFeePct ?? 0,
            paymentFeePct: ch?.paymentFeePct ?? 0,
            packagingCost: cfg.packagingCost,
            otherCost: cfg.otherCost,
          })
          const isBelowTarget = profitMarginPerUnit < cfg.minMarginPct
          return (
            <span className={`font-semibold tabular-nums ${
              profitMarginPerUnit < 0 ? 'text-red-500' :
              isBelowTarget ? 'text-yellow-600 dark:text-yellow-400' :
              'text-green-600 dark:text-green-400'
            }`}>
              {formatPct(profitMarginPerUnit)}
              {isBelowTarget && profitMarginPerUnit >= 0 && <AlertTriangle className="inline ml-1 h-3.5 w-3.5" />}
            </span>
          )
        },
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            <button
              onClick={() => { setActiveTab('assign'); setTimeout(() => prefillAssign(row.original), 50) }}
              title="Sửa"
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Calculator className="h-4 w-4" />
            </button>
            <button
              onClick={() => setDeleteTarget(row.original)}
              title="Xóa"
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-red-500"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ),
      },
    ],
    [productMap, channelMap, latestCostPrices],
  )

  // --------------- CALCULATOR TAB ---------------

  const [calcCostPrice, setCalcCostPrice] = useState('')
  const [calcChannelId, setCalcChannelId] = useState('')
  const [calcCategoryId, setCalcCategoryId] = useState('')
  const [calcPlatformFee, setCalcPlatformFee] = useState('')
  const [calcPaymentFee, setCalcPaymentFee] = useState('')
  const [calcPackaging, setCalcPackaging] = useState('')
  const [calcOther, setCalcOther] = useState('')
  const [calcMarginPct, setCalcMarginPct] = useState(String(settings?.defaultMinMarginPct ?? 20))

  useEffect(() => {
    if (!calcChannelId) return
    resolveChannelFee(calcChannelId, calcCategoryId || undefined, db).then((fee) => {
      setCalcPlatformFee(String(fee.platformFeePct))
      setCalcPaymentFee(String(fee.paymentFeePct))
    })
  }, [calcChannelId, calcCategoryId])

  const calcParams = useMemo(() => ({
    costPrice: parseFloat(calcCostPrice) || 0,
    platformFeePct: parseFloat(calcPlatformFee) || 0,
    paymentFeePct: parseFloat(calcPaymentFee) || 0,
    packagingCost: parseFloat(calcPackaging) || 0,
    otherCost: parseFloat(calcOther) || 0,
    minMarginPct: parseFloat(calcMarginPct) || 0,
  }), [calcCostPrice, calcPlatformFee, calcPaymentFee, calcPackaging, calcOther, calcMarginPct])

  const calcResults = useMemo(() => {
    if (!calcParams.costPrice) return null
    const minPrice = calcMinSellingPrice(calcParams)
    const suggestedPrice = calcSuggestedPrice(calcParams)
    const profit = calcProfitPerUnit({ ...calcParams, sellingPrice: suggestedPrice })
    return { minPrice, suggestedPrice, ...profit }
  }, [calcParams])

  // --------------- ASSIGN TAB ---------------

  const {
    register: aReg, handleSubmit: aSubmit, reset: aReset, watch: aWatch, setValue: aSetValue,
    formState: { errors: aErrors, isSubmitting: aSubmitting },
  } = useForm<AssignFields>({
    resolver: zodResolver(assignSchema),
    defaultValues: {
      packagingCost: settings?.defaultPackagingCost ?? 0,
      minMarginPct: settings?.defaultMinMarginPct ?? 20,
    },
  })

  const watchProductId = aWatch('productId')
  const watchChannelId = aWatch('channelId')
  const watchSelling = aWatch('sellingPrice')
  const watchPackaging = aWatch('packagingCost')
  const watchOther = aWatch('otherCost')
  const watchMargin = aWatch('minMarginPct')

  const [assignFees, setAssignFees] = useState({ platform: 0, payment: 0 })
  const [assignCostPrice, setAssignCostPrice] = useState<number | null>(null)

  const assignedProduct = products.find((p) => p.id === watchProductId)

  useEffect(() => {
    if (!watchProductId) { setAssignCostPrice(null); return }
    if (!variantsMap[watchProductId]) {
      db.productVariants.where('productId').equals(watchProductId).toArray().then((v) => {
        setVariantsMap((prev) => ({ ...prev, [watchProductId]: v }))
      })
    }
    getLatestCostPrice(watchProductId).then(setAssignCostPrice)
  }, [watchProductId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!watchChannelId) { setAssignFees({ platform: 0, payment: 0 }); return }
    resolveChannelFee(watchChannelId, assignedProduct?.categoryId, db).then((fee) => {
      setAssignFees({ platform: fee.platformFeePct, payment: fee.paymentFeePct })
    })
  }, [watchChannelId, assignedProduct?.categoryId])

  const assignMinPrice = useMemo(() => {
    if (!assignCostPrice) return null
    return calcMinSellingPrice({
      costPrice: assignCostPrice,
      packagingCost: Number(watchPackaging) || 0,
      otherCost: Number(watchOther) || 0,
      platformFeePct: assignFees.platform,
      paymentFeePct: assignFees.payment,
    })
  }, [assignCostPrice, watchPackaging, watchOther, assignFees])

  const assignSuggestedPrice = useMemo(() => {
    if (!assignCostPrice) return null
    return calcSuggestedPrice({
      costPrice: assignCostPrice,
      packagingCost: Number(watchPackaging) || 0,
      otherCost: Number(watchOther) || 0,
      platformFeePct: assignFees.platform,
      paymentFeePct: assignFees.payment,
      minMarginPct: Number(watchMargin) || 0,
    })
  }, [assignCostPrice, watchPackaging, watchOther, assignFees, watchMargin])

  const assignCurrentMargin = useMemo(() => {
    const sp = Number(watchSelling) || 0
    if (!assignCostPrice || sp === 0) return null
    return calcProfitPerUnit({
      sellingPrice: sp,
      costPrice: assignCostPrice,
      platformFeePct: assignFees.platform,
      paymentFeePct: assignFees.payment,
      packagingCost: Number(watchPackaging) || 0,
      otherCost: Number(watchOther) || 0,
    }).profitMarginPerUnit
  }, [watchSelling, assignCostPrice, assignFees, watchPackaging, watchOther])

  const prefillAssign = (c: PriceConfig) => {
    aReset({
      productId: c.productId,
      variantId: c.variantId ?? '',
      channelId: c.channelId ?? '',
      sellingPrice: c.sellingPrice,
      packagingCost: c.packagingCost,
      otherCost: c.otherCost,
      minMarginPct: c.minMarginPct,
    })
    refreshCostPrices([c.productId])
  }

  const onAssignSubmit = async (fields: AssignFields) => {
    const input: PriceConfigInput = {
      productId: fields.productId,
      variantId: fields.variantId || undefined,
      channelId: fields.channelId || undefined,
      sellingPrice: fields.sellingPrice,
      minSellingPrice: assignMinPrice ?? 0,
      packagingCost: fields.packagingCost,
      otherCost: fields.otherCost,
      minMarginPct: fields.minMarginPct,
    }
    try {
      await upsert(input)
      await refreshCostPrices([fields.productId])
      toast.success('Đã lưu cấu hình giá')
      aReset()
      setActiveTab('overview')
    } catch {
      toast.error('Lưu thất bại')
    }
  }

  // --------------- Render ---------------

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Danh sách giá' },
    { key: 'calculator', label: 'Máy tính giá' },
    { key: 'assign', label: 'Gán giá' },
  ]

  return (
    <PageLayout
      title="Quản lý giá"
      action={
        activeTab !== 'assign' ? (
          <button
            onClick={() => setActiveTab('assign')}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Gán giá mới
          </button>
        ) : undefined
      }
    >
      <div className="flex border-b">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === t.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ============ TAB: OVERVIEW ============ */}
      {activeTab === 'overview' && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground flex items-center gap-3">
            <span className="flex items-center gap-1 text-red-500"><AlertTriangle className="h-3.5 w-3.5" /> Đỏ = giá bán &lt; giá sàn</span>
            <span className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400"><AlertTriangle className="h-3.5 w-3.5" /> Vàng = margin &lt; mục tiêu</span>
          </p>
          {loading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Đang tải...</p>
          ) : (
            <DataTable columns={overviewColumns} data={deduplicatedConfigs} searchPlaceholder="Tìm theo tên sản phẩm..." />
          )}
        </div>
      )}

      {/* ============ TAB: CALCULATOR ============ */}
      {activeTab === 'calculator' && (
        <div className="grid grid-cols-2 gap-6">
          <div className="rounded-xl border bg-card p-5 space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Thông số đầu vào</h3>

            <div className="space-y-1">
              <label className={labelCls}>Giá vốn (₫) <span className="text-red-500">*</span></label>
              <input type="number" value={calcCostPrice} onChange={(e) => setCalcCostPrice(e.target.value)} className={inputCls} placeholder="0" autoFocus />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className={labelCls}>Kênh bán</label>
                <select value={calcChannelId} onChange={(e) => setCalcChannelId(e.target.value)} className={inputCls}>
                  <option value="">— Không chọn —</option>
                  {activeChannels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className={labelCls}>Danh mục</label>
                <select value={calcCategoryId} onChange={(e) => setCalcCategoryId(e.target.value)} className={inputCls}>
                  <option value="">— Không chọn —</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className={labelCls}>% Phí sàn</label>
                <input type="number" step="0.1" value={calcPlatformFee} onChange={(e) => setCalcPlatformFee(e.target.value)} className={inputCls} placeholder="0" />
              </div>
              <div className="space-y-1">
                <label className={labelCls}>% Phí thanh toán</label>
                <input type="number" step="0.1" value={calcPaymentFee} onChange={(e) => setCalcPaymentFee(e.target.value)} className={inputCls} placeholder="0" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className={labelCls}>Phí đóng gói (₫)</label>
                <input type="number" value={calcPackaging} onChange={(e) => setCalcPackaging(e.target.value)} className={inputCls} placeholder="0" />
              </div>
              <div className="space-y-1">
                <label className={labelCls}>Chi phí khác (₫)</label>
                <input type="number" value={calcOther} onChange={(e) => setCalcOther(e.target.value)} className={inputCls} placeholder="0" />
              </div>
            </div>

            <div className="space-y-1">
              <label className={labelCls}>% Margin mong muốn</label>
              <input type="number" step="0.5" value={calcMarginPct} onChange={(e) => setCalcMarginPct(e.target.value)} className={inputCls} />
            </div>
          </div>

          <div className="rounded-xl border bg-card p-5 space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Kết quả</h3>
            {!calcResults ? (
              <p className="text-sm text-muted-foreground">Nhập giá vốn để xem kết quả.</p>
            ) : (
              <>
                <div className="space-y-2">
                  <RRow label="Giá sàn (không lỗ)" value={formatVND(calcResults.minPrice)} big />
                  <RRow label="Giá đề xuất" value={formatVND(calcResults.suggestedPrice)} big />
                  <RRow label="Lợi nhuận / đơn" value={formatVND(calcResults.grossProfitPerUnit)} />
                  <RRow label="Margin thực tế" value={formatPct(calcResults.profitMarginPerUnit)} />
                </div>
                <div className="border-t pt-4 space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Breakdown / đơn vị</p>
                  <BRow label="Giá vốn" v={formatVND(calcParams.costPrice)} />
                  <BRow label="Phí sàn" v={formatVND(calcResults.platformFee)} />
                  <BRow label="Phí thanh toán" v={formatVND(calcResults.paymentFee)} />
                  <BRow label="Phí đóng gói" v={formatVND(calcParams.packagingCost)} />
                  <BRow label="Chi phí khác" v={formatVND(calcParams.otherCost)} />
                  <div className="border-t pt-2 flex justify-between text-sm font-semibold">
                    <span>Tổng chi phí</span><span>{formatVND(calcResults.totalCostPerUnit)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold text-green-600 dark:text-green-400">
                    <span>Lợi nhuận</span><span>{formatVND(calcResults.grossProfitPerUnit)}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ============ TAB: ASSIGN ============ */}
      {activeTab === 'assign' && (
        <div className="grid grid-cols-2 gap-6">
          <form onSubmit={aSubmit(onAssignSubmit)} className="rounded-xl border bg-card p-5 space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Gán giá cho sản phẩm</h3>

            <div className="space-y-1">
              <label className={labelCls}>Sản phẩm <span className="text-red-500">*</span></label>
              <select {...aReg('productId')} className={inputCls}>
                <option value="">— Chọn sản phẩm —</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
              </select>
              {aErrors.productId && <p className="text-xs text-red-500">{aErrors.productId.message}</p>}
            </div>

            {watchProductId && (variantsMap[watchProductId] ?? []).length > 0 && (
              <div className="space-y-1">
                <label className={labelCls}>Biến thể</label>
                <select {...aReg('variantId')} className={inputCls}>
                  <option value="">— Tất cả biến thể —</option>
                  {(variantsMap[watchProductId] ?? []).map((v) => (
                    <option key={v.id} value={v.id}>{v.name} ({v.sku})</option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-1">
              <label className={labelCls}>Kênh bán</label>
              <select {...aReg('channelId')} className={inputCls}>
                <option value="">Base — áp dụng tất cả kênh</option>
                {activeChannels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {watchChannelId && (
                <p className="text-xs text-muted-foreground">
                  Phí sàn: {assignFees.platform}% / Phí TT: {assignFees.payment}%
                  {assignedProduct?.categoryId && ` — danh mục: ${categoryMap[assignedProduct.categoryId] ?? ''}`}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label className={labelCls}>Giá bán (₫) <span className="text-red-500">*</span></label>
              {assignSuggestedPrice != null && (
                <button
                  type="button"
                  onClick={() => aSetValue('sellingPrice', Math.ceil(assignSuggestedPrice / 1000) * 1000)}
                  className="text-xs text-primary hover:underline ml-2"
                >
                  Dùng giá đề xuất ({formatVND(Math.ceil(assignSuggestedPrice / 1000) * 1000)})
                </button>
              )}
              <input {...aReg('sellingPrice')} type="number" min={0} className={inputCls} />
              {aErrors.sellingPrice && <p className="text-xs text-red-500">{aErrors.sellingPrice.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className={labelCls}>Phí đóng gói (₫)</label>
                <input {...aReg('packagingCost')} type="number" min={0} className={inputCls} />
              </div>
              <div className="space-y-1">
                <label className={labelCls}>Chi phí khác (₫)</label>
                <input {...aReg('otherCost')} type="number" min={0} className={inputCls} />
              </div>
            </div>

            <div className="space-y-1">
              <label className={labelCls}>% Margin tối thiểu mong muốn</label>
              <input {...aReg('minMarginPct')} type="number" step="0.5" min={0} max={100} className={inputCls} />
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={() => setActiveTab('overview')} className="flex-1 rounded-lg border py-2.5 text-sm font-medium hover:bg-muted">
                Huỷ
              </button>
              <button type="submit" disabled={aSubmitting} className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
                {aSubmitting ? 'Đang lưu...' : 'Lưu cấu hình'}
              </button>
            </div>
          </form>

          {/* Preview */}
          <div className="rounded-xl border bg-card p-5 space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Xem trước</h3>
            {!watchProductId ? (
              <p className="text-sm text-muted-foreground">Chọn sản phẩm để xem thông tin.</p>
            ) : (
              <div className="space-y-2">
                {assignCostPrice != null ? (
                  <>
                    <RRow label="Giá vốn hiện tại" value={formatVND(assignCostPrice)} />
                    {assignMinPrice != null && <RRow label="Giá sàn (tự tính)" value={formatVND(assignMinPrice)} big />}
                    {assignSuggestedPrice != null && <RRow label="Giá đề xuất" value={formatVND(assignSuggestedPrice)} />}
                    {assignCurrentMargin != null && (
                      <RRow
                        label="Margin tại giá bán nhập"
                        value={
                          <span className={assignCurrentMargin < 0 ? 'text-red-500' : assignCurrentMargin < (Number(watchMargin) || 0) ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'}>
                            {formatPct(assignCurrentMargin)}
                          </span>
                        }
                      />
                    )}
                    {assignMinPrice != null && (Number(watchSelling) || 0) > 0 && (Number(watchSelling) || 0) < assignMinPrice && (
                      <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-600 dark:text-red-400">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        Giá bán thấp hơn giá sàn!
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Sản phẩm chưa có lô nhập hàng. Vẫn có thể gán giá.</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Xóa cấu hình giá?"
        description="Cấu hình giá này sẽ bị xóa vĩnh viễn."
        confirmLabel="Xóa"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </PageLayout>
  )
}

// --------------- Tiny helpers ---------------

function RRow({ label, value, big }: { label: string; value: React.ReactNode; big?: boolean }) {
  return (
    <div className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${big ? 'bg-muted/50' : ''}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-semibold tabular-nums ${big ? 'text-base' : ''}`}>{value}</span>
    </div>
  )
}
function BRow({ label, v }: { label: string; v: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{v}</span>
    </div>
  )
}
