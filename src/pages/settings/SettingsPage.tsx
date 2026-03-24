import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Download, Upload, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { PageLayout } from '@/components/layout/PageLayout'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { useSettingsStore } from '@/stores/useSettingsStore'
import { runSeedIfNeeded } from '@/db/seed'
import db from '@/db/db'

// --------------- Schema ---------------

const schema = z.object({
  businessName: z.string().min(1, 'Không được để trống'),
  defaultPackagingCost: z.coerce.number().min(0),
  defaultMinMarginPct: z.coerce.number().min(0).max(100),
  defaultLowStockAlert: z.coerce.number().int().min(0),
  currency: z.string().min(1),
})
type FormValues = z.infer<typeof schema>

// --------------- Export / Import helpers ---------------

// Recursively convert ISO date strings back to Date objects on import
function reviveDates(val: unknown): unknown {
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(val)) return new Date(val)
  if (Array.isArray(val)) return val.map(reviveDates)
  if (val && typeof val === 'object')
    return Object.fromEntries(Object.entries(val as Record<string, unknown>).map(([k, v]) => [k, reviveDates(v)]))
  return val
}

async function exportBackup() {
  const data = {
    appSettings: await db.appSettings.toArray(),
    salesChannels: await db.salesChannels.toArray(),
    categories: await db.categories.toArray(),
    channelCategoryFees: await db.channelCategoryFees.toArray(),
    suppliers: await db.suppliers.toArray(),
    supplierPayments: await db.supplierPayments.toArray(),
    customers: await db.customers.toArray(),
    products: await db.products.toArray(),
    productVariants: await db.productVariants.toArray(),
    productChannelInfos: await db.productChannelInfos.toArray(),
    priceConfigs: await db.priceConfigs.toArray(),
    importBatches: await db.importBatches.toArray(),
    importItems: await db.importItems.toArray(),
    inventoryRecords: await db.inventoryRecords.toArray(),
    stockMovements: await db.stockMovements.toArray(),
    orders: await db.orders.toArray(),
    orderItems: await db.orderItems.toArray(),
    expenses: await db.expenses.toArray(),
  }
  const payload = { version: '1.0', exportedAt: new Date().toISOString(), data }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `seller-backup-${format(new Date(), 'yyyyMMdd-HHmm')}.json`
  a.click()
  URL.revokeObjectURL(url)
}

async function importBackup(file: File) {
  const text = await file.text()
  const parsed = JSON.parse(text)
  const { data } = reviveDates(parsed) as { data: Record<string, unknown[]> }

  await db.transaction(
    'rw',
    [
      db.appSettings, db.salesChannels, db.categories, db.channelCategoryFees,
      db.suppliers, db.supplierPayments, db.customers, db.products,
      db.productVariants, db.productChannelInfos, db.priceConfigs,
      db.importBatches, db.importItems, db.inventoryRecords,
      db.stockMovements, db.orders, db.orderItems, db.expenses,
    ],
    async () => {
      await db.appSettings.clear(); await db.appSettings.bulkAdd(data.appSettings as never[])
      await db.salesChannels.clear(); await db.salesChannels.bulkAdd(data.salesChannels as never[])
      await db.categories.clear(); await db.categories.bulkAdd(data.categories as never[])
      await db.channelCategoryFees.clear(); await db.channelCategoryFees.bulkAdd(data.channelCategoryFees as never[])
      await db.suppliers.clear(); await db.suppliers.bulkAdd(data.suppliers as never[])
      await db.supplierPayments.clear(); await db.supplierPayments.bulkAdd(data.supplierPayments as never[])
      await db.customers.clear(); await db.customers.bulkAdd(data.customers as never[])
      await db.products.clear(); await db.products.bulkAdd(data.products as never[])
      await db.productVariants.clear(); await db.productVariants.bulkAdd(data.productVariants as never[])
      await db.productChannelInfos.clear(); await db.productChannelInfos.bulkAdd(data.productChannelInfos as never[])
      await db.priceConfigs.clear(); await db.priceConfigs.bulkAdd(data.priceConfigs as never[])
      await db.importBatches.clear(); await db.importBatches.bulkAdd(data.importBatches as never[])
      await db.importItems.clear(); await db.importItems.bulkAdd(data.importItems as never[])
      await db.inventoryRecords.clear(); await db.inventoryRecords.bulkAdd(data.inventoryRecords as never[])
      await db.stockMovements.clear(); await db.stockMovements.bulkAdd(data.stockMovements as never[])
      await db.orders.clear(); await db.orders.bulkAdd(data.orders as never[])
      await db.orderItems.clear(); await db.orderItems.bulkAdd(data.orderItems as never[])
      await db.expenses.clear(); await db.expenses.bulkAdd(data.expenses as never[])
    },
  )
}

// --------------- Component ---------------

export default function SettingsPage() {
  const { settings, loading, load, save } = useSettingsStore()
  const [resetOpen, setResetOpen] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  // Load settings on mount
  useEffect(() => {
    load()
  }, [load])

  // Populate form when settings loaded
  useEffect(() => {
    if (settings) {
      reset({
        businessName: settings.businessName,
        defaultPackagingCost: settings.defaultPackagingCost,
        defaultMinMarginPct: settings.defaultMinMarginPct,
        defaultLowStockAlert: settings.defaultLowStockAlert,
        currency: settings.currency,
      })
    }
  }, [settings, reset])

  const onSubmit = async (values: FormValues) => {
    try {
      await save(values)
      toast.success('Đã lưu cài đặt')
    } catch {
      toast.error('Lưu thất bại')
    }
  }

  const handleExport = async () => {
    try {
      await exportBackup()
      toast.success('Đã xuất backup')
    } catch {
      toast.error('Xuất backup thất bại')
    }
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      await importBackup(file)
      await load()
      toast.success('Import thành công — đã tải lại dữ liệu')
    } catch {
      toast.error('Import thất bại — file không hợp lệ')
    }
    e.target.value = ''
  }

  const handleReset = async () => {
    try {
      // Clear all tables then re-seed defaults
      await db.transaction(
        'rw',
        [
          db.appSettings, db.salesChannels, db.categories, db.channelCategoryFees,
          db.suppliers, db.supplierPayments, db.customers, db.products,
          db.productVariants, db.productChannelInfos, db.priceConfigs,
          db.importBatches, db.importItems, db.inventoryRecords,
          db.stockMovements, db.orders, db.orderItems, db.expenses,
        ],
        async () => {
          await Promise.all([
            db.appSettings.clear(), db.salesChannels.clear(), db.categories.clear(),
            db.channelCategoryFees.clear(), db.suppliers.clear(), db.supplierPayments.clear(),
            db.customers.clear(), db.products.clear(), db.productVariants.clear(),
            db.productChannelInfos.clear(), db.priceConfigs.clear(), db.importBatches.clear(),
            db.importItems.clear(), db.inventoryRecords.clear(), db.stockMovements.clear(),
            db.orders.clear(), db.orderItems.clear(), db.expenses.clear(),
          ])
        },
      )
      await runSeedIfNeeded()
      await load()
      toast.success('Đã reset toàn bộ dữ liệu')
    } catch {
      toast.error('Reset thất bại')
    }
  }

  if (loading && !settings) {
    return <PageLayout title="Cài đặt"><p className="text-muted-foreground">Đang tải...</p></PageLayout>
  }

  return (
    <PageLayout title="Cài đặt">
      <div className="max-w-2xl space-y-6">
        {/* Business info form */}
        <div className="rounded-xl border bg-card p-6">
          <h3 className="mb-4 text-sm font-semibold">Thông tin doanh nghiệp</h3>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Business name */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Tên doanh nghiệp</label>
              <input
                {...register('businessName')}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {errors.businessName && <p className="text-xs text-red-500">{errors.businessName.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Default packaging cost */}
              <div className="space-y-1">
                <label className="text-sm font-medium">Chi phí đóng gói mặc định (₫)</label>
                <input
                  {...register('defaultPackagingCost')}
                  type="number"
                  min={0}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                {errors.defaultPackagingCost && <p className="text-xs text-red-500">{errors.defaultPackagingCost.message}</p>}
              </div>

              {/* Default min margin */}
              <div className="space-y-1">
                <label className="text-sm font-medium">Margin tối thiểu mặc định (%)</label>
                <input
                  {...register('defaultMinMarginPct')}
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                {errors.defaultMinMarginPct && <p className="text-xs text-red-500">{errors.defaultMinMarginPct.message}</p>}
              </div>

              {/* Default low stock alert */}
              <div className="space-y-1">
                <label className="text-sm font-medium">Cảnh báo tồn kho thấp (số lượng)</label>
                <input
                  {...register('defaultLowStockAlert')}
                  type="number"
                  min={0}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                {errors.defaultLowStockAlert && <p className="text-xs text-red-500">{errors.defaultLowStockAlert.message}</p>}
              </div>

              {/* Currency */}
              <div className="space-y-1">
                <label className="text-sm font-medium">Đơn vị tiền tệ</label>
                <input
                  {...register('currency')}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting || !isDirty}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {isSubmitting ? 'Đang lưu...' : 'Lưu cài đặt'}
              </button>
            </div>
          </form>
        </div>

        {/* Data management */}
        <div className="rounded-xl border bg-card p-6">
          <h3 className="mb-1 text-sm font-semibold">Quản lý dữ liệu</h3>
          <p className="mb-4 text-xs text-muted-foreground">
            Backup và khôi phục toàn bộ dữ liệu. Reset sẽ xóa sạch và tạo lại dữ liệu mặc định.
          </p>
          <div className="flex flex-wrap gap-3">
            {/* Export */}
            <button
              onClick={handleExport}
              className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              <Download className="h-4 w-4" />
              Xuất backup JSON
            </button>

            {/* Import */}
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted">
              <Upload className="h-4 w-4" />
              Import từ file backup
              <input type="file" accept=".json" className="hidden" onChange={handleImport} />
            </label>

            {/* Reset */}
            <button
              onClick={() => setResetOpen(true)}
              className="flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30"
            >
              <Trash2 className="h-4 w-4" />
              Reset toàn bộ data
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Reset toàn bộ dữ liệu?"
        description="Hành động này sẽ xóa tất cả đơn hàng, sản phẩm, tồn kho và mọi dữ liệu khác. Không thể hoàn tác. Dữ liệu mặc định (kênh, danh mục) sẽ được tạo lại."
        confirmLabel="Reset"
        variant="destructive"
        onConfirm={handleReset}
      />
    </PageLayout>
  )
}
