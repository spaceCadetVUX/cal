import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { ArrowLeft, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { PageLayout } from '@/components/layout/PageLayout'
import { useImportStore, generateBatchCode } from '@/stores/useImportStore'
import { useSupplierStore } from '@/stores/useSupplierStore'
import { formatVND } from '@/utils/formatters'
import db from '@/db/db'
import type { Product, ProductVariant } from '@/types'

// --------------- Types ---------------

interface LineItemDraft {
  key: string
  productId: string
  variantId: string   // '' = no variant
  quantity: string
  costPrice: string
}

interface ProductEntry {
  product: Product
  variants: ProductVariant[]
}

// --------------- Zod schema ---------------

const headerSchema = z.object({
  batchCode: z.string().min(1, 'Mã lô không được trống'),
  supplierId: z.string().min(1, 'Chọn nhà cung cấp'),
  importDate: z.string().min(1, 'Chọn ngày nhập'),
  invoiceNumber: z.string().optional(),
  note: z.string().optional(),
})
type HeaderFields = z.infer<typeof headerSchema>

// --------------- Component ---------------

const inputCls = 'w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring'
const errorCls = 'text-xs text-red-500'

export default function ImportFormPage() {
  const { id } = useParams<{ id: string }>()  // có id = edit mode
  const navigate = useNavigate()
  const { createBatch, updateBatch, getBatchDetail } = useImportStore()
  const { suppliers, load: loadSuppliers } = useSupplierStore()

  const [catalog, setCatalog] = useState<Map<string, ProductEntry>>(new Map())
  const [lineItems, setLineItems] = useState<LineItemDraft[]>([])
  const [lineErrors, setLineErrors] = useState<Record<number, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const isEdit = Boolean(id)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<HeaderFields>({
    resolver: zodResolver(headerSchema),
    defaultValues: {
      batchCode: generateBatchCode(),
      importDate: new Date().toISOString().slice(0, 10),
    },
  })

  // Load suppliers + product catalog
  useEffect(() => {
    loadSuppliers()

    db.products
      .filter((p) => p.isActive)
      .sortBy('name')
      .then(async (products) => {
        const allVariants = await db.productVariants.toArray()
        const map = new Map<string, ProductEntry>()
        products.forEach((p) => {
          map.set(p.id, {
            product: p,
            variants: allVariants.filter((v) => v.productId === p.id && v.isActive),
          })
        })
        setCatalog(map)
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Edit mode: load existing batch
  useEffect(() => {
    if (!id) return
    getBatchDetail(id).then((detail) => {
      if (!detail) return
      const { batch, items } = detail
      const [y, m, d] = [
        batch.importDate.getFullYear(),
        batch.importDate.getMonth() + 1,
        batch.importDate.getDate(),
      ]
      reset({
        batchCode: batch.batchCode,
        supplierId: batch.supplierId,
        importDate: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        invoiceNumber: batch.invoiceNumber ?? '',
        note: batch.note ?? '',
      })
      setLineItems(
        items.map((i) => ({
          key: crypto.randomUUID(),
          productId: i.productId,
          variantId: i.variantId ?? '',
          quantity: String(i.quantity),
          costPrice: String(i.costPrice),
        })),
      )
    })
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  // --------------- Line item helpers ---------------

  const addLine = () => {
    setLineItems((prev) => [
      ...prev,
      { key: crypto.randomUUID(), productId: '', variantId: '', quantity: '', costPrice: '' },
    ])
  }

  const removeLine = (key: string) => {
    setLineItems((prev) => prev.filter((l) => l.key !== key))
  }

  const updateLine = (key: string, field: keyof LineItemDraft, value: string) => {
    setLineItems((prev) =>
      prev.map((l) => {
        if (l.key !== key) return l
        const updated = { ...l, [field]: value }
        // Khi đổi product → reset variantId
        if (field === 'productId') updated.variantId = ''
        return updated
      }),
    )
  }

  // --------------- Total ---------------

  const total = useMemo(
    () =>
      lineItems.reduce((sum, l) => {
        const qty = parseFloat(l.quantity)
        const cost = parseFloat(l.costPrice)
        if (!isNaN(qty) && !isNaN(cost)) return sum + qty * cost
        return sum
      }, 0),
    [lineItems],
  )

  // --------------- Validate line items ---------------

  const validateLines = (): boolean => {
    const errs: Record<number, string> = {}
    if (lineItems.length === 0) {
      toast.error('Cần thêm ít nhất 1 sản phẩm')
      return false
    }
    lineItems.forEach((l, i) => {
      if (!l.productId) { errs[i] = 'Chọn sản phẩm'; return }
      const entry = catalog.get(l.productId)
      if (entry && entry.variants.length > 0 && !l.variantId) {
        errs[i] = 'Chọn biến thể'; return
      }
      if (!l.quantity || isNaN(Number(l.quantity)) || Number(l.quantity) <= 0) {
        errs[i] = 'Số lượng phải > 0'; return
      }
      if (!l.costPrice || isNaN(Number(l.costPrice)) || Number(l.costPrice) < 0) {
        errs[i] = 'Giá vốn không hợp lệ'; return
      }
    })
    setLineErrors(errs)
    return Object.keys(errs).length === 0
  }

  // --------------- Submit ---------------

  const onSubmit = async (fields: HeaderFields) => {
    if (!validateLines()) return
    setSubmitting(true)
    try {
      const [y, m, d] = fields.importDate.split('-').map(Number)

      const input = {
        batchCode: fields.batchCode,
        supplierId: fields.supplierId,
        importDate: new Date(y, m - 1, d),
        invoiceNumber: fields.invoiceNumber || undefined,
        note: fields.note || undefined,
        items: lineItems.map((l) => ({
          productId: l.productId,
          variantId: l.variantId || undefined,
          quantity: Number(l.quantity),
          costPrice: Number(l.costPrice),
        })),
      }

      if (isEdit && id) {
        await updateBatch(id, input)
        toast.success('Đã cập nhật phiếu nhập')
        navigate(`/imports/${id}`)
      } else {
        const batch = await createBatch(input)
        toast.success('Đã tạo phiếu nhập')
        navigate(`/imports/${batch.id}`)
      }
    } catch {
      toast.error('Lưu thất bại')
    } finally {
      setSubmitting(false)
    }
  }

  // --------------- Render ---------------

  return (
    <PageLayout
      title={isEdit ? 'Sửa phiếu nhập' : 'Tạo phiếu nhập'}
      action={
        <button
          onClick={() => navigate(isEdit && id ? `/imports/${id}` : '/imports')}
          className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại
        </button>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* ---- Header fields ---- */}
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Thông tin lô nhập
          </h3>

          <div className="grid grid-cols-2 gap-4">
            {/* Mã lô */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Mã lô <span className="text-red-500">*</span></label>
              <div className="flex gap-2">
                <input {...register('batchCode')} className={inputCls} />
                <button
                  type="button"
                  onClick={() => setValue('batchCode', generateBatchCode())}
                  className="shrink-0 rounded-lg border px-2 py-2 text-muted-foreground hover:bg-muted"
                  title="Tạo mã mới"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>
              {errors.batchCode && <p className={errorCls}>{errors.batchCode.message}</p>}
            </div>

            {/* Ngày nhập */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Ngày nhập <span className="text-red-500">*</span></label>
              <input {...register('importDate')} type="date" className={inputCls} />
              {errors.importDate && <p className={errorCls}>{errors.importDate.message}</p>}
            </div>

            {/* Nhà cung cấp */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Nhà cung cấp <span className="text-red-500">*</span></label>
              <select {...register('supplierId')} className={inputCls}>
                <option value="">— Chọn NCC —</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              {errors.supplierId && <p className={errorCls}>{errors.supplierId.message}</p>}
            </div>

            {/* Số hoá đơn */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Số hoá đơn NCC</label>
              <input {...register('invoiceNumber')} className={inputCls} placeholder="Tuỳ chọn" />
            </div>
          </div>

          {/* Ghi chú */}
          <div className="space-y-1">
            <label className="text-sm font-medium">Ghi chú</label>
            <textarea {...register('note')} rows={2} className={`${inputCls} resize-none`} />
          </div>
        </div>

        {/* ---- Line items ---- */}
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Danh sách sản phẩm
            </h3>
            <span className="text-sm text-muted-foreground">
              {lineItems.length > 0 && `${lineItems.length} dòng`}
            </span>
          </div>

          {/* Table header */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="py-2 pr-3 text-left font-medium w-[35%]">Sản phẩm</th>
                  <th className="py-2 pr-3 text-left font-medium w-[20%]">Biến thể</th>
                  <th className="py-2 pr-3 text-right font-medium w-[12%]">Số lượng</th>
                  <th className="py-2 pr-3 text-right font-medium w-[18%]">Giá vốn (₫)</th>
                  <th className="py-2 pr-3 text-right font-medium w-[12%]">Tổng</th>
                  <th className="w-[3%]"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {lineItems.map((line, i) => {
                  const entry = catalog.get(line.productId)
                  const hasVariants = (entry?.variants ?? []).length > 0
                  const qty = parseFloat(line.quantity)
                  const cost = parseFloat(line.costPrice)
                  const lineTotal = !isNaN(qty) && !isNaN(cost) ? qty * cost : null

                  return (
                    <tr key={line.key}>
                      <td className="py-2 pr-3">
                        <select
                          value={line.productId}
                          onChange={(e) => updateLine(line.key, 'productId', e.target.value)}
                          className={inputCls}
                        >
                          <option value="">— Chọn SP —</option>
                          {[...catalog.values()].map(({ product }) => (
                            <option key={product.id} value={product.id}>
                              {product.name} ({product.sku})
                            </option>
                          ))}
                        </select>
                        {lineErrors[i] && <p className={errorCls}>{lineErrors[i]}</p>}
                      </td>
                      <td className="py-2 pr-3">
                        {hasVariants ? (
                          <select
                            value={line.variantId}
                            onChange={(e) => updateLine(line.key, 'variantId', e.target.value)}
                            className={inputCls}
                          >
                            <option value="">— Chọn —</option>
                            {entry?.variants.map((v) => (
                              <option key={v.id} value={v.id}>
                                {v.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        <input
                          type="number"
                          min={1}
                          value={line.quantity}
                          onChange={(e) => updateLine(line.key, 'quantity', e.target.value)}
                          className={`${inputCls} text-right`}
                          placeholder="0"
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <input
                          type="number"
                          min={0}
                          value={line.costPrice}
                          onChange={(e) => updateLine(line.key, 'costPrice', e.target.value)}
                          className={`${inputCls} text-right`}
                          placeholder="0"
                        />
                      </td>
                      <td className="py-2 pr-3 text-right font-medium tabular-nums">
                        {lineTotal !== null ? formatVND(lineTotal) : '—'}
                      </td>
                      <td className="py-2">
                        <button
                          type="button"
                          onClick={() => removeLine(line.key)}
                          className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}

                {lineItems.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground text-sm">
                      Chưa có sản phẩm nào. Bấm "Thêm dòng" để thêm.
                    </td>
                  </tr>
                )}
              </tbody>

              {lineItems.length > 0 && (
                <tfoot>
                  <tr className="border-t font-semibold">
                    <td colSpan={4} className="py-3 pr-3 text-right text-muted-foreground">
                      Tổng cộng:
                    </td>
                    <td className="py-3 pr-3 text-right text-lg">{formatVND(total)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          <button
            type="button"
            onClick={addLine}
            className="flex items-center gap-2 rounded-lg border border-dashed px-4 py-2 text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary transition-colors"
          >
            <Plus className="h-4 w-4" />
            Thêm dòng sản phẩm
          </button>
        </div>

        {/* ---- Submit ---- */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate(isEdit && id ? `/imports/${id}` : '/imports')}
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Huỷ
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? 'Đang lưu...' : isEdit ? 'Lưu thay đổi' : 'Tạo phiếu nhập'}
          </button>
        </div>
      </form>
    </PageLayout>
  )
}

// For re-export (used by App.tsx)
export { ImportFormPage }
