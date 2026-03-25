import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, CheckCircle, Pencil, XCircle } from 'lucide-react'
import { PageLayout } from '@/components/layout/PageLayout'
import { StatCard } from '@/components/shared/StatCard'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { useImportStore, type ImportBatchDetail } from '@/stores/useImportStore'
import { useInventoryStore } from '@/stores/useInventoryStore'
import { useSupplierStore } from '@/stores/useSupplierStore'
import { formatVND, formatDate } from '@/utils/formatters'
import db from '@/db/db'
import type { ImportBatchStatus } from '@/types'

// --------------- Status label ---------------

const STATUS_LABELS: Record<ImportBatchStatus, { label: string; cls: string }> = {
  pending: { label: 'Chờ nhận hàng', cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  received: { label: 'Đã nhận hàng', cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  cancelled: { label: 'Đã hủy', cls: 'bg-muted text-muted-foreground' },
}

// --------------- Component ---------------

export default function ImportDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { batches, confirmBatch, cancelBatch } = useImportStore()
  const { load: reloadInventory } = useInventoryStore()
  const { suppliers } = useSupplierStore()

  const [detail, setDetail] = useState<ImportBatchDetail | null | undefined>(undefined)
  const [productNames, setProductNames] = useState<Record<string, string>>({})
  const [variantNames, setVariantNames] = useState<Record<string, string>>({})
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)

  const { getBatchDetail } = useImportStore()

  // Resolve batch từ store + load detail
  useEffect(() => {
    if (!id) return
    getBatchDetail(id).then((d) => {
      setDetail(d)
      if (d) {
        const productIds = [...new Set(d.items.map((i) => i.productId))]
        const variantIds = d.items.filter((i) => i.variantId).map((i) => i.variantId!)

        Promise.all([
          db.products.bulkGet(productIds),
          db.productVariants.bulkGet(variantIds),
        ]).then(([products, variants]) => {
          setProductNames(
            Object.fromEntries((products.filter(Boolean) as NonNullable<typeof products[0]>[]).map((p) => [p.id, p.name])),
          )
          setVariantNames(
            Object.fromEntries((variants.filter(Boolean) as NonNullable<typeof variants[0]>[]).map((v) => [v.id, v.name])),
          )
        })
      }
    })
  }, [id, batches]) // eslint-disable-line react-hooks/exhaustive-deps

  const batch = detail?.batch
  const items = detail?.items ?? []
  const supplierName = batch ? (suppliers.find((s) => s.id === batch.supplierId)?.name ?? '—') : '—'

  const handleConfirm = async () => {
    if (!id) return
    try {
      await confirmBatch(id)
      await reloadInventory()
      toast.success('Xác nhận nhận hàng thành công — tồn kho đã cập nhật')
    } catch {
      toast.error('Xác nhận thất bại')
    } finally {
      setConfirmOpen(false)
    }
  }

  const handleCancel = async () => {
    if (!id) return
    try {
      await cancelBatch(id)
      toast.success('Đã hủy lô nhập')
    } catch {
      toast.error('Hủy thất bại')
    } finally {
      setCancelOpen(false)
    }
  }

  // --------------- Loading / not found ---------------

  if (detail === undefined) {
    return <PageLayout title="Phiếu nhập"><p className="text-muted-foreground">Đang tải...</p></PageLayout>
  }

  if (detail === null || !batch) {
    return (
      <PageLayout title="Không tìm thấy">
        <p className="text-muted-foreground">Phiếu nhập không tồn tại.</p>
        <button onClick={() => navigate('/imports')} className="mt-4 text-sm text-primary hover:underline">
          ← Quay lại danh sách
        </button>
      </PageLayout>
    )
  }

  const status = STATUS_LABELS[batch.status]
  const isPending = batch.status === 'pending'

  return (
    <PageLayout
      title={batch.batchCode}
      action={
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => navigate('/imports')}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" />
            Danh sách
          </button>

          {isPending && (
            <>
              <button
                onClick={() => navigate(`/imports/${id}/edit`)}
                className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted"
              >
                <Pencil className="h-4 w-4" />
                Sửa
              </button>
              <button
                onClick={() => setCancelOpen(true)}
                className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
              >
                <XCircle className="h-4 w-4" />
                Hủy lô
              </button>
              <button
                onClick={() => setConfirmOpen(true)}
                className="flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                <CheckCircle className="h-4 w-4" />
                Xác nhận nhận hàng
              </button>
            </>
          )}
        </div>
      }
    >
      <div className="space-y-6">
        {/* ---- Info card ---- */}
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-start justify-between mb-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Thông tin lô nhập
            </h3>
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${status.cls}`}>
              {status.label}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <Row label="Nhà cung cấp" value={supplierName} />
            <Row label="Ngày nhập" value={formatDate(batch.importDate)} />
            <Row label="Số hoá đơn NCC" value={batch.invoiceNumber} />
            <Row label="Ngày tạo" value={formatDate(batch.createdAt)} />
            {batch.note && <Row label="Ghi chú" value={batch.note} />}
          </div>
        </div>

        {/* ---- Stats ---- */}
        <div className="grid grid-cols-3 gap-4">
          <StatCard title="Số dòng SP" value={String(items.length)} />
          <StatCard title="Tổng số lượng" value={String(items.reduce((s, i) => s + i.quantity, 0))} />
          <StatCard title="Tổng tiền" value={formatVND(batch.totalAmount)} variant="default" />
        </div>

        {/* ---- Line items ---- */}
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Chi tiết sản phẩm
            </h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="px-5 py-3 text-left font-medium text-muted-foreground">Sản phẩm</th>
                <th className="px-5 py-3 text-left font-medium text-muted-foreground">Biến thể</th>
                <th className="px-5 py-3 text-right font-medium text-muted-foreground">Số lượng</th>
                <th className="px-5 py-3 text-right font-medium text-muted-foreground">Giá vốn</th>
                <th className="px-5 py-3 text-right font-medium text-muted-foreground">Tổng</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-muted/20">
                  <td className="px-5 py-3 font-medium">{productNames[item.productId] ?? '—'}</td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {item.variantId ? (variantNames[item.variantId] ?? '—') : '—'}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums">{item.quantity}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{formatVND(item.costPrice)}</td>
                  <td className="px-5 py-3 text-right tabular-nums font-medium">
                    {formatVND(item.quantity * item.costPrice)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/20 font-semibold">
                <td colSpan={4} className="px-5 py-3 text-right text-muted-foreground">
                  Tổng cộng:
                </td>
                <td className="px-5 py-3 text-right text-base">{formatVND(batch.totalAmount)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Dialogs */}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(v) => !v && setConfirmOpen(false)}
        title="Xác nhận nhận hàng?"
        description={`Lô ${batch.batchCode} sẽ được đánh dấu "Đã nhận hàng" và tồn kho sẽ tự động cập nhật. Không thể hoàn tác.`}
        confirmLabel="Xác nhận nhận hàng"
        variant="default"
        onConfirm={handleConfirm}
      />

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={(v) => !v && setCancelOpen(false)}
        title="Hủy lô nhập?"
        description={`Lô ${batch.batchCode} sẽ bị hủy. Tồn kho không bị ảnh hưởng vì chưa xác nhận nhận hàng.`}
        confirmLabel="Hủy lô"
        variant="destructive"
        onConfirm={handleCancel}
      />
    </PageLayout>
  )
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex gap-2">
      <span className="w-36 shrink-0 text-muted-foreground">{label}</span>
      <span className="font-medium">{value || '—'}</span>
    </div>
  )
}
