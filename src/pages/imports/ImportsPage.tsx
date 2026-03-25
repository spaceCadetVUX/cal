import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Eye, Plus, Trash2 } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { PageLayout } from '@/components/layout/PageLayout'
import { DataTable } from '@/components/shared/DataTable'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { useImportStore } from '@/stores/useImportStore'
import { useSupplierStore } from '@/stores/useSupplierStore'
import { formatVND, formatDate } from '@/utils/formatters'
import type { ImportBatch, ImportBatchStatus } from '@/types'

// --------------- Status config ---------------

const STATUS_CONFIG: Record<ImportBatchStatus, { label: string; cls: string }> = {
  pending: { label: 'Chờ nhận', cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  received: { label: 'Đã nhận', cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  cancelled: { label: 'Đã hủy', cls: 'bg-muted text-muted-foreground' },
}

// --------------- Filter type ---------------
type StatusFilter = 'all' | ImportBatchStatus

// --------------- Component ---------------

export default function ImportsPage() {
  const navigate = useNavigate()
  const { batches, loading, load, deleteBatch } = useImportStore()
  const { suppliers, load: loadSuppliers } = useSupplierStore()

  const [deleteTarget, setDeleteTarget] = useState<ImportBatch | null>(null)
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('all')
  const [filterSupplierId, setFilterSupplierId] = useState('')

  useEffect(() => {
    load()
    loadSuppliers()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const supplierMap = useMemo(
    () => Object.fromEntries(suppliers.map((s) => [s.id, s.name])),
    [suppliers],
  )

  const filtered = useMemo(() => {
    return batches.filter((b) => {
      if (filterStatus !== 'all' && b.status !== filterStatus) return false
      if (filterSupplierId && b.supplierId !== filterSupplierId) return false
      return true
    })
  }, [batches, filterStatus, filterSupplierId])

  const handleDelete = async () => {
    if (!deleteTarget) return
    const err = await deleteBatch(deleteTarget.id)
    if (err) {
      toast.error(err)
    } else {
      toast.success('Đã xóa phiếu nhập')
    }
    setDeleteTarget(null)
  }

  const columns: ColumnDef<ImportBatch>[] = useMemo(
    () => [
      {
        header: 'Mã lô',
        accessorKey: 'batchCode',
        cell: ({ getValue }) => (
          <span className="font-mono text-sm font-medium">{getValue() as string}</span>
        ),
      },
      {
        header: 'Nhà cung cấp',
        accessorKey: 'supplierId',
        cell: ({ getValue }) => supplierMap[getValue() as string] ?? '—',
      },
      {
        header: 'Ngày nhập',
        accessorKey: 'importDate',
        cell: ({ getValue }) => formatDate(getValue() as Date),
      },
      {
        header: 'Số hoá đơn',
        accessorKey: 'invoiceNumber',
        cell: ({ getValue }) => (
          <span className="text-muted-foreground">{String(getValue() ?? '—')}</span>
        ),
      },
      {
        header: 'Tổng tiền',
        accessorKey: 'totalAmount',
        cell: ({ getValue }) => (
          <span className="font-medium tabular-nums">{formatVND(getValue() as number)}</span>
        ),
      },
      {
        header: 'Trạng thái',
        accessorKey: 'status',
        cell: ({ getValue }) => {
          const cfg = STATUS_CONFIG[getValue() as ImportBatchStatus]
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
          const b = row.original
          const canDelete = b.status !== 'received'
          return (
            <div className="flex items-center justify-end gap-1">
              <button
                onClick={() => navigate(`/imports/${b.id}`)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                title="Xem chi tiết"
              >
                <Eye className="h-4 w-4" />
              </button>
              {canDelete && (
                <button
                  onClick={() => setDeleteTarget(b)}
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
    [supplierMap, navigate],
  )

  const selectCls = 'rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring'

  return (
    <PageLayout
      title="Nhập hàng"
      action={
        <button
          onClick={() => navigate('/imports/new')}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Tạo phiếu nhập
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
          <option value="pending">Chờ nhận hàng</option>
          <option value="received">Đã nhận hàng</option>
          <option value="cancelled">Đã hủy</option>
        </select>

        <select
          value={filterSupplierId}
          onChange={(e) => setFilterSupplierId(e.target.value)}
          className={selectCls}
        >
          <option value="">Tất cả nhà cung cấp</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        {(filterStatus !== 'all' || filterSupplierId) && (
          <button
            onClick={() => { setFilterStatus('all'); setFilterSupplierId('') }}
            className="text-sm text-muted-foreground underline hover:text-foreground"
          >
            Xóa bộ lọc
          </button>
        )}

        <span className="ml-auto text-sm text-muted-foreground">
          {filtered.length} / {batches.length} phiếu
        </span>
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Đang tải...</p>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          searchPlaceholder="Tìm theo mã lô, hoá đơn..."
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Xóa phiếu nhập?"
        description={`Xóa lô "${deleteTarget?.batchCode}". Thao tác không thể hoàn tác.`}
        confirmLabel="Xóa"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </PageLayout>
  )
}
