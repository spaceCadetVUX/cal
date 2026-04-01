import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, RotateCcw } from 'lucide-react'
import { PageLayout } from '@/components/layout/PageLayout'
import { StatCard } from '@/components/shared/StatCard'
import { ChannelBadge } from '@/components/shared/ChannelBadge'
import { useOrderStore } from '@/stores/useOrderStore'
import { useChannelStore } from '@/stores/useChannelStore'
import { useCustomerStore } from '@/stores/useCustomerStore'
import { calcOrderProfit } from '@/utils/profitCalculator'
import { formatVND, formatDate, formatPct } from '@/utils/formatters'
import db from '@/db/db'
import type { Order, OrderItem, OrderStatus } from '@/types'

// --------------- Status config ---------------

const STATUS_CONFIG: Record<OrderStatus, { label: string; cls: string }> = {
  pending:   { label: 'Chờ xử lý',  cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  confirmed: { label: 'Đã xác nhận', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  shipping:  { label: 'Đang giao',   cls: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  delivered: { label: 'Đã giao',     cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  cancelled: { label: 'Đã hủy',      cls: 'bg-muted text-muted-foreground' },
  returned:  { label: 'Hoàn trả',    cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
}

const STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending:   ['confirmed', 'cancelled'],
  confirmed: ['shipping', 'cancelled'],
  shipping:  ['delivered', 'returned'],
  delivered: [],
  cancelled: [],
  returned:  [],
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Tiền mặt', bank_transfer: 'Chuyển khoản', momo: 'MoMo',
  vnpay: 'VNPay', zalopay: 'ZaloPay', cod: 'COD', card: 'Thẻ', other: 'Khác',
}

// --------------- Component ---------------

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { orders, updateStatus } = useOrderStore()
  const { channels } = useChannelStore()
  const { customers } = useCustomerStore()

  const [order, setOrder] = useState<Order | null | undefined>(undefined)
  const [items, setItems] = useState<OrderItem[]>([])
  const [productNames, setProductNames] = useState<Record<string, string>>({})
  const [variantNames, setVariantNames] = useState<Record<string, string>>({})
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [showReturnDialog, setShowReturnDialog] = useState(false)
  const [returnQtys, setReturnQtys] = useState<Record<string, number>>({})
  const [returning, setReturning] = useState(false)

  const { getOrderDetail, returnOrder } = useOrderStore()

  useEffect(() => {
    if (!id) return
    getOrderDetail(id).then((detail) => {
      if (!detail) { setOrder(null); return }
      setOrder(detail.order)
      setItems(detail.items)

      const productIds = [...new Set(detail.items.map((i) => i.productId))]
      const variantIds = detail.items.filter((i) => i.variantId).map((i) => i.variantId!)
      Promise.all([
        db.products.bulkGet(productIds),
        db.productVariants.bulkGet(variantIds),
      ]).then(([products, variants]) => {
        setProductNames(
          Object.fromEntries(
            (products.filter(Boolean) as NonNullable<typeof products[0]>[]).map((p) => [p.id, p.name]),
          ),
        )
        setVariantNames(
          Object.fromEntries(
            (variants.filter(Boolean) as NonNullable<typeof variants[0]>[]).map((v) => [v.id, v.name]),
          ),
        )
      })
    })
  }, [id, orders]) // eslint-disable-line react-hooks/exhaustive-deps

  if (order === undefined) {
    return <PageLayout title="Đơn hàng"><p className="text-muted-foreground">Đang tải...</p></PageLayout>
  }
  if (order === null) {
    return (
      <PageLayout title="Không tìm thấy">
        <p className="text-muted-foreground">Đơn hàng không tồn tại.</p>
        <button onClick={() => navigate('/orders')} className="mt-4 text-sm text-primary hover:underline">
          ← Quay lại danh sách
        </button>
      </PageLayout>
    )
  }

  const channel = channels.find((c) => c.id === order.channelId)
  const customer = customers.find((c) => c.id === order.customerId)
  const status = STATUS_CONFIG[order.status]
  const nextStatuses = STATUS_TRANSITIONS[order.status]

  // Profit calculations
  const totalGrossProfit = items.reduce((s, i) => s + i.grossProfit, 0)
  const netProfit = calcOrderProfit(
    items.map((i) => i.grossProfit),
    order.sellerShippingFee,
    order.shippingSubsidy,
  )
  const profitMargin = order.totalRevenue > 0 ? (netProfit / order.totalRevenue) * 100 : 0
  const totalPlatformFee = items.reduce((s, i) => s + i.platformFee, 0)
  const totalPaymentFee = items.reduce((s, i) => s + i.paymentFee, 0)
  const totalPackaging = items.reduce((s, i) => s + i.packagingCost * i.quantity, 0)
  const totalOther = items.reduce((s, i) => s + i.otherCost * i.quantity, 0)

  const handleStatusChange = async (newStatus: OrderStatus) => {
    if (newStatus === 'returned') {
      setReturnQtys(Object.fromEntries(items.map((i) => [i.id, i.quantity])))
      setShowReturnDialog(true)
      return
    }
    setUpdatingStatus(true)
    try {
      await updateStatus(order.id, newStatus)
      setOrder((prev) => prev ? { ...prev, status: newStatus } : prev)
      toast.success(`Đã chuyển trạng thái: ${STATUS_CONFIG[newStatus].label}`)
    } catch {
      toast.error('Cập nhật thất bại')
    } finally {
      setUpdatingStatus(false)
    }
  }

  const handleReturn = async () => {
    setReturning(true)
    try {
      const returnItems = Object.entries(returnQtys)
        .filter(([, qty]) => qty > 0)
        .map(([itemId, quantity]) => ({ itemId, quantity }))
      if (returnItems.length === 0) { toast.error('Chọn ít nhất 1 sản phẩm'); return }
      const err = await returnOrder(order.id, returnItems)
      if (err) { toast.error(err); return }
      setOrder((prev) => prev ? { ...prev, status: 'returned' } : prev)
      setShowReturnDialog(false)
      toast.success('Đã tạo hoàn trả, hàng đã được hoàn kho')
    } catch {
      toast.error('Hoàn trả thất bại')
    } finally {
      setReturning(false)
    }
  }

  return (
    <PageLayout
      title={order.orderCode}
      action={
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => navigate('/orders')}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" />
            Danh sách
          </button>

          {nextStatuses.map((s) => (
            <button
              key={s}
              onClick={() => handleStatusChange(s)}
              disabled={updatingStatus}
              className={`rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50 ${
                s === 'cancelled' || s === 'returned'
                  ? 'border border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20'
                  : 'bg-primary text-primary-foreground hover:opacity-90'
              }`}
            >
              {s === 'returned' ? <RotateCcw className="inline h-3.5 w-3.5 mr-1" /> : '→ '}
              {STATUS_CONFIG[s].label}
            </button>
          ))}
          {order.status === 'delivered' && (
            <button
              onClick={() => { setReturnQtys(Object.fromEntries(items.map((i) => [i.id, i.quantity]))); setShowReturnDialog(true) }}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Tạo hoàn trả
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-6">
        {/* Info card */}
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-start justify-between mb-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Thông tin đơn hàng
            </h3>
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${status.cls}`}>
              {status.label}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <Row label="Kênh bán" value={channel ? <ChannelBadge name={channel.name} color={channel.color} /> : '—'} />
            <Row label="Ngày đặt" value={formatDate(order.orderDate)} />
            <Row label="Khách hàng" value={customer?.name ?? 'Khách vãng lai'} />
            <Row label="PTTT" value={PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod} />
            {order.externalOrderId && <Row label="Mã đơn ngoài" value={order.externalOrderId} />}
            <Row label="Ngày tạo" value={formatDate(order.createdAt)} />
            {order.note && <Row label="Ghi chú" value={order.note} />}
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard title="Doanh thu" value={formatVND(order.totalRevenue)} />
          <StatCard
            title="Lợi nhuận ròng"
            value={formatVND(netProfit)}
            variant={netProfit >= 0 ? 'default' : 'default'}
          />
          <StatCard title="Biên LN" value={formatPct(profitMargin)} />
          <StatCard title="Số sản phẩm" value={String(items.length)} />
        </div>

        {/* Line items */}
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Chi tiết sản phẩm
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="px-5 py-3 text-left font-medium text-muted-foreground">Sản phẩm</th>
                  <th className="px-5 py-3 text-right font-medium text-muted-foreground">SL</th>
                  <th className="px-5 py-3 text-right font-medium text-muted-foreground">Giá bán</th>
                  <th className="px-5 py-3 text-right font-medium text-muted-foreground">Giá vốn</th>
                  <th className="px-5 py-3 text-right font-medium text-muted-foreground">Phí sàn</th>
                  <th className="px-5 py-3 text-right font-medium text-muted-foreground">Phí TT</th>
                  <th className="px-5 py-3 text-right font-medium text-muted-foreground">Đóng gói</th>
                  <th className="px-5 py-3 text-right font-medium text-muted-foreground">LN gộp</th>
                  <th className="px-5 py-3 text-right font-medium text-muted-foreground">Biên</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((item) => {
                  const subtotal = item.sellingPrice * item.quantity
                  const margin = subtotal > 0 ? (item.grossProfit / subtotal) * 100 : 0
                  return (
                    <tr key={item.id} className="hover:bg-muted/20">
                      <td className="px-5 py-3">
                        <div className="font-medium">{productNames[item.productId] ?? '—'}</div>
                        {item.variantId && (
                          <div className="text-xs text-muted-foreground">{variantNames[item.variantId] ?? '—'}</div>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums">{item.quantity}</td>
                      <td className="px-5 py-3 text-right tabular-nums">{formatVND(item.sellingPrice)}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">{formatVND(item.costPrice)}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">{formatVND(item.platformFee)}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">{formatVND(item.paymentFee)}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">{formatVND(item.packagingCost * item.quantity)}</td>
                      <td className="px-5 py-3 text-right tabular-nums">
                        <span className={item.grossProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                          {formatVND(item.grossProfit)}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-sm">
                        <span className={margin >= 20 ? 'text-green-600 dark:text-green-400' : margin >= 10 ? 'text-yellow-600' : 'text-red-600'}>
                          {formatPct(margin)}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Profit breakdown summary */}
        <div className="rounded-xl border bg-card p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">
            Tổng kết lợi nhuận
          </h3>
          <div className="grid grid-cols-1 gap-y-2 text-sm sm:max-w-xs">
            <BRow label="Doanh thu (tạm tính)" value={formatVND(items.reduce((s, i) => s + i.sellingPrice * i.quantity, 0))} />
            {order.discountAmount > 0 && <BRow label="Giảm giá" value={`-${formatVND(order.discountAmount)}`} cls="text-red-600" />}
            <BRow label="Doanh thu thực" value={formatVND(order.totalRevenue)} bold />
            <div className="border-t my-1" />
            <BRow label="Phí sàn (tổng)" value={`-${formatVND(totalPlatformFee)}`} cls="text-red-600 dark:text-red-400" />
            <BRow label="Phí thanh toán" value={`-${formatVND(totalPaymentFee)}`} cls="text-red-600 dark:text-red-400" />
            <BRow label="Đóng gói (tổng)" value={`-${formatVND(totalPackaging)}`} cls="text-red-600 dark:text-red-400" />
            {totalOther > 0 && <BRow label="Chi phí khác" value={`-${formatVND(totalOther)}`} cls="text-red-600 dark:text-red-400" />}
            <BRow label="Giá vốn (tổng)" value={`-${formatVND(items.reduce((s, i) => s + i.costPrice * i.quantity, 0))}`} cls="text-red-600 dark:text-red-400" />
            <BRow label="Lợi nhuận gộp SP" value={formatVND(totalGrossProfit)} bold />
            <div className="border-t my-1" />
            {order.sellerShippingFee > 0 && <BRow label="Phí ship shop chịu" value={`-${formatVND(order.sellerShippingFee)}`} cls="text-red-600 dark:text-red-400" />}
            {order.shippingSubsidy > 0 && <BRow label="Trợ giá ship" value={`+${formatVND(order.shippingSubsidy)}`} cls="text-green-600" />}
            <div className="border-t my-1" />
            <BRow
              label="Lợi nhuận ròng"
              value={formatVND(netProfit)}
              bold
              cls={netProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}
            />
            <BRow
              label="Biên lợi nhuận"
              value={formatPct(profitMargin)}
              cls={profitMargin >= 20 ? 'text-green-600 dark:text-green-400' : profitMargin >= 10 ? 'text-yellow-600' : 'text-red-600'}
            />
          </div>
        </div>
      </div>

      {/* Return Dialog */}
      {showReturnDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-background border shadow-xl">
            <div className="px-5 py-4 border-b">
              <h2 className="text-base font-semibold">Tạo hoàn trả đơn hàng</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Chọn sản phẩm và số lượng cần hoàn trả</p>
            </div>
            <div className="p-5 space-y-3 max-h-80 overflow-y-auto">
              {items.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{productNames[item.productId] ?? '—'}</div>
                    {item.variantId && (
                      <div className="text-xs text-muted-foreground">{variantNames[item.variantId] ?? '—'}</div>
                    )}
                    <div className="text-xs text-muted-foreground">Đặt: {item.quantity}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-muted-foreground">Hoàn:</label>
                    <input
                      type="number"
                      min={0}
                      max={item.quantity}
                      value={returnQtys[item.id] ?? 0}
                      onChange={(e) => setReturnQtys((prev) => ({ ...prev, [item.id]: Math.min(item.quantity, Math.max(0, parseInt(e.target.value) || 0)) }))}
                      className="w-16 rounded-lg border px-2 py-1 text-sm text-center [appearance:textfield]"
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 py-4 border-t flex justify-end gap-2">
              <button
                onClick={() => setShowReturnDialog(false)}
                disabled={returning}
                className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                onClick={handleReturn}
                disabled={returning}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {returning ? 'Đang xử lý...' : 'Xác nhận hoàn trả'}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-2 items-center">
      <span className="w-36 shrink-0 text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}

function BRow({
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
