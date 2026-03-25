import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { useSupplierStore } from '@/stores/useSupplierStore'
import type { Supplier } from '@/types'

const schema = z.object({
  name: z.string().min(1, 'Không được để trống'),
  phone: z.string().min(1, 'Không được để trống'),
  email: z.string().optional(),
  address: z.string().optional(),
  contactPerson: z.string().optional(),
  note: z.string().optional(),
})
export type SupplierFormValues = z.infer<typeof schema>

interface Props {
  open: boolean
  onClose: (saved?: Supplier) => void
  editing: Supplier | null
}

const inputCls = 'w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring'
const labelCls = 'text-sm font-medium'

export function SupplierFormDialog({ open, onClose, editing }: Props) {
  const { add, update } = useSupplierStore()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SupplierFormValues>({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (!open) return
    reset(
      editing
        ? {
            name: editing.name,
            phone: editing.phone,
            email: editing.email ?? '',
            address: editing.address ?? '',
            contactPerson: editing.contactPerson ?? '',
            note: editing.note ?? '',
          }
        : { name: '', phone: '', email: '', address: '', contactPerson: '', note: '' },
    )
  }, [open, editing, reset])

  const onSubmit = async (values: SupplierFormValues) => {
    // Normalize empty strings to undefined for optional fields
    const clean = {
      ...values,
      email: values.email || undefined,
      address: values.address || undefined,
      contactPerson: values.contactPerson || undefined,
      note: values.note || undefined,
    }
    try {
      if (editing) {
        await update(editing.id, clean)
        toast.success('Đã cập nhật nhà cung cấp')
        onClose(editing)
      } else {
        const saved = await add(clean)
        toast.success('Đã thêm nhà cung cấp')
        onClose(saved)
      }
    } catch {
      toast.error('Lưu thất bại')
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-card shadow-lg">
          <div className="flex items-center justify-between border-b px-6 py-4">
            <Dialog.Title className="text-base font-semibold">
              {editing ? 'Sửa nhà cung cấp' : 'Thêm nhà cung cấp'}
            </Dialog.Title>
            <Dialog.Close className="rounded-lg p-1 text-muted-foreground hover:bg-muted">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-4 px-6 py-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className={labelCls}>Tên nhà cung cấp <span className="text-red-500">*</span></label>
                  <input {...register('name')} className={inputCls} autoFocus />
                  {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
                </div>
                <div className="space-y-1">
                  <label className={labelCls}>Số điện thoại <span className="text-red-500">*</span></label>
                  <input {...register('phone')} className={inputCls} />
                  {errors.phone && <p className="text-xs text-red-500">{errors.phone.message}</p>}
                </div>
                <div className="space-y-1">
                  <label className={labelCls}>Email</label>
                  <input {...register('email')} type="email" className={inputCls} />
                </div>
                <div className="space-y-1">
                  <label className={labelCls}>Người liên hệ</label>
                  <input {...register('contactPerson')} className={inputCls} />
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
                {isSubmitting ? 'Đang lưu...' : editing ? 'Cập nhật' : 'Thêm NCC'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
