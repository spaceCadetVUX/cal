import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import * as Dialog from '@radix-ui/react-dialog'
import { Plus, Pencil, Trash2, X } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { PageLayout } from '@/components/layout/PageLayout'
import { DataTable } from '@/components/shared/DataTable'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { useCategoryStore } from '@/stores/useCategoryStore'
import { formatDate } from '@/utils/formatters'
import type { Category } from '@/types'

// --------------- Schema ---------------

const schema = z.object({
  name: z.string().min(1, 'Không được để trống'),
  note: z.string().optional(),
})
type FormValues = z.infer<typeof schema>

// --------------- Form Dialog ---------------

interface FormDialogProps {
  open: boolean
  onClose: () => void
  editing: Category | null
}

function CategoryFormDialog({ open, onClose, editing }: FormDialogProps) {
  const { add, update } = useCategoryStore()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (!open) return
    reset(editing ? { name: editing.name, note: editing.note ?? '' } : { name: '', note: '' })
  }, [open, editing, reset])

  const onSubmit = async (values: FormValues) => {
    try {
      if (editing) {
        await update(editing.id, values)
        toast.success('Đã cập nhật danh mục')
      } else {
        await add(values)
        toast.success('Đã thêm danh mục')
      }
      onClose()
    } catch {
      toast.error('Lưu thất bại')
    }
  }

  const inputCls = 'w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring'

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-card shadow-lg">
          <div className="flex items-center justify-between border-b px-6 py-4">
            <Dialog.Title className="text-base font-semibold">
              {editing ? 'Sửa danh mục' : 'Thêm danh mục'}
            </Dialog.Title>
            <Dialog.Close className="rounded-lg p-1 text-muted-foreground hover:bg-muted">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-4 px-6 py-5">
              <div className="space-y-1">
                <label className="text-sm font-medium">Tên danh mục</label>
                <input {...register('name')} className={inputCls} autoFocus />
                {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Ghi chú (tuỳ chọn)</label>
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

export default function CategoriesPage() {
  const { categories, loading, load, remove } = useCategoryStore()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)

  useEffect(() => { load() }, [load])

  const openAdd = () => { setEditing(null); setDialogOpen(true) }
  const openEdit = (cat: Category) => { setEditing(cat); setDialogOpen(true) }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const err = await remove(deleteTarget.id)
    if (err) {
      toast.error(err)
    } else {
      toast.success(`Đã xóa "${deleteTarget.name}"`)
    }
    setDeleteTarget(null)
  }

  const columns: ColumnDef<Category>[] = [
    {
      header: 'Tên danh mục',
      accessorKey: 'name',
      cell: ({ getValue }) => <span className="font-medium">{String(getValue())}</span>,
    },
    {
      header: 'Ghi chú',
      accessorKey: 'note',
      cell: ({ getValue }) => <span className="text-muted-foreground">{String(getValue() ?? '—')}</span>,
    },
    {
      header: 'Ngày tạo',
      accessorKey: 'createdAt',
      cell: ({ getValue }) => <span className="text-muted-foreground">{formatDate(getValue() as Date)}</span>,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
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
      title="Danh mục sản phẩm"
      action={
        <button
          onClick={openAdd}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Thêm danh mục
        </button>
      }
    >
      {loading ? (
        <p className="text-sm text-muted-foreground">Đang tải...</p>
      ) : (
        <DataTable columns={columns} data={categories} searchPlaceholder="Tìm danh mục..." />
      )}

      <CategoryFormDialog open={dialogOpen} onClose={() => setDialogOpen(false)} editing={editing} />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title={`Xóa danh mục "${deleteTarget?.name}"?`}
        description="Nếu còn sản phẩm đang dùng danh mục này, xóa sẽ bị chặn."
        confirmLabel="Xóa"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </PageLayout>
  )
}
