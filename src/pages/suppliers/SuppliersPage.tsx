import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Plus, Eye, Pencil, Trash2 } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { PageLayout } from '@/components/layout/PageLayout'
import { DataTable } from '@/components/shared/DataTable'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { SupplierFormDialog } from './SupplierFormDialog'
import { useSupplierStore } from '@/stores/useSupplierStore'
import { formatVND } from '@/utils/formatters'
import type { Supplier } from '@/types'

export default function SuppliersPage() {
  const navigate = useNavigate()
  const { suppliers, stats, loading, load, remove } = useSupplierStore()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null)

  useEffect(() => { load() }, [load])

  const openAdd = () => { setEditing(null); setDialogOpen(true) }
  const openEdit = (sup: Supplier) => { setEditing(sup); setDialogOpen(true) }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await remove(deleteTarget.id)
      toast.success(`Đã xóa "${deleteTarget.name}"`)
    } catch {
      toast.error('Xóa thất bại')
    } finally {
      setDeleteTarget(null)
    }
  }

  // columns are defined inside the component to access stats via closure
  const columns: ColumnDef<Supplier>[] = [
    {
      header: 'Tên nhà cung cấp',
      accessorKey: 'name',
      cell: ({ getValue }) => <span className="font-medium">{String(getValue())}</span>,
    },
    {
      header: 'Số điện thoại',
      accessorKey: 'phone',
      cell: ({ getValue }) => <span className="text-muted-foreground">{String(getValue() ?? '—')}</span>,
    },
    {
      id: 'productCount',
      header: 'Số SP',
      cell: ({ row }) => (
        <span className="text-muted-foreground">{stats[row.original.id]?.productCount ?? 0}</span>
      ),
    },
    {
      id: 'totalImported',
      header: 'Tổng nhập',
      cell: ({ row }) => {
        const v = stats[row.original.id]?.totalImported ?? 0
        return <span className="text-muted-foreground">{v > 0 ? formatVND(v) : '—'}</span>
      },
    },
    {
      id: 'debt',
      header: 'Công nợ',
      cell: ({ row }) => {
        const debt = stats[row.original.id]?.debt ?? 0
        return (
          <span className={debt > 0 ? 'font-medium text-red-600 dark:text-red-400' : 'text-muted-foreground'}>
            {debt > 0 ? formatVND(debt) : '—'}
          </span>
        )
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => navigate(`/suppliers/${row.original.id}`)}
            title="Xem chi tiết"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            onClick={() => openEdit(row.original)}
            title="Sửa"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Pencil className="h-4 w-4" />
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
  ]

  return (
    <PageLayout
      loading={loading}
      title="Nhà cung cấp"
      action={
        <button
          onClick={openAdd}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Thêm NCC
        </button>
      }
    >
      <DataTable
        columns={columns}
        data={suppliers}
        searchPlaceholder="Tìm theo tên, SĐT..."
        emptyMessage="Chưa có nhà cung cấp nào."
      />

      <SupplierFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        editing={editing}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title={`Xóa nhà cung cấp "${deleteTarget?.name}"?`}
        description="Toàn bộ lịch sử thanh toán của NCC này cũng sẽ bị xóa."
        confirmLabel="Xóa"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </PageLayout>
  )
}
