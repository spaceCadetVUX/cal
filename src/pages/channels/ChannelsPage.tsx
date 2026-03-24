import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import * as Dialog from '@radix-ui/react-dialog'
import * as Switch from '@radix-ui/react-switch'
import { Plus, Pencil, Trash2, Tags, X } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { PageLayout } from '@/components/layout/PageLayout'
import { DataTable } from '@/components/shared/DataTable'
import { ChannelBadge } from '@/components/shared/ChannelBadge'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { useChannelStore } from '@/stores/useChannelStore'
import { CHANNEL_DEFAULTS } from '@/constants/channelDefaults'
import { formatPct } from '@/utils/formatters'
import db from '@/db/db'
import type { SalesChannel, ChannelType } from '@/types'

// --------------- Channel form schema ---------------

const CHANNEL_TYPES: ChannelType[] = ['shopee', 'lazada', 'tiki', 'tiktok', 'website', 'offline', 'custom']

const channelSchema = z.object({
  name: z.string().min(1, 'Không được để trống'),
  type: z.enum(['shopee', 'lazada', 'tiki', 'tiktok', 'website', 'offline', 'custom'] as const),
  platformFeePct: z.coerce.number().min(0, '≥ 0').max(100, '≤ 100'),
  paymentFeePct: z.coerce.number().min(0).max(100),
  defaultShippingSubsidy: z.coerce.number().min(0),
  color: z.string().min(4),
  note: z.string().optional(),
})
type ChannelForm = z.infer<typeof channelSchema>

// --------------- Category fees state ---------------

interface FeeRow {
  categoryId: string
  categoryName: string
  feePct: number // 0 = no override (use channel default)
}

// ====================================================
// Channel Form Dialog (Add / Edit)
// ====================================================

interface ChannelFormDialogProps {
  open: boolean
  onClose: () => void
  editing: SalesChannel | null
  defaultTab?: 'info' | 'fees'
}

function ChannelFormDialog({ open, onClose, editing, defaultTab = 'info' }: ChannelFormDialogProps) {
  const { add, update, loadCategoryFees, saveCategoryFees } = useChannelStore()
  const [tab, setTab] = useState<'info' | 'fees'>('info')
  const [feeRows, setFeeRows] = useState<FeeRow[]>([])
  const [savingFees, setSavingFees] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChannelForm>({ resolver: zodResolver(channelSchema) })

  const selectedType = watch('type')
  const colorValue = watch('color')

  // Reset form and tab when dialog opens / editing target changes
  useEffect(() => {
    if (!open) return
    // Use defaultTab only when editing (fees tab requires an existing channel)
    setTab(editing && defaultTab === 'fees' ? 'fees' : 'info')
    if (editing) {
      reset({
        name: editing.name,
        type: editing.type,
        platformFeePct: editing.platformFeePct,
        paymentFeePct: editing.paymentFeePct,
        defaultShippingSubsidy: editing.defaultShippingSubsidy,
        color: editing.color,
        note: editing.note ?? '',
      })
    } else {
      const def = CHANNEL_DEFAULTS.shopee
      reset({ name: def.name, type: 'shopee', platformFeePct: def.platformFeePct, paymentFeePct: def.paymentFeePct, defaultShippingSubsidy: 0, color: def.color, note: '' })
    }
  }, [open, editing, reset])

  // Prefill fees/color when type changes (only for new channels)
  useEffect(() => {
    if (!selectedType || editing) return
    const def = CHANNEL_DEFAULTS[selectedType as ChannelType]
    if (def) {
      setValue('platformFeePct', def.platformFeePct)
      setValue('paymentFeePct', def.paymentFeePct)
      setValue('color', def.color)
    }
  }, [selectedType, editing, setValue])

  // Load existing fees when switching to fees tab
  useEffect(() => {
    if (tab !== 'fees' || !editing) return
    ;(async () => {
      const cats = await db.categories.orderBy('name').toArray()
      const existing = await loadCategoryFees(editing.id)
      const feeMap = new Map(existing.map((f) => [f.categoryId, f.feePct]))
      setFeeRows(cats.map((c) => ({ categoryId: c.id, categoryName: c.name, feePct: feeMap.get(c.id) ?? 0 })))
    })()
  }, [tab, editing, loadCategoryFees])

  const onSubmit = async (values: ChannelForm) => {
    try {
      if (editing) {
        await update(editing.id, values)
        toast.success('Đã cập nhật kênh')
      } else {
        await add({ ...values, isActive: true })
        toast.success('Đã thêm kênh mới')
      }
      onClose()
    } catch {
      toast.error('Lưu thất bại')
    }
  }

  const handleSaveFees = async () => {
    if (!editing) return
    setSavingFees(true)
    try {
      await saveCategoryFees(editing.id, feeRows)
      toast.success('Đã lưu phí theo danh mục')
    } catch {
      toast.error('Lưu phí thất bại')
    } finally {
      setSavingFees(false)
    }
  }

  const inputCls = 'w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring'
  const labelCls = 'text-sm font-medium'

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-card shadow-lg">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-6 py-4">
            <Dialog.Title className="text-base font-semibold">
              {editing ? 'Sửa kênh bán' : 'Thêm kênh bán'}
            </Dialog.Title>
            <Dialog.Close className="rounded-lg p-1 text-muted-foreground hover:bg-muted">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          {/* Tabs — only show fees tab when editing */}
          {editing && (
            <div className="flex border-b px-6">
              {(['info', 'fees'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                    tab === t
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t === 'info' ? 'Thông tin' : 'Phí theo danh mục'}
                </button>
              ))}
            </div>
          )}

          {/* Tab: Channel info */}
          {tab === 'info' && (
            <form onSubmit={handleSubmit(onSubmit)}>
              <div className="space-y-4 px-6 py-5">
                {/* Type */}
                <div className="space-y-1">
                  <label className={labelCls}>Loại kênh</label>
                  <select {...register('type')} className={inputCls}>
                    {CHANNEL_TYPES.map((t) => (
                      <option key={t} value={t}>{CHANNEL_DEFAULTS[t].name}</option>
                    ))}
                  </select>
                </div>

                {/* Name */}
                <div className="space-y-1">
                  <label className={labelCls}>Tên kênh</label>
                  <input {...register('name')} className={inputCls} />
                  {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Platform fee */}
                  <div className="space-y-1">
                    <label className={labelCls}>Phí sàn (%)</label>
                    <input {...register('platformFeePct')} type="number" min={0} max={100} step={0.1} className={inputCls} />
                    {errors.platformFeePct && <p className="text-xs text-red-500">{errors.platformFeePct.message}</p>}
                  </div>
                  {/* Payment fee */}
                  <div className="space-y-1">
                    <label className={labelCls}>Phí thanh toán (%)</label>
                    <input {...register('paymentFeePct')} type="number" min={0} max={100} step={0.1} className={inputCls} />
                    {errors.paymentFeePct && <p className="text-xs text-red-500">{errors.paymentFeePct.message}</p>}
                  </div>
                  {/* Shipping subsidy */}
                  <div className="space-y-1">
                    <label className={labelCls}>Hỗ trợ vận chuyển mặc định (₫)</label>
                    <input {...register('defaultShippingSubsidy')} type="number" min={0} className={inputCls} />
                  </div>
                  {/* Color — color picker and text input stay in sync via watch+setValue */}
                  <div className="space-y-1">
                    <label className={labelCls}>Màu badge</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={colorValue ?? '#000000'}
                        onChange={(e) => setValue('color', e.target.value, { shouldDirty: true })}
                        className="h-9 w-12 cursor-pointer rounded-lg border bg-background p-1"
                      />
                      <input {...register('color')} className={`${inputCls} flex-1`} placeholder="#EE4D2D" />
                    </div>
                  </div>
                </div>

                {/* Note */}
                <div className="space-y-1">
                  <label className={labelCls}>Ghi chú (tuỳ chọn)</label>
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
                  {isSubmitting ? 'Đang lưu...' : editing ? 'Cập nhật' : 'Thêm kênh'}
                </button>
              </div>
            </form>
          )}

          {/* Tab: Category fees */}
          {tab === 'fees' && editing && (
            <div>
              <div className="px-6 py-3">
                <p className="text-xs text-muted-foreground">
                  Phí = 0 nghĩa là dùng phí mặc định của kênh ({formatPct(editing.platformFeePct)}).
                </p>
              </div>
              <div className="max-h-80 overflow-y-auto px-6">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="py-2 text-left font-medium text-muted-foreground">Danh mục</th>
                      <th className="py-2 text-right font-medium text-muted-foreground">Phí sàn (%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {feeRows.map((row, i) => (
                      <tr key={row.categoryId}>
                        <td className="py-2">{row.categoryName}</td>
                        <td className="py-2">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={0.1}
                            value={row.feePct}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0
                              setFeeRows((prev) => prev.map((r, idx) => idx === i ? { ...r, feePct: val } : r))
                            }}
                            className="w-20 rounded border bg-background px-2 py-1 text-right text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end gap-3 border-t px-6 py-4">
                <Dialog.Close asChild>
                  <button type="button" className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted">
                    Đóng
                  </button>
                </Dialog.Close>
                <button
                  onClick={handleSaveFees}
                  disabled={savingFees}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {savingFees ? 'Đang lưu...' : 'Lưu phí'}
                </button>
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// ====================================================
// ChannelsPage
// ====================================================

export default function ChannelsPage() {
  const { channels, loading, load, remove, toggleActive } = useChannelStore()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<SalesChannel | null>(null)
  const [dialogDefaultTab, setDialogDefaultTab] = useState<'info' | 'fees'>('info')
  const [deleteTarget, setDeleteTarget] = useState<SalesChannel | null>(null)

  useEffect(() => {
    load()
  }, [load])

  const openAdd = () => {
    setEditing(null)
    setDialogDefaultTab('info')
    setDialogOpen(true)
  }

  const openEdit = (ch: SalesChannel, tab: 'info' | 'fees' = 'info') => {
    setEditing(ch)
    setDialogDefaultTab(tab)
    setDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await remove(deleteTarget.id)
      toast.success(`Đã xóa kênh "${deleteTarget.name}"`)
    } catch {
      toast.error('Xóa thất bại')
    } finally {
      setDeleteTarget(null)
    }
  }

  const columns: ColumnDef<SalesChannel>[] = [
    {
      header: 'Kênh',
      accessorKey: 'name',
      cell: ({ row }) => (
        <ChannelBadge name={row.original.name} color={row.original.color} />
      ),
    },
    {
      header: 'Loại',
      accessorKey: 'type',
      cell: ({ getValue }) => <span className="capitalize text-muted-foreground">{String(getValue())}</span>,
    },
    {
      header: 'Phí sàn',
      accessorKey: 'platformFeePct',
      cell: ({ getValue }) => formatPct(getValue() as number),
    },
    {
      header: 'Phí TT',
      accessorKey: 'paymentFeePct',
      cell: ({ getValue }) => formatPct(getValue() as number),
    },
    {
      id: 'status',
      header: 'Trạng thái',
      cell: ({ row }) => (
        <Switch.Root
          checked={row.original.isActive}
          onCheckedChange={() => toggleActive(row.original.id)}
          className="relative inline-flex h-5 w-9 cursor-pointer items-center rounded-full transition-colors data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted"
        >
          <Switch.Thumb className="block h-4 w-4 rounded-full bg-white shadow-sm transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0.5" />
        </Switch.Root>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => openEdit(row.original, 'info')}
            title="Sửa thông tin"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={() => openEdit(row.original, 'fees')}
            title="Phí theo danh mục"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Tags className="h-4 w-4" />
          </button>
          <button
            onClick={() => setDeleteTarget(row.original)}
            title="Xóa kênh"
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
      title="Kênh bán"
      action={
        <button
          onClick={openAdd}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Thêm kênh
        </button>
      }
    >
      {loading ? (
        <p className="text-sm text-muted-foreground">Đang tải...</p>
      ) : (
        <DataTable columns={columns} data={channels} searchPlaceholder="Tìm theo tên kênh..." />
      )}

      <ChannelFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        editing={editing}
        defaultTab={dialogDefaultTab}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title={`Xóa kênh "${deleteTarget?.name}"?`}
        description="Toàn bộ phí theo danh mục của kênh này cũng sẽ bị xóa. Đơn hàng đã tạo sẽ không bị ảnh hưởng."
        confirmLabel="Xóa"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </PageLayout>
  )
}
