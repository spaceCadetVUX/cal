import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import * as Dialog from '@radix-ui/react-dialog'
import { Eye, Plus, Pencil, Trash2, X } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { PageLayout } from '@/components/layout/PageLayout'
import { DataTable } from '@/components/shared/DataTable'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { useCustomerStore } from '@/stores/useCustomerStore'
import { formatVND } from '@/utils/formatters'
import { cn } from '@/lib/utils'
import type { Customer, CustomerType } from '@/types'

// --------------- Constants ---------------

const TYPE_LABELS: Record<CustomerType, string> = {
  retail: 'Lẻ',
  wholesale: 'Sỉ',
  vip: 'VIP',
}

const typeBadgeCls: Record<CustomerType, string> = {
  retail: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  wholesale: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  vip: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
}

function TypeBadge({ type }: { type: CustomerType }) {
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', typeBadgeCls[type])}>
      {TYPE_LABELS[type]}
    </span>
  )
}

// --------------- Schema ---------------

const schema = z.object({
  name: z.string().min(1, 'Không được để trống'),
  phone: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
  type: z.enum(['retail', 'wholesale', 'vip'] as const),
  note: z.string().optional(),
})
type FormValues = z.infer<typeof schema>

// --------------- Form Dialog ---------------

interface FormDialogProps {
  open: boolean
  onClose: () => void
  editing: Customer | null
}

function CustomerFormDialog({ open, onClose, editing }: FormDialogProps) {
  const { add, update } = useCustomerStore()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (!open) return
    reset(
      editing
        ? { name: editing.name, phone: editing.phone ?? '', email: editing.email ?? '', address: editing.address ?? '', type: editing.type, note: editing.note ?? '' }
        : { name: '', phone: '', email: '', address: '', type: 'retail', note: '' },
    )
  }, [open, editing, reset])

  const onSubmit = async (values: FormValues) => {
    const clean = {
      ...values,
      phone: values.phone || undefined,
      email: values.email || undefined,
      address: values.address || undefined,
      note: values.note || undefined,
    }
    try {
      if (editing) {
        await update(editing.id, clean)
        toast.success('Đã cập nhật khách hàng')
      } else {
        await add(clean)
        toast.success('Đã thêm khách hàng')
      }
      onClose()
    } catch {
      toast.error('Lưu thất bại')
    }
  }

  const inputCls = 'w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring'
  const labelCls = 'text-sm font-medium'

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-card shadow-lg">
          <div className="flex items-center justify-between border-b px-6 py-4">
            <Dialog.Title className="text-base font-semibold">
              {editing ? 'Sửa khách hàng' : 'Thêm khách hàng'}
            </Dialog.Title>
            <Dialog.Close className="rounded-lg p-1 text-muted-foreground hover:bg-muted">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-4 px-6 py-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className={labelCls}>Tên khách hàng <span className="text-red-500">*</span></label>
                  <input {...register('name')} className={inputCls} autoFocus />
                  {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
                </div>
                <div className="space-y-1">
                  <label className={labelCls}>Loại khách</label>
                  <select {...register('type')} className={inputCls}>
                    <option value="retail">Lẻ</option>
                    <option value="wholesale">Sỉ</option>
                    <option value="vip">VIP</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className={labelCls}>Số điện thoại</label>
                  <input {...register('phone')} className={inputCls} />
                </div>
                <div className="space-y-1">
                  <label className={labelCls}>Email</label>
                  <input {...register('email')} type="email" className={inputCls} />
                </div>
              </div>
              <div className="space-y-1">
                <label className={labelCls}>Địa chỉ</label>
                <input {...register('address')} className={inputCls} />
              </div>
              <div className="space-y-1">
                <label className={labelCls}>Ghi chú</label>
                <input {...register('note')} className={inputCls} />
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
                {isSubmitting ? 'Đang lưu...' : editing ? 'Cập nhật' : 'Thêm'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// --------------- Page ---------------

const TYPE_FILTER_OPTIONS: { value: CustomerType | ''; label: string }[] = [
  { value: '', label: 'Tất cả' },
  { value: 'retail', label: 'Lẻ' },
  { value: 'wholesale', label: 'Sỉ' },
  { value: 'vip', label: 'VIP' },
]

export default function CustomersPage() {
  const navigate = useNavigate()
  const { customers, stats, loading, load, remove } = useCustomerStore()
  const [typeFilter, setTypeFilter] = useState<CustomerType | ''>('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null)

  useEffect(() => { load() }, [load])

  const openAdd = () => { setEditing(null); setDialogOpen(true) }
  const openEdit = (c: Customer) => { setEditing(c); setDialogOpen(true) }

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

  // Apply type filter before passing to DataTable
  const filtered = typeFilter ? customers.filter((c) => c.type === typeFilter) : customers

  const columns: ColumnDef<Customer>[] = [
    {
      header: 'Tên khách hàng',
      accessorKey: 'name',
      cell: ({ getValue }) => <span className="font-medium">{String(getValue())}</span>,
    },
    {
      header: 'SĐT',
      accessorKey: 'phone',
      cell: ({ getValue }) => <span className="text-muted-foreground">{String(getValue() ?? '—')}</span>,
    },
    {
      header: 'Loại',
      accessorKey: 'type',
      cell: ({ getValue }) => <TypeBadge type={getValue() as CustomerType} />,
    },
    {
      id: 'orderCount',
      header: 'Tổng đơn',
      cell: ({ row }) => (
        <span className="text-muted-foreground">{stats[row.original.id]?.orderCount ?? 0}</span>
      ),
    },
    {
      id: 'totalSpent',
      header: 'Tổng chi tiêu',
      cell: ({ row }) => {
        const v = stats[row.original.id]?.totalSpent ?? 0
        return <span className="text-muted-foreground">{v > 0 ? formatVND(v) : '—'}</span>
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => navigate(`/customers/${row.original.id}`)}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Chi tiết"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            onClick={() => openEdit(row.original)}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Sửa"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={() => setDeleteTarget(row.original)}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-red-500"
            title="Xóa"
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
      title="Khách hàng"
      action={
        <button
          onClick={openAdd}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Thêm khách hàng
        </button>
      }
    >
      {/* Type filter */}
      <div className="flex items-center gap-2">
        {TYPE_FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setTypeFilter(opt.value)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              typeFilter === opt.value
                ? 'bg-primary text-primary-foreground'
                : 'border hover:bg-muted text-muted-foreground',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <DataTable columns={columns} data={filtered} searchPlaceholder="Tìm theo tên, SĐT..." emptyMessage="Chưa có khách hàng nào." />

      <CustomerFormDialog open={dialogOpen} onClose={() => setDialogOpen(false)} editing={editing} />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title={`Xóa khách hàng "${deleteTarget?.name}"?`}
        description="Lịch sử đơn hàng của khách sẽ không bị xóa."
        confirmLabel="Xóa"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </PageLayout>
  )
}
