import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Eye, Pencil, Plus, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { PageLayout } from '@/components/layout/PageLayout'
import { DataTable } from '@/components/shared/DataTable'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { ChannelBadge } from '@/components/shared/ChannelBadge'
import { ProductFormDialog } from './ProductFormDialog'
import { useProductStore } from '@/stores/useProductStore'
import { useChannelStore } from '@/stores/useChannelStore'
import { useCategoryStore } from '@/stores/useCategoryStore'
import { useSupplierStore } from '@/stores/useSupplierStore'
import type { Product } from '@/types'

// --------------- Filter state ---------------

type StatusFilter = 'all' | 'active' | 'inactive'

// --------------- ProductsPage ---------------

export default function ProductsPage() {
  const navigate = useNavigate()
  const { products, stats, loading, load, remove, toggleActive } = useProductStore()
  const { channels, load: loadChannels } = useChannelStore()
  const { categories, load: loadCategories } = useCategoryStore()
  const { suppliers, load: loadSuppliers } = useSupplierStore()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null)

  // Filters
  const [filterCategoryId, setFilterCategoryId] = useState('')
  const [filterChannelId, setFilterChannelId] = useState('')
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('all')

  useEffect(() => {
    load()
    loadChannels()
    loadCategories()
    loadSuppliers()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Derived: lookup maps
  const categoryMap = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c.name])),
    [categories],
  )
  const channelMap = useMemo(
    () => Object.fromEntries(channels.map((c) => [c.id, c])),
    [channels],
  )
  const supplierMap = useMemo(
    () => Object.fromEntries(suppliers.map((s) => [s.id, s.name])),
    [suppliers],
  )

  // Filtered products
  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (filterStatus === 'active' && !p.isActive) return false
      if (filterStatus === 'inactive' && p.isActive) return false
      if (filterCategoryId && p.categoryId !== filterCategoryId) return false
      if (filterChannelId) {
        const s = stats[p.id]
        if (!s || !s.listedChannelIds.includes(filterChannelId)) return false
      }
      return true
    })
  }, [products, stats, filterStatus, filterCategoryId, filterChannelId])

  // --------------- Actions ---------------

  const handleAdd = () => {
    setEditing(null)
    setDialogOpen(true)
  }

  const handleEdit = (product: Product) => {
    setEditing(product)
    setDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const err = await remove(deleteTarget.id)
    if (err) {
      toast.error(err)
    } else {
      toast.success('Đã xóa sản phẩm')
    }
    setDeleteTarget(null)
  }

  const handleToggle = async (product: Product) => {
    try {
      await toggleActive(product.id)
      toast.success(product.isActive ? 'Đã ngừng kinh doanh' : 'Đã kích hoạt trở lại')
    } catch {
      toast.error('Cập nhật thất bại')
    }
  }

  // --------------- Columns ---------------

  const columns: ColumnDef<Product>[] = useMemo(
    () => [
      {
        header: 'SKU',
        accessorKey: 'sku',
        cell: ({ getValue }) => (
          <span className="font-mono text-xs text-muted-foreground">{getValue() as string}</span>
        ),
      },
      {
        header: 'Tên sản phẩm',
        accessorKey: 'name',
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            {row.original.images && row.original.images.length > 0 && (
              <img
                src={row.original.images[0]}
                alt=""
                className="h-8 w-8 rounded-md border object-cover shrink-0"
              />
            )}
            <span className="font-medium">{row.original.name}</span>
          </div>
        ),
      },
      {
        header: 'Danh mục',
        accessorKey: 'categoryId',
        cell: ({ getValue }) => (
          <span className="text-sm">{categoryMap[getValue() as string] ?? '—'}</span>
        ),
      },
      {
        header: 'NCC',
        accessorKey: 'supplierId',
        cell: ({ getValue }) => (
          <span className="text-sm text-muted-foreground">
            {getValue() ? (supplierMap[getValue() as string] ?? '—') : '—'}
          </span>
        ),
      },
      {
        header: 'Tồn kho',
        id: 'totalQty',
        cell: ({ row }) => {
          const s = stats[row.original.id]
          const qty = s?.totalQty ?? 0
          return (
            <span className={`font-medium tabular-nums ${qty === 0 ? 'text-red-500' : qty < 5 ? 'text-yellow-600' : ''}`}>
              {qty}
            </span>
          )
        },
      },
      {
        header: 'Kênh bán',
        id: 'channels',
        cell: ({ row }) => {
          const s = stats[row.original.id]
          const ids = s?.listedChannelIds ?? []
          if (ids.length === 0) return <span className="text-xs text-muted-foreground">—</span>
          return (
            <div className="flex flex-wrap gap-1">
              {ids.slice(0, 3).map((cid) => {
                const ch = channelMap[cid]
                if (!ch) return null
                return <ChannelBadge key={cid} name={ch.name} color={ch.color} />
              })}
              {ids.length > 3 && (
                <span className="text-xs text-muted-foreground">+{ids.length - 3}</span>
              )}
            </div>
          )
        },
      },
      {
        header: 'Trạng thái',
        accessorKey: 'isActive',
        cell: ({ getValue }) => {
          const active = getValue() as boolean
          return (
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                active
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {active ? 'Đang bán' : 'Ngừng bán'}
            </span>
          )
        },
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const p = row.original
          return (
            <div className="flex items-center justify-end gap-1">
              <button
                onClick={() => navigate(`/products/${p.id}`)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                title="Xem chi tiết"
              >
                <Eye className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleEdit(p)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                title="Sửa"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleToggle(p)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                title={p.isActive ? 'Ngừng kinh doanh' : 'Kích hoạt trở lại'}
              >
                {p.isActive ? (
                  <ToggleRight className="h-4 w-4 text-green-500" />
                ) : (
                  <ToggleLeft className="h-4 w-4" />
                )}
              </button>
              <button
                onClick={() => setDeleteTarget(p)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-red-500"
                title="Xóa"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [categoryMap, channelMap, supplierMap, stats],
  )

  // --------------- Render ---------------

  const selectCls =
    'rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring'

  return (
    <PageLayout
      loading={loading}
      title="Sản phẩm"
      action={
        <button
          onClick={handleAdd}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Thêm sản phẩm
        </button>
      }
    >
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as StatusFilter)}
          className={selectCls}
        >
          <option value="all">Tất cả trạng thái</option>
          <option value="active">Đang kinh doanh</option>
          <option value="inactive">Ngừng kinh doanh</option>
        </select>

        <select
          value={filterCategoryId}
          onChange={(e) => setFilterCategoryId(e.target.value)}
          className={selectCls}
        >
          <option value="">Tất cả danh mục</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          value={filterChannelId}
          onChange={(e) => setFilterChannelId(e.target.value)}
          className={selectCls}
        >
          <option value="">Tất cả kênh</option>
          {channels
            .filter((c) => c.isActive)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </select>

        {(filterStatus !== 'all' || filterCategoryId || filterChannelId) && (
          <button
            onClick={() => {
              setFilterStatus('all')
              setFilterCategoryId('')
              setFilterChannelId('')
            }}
            className="text-sm text-muted-foreground hover:text-foreground underline"
          >
            Xóa bộ lọc
          </button>
        )}

        <span className="ml-auto text-sm text-muted-foreground">
          {filtered.length} / {products.length} sản phẩm
        </span>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        searchPlaceholder="Tìm theo tên, SKU, barcode..."
        emptyMessage="Chưa có sản phẩm nào. Thêm sản phẩm đầu tiên!"
      />

      <ProductFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        editing={editing}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Xóa sản phẩm?"
        description={`Xóa "${deleteTarget?.name}". Thao tác này không thể hoàn tác. Sản phẩm đã có đơn hàng hoặc lô nhập sẽ không thể xóa.`}
        confirmLabel="Xóa"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </PageLayout>
  )
}
