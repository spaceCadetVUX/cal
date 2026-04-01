import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import * as Dialog from '@radix-ui/react-dialog'
import { AlertTriangle, Minus, Plus, X } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { PageLayout } from '@/components/layout/PageLayout'
import { DataTable } from '@/components/shared/DataTable'
import { useInventoryStore, type InventoryWithProduct, type MovementWithProduct } from '@/stores/useInventoryStore'
import { useCategoryStore } from '@/stores/useCategoryStore'
import { useChannelStore } from '@/stores/useChannelStore'
import { ChannelBadge } from '@/components/shared/ChannelBadge'
import { formatDate, formatVND } from '@/utils/formatters'
import type { StockMovementType } from '@/types'

// --------------- Types ---------------

type Tab = 'overview' | 'history'
type StockFilter = 'all' | 'lowstock' | 'outofstock'

const MOVEMENT_TYPE_LABELS: Record<StockMovementType, { label: string; cls: string }> = {
  import: { label: 'Nhập hàng', cls: 'text-green-600 dark:text-green-400' },
  sale: { label: 'Bán hàng', cls: 'text-blue-600 dark:text-blue-400' },
  return: { label: 'Hoàn trả', cls: 'text-purple-600 dark:text-purple-400' },
  adjustment: { label: 'Điều chỉnh', cls: 'text-orange-600 dark:text-orange-400' },
  damage: { label: 'Hàng hỏng', cls: 'text-red-600 dark:text-red-400' },
}

// --------------- Adjust Dialog ---------------

const adjustSchema = z.object({
  type: z.enum(['add', 'subtract'] as const),
  amount: z.coerce.number().min(1, 'Số lượng phải ≥ 1'),
  note: z.string().optional(),
})
type AdjustFields = z.infer<typeof adjustSchema>

interface AdjustDialogProps {
  open: boolean
  onClose: () => void
  item: InventoryWithProduct | null
}

function AdjustDialog({ open, onClose, item }: AdjustDialogProps) {
  const { adjust, load } = useInventoryStore()
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<AdjustFields>({
    resolver: zodResolver(adjustSchema),
    defaultValues: { type: 'add' },
  })

  useEffect(() => {
    if (open) reset({ type: 'add', amount: undefined as unknown as number, note: '' })
  }, [open, reset])

  const onSubmit = async (fields: AdjustFields) => {
    if (!item) return
    const delta = fields.type === 'add' ? fields.amount : -fields.amount
    try {
      await adjust({
        productId: item.record.productId,
        variantId: item.record.variantId,
        delta,
        note: fields.note || undefined,
      })
      await load()
      toast.success(`Đã ${fields.type === 'add' ? 'thêm' : 'trừ'} ${fields.amount} đơn vị`)
      onClose()
    } catch {
      toast.error('Điều chỉnh thất bại')
    }
  }

  const inputCls = 'w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring'

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-card shadow-lg">
          <div className="flex items-center justify-between border-b px-6 py-4">
            <Dialog.Title className="text-base font-semibold">Điều chỉnh tồn kho</Dialog.Title>
            <Dialog.Close className="rounded-lg p-1 text-muted-foreground hover:bg-muted">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          {item && (
            <div className="px-6 pt-4 pb-2">
              <p className="text-sm font-medium">{item.product.name}</p>
              {item.variantName && <p className="text-xs text-muted-foreground">{item.variantName}</p>}
              <p className="text-xs text-muted-foreground mt-1">
                Tồn kho hiện tại: <span className="font-semibold text-foreground">{item.record.quantity}</span>
                {' '}/ Khả dụng: <span className="font-semibold text-foreground">{item.availableQty}</span>
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-4 px-6 py-4">
              {/* Loại điều chỉnh */}
              <div className="flex gap-3">
                <label className="flex-1">
                  <input type="radio" {...register('type')} value="add" className="sr-only peer" />
                  <div className="flex items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-medium cursor-pointer peer-checked:border-green-500 peer-checked:bg-green-50 peer-checked:text-green-700 dark:peer-checked:bg-green-900/20 dark:peer-checked:text-green-400 hover:bg-muted transition-colors">
                    <Plus className="h-4 w-4" />
                    Thêm vào
                  </div>
                </label>
                <label className="flex-1">
                  <input type="radio" {...register('type')} value="subtract" className="sr-only peer" />
                  <div className="flex items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-medium cursor-pointer peer-checked:border-red-500 peer-checked:bg-red-50 peer-checked:text-red-700 dark:peer-checked:bg-red-900/20 dark:peer-checked:text-red-400 hover:bg-muted transition-colors">
                    <Minus className="h-4 w-4" />
                    Trừ đi
                  </div>
                </label>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Số lượng <span className="text-red-500">*</span></label>
                <input {...register('amount')} type="number" min={1} className={inputCls} autoFocus />
                {errors.amount && <p className="text-xs text-red-500">{errors.amount.message}</p>}
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Lý do / Ghi chú</label>
                <input {...register('note')} className={inputCls} placeholder="VD: Kiểm kê kho, hàng hỏng..." />
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t px-6 py-4">
              <Dialog.Close asChild>
                <button type="button" className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted">
                  Huỷ
                </button>
              </Dialog.Close>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {isSubmitting ? 'Đang lưu...' : 'Điều chỉnh'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// --------------- Main Page ---------------

export default function InventoryPage() {
  const { items, loading, load, loadMovements } = useInventoryStore()
  const { categories } = useCategoryStore()
  const { channels } = useChannelStore()

  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [stockFilter, setStockFilter] = useState<StockFilter>('all')
  const [adjustTarget, setAdjustTarget] = useState<InventoryWithProduct | null>(null)
  const [movements, setMovements] = useState<MovementWithProduct[]>([])
  const [movTypeFilter, setMovTypeFilter] = useState('')
  const [movLoading, setMovLoading] = useState(false)

  const categoryMap = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c.name])),
    [categories],
  )
  const channelMap = useMemo(
    () => Object.fromEntries(channels.map((c) => [c.id, c])),
    [channels],
  )

  useEffect(() => {
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeTab !== 'history') return
    setMovLoading(true)
    loadMovements({ type: movTypeFilter || undefined }).then((m) => {
      setMovements(m)
      setMovLoading(false)
    })
  }, [activeTab, movTypeFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  // --------------- Filtered items ---------------

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (stockFilter === 'lowstock') return item.isLow && item.availableQty > 0
      if (stockFilter === 'outofstock') return item.availableQty <= 0
      return true
    })
  }, [items, stockFilter])

  // Summary stats
  const totalItems = items.length
  const lowStockCount = items.filter((i) => i.isLow && i.availableQty > 0).length
  const outOfStockCount = items.filter((i) => i.availableQty <= 0).length

  // --------------- Columns: Overview ---------------

  const overviewColumns: ColumnDef<InventoryWithProduct>[] = useMemo(
    () => [
      {
        header: 'Sản phẩm',
        accessorFn: (row) => row.product.name,
        cell: ({ row }) => (
          <div>
            <p className="font-medium">{row.original.product.name}</p>
            {row.original.variantName && (
              <p className="text-xs text-muted-foreground">{row.original.variantName}</p>
            )}
          </div>
        ),
      },
      {
        header: 'SKU',
        accessorFn: (row) => row.product.sku,
        cell: ({ getValue }) => (
          <span className="font-mono text-xs text-muted-foreground">{getValue() as string}</span>
        ),
      },
      {
        header: 'Danh mục',
        accessorFn: (row) => categoryMap[row.product.categoryId] ?? '—',
      },
      {
        header: 'Tồn kho',
        accessorFn: (row) => row.record.quantity,
        cell: ({ getValue }) => (
          <span className="font-medium tabular-nums">{getValue() as number}</span>
        ),
      },
      {
        header: 'Đang giữ',
        accessorFn: (row) => row.record.reservedQty,
        cell: ({ getValue }) => (
          <span className="tabular-nums text-muted-foreground">{getValue() as number}</span>
        ),
      },
      {
        header: 'Khả dụng',
        id: 'availableQty',
        cell: ({ row }) => {
          const qty = row.original.availableQty
          return (
            <span
              className={`font-semibold tabular-nums ${
                qty <= 0
                  ? 'text-red-500'
                  : row.original.isLow
                  ? 'text-yellow-600 dark:text-yellow-400'
                  : ''
              }`}
            >
              {qty}
            </span>
          )
        },
      },
      {
        header: 'Cảnh báo',
        id: 'alert',
        cell: ({ row }) => {
          const { isLow, availableQty, record } = row.original
          if (availableQty <= 0) {
            return (
              <span className="flex items-center gap-1 text-xs font-medium text-red-500">
                <AlertTriangle className="h-3.5 w-3.5" />
                Hết hàng
              </span>
            )
          }
          if (isLow) {
            return (
              <span className="flex items-center gap-1 text-xs font-medium text-yellow-600 dark:text-yellow-400">
                <AlertTriangle className="h-3.5 w-3.5" />
                Sắp hết (ngưỡng: {record.lowStockAlert})
              </span>
            )
          }
          return <span className="text-xs text-muted-foreground">Bình thường</span>
        },
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div className="flex justify-end">
            <button
              onClick={() => setAdjustTarget(row.original)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium border hover:bg-muted transition-colors"
            >
              Điều chỉnh
            </button>
          </div>
        ),
      },
    ],
    [categoryMap],
  )

  // --------------- Columns: History ---------------

  const historyColumns: ColumnDef<MovementWithProduct>[] = useMemo(
    () => [
      {
        header: 'Ngày',
        accessorKey: 'createdAt',
        cell: ({ getValue }) => formatDate(getValue() as Date),
      },
      {
        header: 'Sản phẩm',
        accessorKey: 'productName',
        cell: ({ row }) => (
          <div>
            <p className="font-medium">{row.original.productName}</p>
            {row.original.variantName && (
              <p className="text-xs text-muted-foreground">{row.original.variantName}</p>
            )}
          </div>
        ),
      },
      {
        header: 'Loại',
        accessorKey: 'type',
        cell: ({ getValue }) => {
          const cfg = MOVEMENT_TYPE_LABELS[getValue() as StockMovementType]
          return <span className={`text-sm font-medium ${cfg.cls}`}>{cfg.label}</span>
        },
      },
      {
        header: 'Số lượng',
        accessorKey: 'quantity',
        cell: ({ getValue }) => {
          const qty = getValue() as number
          return (
            <span className={`font-semibold tabular-nums ${qty > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
              {qty > 0 ? `+${qty}` : qty}
            </span>
          )
        },
      },
      {
        header: 'Kênh',
        accessorKey: 'channelId',
        cell: ({ getValue }) => {
          const cid = getValue() as string | undefined
          if (!cid) return <span className="text-muted-foreground">—</span>
          const ch = channelMap[cid]
          if (!ch) return <span className="text-muted-foreground text-xs">{cid}</span>
          return <ChannelBadge name={ch.name} color={ch.color} />
        },
      },
      {
        header: 'Ghi chú',
        accessorKey: 'note',
        cell: ({ getValue }) => (
          <span className="text-muted-foreground text-sm">{String(getValue() ?? '—')}</span>
        ),
      },
    ],
    [channelMap],
  )

  // --------------- Render ---------------

  const selectCls = 'rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring'
  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Tổng quan' },
    { key: 'history', label: 'Lịch sử biến động' },
  ]

  return (
    <PageLayout title="Tồn kho">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border bg-card p-4 text-center">
          <p className="text-2xl font-bold">{totalItems}</p>
          <p className="text-sm text-muted-foreground">Tổng sản phẩm</p>
        </div>
        <div
          className={`rounded-xl border bg-card p-4 text-center cursor-pointer transition-colors hover:border-yellow-400 ${stockFilter === 'lowstock' ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/10' : ''}`}
          onClick={() => setStockFilter(stockFilter === 'lowstock' ? 'all' : 'lowstock')}
        >
          <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{lowStockCount}</p>
          <p className="text-sm text-muted-foreground">Sắp hết hàng</p>
        </div>
        <div
          className={`rounded-xl border bg-card p-4 text-center cursor-pointer transition-colors hover:border-red-400 ${stockFilter === 'outofstock' ? 'border-red-400 bg-red-50 dark:bg-red-900/10' : ''}`}
          onClick={() => setStockFilter(stockFilter === 'outofstock' ? 'all' : 'outofstock')}
        >
          <p className="text-2xl font-bold text-red-500">{outOfStockCount}</p>
          <p className="text-sm text-muted-foreground">Hết hàng</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === t.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Tổng quan */}
      {activeTab === 'overview' && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value as StockFilter)}
              className={selectCls}
            >
              <option value="all">Tất cả ({totalItems})</option>
              <option value="lowstock">Sắp hết ({lowStockCount})</option>
              <option value="outofstock">Hết hàng ({outOfStockCount})</option>
            </select>
            {stockFilter !== 'all' && (
              <button
                onClick={() => setStockFilter('all')}
                className="text-sm text-muted-foreground underline hover:text-foreground"
              >
                Xóa bộ lọc
              </button>
            )}
          </div>

          <DataTable
            columns={overviewColumns}
            data={loading ? [] : filteredItems}
            searchPlaceholder="Tìm theo tên, SKU..."
            emptyMessage={loading ? 'Đang tải...' : 'Chưa có dữ liệu tồn kho.'}
          />
        </div>
      )}

      {/* Tab: Lịch sử */}
      {activeTab === 'history' && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <select
              value={movTypeFilter}
              onChange={(e) => setMovTypeFilter(e.target.value)}
              className={selectCls}
            >
              <option value="">Tất cả loại</option>
              <option value="import">Nhập hàng</option>
              <option value="sale">Bán hàng</option>
              <option value="return">Hoàn trả</option>
              <option value="adjustment">Điều chỉnh</option>
              <option value="damage">Hàng hỏng</option>
            </select>
          </div>

          {movLoading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Đang tải...</p>
          ) : (
            <DataTable
              columns={historyColumns}
              data={movements}
              searchPlaceholder="Tìm theo tên sản phẩm..."
            />
          )}
        </div>
      )}

      {/* Adjust dialog */}
      <AdjustDialog
        open={!!adjustTarget}
        onClose={() => setAdjustTarget(null)}
        item={adjustTarget}
      />
    </PageLayout>
  )
}
