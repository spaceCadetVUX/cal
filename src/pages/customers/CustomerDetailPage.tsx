// ============================================================
// CustomerDetailPage.tsx — Chi tiết khách hàng + lịch sử đơn hàng
// ============================================================

import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Eye } from 'lucide-react'
import { PageLayout } from '@/components/layout/PageLayout'
import { ChannelBadge } from '@/components/shared/ChannelBadge'
import { useCustomerStore } from '@/stores/useCustomerStore'
import { useChannelStore } from '@/stores/useChannelStore'
import { formatVND, formatDate } from '@/utils/formatters'
import db from '@/db/db'
import type { Customer, CustomerType, Order, OrderStatus } from '@/types'

const TYPE_LABELS: Record<CustomerType, string> = {
  retail: 'Lẻ',
  wholesale: 'Sỉ',
  vip: 'VIP',
}

const STATUS_CONFIG: Record<OrderStatus, { label: string; cls: string }> = {
  pending:   { label: 'Chờ xử lý',   cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  confirmed: { label: 'Đã xác nhận', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  shipping:  { label: 'Đang giao',   cls: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  delivered: { label: 'Đã giao',     cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  cancelled: { label: 'Đã hủy',      cls: 'bg-muted text-muted-foreground' },
  returned:  { label: 'Hoàn trả',    cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
}

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { customers, stats } = useCustomerStore()
  const { channels } = useChannelStore()

  const [customer, setCustomer] = useState<Customer | null | undefined>(undefined)
  const [orders, setOrders] = useState<Order[]>([])
  const [loadingOrders, setLoadingOrders] = useState(true)

  // Resolve customer
  useEffect(() => {
    if (!id) return
    const fromStore = customers.find((c) => c.id === id)
    if (fromStore) {
      setCustomer(fromStore)
    } else {
      db.customers?.get(id).then((c) => setCustomer(c ?? null)).catch(() => setCustomer(null))
    }
  }, [id, customers])

  // Load orders
  useEffect(() => {
    if (!id) return
    setLoadingOrders(true)
    db.orders
      .where('customerId')
      .equals(id)
      .reverse()
      .sortBy('orderDate')
      .then((result) => setOrders(result))
      .finally(() => setLoadingOrders(false))
  }, [id])

  if (customer === undefined) {
    return <PageLayout title="Khách hàng"><p className="text-muted-foreground">Đang tải...</p></PageLayout>
  }
  if (customer === null) {
    return (
      <PageLayout title="Không tìm thấy">
        <p className="text-muted-foreground">Khách hàng không tồn tại.</p>
        <button onClick={() => navigate('/customers')} className="mt-4 text-sm text-primary hover:underline">
          ← Quay lại
        </button>
      </PageLayout>
    )
  }

  const channelMap = Object.fromEntries(channels.map((c) => [c.id, c]))
  const customerStats = stats[customer.id]
  const deliveredOrders = orders.filter((o) => o.status === 'delivered')
  const totalRevenue = deliveredOrders.reduce((s, o) => s + o.totalRevenue, 0)

  return (
    <PageLayout
      title={customer.name}
      action={
        <button
          onClick={() => navigate('/customers')}
          className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
          Danh sách
        </button>
      }
    >
      <div className="space-y-6">
        {/* Customer Info */}
        <div className="rounded-xl border bg-card p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Thông tin khách hàng
          </h3>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2.5 text-sm">
            <InfoRow label="Loại khách" value={
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                {TYPE_LABELS[customer.type]}
              </span>
            } />
            <InfoRow label="Ngày tạo" value={formatDate(customer.createdAt)} />
            {customer.phone && <InfoRow label="Điện thoại" value={customer.phone} />}
            {customer.email && <InfoRow label="Email" value={customer.email} />}
            {customer.address && <InfoRow label="Địa chỉ" value={customer.address} />}
            {customer.note && <InfoRow label="Ghi chú" value={customer.note} />}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard title="Tổng đơn" value={String(customerStats?.orderCount ?? orders.length)} />
          <StatCard title="Đã giao" value={String(deliveredOrders.length)} />
          <StatCard title="Tổng doanh thu" value={formatVND(totalRevenue || (customerStats?.totalSpent ?? 0))} />
          <StatCard
            title="Trung bình / đơn"
            value={deliveredOrders.length > 0 ? formatVND(totalRevenue / deliveredOrders.length) : '—'}
          />
        </div>

        {/* Order History */}
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Lịch sử đơn hàng ({orders.length})
            </h3>
          </div>
          {loadingOrders ? (
            <p className="p-5 text-sm text-muted-foreground">Đang tải...</p>
          ) : orders.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">Chưa có đơn hàng nào.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="px-5 py-3 text-left font-medium text-muted-foreground">Mã đơn</th>
                    <th className="px-5 py-3 text-left font-medium text-muted-foreground">Kênh</th>
                    <th className="px-5 py-3 text-left font-medium text-muted-foreground">Ngày</th>
                    <th className="px-5 py-3 text-right font-medium text-muted-foreground">Doanh thu</th>
                    <th className="px-5 py-3 text-left font-medium text-muted-foreground">Trạng thái</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {orders.map((order) => {
                    const ch = channelMap[order.channelId]
                    const statusCfg = STATUS_CONFIG[order.status]
                    return (
                      <tr key={order.id} className="hover:bg-muted/20">
                        <td className="px-5 py-3">
                          <span className="font-mono text-sm font-medium">{order.orderCode}</span>
                          {order.externalOrderId && (
                            <div className="text-xs text-muted-foreground">{order.externalOrderId}</div>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          {ch ? <ChannelBadge name={ch.name} color={ch.color} /> : '—'}
                        </td>
                        <td className="px-5 py-3 text-muted-foreground">{formatDate(order.orderDate)}</td>
                        <td className="px-5 py-3 text-right tabular-nums font-medium">{formatVND(order.totalRevenue)}</td>
                        <td className="px-5 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusCfg.cls}`}>
                            {statusCfg.label}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <Link
                            to={`/orders/${order.id}`}
                            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground inline-flex"
                            title="Xem chi tiết"
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  )
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <span className="w-32 shrink-0 text-muted-foreground">{label}</span>
      <span className="font-medium">{typeof value === 'string' ? value || '—' : value}</span>
    </div>
  )
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  )
}
