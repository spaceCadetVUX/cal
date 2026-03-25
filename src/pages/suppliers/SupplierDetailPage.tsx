import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import * as Dialog from '@radix-ui/react-dialog'
import { ArrowLeft, Pencil, Plus, Trash2, X } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { PageLayout } from '@/components/layout/PageLayout'
import { StatCard } from '@/components/shared/StatCard'
import { DataTable } from '@/components/shared/DataTable'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { SupplierFormDialog } from './SupplierFormDialog'
import { useSupplierStore } from '@/stores/useSupplierStore'
import { formatVND, formatDate } from '@/utils/formatters'
import db from '@/db/db'
import type { Supplier, SupplierPayment, SupplierPaymentMethod } from '@/types'

// --------------- Constants ---------------

const PAYMENT_METHOD_LABELS: Record<SupplierPaymentMethod, string> = {
  cash: 'Tiền mặt',
  bank_transfer: 'Chuyển khoản',
  other: 'Khác',
}

// --------------- Payment form schema ---------------

const paymentSchema = z.object({
  amount: z.coerce.number().min(1, 'Số tiền phải > 0'),
  paymentDate: z.string().min(1, 'Chọn ngày thanh toán'),
  paymentMethod: z.enum(['cash', 'bank_transfer', 'other'] as const),
  note: z.string().optional(),
})
type PaymentFormValues = z.infer<typeof paymentSchema>

// --------------- Add Payment Dialog ---------------

interface AddPaymentDialogProps {
  open: boolean
  onClose: () => void
  supplierId: string
  onAdded: (payment: SupplierPayment) => void
}

function AddPaymentDialog({ open, onClose, supplierId, onAdded }: AddPaymentDialogProps) {
  const { addPayment } = useSupplierStore()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { paymentMethod: 'bank_transfer' },
  })

  useEffect(() => {
    if (!open) return
    // Default date = today
    const today = new Date().toISOString().slice(0, 10)
    reset({ amount: undefined as unknown as number, paymentDate: today, paymentMethod: 'bank_transfer', note: '' })
  }, [open, reset])

  const onSubmit = async (values: PaymentFormValues) => {
    // Parse date string as local time to avoid UTC timezone offset
    const [y, m, d] = values.paymentDate.split('-').map(Number)
    try {
      const payment = await addPayment({
        supplierId,
        amount: values.amount,
        paymentDate: new Date(y, m - 1, d),
        paymentMethod: values.paymentMethod,
        note: values.note || undefined,
      })
      toast.success('Đã ghi nhận thanh toán')
      onAdded(payment)
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
            <Dialog.Title className="text-base font-semibold">Ghi nhận thanh toán</Dialog.Title>
            <Dialog.Close className="rounded-lg p-1 text-muted-foreground hover:bg-muted">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-4 px-6 py-5">
              <div className="space-y-1">
                <label className="text-sm font-medium">Số tiền (₫) <span className="text-red-500">*</span></label>
                <input {...register('amount')} type="number" min={1} className={inputCls} autoFocus />
                {errors.amount && <p className="text-xs text-red-500">{errors.amount.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Ngày thanh toán <span className="text-red-500">*</span></label>
                  <input {...register('paymentDate')} type="date" className={inputCls} />
                  {errors.paymentDate && <p className="text-xs text-red-500">{errors.paymentDate.message}</p>}
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Hình thức</label>
                  <select {...register('paymentMethod')} className={inputCls}>
                    <option value="cash">Tiền mặt</option>
                    <option value="bank_transfer">Chuyển khoản</option>
                    <option value="other">Khác</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Ghi chú</label>
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
                {isSubmitting ? 'Đang lưu...' : 'Ghi nhận'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// --------------- Supplier Detail Page ---------------

interface DebtStats {
  totalImported: number
  totalPaid: number
  debt: number
}

export default function SupplierDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { suppliers, deletePayment } = useSupplierStore()

  const [supplier, setSupplier] = useState<Supplier | null | undefined>(undefined) // undefined = loading
  const [debtStats, setDebtStats] = useState<DebtStats>({ totalImported: 0, totalPaid: 0, debt: 0 })
  const [payments, setPayments] = useState<SupplierPayment[]>([])
  const [editOpen, setEditOpen] = useState(false)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [deletePaymentTarget, setDeletePaymentTarget] = useState<SupplierPayment | null>(null)

  // Resolve supplier from store (fast) or DB (direct navigation)
  useEffect(() => {
    if (!id) return
    const fromStore = suppliers.find((s) => s.id === id)
    if (fromStore) {
      setSupplier(fromStore)
    } else {
      db.suppliers.get(id).then((s) => setSupplier(s ?? null))
    }
  }, [id, suppliers])

  // Load debt stats + payments for this supplier
  const loadDetail = async () => {
    if (!id) return
    const [batches, pmts] = await Promise.all([
      db.importBatches.where('supplierId').equals(id).filter((b) => b.status === 'received').toArray(),
      db.supplierPayments.where('supplierId').equals(id).toArray(),
    ])
    const totalImported = batches.reduce((sum, b) => sum + b.totalAmount, 0)
    const totalPaid = pmts.reduce((sum, p) => sum + p.amount, 0)
    setDebtStats({ totalImported, totalPaid, debt: totalImported - totalPaid })
    // Sort payments newest first
    setPayments(pmts.sort((a, b) => b.paymentDate.getTime() - a.paymentDate.getTime()))
  }

  useEffect(() => { loadDetail() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handlePaymentAdded = (payment: SupplierPayment) => {
    setPayments((prev) => [payment, ...prev])
    setDebtStats((prev) => ({
      ...prev,
      totalPaid: prev.totalPaid + payment.amount,
      debt: prev.totalImported - (prev.totalPaid + payment.amount),
    }))
  }

  const handleDeletePayment = async () => {
    if (!deletePaymentTarget) return
    try {
      await deletePayment(deletePaymentTarget.id)
      const amt = deletePaymentTarget.amount
      setPayments((prev) => prev.filter((p) => p.id !== deletePaymentTarget.id))
      setDebtStats((prev) => ({
        ...prev,
        totalPaid: prev.totalPaid - amt,
        debt: prev.totalImported - (prev.totalPaid - amt),
      }))
      toast.success('Đã xóa thanh toán')
    } catch {
      toast.error('Xóa thất bại')
    } finally {
      setDeletePaymentTarget(null)
    }
  }

  const paymentColumns: ColumnDef<SupplierPayment>[] = [
    {
      header: 'Ngày',
      accessorKey: 'paymentDate',
      cell: ({ getValue }) => formatDate(getValue() as Date),
    },
    {
      header: 'Hình thức',
      accessorKey: 'paymentMethod',
      cell: ({ getValue }) => PAYMENT_METHOD_LABELS[getValue() as SupplierPaymentMethod],
    },
    {
      header: 'Số tiền',
      accessorKey: 'amount',
      cell: ({ getValue }) => <span className="font-medium text-green-600 dark:text-green-400">{formatVND(getValue() as number)}</span>,
    },
    {
      header: 'Ghi chú',
      accessorKey: 'note',
      cell: ({ getValue }) => <span className="text-muted-foreground">{String(getValue() ?? '—')}</span>,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex justify-end">
          <button
            onClick={() => setDeletePaymentTarget(row.original)}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-red-500"
            title="Xóa"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ]

  // Loading state
  if (supplier === undefined) {
    return <PageLayout title="Nhà cung cấp"><p className="text-muted-foreground">Đang tải...</p></PageLayout>
  }

  // Not found
  if (supplier === null) {
    return (
      <PageLayout title="Không tìm thấy">
        <p className="text-muted-foreground">Nhà cung cấp không tồn tại.</p>
        <button onClick={() => navigate('/suppliers')} className="mt-4 text-sm text-primary hover:underline">
          ← Quay lại danh sách
        </button>
      </PageLayout>
    )
  }

  return (
    <PageLayout
      title={supplier.name}
      action={
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/suppliers')}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" />
            Danh sách
          </button>
          <button
            onClick={() => setEditOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            <Pencil className="h-4 w-4" />
            Sửa
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Supplier info */}
        <div className="rounded-xl border bg-card p-5">
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">Thông tin liên hệ</h3>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <Row label="Số điện thoại" value={supplier.phone} />
            <Row label="Email" value={supplier.email} />
            <Row label="Người liên hệ" value={supplier.contactPerson} />
            <Row label="Địa chỉ" value={supplier.address} />
            {supplier.note && <Row label="Ghi chú" value={supplier.note} />}
          </div>
        </div>

        {/* Debt summary */}
        <div>
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">Công nợ</h3>
          <div className="grid grid-cols-3 gap-4">
            <StatCard title="Tổng đã nhập" value={formatVND(debtStats.totalImported)} />
            <StatCard title="Đã thanh toán" value={formatVND(debtStats.totalPaid)} variant="success" />
            <StatCard
              title="Còn nợ"
              value={formatVND(debtStats.debt)}
              variant={debtStats.debt > 0 ? 'danger' : 'default'}
            />
          </div>
        </div>

        {/* Payments list */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Lịch sử thanh toán</h3>
            <button
              onClick={() => setPaymentOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              <Plus className="h-3.5 w-3.5" />
              Ghi nhận thanh toán
            </button>
          </div>
          {payments.length === 0 ? (
            <p className="rounded-xl border bg-card py-8 text-center text-sm text-muted-foreground">
              Chưa có thanh toán nào
            </p>
          ) : (
            <DataTable columns={paymentColumns} data={payments} searchPlaceholder="Tìm thanh toán..." />
          )}
        </div>

        {/* Import history placeholder */}
        <div className="rounded-xl border bg-card p-5">
          <h3 className="mb-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">Lịch sử nhập hàng</h3>
          <p className="text-sm text-muted-foreground">Sẽ hiển thị dữ liệu sau khi hoàn thành Sprint 1.8.</p>
        </div>
      </div>

      <SupplierFormDialog open={editOpen} onClose={() => setEditOpen(false)} editing={supplier} />

      <AddPaymentDialog
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        supplierId={supplier.id}
        onAdded={handlePaymentAdded}
      />

      <ConfirmDialog
        open={!!deletePaymentTarget}
        onOpenChange={(v) => !v && setDeletePaymentTarget(null)}
        title="Xóa thanh toán?"
        description={`Xóa khoản thanh toán ${deletePaymentTarget ? formatVND(deletePaymentTarget.amount) : ''}. Không thể hoàn tác.`}
        confirmLabel="Xóa"
        variant="destructive"
        onConfirm={handleDeletePayment}
      />
    </PageLayout>
  )
}

// Small helper for info rows
function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex gap-2">
      <span className="w-32 shrink-0 text-muted-foreground">{label}</span>
      <span className="font-medium">{value || '—'}</span>
    </div>
  )
}
