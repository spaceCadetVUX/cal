import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Minus, Plus, Search, ShoppingCart, Trash2, X } from 'lucide-react'
import { useOrderStore } from '@/stores/useOrderStore'
import { useChannelStore } from '@/stores/useChannelStore'
import { usePriceStore } from '@/stores/usePriceStore'
import { resolveChannelFee } from '@/utils/channelFeeResolver'
import { calcOrderItemProfit } from '@/utils/profitCalculator'
import { formatVND } from '@/utils/formatters'
import { generateId } from '@/utils/idGenerator'
import db from '@/db/db'
import type { PaymentMethod, Product, ProductVariant } from '@/types'

// --------------- Types ---------------

interface CartItem {
  _id: string
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
  grossProfit: number
}

interface CatalogEntry {
  product: Product
  variants: ProductVariant[]
}

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Tiền mặt' },
  { value: 'bank_transfer', label: 'CK' },
  { value: 'momo', label: 'MoMo' },
  { value: 'vnpay', label: 'VNPay' },
  { value: 'zalopay', label: 'Zalo' },
  { value: 'cod', label: 'COD' },
]

// --------------- Component ---------------

export default function PosPage() {
  const navigate = useNavigate()
  const { createOrder } = useOrderStore()
  const { channels, load: loadChannels } = useChannelStore()
  const { getLatestCostPrice, getEffectiveConfig, load: loadPrices, configs } = usePriceStore()

  const [catalog, setCatalog] = useState<CatalogEntry[]>([])
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [cashReceived, setCashReceived] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  const catalogLoaded = useRef(false)

  // Find offline channel
  const offlineChannel = useMemo(
    () => channels.find((c) => c.type === 'offline' && c.isActive) ?? channels.find((c) => c.isActive),
    [channels],
  )

  useEffect(() => {
    loadChannels()
    if (configs.length === 0) loadPrices()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (catalogLoaded.current) return
    catalogLoaded.current = true
    ;(async () => {
      const [products, variants] = await Promise.all([
        db.products.filter((p) => p.isActive).toArray(),
        db.productVariants.toArray(),
      ])
      const entries: CatalogEntry[] = products.map((p) => ({
        product: p,
        variants: variants.filter((v) => v.productId === p.id && v.isActive),
      }))
      setCatalog(entries)
    })()
  }, [])

  // Filtered product list
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return catalog
    return catalog.filter(
      (e) =>
        e.product.name.toLowerCase().includes(q) ||
        e.product.sku.toLowerCase().includes(q) ||
        (e.product.barcode ?? '').toLowerCase().includes(q),
    )
  }, [catalog, search])

  const addToCart = async (product: Product, variant?: ProductVariant) => {
    if (!offlineChannel) {
      toast.error('Không tìm thấy kênh offline')
      return
    }

    const variantId = variant?.id
    // Check if already in cart
    const existing = cart.find(
      (i) => i.productId === product.id && i.variantId === variantId,
    )
    if (existing) {
      setCart((prev) =>
        prev.map((i) =>
          i._id === existing._id ? { ...i, quantity: i.quantity + 1 } : i,
        ),
      )
      return
    }

    // Resolve price + fees
    const { platformFeePct, paymentFeePct } = await resolveChannelFee(
      offlineChannel.id,
      product.categoryId,
      db,
    )
    const priceConfig = getEffectiveConfig(product.id, variantId ?? null, offlineChannel.id)
    const sellingPrice = priceConfig?.sellingPrice ?? 0
    const packagingCost = priceConfig?.packagingCost ?? 0
    const otherCost = priceConfig?.otherCost ?? 0
    const costPrice = (await getLatestCostPrice(product.id, variantId)) ?? 0

    const calc = calcOrderItemProfit({
      sellingPrice,
      costPrice,
      platformFeePct,
      paymentFeePct,
      packagingCost,
      otherCost,
      quantity: 1,
    })

    setCart((prev) => [
      ...prev,
      {
        _id: generateId(),
        productId: product.id,
        productName: product.name,
        variantId,
        variantName: variant?.name,
        categoryId: product.categoryId,
        quantity: 1,
        sellingPrice,
        costPrice,
        packagingCost,
        otherCost,
        platformFeePct,
        paymentFeePct,
        grossProfit: calc.grossProfit,
      },
    ])
  }

  const updateQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => {
          if (i._id !== id) return i
          const newQty = i.quantity + delta
          if (newQty <= 0) return null
          const calc = calcOrderItemProfit({
            sellingPrice: i.sellingPrice,
            costPrice: i.costPrice,
            platformFeePct: i.platformFeePct,
            paymentFeePct: i.paymentFeePct,
            packagingCost: i.packagingCost,
            otherCost: i.otherCost,
            quantity: newQty,
          })
          return { ...i, quantity: newQty, grossProfit: calc.grossProfit }
        })
        .filter((i): i is CartItem => i !== null),
    )
  }

  const removeFromCart = (id: string) => setCart((prev) => prev.filter((i) => i._id !== id))

  const total = useMemo(() => cart.reduce((s, i) => s + i.sellingPrice * i.quantity, 0), [cart])
  const change = cashReceived - total

  const handleCheckout = async () => {
    if (!offlineChannel) { toast.error('Không tìm thấy kênh offline'); return }
    if (cart.length === 0) { toast.error('Giỏ hàng trống'); return }
    setSubmitting(true)
    try {
      await createOrder({
        channelId: offlineChannel.id,
        orderDate: new Date(),
        paymentMethod,
        buyerShippingFee: 0,
        sellerShippingFee: 0,
        shippingSubsidy: 0,
        discountAmount: 0,
        items: cart.map((i) => ({
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
      toast.success('Thanh toán thành công!')
      setCart([])
      setCashReceived(0)
    } catch {
      toast.error('Thanh toán thất bại')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {/* Top bar */}
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <button
          onClick={() => navigate('/orders')}
          className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
          Thoát POS
        </button>
        <span className="font-semibold">Quick POS</span>
        {offlineChannel && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {offlineChannel.name}
          </span>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ---- Left: Product catalog ---- */}
        <div className="flex flex-1 flex-col overflow-hidden border-r">
          {/* Search */}
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm tên / SKU / barcode..."
                className="w-full rounded-lg border bg-background py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                autoFocus
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Product grid */}
          <div className="flex-1 overflow-y-auto p-3">
            {filtered.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Không tìm thấy sản phẩm</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {filtered.map(({ product, variants }) =>
                  variants.length === 0 ? (
                    <ProductCard
                      key={product.id}
                      name={product.name}
                      sku={product.sku}
                      onClick={() => addToCart(product)}
                    />
                  ) : (
                    variants.map((v) => (
                      <ProductCard
                        key={`${product.id}-${v.id}`}
                        name={product.name}
                        sku={v.sku}
                        variant={v.name}
                        onClick={() => addToCart(product, v)}
                      />
                    ))
                  ),
                )}
              </div>
            )}
          </div>
        </div>

        {/* ---- Right: Cart + checkout ---- */}
        <div className="flex w-80 flex-col bg-card xl:w-96">
          {/* Cart header */}
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <ShoppingCart className="h-4 w-4" />
            <span className="font-medium">Giỏ hàng</span>
            {cart.length > 0 && (
              <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                {cart.reduce((s, i) => s + i.quantity, 0)} sp
              </span>
            )}
          </div>

          {/* Cart items */}
          <div className="flex-1 overflow-y-auto">
            {cart.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Chưa có sản phẩm</p>
            ) : (
              <div className="divide-y">
                {cart.map((item) => (
                  <div key={item._id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium">{item.productName}</p>
                        {item.variantName && (
                          <p className="text-xs text-muted-foreground">{item.variantName}</p>
                        )}
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {formatVND(item.sellingPrice)} / cái
                        </p>
                      </div>
                      <button
                        onClick={() => removeFromCart(item._id)}
                        className="text-muted-foreground hover:text-red-500 shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => updateQty(item._id, -1)}
                          className="rounded border p-1 hover:bg-muted"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-8 text-center text-sm tabular-nums">{item.quantity}</span>
                        <button
                          onClick={() => updateQty(item._id, 1)}
                          className="rounded border p-1 hover:bg-muted"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <span className="font-medium tabular-nums text-sm">
                        {formatVND(item.sellingPrice * item.quantity)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Checkout panel */}
          <div className="border-t p-4 space-y-3">
            {/* Total */}
            <div className="flex justify-between text-lg font-bold">
              <span>Tổng</span>
              <span className="tabular-nums">{formatVND(total)}</span>
            </div>

            {/* Payment method */}
            <div className="flex gap-1.5 flex-wrap">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setPaymentMethod(m.value)}
                  className={`rounded px-2.5 py-1 text-xs font-medium border transition-colors ${
                    paymentMethod === m.value
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'hover:bg-muted'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* Cash input (only for cash) */}
            {paymentMethod === 'cash' && (
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Tiền khách đưa</label>
                <input
                  type="number"
                  min={0}
                  value={cashReceived || ''}
                  onChange={(e) => setCashReceived(Number(e.target.value))}
                  placeholder="Nhập số tiền..."
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
                />
                {cashReceived > 0 && (
                  <div className={`flex justify-between text-sm font-semibold ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    <span>{change >= 0 ? 'Tiền thối' : 'Còn thiếu'}</span>
                    <span className="tabular-nums">{formatVND(Math.abs(change))}</span>
                  </div>
                )}
              </div>
            )}

            {/* Quick cash buttons */}
            {paymentMethod === 'cash' && total > 0 && (
              <div className="flex gap-1.5 flex-wrap">
                {[total, Math.ceil(total / 10000) * 10000, Math.ceil(total / 50000) * 50000, Math.ceil(total / 100000) * 100000]
                  .filter((v, i, arr) => arr.indexOf(v) === i)
                  .slice(0, 4)
                  .map((v) => (
                    <button
                      key={v}
                      onClick={() => setCashReceived(v)}
                      className="rounded border px-2 py-1 text-xs hover:bg-muted tabular-nums"
                    >
                      {formatVND(v)}
                    </button>
                  ))}
              </div>
            )}

            <button
              onClick={handleCheckout}
              disabled={submitting || cart.length === 0}
              className="w-full rounded-lg bg-primary py-3 text-base font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? 'Đang xử lý...' : 'Thanh toán'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ProductCard({
  name,
  sku,
  variant,
  onClick,
}: {
  name: string
  sku: string
  variant?: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-xl border bg-background p-3 text-left hover:bg-muted/50 hover:border-primary/50 active:scale-95 transition-transform"
    >
      <p className="text-sm font-medium line-clamp-2 leading-tight">{name}</p>
      {variant && <p className="mt-0.5 text-xs text-primary">{variant}</p>}
      <p className="mt-1 text-xs text-muted-foreground font-mono">{sku}</p>
    </button>
  )
}
