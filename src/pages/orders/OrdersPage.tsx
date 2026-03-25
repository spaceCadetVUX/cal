import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, Plus, ShoppingCart, Trash2 } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { PageLayout } from '@/components/layout/PageLayout'
import { DataTable } from '@/components/shared/DataTable'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { ChannelBadge } from '@/components/shared/ChannelBadge'
import { useOrderStore, type OrderSummary } from '@/stores/useOrderStore'
import { useChannelStore } from '@/stores/useChannelStore'
import { formatVND, formatDate, formatPct } from '@/utils/formatters'
import { toast } from 'sonner'
import type { OrderStatus } from '@/types'

// --------------- Status config ---------------

const STATUS_CONFIG: Record<OrderStatus, { label: string; cls: string }> = {
  pending:   { label: 'Chờ xử lý',  cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  confirmed: { label: 'Đã xác nhận', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  shipping:  { label: 'Đang giao',   cls: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  delivered: { label: 'Đã giao',     cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  cancelled: { label: 'Đã hủy',      cls: 'bg-muted text-muted-foreground' },
  returned:  { label: 'Hoàn trả',    cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
}

type StatusFilter = 'all' | OrderStatus

// --------------- Component ---------------

export default function OrdersPage() {
  const navigate = useNavigate()
  const { orders, loading, load, deleteOrder } = useOrderStore()
  const { channels, load: loadChannels } = useChannelStore()

  const [filterChannelId, setFilterChannelId] = useState('')
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('all')
  const [deleteTarget, setDeleteTarget] = useState<OrderSummary | null>(null)

  useEffect(() => {
    load()
    loadChannels()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const channelMap = useMemo(
    () => Object.fromEntries(channels.map((c) => [c.id, c])),
    [channels],
  )

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (filterChannelId && o.channelId !== filterChannelId) return false
      if (filterStatus !== 'all' && o.status !== filterStatus) return false
      return true
    })
  }, [orders, filterChannelId, filterStatus])

  const handleDelete = async () => {
    if (!deleteTarget) return
    const err = await deleteOrder(deleteTarget.id)
    if (err) {
      toast.error(err)
    } else {
      toast.success('Đã xóa đơn hàng')
    }
    setDeleteTarget(null)
  }

  const columns: ColumnDef<OrderSummary>[] = useMemo(
    () => [
      {
        header: 'Mã đơn',
        accessorKey: 'orderCode',
        cell: ({ getValue }) => (
          <span className="font-mono text-sm font-medium">{getValue() as string}</span>
        ),
      },
      {
        header: 'Kênh',
        accessorKey: 'channelId',
        cell: ({ getValue }) => {
          const ch = channelMap[getValue() as string]
          return ch ? <ChannelBadge name={ch.name} color={ch.color} /> : '—'
        },
      },
      {
        header: 'Ngày',
        accessorKey: 'orderDate',
        cell: ({ getValue }) => formatDate(getValue() as Date),
      },
      {
        header: 'Doanh thu',
        accessorKey: 'totalRevenue',
        cell: ({ getValue }) => (
          <span className="tabular-nums font-medium">{formatVND(getValue() as number)}</span>
        ),
      },
      {
        header: 'Lợi nhuận',
        id: 'netProfit',
        accessorFn: (row) => row.netProfit,
        cell: ({ getValue }) => {
          const v = getValue() as number
          return (
            <span className={`tabular-nums font-medium ${v >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {formatVND(v)}
            </span>
          )
        },
      },
      {
        header: 'Biên LN',
        id: 'profitMargin',
        accessorFn: (row) => row.profitMargin,
        cell: ({ getValue }) => {
          const v = getValue() as number
          return (
            <span className={`tabular-nums text-sm ${v >= 20 ? 'text-green-600 dark:text-green-400' : v >= 10 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>
              {formatPct(v)}
            </span>
          )
        },
      },
      {
        header: 'Trạng thái',
        accessorKey: 'status',
        cell: ({ getValue }) => {
          const cfg = STATUS_CONFIG[getValue() as OrderStatus]
          return (
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cfg.cls}`}>
              {cfg.label}
            </span>
          )
        },
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const o = row.original
          const canDelete = o.status !== 'delivered' && o.status !== 'shipping'
          return (
            <div className="flex items-center justify-end gap-1">
              <button
                onClick={() => navigate(`/orders/${o.id}`)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                title="Xem chi tiết"
              >
                <Eye className="h-4 w-4" />
              </button>
              {canDelete && (
                <button
                  onClick={() => setDeleteTarget(o)}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-red-500"
                  title="Xóa"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          )
        },
      },
    ],
    [channelMap, navigate],
  )

  const selectCls = 'rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring'

  return (
    <PageLayout
      title="Đơn bán"
      action={
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/orders/pos')}
            className="flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            <ShoppingCart className="h-4 w-4" />
            POS Mode
          </button>
          <button
            onClick={() => navigate('/orders/new')}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Tạo đơn
          </button>
        </div>
      }
    >
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filterChannelId}
          onChange={(e) => setFilterChannelId(e.target.value)}
          className={selectCls}
        >
          <option value="">Tất cả kênh</option>
          {channels.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as StatusFilter)}
          className={selectCls}
        >
          <option value="all">Tất cả trạng thái</option>
          {(Object.keys(STATUS_CONFIG) as OrderStatus[]).map((s) => (
            <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
          ))}
        </select>

        {(filterChannelId || filterStatus !== 'all') && (
          <button
            onClick={() => { setFilterChannelId(''); setFilterStatus('all') }}
            className="text-sm text-muted-foreground underline hover:text-foreground"
          >
            Xóa bộ lọc
          </button>
        )}

        <span className="ml-auto text-sm text-muted-foreground">
          {filtered.length} / {orders.length} đơn
        </span>
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Đang tải...</p>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          searchPlaceholder="Tìm theo mã đơn..."
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Xóa đơn hàng?"
        description={`Xóa đơn "${deleteTarget?.orderCode}". Tồn kho sẽ không được hoàn trả. Thao tác không thể hoàn tác.`}
        confirmLabel="Xóa"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </PageLayout>
  )
}
