import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { AlertTriangle, ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { PageLayout } from '@/components/layout/PageLayout'
import { useOrderStore } from '@/stores/useOrderStore'
import { useChannelStore } from '@/stores/useChannelStore'
import { useCustomerStore } from '@/stores/useCustomerStore'
import { usePriceStore } from '@/stores/usePriceStore'
import { resolveChannelFee } from '@/utils/channelFeeResolver'
import { calcOrderItemProfit, calcOrderProfit } from '@/utils/profitCalculator'
import { formatVND, formatPct } from '@/utils/formatters'
import { generateId } from '@/utils/idGenerator'
import db from '@/db/db'
import type { PaymentMethod, Product, ProductVariant } from '@/types'

// --------------- Draft type ---------------

interface OrderItemDraft {
  _id: string           // local key only
  productId: string
  productName: string
  variantId?: string
  variantName?: string
  categoryId?: string
  quantity: number
  sellingPrice: number
  costPrice: number
  packagingCost: number
  otherCost: number
  platformFeePct: number
  paymentFeePct: number
  // computed
  grossProfit: number
  profitMargin: number
}

interface CatalogItem {
  product: Product
  variants: ProductVariant[]
}

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Tiền mặt' },
  { value: 'bank_transfer', label: 'Chuyển khoản' },
  { value: 'momo', label: 'MoMo' },
  { value: 'vnpay', label: 'VNPay' },
  { value: 'zalopay', label: 'ZaloPay' },
  { value: 'cod', label: 'COD' },
  { value: 'card', label: 'Thẻ' },
  { value: 'other', label: 'Khác' },
]

function computeDraftProfit(d: Omit<OrderItemDraft, 'grossProfit' | 'profitMargin'>): Pick<OrderItemDraft, 'grossProfit' | 'profitMargin'> {
  const calc = calcOrderItemProfit({
    sellingPrice: d.sellingPrice,
    costPrice: d.costPrice,
    platformFeePct: d.platformFeePct,
    paymentFeePct: d.paymentFeePct,
    packagingCost: d.packagingCost,
    otherCost: d.otherCost,
    quantity: d.quantity,
  })
  return { grossProfit: calc.grossProfit, profitMargin: calc.profitMargin }
}

// --------------- Component ---------------

export default function OrderFormPage() {
  const navigate = useNavigate()
  const { createOrder } = useOrderStore()
  const { channels, load: loadChannels } = useChannelStore()
  const { customers, load: loadCustomers } = useCustomerStore()
  const { configs: priceConfigs, getLatestCostPrice, getEffectiveConfig, load: loadPrices } = usePriceStore()

  // Header state
  const [channelId, setChannelId] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [externalOrderId, setExternalOrderId] = useState('')
  const [orderDateStr, setOrderDateStr] = useState(() => new Date().toISOString().slice(0, 10))
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [buyerShippingFee, setBuyerShippingFee] = useState(0)
  const [sellerShippingFee, setSellerShippingFee] = useState(0)
  const [shippingSubsidy, setShippingSubsidy] = useState(0)
  const [discountAmount, setDiscountAmount] = useState(0)
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Line items
  const [items, setItems] = useState<OrderItemDraft[]>([])

  // Add-item form
  const [addProductId, setAddProductId] = useState('')
  const [addVariantId, setAddVariantId] = useState('')
  const [addQty, setAddQty] = useState(1)
  const [adding, setAdding] = useState(false)

  // Catalog
  const [catalog, setCatalog] = useState<Map<string, CatalogItem>>(new Map())
  const catalogLoaded = useRef(false)

  useEffect(() => {
    loadChannels()
    loadCustomers()
    if (priceConfigs.length === 0) loadPrices()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (catalogLoaded.current) return
    catalogLoaded.current = true
    ;(async () => {
      const [products, variants] = await Promise.all([
        db.products.filter((p) => p.isActive).toArray(),
        db.productVariants.toArray(),
      ])
      const map = new Map<string, CatalogItem>()
      for (const p of products) {
        map.set(p.id, { product: p, variants: variants.filter((v) => v.productId === p.id) })
      }
      setCatalog(map)
    })()
  }, [])

  // Khi channel thay đổi → re-resolve fees cho tất cả items hiện tại
  useEffect(() => {
    if (!channelId || items.length === 0) return
    ;(async () => {
      const updated = await Promise.all(
        items.map(async (item) => {
          const { platformFeePct, paymentFeePct } = await resolveChannelFee(channelId, item.categoryId, db)
          const base = { ...item, platformFeePct, paymentFeePct }
          return { ...base, ...computeDraftProfit(base) }
        }),
      )
      setItems(updated)
    })()
  }, [channelId]) // eslint-disable-line react-hooks/exhaustive-deps

  const selectedProduct = catalog.get(addProductId)
  const availableVariants = selectedProduct?.variants ?? []

  const handleAddItem = async () => {
    if (!addProductId || addQty <= 0) return
    if (!channelId) { toast.error('Vui lòng chọn kênh bán trước'); return }
    setAdding(true)
    try {
      const entry = catalog.get(addProductId)
      if (!entry) return

      const { product } = entry
      const variant = addVariantId ? entry.variants.find((v) => v.id === addVariantId) : undefined

      // Resolve fees
      const { platformFeePct, paymentFeePct } = await resolveChannelFee(channelId, product.categoryId, db)

      // Auto-fill price from PriceConfig (channel-specific > base)
      const priceConfig = getEffectiveConfig(addProductId, addVariantId || null, channelId)
      const sellingPrice = priceConfig?.sellingPrice ?? 0
      const packagingCost = priceConfig?.packagingCost ?? 0
      const otherCost = priceConfig?.otherCost ?? 0

      // Cost price from latest ImportItem
      const costPrice = (await getLatestCostPrice(addProductId, addVariantId || undefined)) ?? 0

      const base = {
        _id: generateId(),
        productId: addProductId,
        productName: product.name,
        variantId: addVariantId || undefined,
        variantName: variant?.name,
        categoryId: product.categoryId,
        quantity: addQty,
        sellingPrice,
        costPrice,
        packagingCost,
        otherCost,
        platformFeePct,
        paymentFeePct,
      }
      const profit = computeDraftProfit(base)
      setItems((prev) => [...prev, { ...base, ...profit }])

      // Reset add form
      setAddProductId('')
      setAddVariantId('')
      setAddQty(1)
    } finally {
      setAdding(false)
    }
  }

  const updateItem = (id: string, patch: Partial<OrderItemDraft>) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item._id !== id) return item
        const merged = { ...item, ...patch }
        return { ...merged, ...computeDraftProfit(merged) }
      }),
    )
  }

  const removeItem = (id: string) => setItems((prev) => prev.filter((i) => i._id !== id))

  // Totals
  const subtotal = useMemo(() => items.reduce((s, i) => s + i.sellingPrice * i.quantity, 0), [items])
  const totalRevenue = subtotal - discountAmount
  const totalGrossProfit = useMemo(() => items.reduce((s, i) => s + i.grossProfit, 0), [items])
  const netShipping = sellerShippingFee - shippingSubsidy
  const netProfit = totalGrossProfit - netShipping
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0

  const handleSubmit = async () => {
    if (!channelId) { toast.error('Vui lòng chọn kênh bán'); return }
    if (items.length === 0) { toast.error('Vui lòng thêm ít nhất 1 sản phẩm'); return }

    setSubmitting(true)
    try {
      const [y, m, d] = orderDateStr.split('-').map(Number)
      const orderDate = new Date(y, m - 1, d)

      await createOrder({
        channelId,
        customerId: customerId || undefined,
        externalOrderId: externalOrderId || undefined,
        orderDate,
        paymentMethod,
        buyerShippingFee,
        sellerShippingFee,
        shippingSubsidy,
        discountAmount,
        note: note || undefined,
        items: items.map((i) => ({
          productId: i.productId,
          variantId: i.variantId,
          categoryId: i.categoryId,
          quantity: i.quantity,
          sellingPrice: i.sellingPrice,
          costPrice: i.costPrice,
          packagingCost: i.packagingCost,
          otherCost: i.otherCost,
        })),
      })
      toast.success('Tạo đơn thành công')
      navigate('/orders')
    } catch {
      toast.error('Tạo đơn thất bại')
    } finally {
      setSubmitting(false)
    }
  }

  const inputCls = 'w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring'
  const selectCls = inputCls

  return (
    <PageLayout
      title="Tạo đơn bán"
      action={
        <button
          onClick={() => navigate('/orders')}
          className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
          Danh sách
        </button>
      }
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ---- Main form ---- */}
        <div className="space-y-6 lg:col-span-2">

          {/* Header info */}
          <div className="rounded-xl border bg-card p-5 space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Thông tin đơn</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Kênh bán <span className="text-red-500">*</span></label>
                <select value={channelId} onChange={(e) => setChannelId(e.target.value)} className={selectCls}>
                  <option value="">— Chọn kênh —</option>
                  {channels.filter((c) => c.isActive).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Ngày đặt hàng</label>
                <input
                  type="date"
                  value={orderDateStr}
                  onChange={(e) => setOrderDateStr(e.target.value)}
                  className={inputCls}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Khách hàng</label>
                <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={selectCls}>
                  <option value="">— Khách vãng lai —</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}{c.phone ? ` (${c.phone})` : ''}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">PTTT</label>
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)} className={selectCls}>
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Mã đơn ngoài (sàn)</label>
                <input
                  value={externalOrderId}
                  onChange={(e) => setExternalOrderId(e.target.value)}
                  placeholder="Tùy chọn"
                  className={inputCls}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Ghi chú</label>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Tùy chọn"
                  className={inputCls}
                />
              </div>
            </div>
          </div>

          {/* Shipping + discount */}
          <div className="rounded-xl border bg-card p-5 space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Phí & Giảm giá</h3>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Phí ship khách trả', value: buyerShippingFee, set: setBuyerShippingFee },
                { label: 'Phí ship shop chịu', value: sellerShippingFee, set: setSellerShippingFee },
                { label: 'Trợ giá ship (sàn)', value: shippingSubsidy, set: setShippingSubsidy },
                { label: 'Giảm giá / Voucher', value: discountAmount, set: setDiscountAmount },
              ].map(({ label, value, set }) => (
                <div key={label} className="space-y-1.5">
                  <label className="text-sm font-medium">{label}</label>
                  <input
                    type="number"
                    min={0}
                    value={value}
                    onChange={(e) => set(Number(e.target.value))}
                    className={inputCls}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Line items */}
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="px-5 py-4 border-b">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Sản phẩm</h3>
            </div>

            {/* Add item row */}
            <div className="px-5 py-4 border-b bg-muted/30 space-y-3">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <select
                  value={addProductId}
                  onChange={(e) => { setAddProductId(e.target.value); setAddVariantId('') }}
                  className={selectCls}
                >
                  <option value="">— Chọn sản phẩm —</option>
                  {[...catalog.values()].map(({ product }) => (
                    <option key={product.id} value={product.id}>{product.name}</option>
                  ))}
                </select>

                <select
                  value={addVariantId}
                  onChange={(e) => setAddVariantId(e.target.value)}
                  className={selectCls}
                  disabled={availableVariants.length === 0}
                >
                  <option value="">— Không có biến thể —</option>
                  {availableVariants.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>

                <input
                  type="number"
                  min={1}
                  value={addQty}
                  onChange={(e) => setAddQty(Math.max(1, Number(e.target.value)))}
                  placeholder="Số lượng"
                  className={inputCls}
                />

                <button
                  onClick={handleAddItem}
                  disabled={!addProductId || adding}
                  className="flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  Thêm
                </button>
              </div>
            </div>

            {/* Items table */}
            {items.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Chưa có sản phẩm nào</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Sản phẩm</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground w-20">SL</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground w-32">Giá bán</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground w-28">Giá vốn</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground w-28">Lợi nhuận</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground w-16">Biên</th>
                      <th className="px-4 py-3 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {items.map((item) => (
                      <tr key={item._id} className="hover:bg-muted/20">
                        <td className="px-4 py-3">
                          <div className="font-medium">{item.productName}</div>
                          {item.variantName && (
                            <div className="text-xs text-muted-foreground">{item.variantName}</div>
                          )}
                          <div className="text-xs text-muted-foreground mt-0.5">
                            Phí sàn {formatPct(item.platformFeePct)} · TT {formatPct(item.paymentFeePct)}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(e) => updateItem(item._id, { quantity: Math.max(1, Number(e.target.value)) })}
                            className="w-16 rounded border bg-background px-2 py-1 text-right text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                          />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <input
                            type="number"
                            min={0}
                            value={item.sellingPrice}
                            onChange={(e) => updateItem(item._id, { sellingPrice: Number(e.target.value) })}
                            className="w-28 rounded border bg-background px-2 py-1 text-right text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-ring"
                          />
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                          {formatVND(item.costPrice)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          <span className={item.grossProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                            {formatVND(item.grossProfit)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-sm">
                          {item.profitMargin < 20 && (
                            <AlertTriangle className="inline mr-1 h-3.5 w-3.5 text-yellow-500" />
                          )}
                          <span className={item.profitMargin >= 20 ? 'text-green-600 dark:text-green-400' : item.profitMargin >= 10 ? 'text-yellow-600' : 'text-red-600'}>
                            {formatPct(item.profitMargin)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => removeItem(item._id)}
                            className="rounded p-1 text-muted-foreground hover:text-red-500"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ---- Summary sidebar ---- */}
        <div className="space-y-4">
          <div className="rounded-xl border bg-card p-5 space-y-3 sticky top-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Tóm tắt đơn</h3>

            <div className="space-y-2 text-sm">
              <SummaryRow label="Tạm tính" value={formatVND(subtotal)} />
              {discountAmount > 0 && (
                <SummaryRow label="Giảm giá" value={`-${formatVND(discountAmount)}`} cls="text-red-600" />
              )}
              {buyerShippingFee > 0 && (
                <SummaryRow label="Ship (khách trả)" value={formatVND(buyerShippingFee)} />
              )}
              <div className="border-t pt-2">
                <SummaryRow label="Doanh thu" value={formatVND(totalRevenue)} bold />
              </div>
              <SummaryRow label="Lợi nhuận gộp SP" value={formatVND(totalGrossProfit)} />
              {netShipping !== 0 && (
                <SummaryRow
                  label="Chi phí ship ròng"
                  value={`-${formatVND(netShipping)}`}
                  cls={netShipping > 0 ? 'text-red-600' : 'text-green-600'}
                />
              )}
              <div className="border-t pt-2">
                <SummaryRow
                  label="Lợi nhuận ròng"
                  value={formatVND(netProfit)}
                  bold
                  cls={netProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}
                />
                <SummaryRow
                  label="Biên lợi nhuận"
                  value={formatPct(profitMargin)}
                  cls={profitMargin >= 20 ? 'text-green-600 dark:text-green-400' : profitMargin >= 10 ? 'text-yellow-600' : 'text-red-600'}
                />
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting || items.length === 0 || !channelId}
              className="mt-2 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? 'Đang tạo...' : 'Tạo đơn hàng'}
            </button>
          </div>
        </div>
      </div>
    </PageLayout>
  )
}

function SummaryRow({
  label,
  value,
  bold,
  cls,
}: {
  label: string
  value: string
  bold?: boolean
  cls?: string
}) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular-nums ${bold ? 'font-semibold' : ''} ${cls ?? ''}`}>{value}</span>
    </div>
  )
}
