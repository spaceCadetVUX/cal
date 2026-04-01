import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import * as Dialog from '@radix-ui/react-dialog'
import { Pencil, Plus, RefreshCw, Trash2, X } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { PageLayout } from '@/components/layout/PageLayout'
import { DataTable } from '@/components/shared/DataTable'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { StatCard } from '@/components/shared/StatCard'
import { ChannelBadge } from '@/components/shared/ChannelBadge'
import { useExpenseStore, type ExpenseInput } from '@/stores/useExpenseStore'
import { useChannelStore } from '@/stores/useChannelStore'
import { formatVND, formatDate } from '@/utils/formatters'
import { cn } from '@/lib/utils'
import type { Expense, ExpenseCategory, RecurringInterval } from '@/types'

// --------------- Constants ---------------

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  packaging: 'Đóng gói',
  shipping: 'Vận chuyển',
  marketing: 'Marketing',
  software: 'Phần mềm',
  salary: 'Lương',
  rent: 'Mặt bằng',
  other: 'Khác',
}

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  packaging: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  shipping: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  marketing: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  software: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  salary: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  rent: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  other: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
}

const INTERVAL_LABELS: Record<RecurringInterval, string> = {
  monthly: 'Hàng tháng',
  quarterly: 'Hàng quý',
  yearly: 'Hàng năm',
}

// --------------- Zod Schema ---------------

const schema = z.object({
  name: z.string().min(1, 'Không được để trống'),
  category: z.enum([
    'packaging', 'shipping', 'marketing', 'software', 'salary', 'rent', 'other',
  ] as const),
  amount: z.coerce.number().min(1, 'Phải lớn hơn 0'),
  dateStr: z.string().min(1, 'Chọn ngày'),
  channelId: z.string().optional(),
  isRecurring: z.boolean(),
  recurringInterval: z.enum(['monthly', 'quarterly', 'yearly'] as const).optional(),
  note: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

// --------------- Form Dialog ---------------

interface FormDialogProps {
  open: boolean
  onClose: () => void
  editing: Expense | null
}

function ExpenseFormDialog({ open, onClose, editing }: FormDialogProps) {
  const { add, update } = useExpenseStore()
  const { channels } = useChannelStore()
  const activeChannels = channels.filter((c) => c.isActive)

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      category: 'other',
      isRecurring: false,
      recurringInterval: 'monthly',
    },
  })

  const isRecurring = watch('isRecurring')

  // Điền form khi mở để edit
  useEffect(() => {
    if (!open) return
    if (editing) {
      reset({
        name: editing.name,
        category: editing.category,
        amount: editing.amount,
        dateStr: new Date(editing.date).toISOString().slice(0, 10),
        channelId: editing.channelId ?? '',
        isRecurring: editing.isRecurring,
        recurringInterval: editing.recurringInterval ?? 'monthly',
        note: editing.note ?? '',
      })
    } else {
      reset({
        name: '',
        category: 'other',
        amount: undefined as unknown as number,
        dateStr: new Date().toISOString().slice(0, 10),
        channelId: '',
        isRecurring: false,
        recurringInterval: 'monthly',
        note: '',
      })
    }
  }, [open, editing, reset])

  const onSubmit = async (values: FormValues) => {
    const [y, m, d] = values.dateStr.split('-').map(Number)
    const date = new Date(y, m - 1, d)

    const input: ExpenseInput = {
      name: values.name,
      category: values.category,
      amount: values.amount,
      date,
      channelId: values.channelId || undefined,
      isRecurring: values.isRecurring,
      recurringInterval: values.isRecurring ? values.recurringInterval : undefined,
      note: values.note || undefined,
    }

    try {
      if (editing) {
        await update(editing.id, input)
        toast.success('Đã cập nhật chi phí')
      } else {
        await add(input)
        toast.success('Đã thêm chi phí')
      }
      onClose()
    } catch {
      toast.error('Lưu thất bại')
    }
  }

  const inputCls =
    'w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring'

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-card shadow-lg"
          aria-describedby="expense-form-desc"
        >
          <div className="flex items-center justify-between border-b px-6 py-4">
            <Dialog.Title className="text-base font-semibold">
              {editing ? 'Sửa chi phí' : 'Thêm chi phí'}
            </Dialog.Title>
            <Dialog.Description id="expense-form-desc" className="sr-only">
              Form thêm/sửa chi phí vận hành
            </Dialog.Description>
            <Dialog.Close className="rounded-lg p-1 text-muted-foreground hover:bg-muted">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-4 px-6 py-5">

              {/* Tên chi phí */}
              <div className="space-y-1">
                <label className="text-sm font-medium">
                  Tên chi phí <span className="text-red-500">*</span>
                </label>
                <input
                  {...register('name')}
                  placeholder="Vd: Thuê kho tháng 3"
                  className={inputCls}
                  autoFocus
                />
                {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Loại chi phí */}
                <div className="space-y-1">
                  <label className="text-sm font-medium">
                    Loại <span className="text-red-500">*</span>
                  </label>
                  <select {...register('category')} className={inputCls}>
                    {(Object.keys(CATEGORY_LABELS) as ExpenseCategory[]).map((k) => (
                      <option key={k} value={k}>
                        {CATEGORY_LABELS[k]}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Số tiền */}
                <div className="space-y-1">
                  <label className="text-sm font-medium">
                    Số tiền (₫) <span className="text-red-500">*</span>
                  </label>
                  <input
                    {...register('amount')}
                    type="number"
                    min={0}
                    placeholder="0"
                    className={inputCls}
                  />
                  {errors.amount && <p className="text-xs text-red-500">{errors.amount.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Ngày */}
                <div className="space-y-1">
                  <label className="text-sm font-medium">
                    Ngày <span className="text-red-500">*</span>
                  </label>
                  <input {...register('dateStr')} type="date" className={inputCls} />
                  {errors.dateStr && <p className="text-xs text-red-500">{errors.dateStr.message}</p>}
                </div>

                {/* Kênh bán (tuỳ chọn) */}
                <div className="space-y-1">
                  <label className="text-sm font-medium">Kênh bán</label>
                  <select {...register('channelId')} className={inputCls}>
                    <option value="">— Chi phí chung —</option>
                    {activeChannels.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Recurring toggle */}
              <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3">
                <input
                  {...register('isRecurring')}
                  type="checkbox"
                  id="isRecurring"
                  className="h-4 w-4 rounded border-gray-300 accent-primary"
                />
                <label htmlFor="isRecurring" className="text-sm font-medium cursor-pointer">
                  Chi phí định kỳ (tự lặp lại)
                </label>
              </div>

              {/* Interval — chỉ hiện khi isRecurring */}
              {isRecurring && (
                <div className="space-y-1">
                  <label className="text-sm font-medium">Chu kỳ lặp</label>
                  <select {...register('recurringInterval')} className={inputCls}>
                    {(Object.keys(INTERVAL_LABELS) as RecurringInterval[]).map((k) => (
                      <option key={k} value={k}>
                        {INTERVAL_LABELS[k]}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Ghi chú */}
              <div className="space-y-1">
                <label className="text-sm font-medium">Ghi chú</label>
                <input {...register('note')} placeholder="Tuỳ chọn" className={inputCls} />
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t px-6 py-4">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
                >
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

// --------------- Main Page ---------------

export default function ExpensesPage() {
  const { expenses, loading, load, remove, generateRecurring } = useExpenseStore()
  const { channels, load: loadChannels } = useChannelStore()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Expense | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null)
  const [generating, setGenerating] = useState(false)

  // Filters
  const [monthStr, setMonthStr] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [channelFilter, setChannelFilter] = useState<string>('') // '' = tất cả, 'general' = chung

  useEffect(() => {
    load()
    loadChannels()
  }, [load, loadChannels])

  // Parse selected year-month (1-based month from input)
  const [selectedYear, selectedMonthOneBased] = monthStr.split('-').map(Number)

  // Lọc expenses theo tháng + category + channel
  const filtered = useMemo(() => {
    return expenses.filter((e) => {
      const d = new Date(e.date)
      if (d.getFullYear() !== selectedYear || d.getMonth() + 1 !== selectedMonthOneBased) return false
      if (categoryFilter && e.category !== categoryFilter) return false
      if (channelFilter === 'general' && e.channelId) return false
      if (channelFilter && channelFilter !== 'general' && e.channelId !== channelFilter) return false
      return true
    })
  }, [expenses, selectedYear, selectedMonthOneBased, categoryFilter, channelFilter])

  // Stats cho tháng đang xem (không phụ thuộc categoryFilter/channelFilter)
  const monthlyExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const d = new Date(e.date)
      return d.getFullYear() === selectedYear && d.getMonth() + 1 === selectedMonthOneBased
    })
  }, [expenses, selectedYear, selectedMonthOneBased])

  const totalMonth = monthlyExpenses.reduce((s, e) => s + e.amount, 0)
  const generalTotal = monthlyExpenses.filter((e) => !e.channelId).reduce((s, e) => s + e.amount, 0)
  const channelTotal = totalMonth - generalTotal

  // By-category breakdown
  const byCategory = useMemo(() => {
    const acc: Partial<Record<ExpenseCategory, number>> = {}
    for (const e of monthlyExpenses) {
      acc[e.category] = (acc[e.category] ?? 0) + e.amount
    }
    return acc
  }, [monthlyExpenses])

  const channelMap = useMemo(() => new Map(channels.map((c) => [c.id, c])), [channels])

  const openAdd = () => {
    setEditing(null)
    setDialogOpen(true)
  }

  const openEdit = (expense: Expense) => {
    setEditing(expense)
    setDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await remove(deleteTarget.id)
      toast.success('Đã xóa chi phí')
    } catch {
      toast.error('Xóa thất bại')
    } finally {
      setDeleteTarget(null)
    }
  }

  const handleGenerateRecurring = async () => {
    setGenerating(true)
    try {
      const count = await generateRecurring()
      if (count > 0) {
        toast.success(`Đã tạo ${count} chi phí định kỳ cho tháng này`)
      } else {
        toast.info('Không có chi phí định kỳ mới cần tạo')
      }
    } catch {
      toast.error('Tạo thất bại')
    } finally {
      setGenerating(false)
    }
  }

  // --------------- Columns ---------------

  const columns: ColumnDef<Expense>[] = useMemo(
    () => [
      {
        header: 'Tên chi phí',
        accessorKey: 'name',
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.name}</div>
            {row.original.isRecurring && (
              <div className="flex items-center gap-1 mt-0.5">
                <RefreshCw className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  {INTERVAL_LABELS[row.original.recurringInterval ?? 'monthly']}
                </span>
              </div>
            )}
          </div>
        ),
      },
      {
        header: 'Loại',
        accessorKey: 'category',
        cell: ({ getValue }) => {
          const cat = getValue() as ExpenseCategory
          return (
            <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', CATEGORY_COLORS[cat])}>
              {CATEGORY_LABELS[cat]}
            </span>
          )
        },
      },
      {
        header: 'Ngày',
        accessorKey: 'date',
        cell: ({ getValue }) => (
          <span className="text-sm text-muted-foreground">{formatDate(getValue() as Date)}</span>
        ),
      },
      {
        header: 'Kênh',
        accessorKey: 'channelId',
        cell: ({ getValue }) => {
          const cid = getValue() as string | undefined
          const ch = cid ? channelMap.get(cid) : null
          return ch ? (
            <ChannelBadge name={ch.name} color={ch.color} />
          ) : (
            <span className="text-xs text-muted-foreground italic">Chung</span>
          )
        },
      },
      {
        header: 'Số tiền',
        accessorKey: 'amount',
        cell: ({ getValue }) => (
          <span className="font-semibold tabular-nums text-red-600 dark:text-red-400">
            {formatVND(getValue() as number)}
          </span>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            <button
              onClick={() => openEdit(row.original)}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
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
    ],
    [channelMap],
  )

  return (
    <PageLayout
      title="Chi phí"
      action={
        <div className="flex items-center gap-2">
          <button
            onClick={handleGenerateRecurring}
            disabled={generating}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
            title="Tạo chi phí định kỳ cho tháng này"
          >
            <RefreshCw className={cn('h-4 w-4', generating && 'animate-spin')} />
            Tạo định kỳ
          </button>
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Thêm chi phí
          </button>
        </div>
      }
    >
      <div className="space-y-6">

        {/* ---- Filters ---- */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Month picker */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-muted-foreground">Tháng:</label>
            <input
              type="month"
              value={monthStr}
              onChange={(e) => setMonthStr(e.target.value)}
              className="rounded-lg border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Category filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-lg border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Tất cả loại</option>
            {(Object.keys(CATEGORY_LABELS) as ExpenseCategory[]).map((k) => (
              <option key={k} value={k}>
                {CATEGORY_LABELS[k]}
              </option>
            ))}
          </select>

          {/* Channel filter */}
          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            className="rounded-lg border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Tất cả kênh</option>
            <option value="general">Chỉ chi phí chung</option>
            {channels
              .filter((c) => c.isActive)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>

          {/* Clear filters */}
          {(categoryFilter || channelFilter) && (
            <button
              onClick={() => { setCategoryFilter(''); setChannelFilter('') }}
              className="rounded-lg border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>

        {/* ---- Stats ---- */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard
            title="Tổng tháng"
            value={formatVND(totalMonth)}
            subtitle={`${monthlyExpenses.length} khoản`}
            variant={totalMonth > 0 ? 'danger' : 'default'}
          />
          <StatCard
            title="Chi phí chung"
            value={formatVND(generalTotal)}
            subtitle="Không gắn kênh"
          />
          <StatCard
            title="Chi phí theo kênh"
            value={formatVND(channelTotal)}
            subtitle="Gắn kênh cụ thể"
          />
          <StatCard
            title="Số khoản đang lọc"
            value={filtered.length}
            subtitle="trong tháng"
          />
        </div>

        {/* ---- Category breakdown ---- */}
        {Object.keys(byCategory).length > 0 && (
          <div className="rounded-xl border bg-card p-5">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Phân tích theo loại — {monthStr}
            </h3>
            <div className="flex flex-wrap gap-3">
              {(Object.entries(byCategory) as [ExpenseCategory, number][])
                .sort((a, b) => b[1] - a[1])
                .map(([cat, amt]) => (
                  <div
                    key={cat}
                    className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2"
                  >
                    <span className={cn('rounded px-1.5 py-0.5 text-xs font-medium', CATEGORY_COLORS[cat])}>
                      {CATEGORY_LABELS[cat]}
                    </span>
                    <span className="text-sm font-semibold tabular-nums">{formatVND(amt)}</span>
                    <span className="text-xs text-muted-foreground">
                      ({totalMonth > 0 ? Math.round((amt / totalMonth) * 100) : 0}%)
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ---- Table ---- */}
        <DataTable
          columns={columns}
          data={loading ? [] : filtered}
          searchPlaceholder="Tìm chi phí..."
          emptyMessage={loading ? 'Đang tải...' : 'Chưa có chi phí nào.'}
        />
      </div>

      {/* Form Dialog */}
      <ExpenseFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        editing={editing}
      />

      {/* Confirm Delete */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Xóa chi phí?"
        description={`Xóa "${deleteTarget?.name ?? ''}" — ${formatVND(deleteTarget?.amount ?? 0)}. Không thể hoàn tác.`}
        confirmLabel="Xóa"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </PageLayout>
  )
}
