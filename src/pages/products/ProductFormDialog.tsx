import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import * as Dialog from '@radix-ui/react-dialog'
import { ImagePlus, Plus, RefreshCw, Trash2, X } from 'lucide-react'
import { useCategoryStore } from '@/stores/useCategoryStore'
import { useSupplierStore } from '@/stores/useSupplierStore'
import { useChannelStore } from '@/stores/useChannelStore'
import { useProductStore, generateProductSku, type VariantInput, type ChannelInput } from '@/stores/useProductStore'
import { ChannelBadge } from '@/components/shared/ChannelBadge'
import type { Product } from '@/types'

// --------------- Constants ---------------

const UNITS = ['cái', 'hộp', 'kg', 'gram', 'bộ', 'cặp', 'lít', 'mét', 'túi', 'gói', 'chai', 'lon', 'tờ', 'cuộn', 'thùng']

const inputCls =
  'w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50'
const labelCls = 'text-sm font-medium'
const errorCls = 'text-xs text-red-500'

// --------------- Zod schema for main fields ---------------

const productSchema = z.object({
  sku: z.string().min(1, 'SKU không được trống'),
  name: z.string().min(1, 'Tên sản phẩm không được trống'),
  categoryId: z.string().min(1, 'Vui lòng chọn danh mục'),
  supplierId: z.string().optional(),
  unit: z.string().min(1, 'Đơn vị không được trống'),
  description: z.string().optional(),
  barcode: z.string().optional(),
  weight: z.coerce.number().min(0).optional().or(z.literal('')),
  isActive: z.boolean(),
})
type ProductFields = z.infer<typeof productSchema>

// --------------- Props ---------------

interface ProductFormDialogProps {
  open: boolean
  onClose: () => void
  editing?: Product | null
}

// --------------- Tab type ---------------

type Tab = 'info' | 'variants' | 'channels'

// --------------- Component ---------------

export function ProductFormDialog({ open, onClose, editing }: ProductFormDialogProps) {
  const { categories } = useCategoryStore()
  const { suppliers } = useSupplierStore()
  const { channels } = useChannelStore()
  const { add, update, getDetail } = useProductStore()

  const [activeTab, setActiveTab] = useState<Tab>('info')
  const [variants, setVariants] = useState<VariantInput[]>([])
  const [channelInputs, setChannelInputs] = useState<ChannelInput[]>([])
  const [images, setImages] = useState<string[]>([])
  const [variantErrors, setVariantErrors] = useState<Record<number, string>>({})
  const imageInputRef = useRef<HTMLInputElement>(null)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ProductFields>({
    resolver: zodResolver(productSchema),
    defaultValues: { isActive: true },
  })

  // Active channels only (for channel tab)
  const activeChannels = channels.filter((c) => c.isActive)

  // Reset form when open/editing changes
  useEffect(() => {
    if (!open) return
    setActiveTab('info')
    setVariantErrors({})

    if (editing) {
      reset({
        sku: editing.sku,
        name: editing.name,
        categoryId: editing.categoryId,
        supplierId: editing.supplierId ?? '',
        unit: editing.unit,
        description: editing.description ?? '',
        barcode: editing.barcode ?? '',
        weight: editing.weight ?? '',
        isActive: editing.isActive,
      })
      setImages(editing.images ?? [])

      // Load variants + channel infos
      getDetail(editing.id).then(({ variants: v, channelInfos: ci }) => {
        setVariants(v.map((vt) => ({ id: vt.id, name: vt.name, sku: vt.sku, isActive: vt.isActive })))

        // Build channelInputs: merge all active channels, mark those with isListed=true
        const listedMap = Object.fromEntries(ci.map((c) => [c.channelId, c.externalSku ?? '']))
        setChannelInputs(
          activeChannels.map((ch) => ({
            channelId: ch.id,
            externalSku: listedMap[ch.id] ?? '',
            isListed: ch.id in listedMap,
          })),
        )
      })
    } else {
      reset({ sku: generateProductSku(), isActive: true, unit: 'cái' })
      setImages([])
      setVariants([])
      setChannelInputs(
        activeChannels.map((ch) => ({ channelId: ch.id, externalSku: '', isListed: false })),
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing])

  // --------------- Variant helpers ---------------

  const addVariant = () => {
    const newSku = `${generateProductSku()}-V${variants.length + 1}`
    setVariants((prev) => [...prev, { name: '', sku: newSku, isActive: true }])
  }

  const updateVariant = (i: number, field: keyof VariantInput, value: string | boolean) => {
    setVariants((prev) => prev.map((v, idx) => (idx === i ? { ...v, [field]: value } : v)))
    // Clear error on edit
    if (variantErrors[i]) setVariantErrors((prev) => { const next = { ...prev }; delete next[i]; return next })
  }

  const removeVariant = (i: number) => {
    setVariants((prev) => prev.filter((_, idx) => idx !== i))
  }

  // --------------- Channel helpers ---------------

  const toggleChannel = (channelId: string) => {
    setChannelInputs((prev) =>
      prev.map((ci) => (ci.channelId === channelId ? { ...ci, isListed: !ci.isListed } : ci)),
    )
  }

  const updateChannelSku = (channelId: string, externalSku: string) => {
    setChannelInputs((prev) =>
      prev.map((ci) => (ci.channelId === channelId ? { ...ci, externalSku } : ci)),
    )
  }

  // --------------- Image helpers ---------------

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    files.forEach((file) => {
      const reader = new FileReader()
      reader.onload = (ev) => {
        const base64 = ev.target?.result as string
        setImages((prev) => [...prev, base64])
      }
      reader.readAsDataURL(file)
    })
    e.target.value = '' // reset để có thể upload lại cùng file
  }

  const removeImage = (i: number) => {
    setImages((prev) => prev.filter((_, idx) => idx !== i))
  }

  // --------------- Validate variants ---------------

  const validateVariants = (): boolean => {
    const errs: Record<number, string> = {}
    variants.forEach((v, i) => {
      if (!v.name.trim()) errs[i] = 'Tên biến thể không được trống'
      else if (!v.sku.trim()) errs[i] = 'SKU biến thể không được trống'
    })
    // Check duplicate SKU among variants
    const skus = variants.map((v) => v.sku.trim().toLowerCase())
    skus.forEach((sku, i) => {
      if (skus.indexOf(sku) !== i) errs[i] = 'SKU bị trùng'
    })
    setVariantErrors(errs)
    return Object.keys(errs).length === 0
  }

  // --------------- Submit ---------------

  const onSubmit = async (fields: ProductFields) => {
    if (!validateVariants()) {
      setActiveTab('variants')
      return
    }

    const formInput = {
      sku: fields.sku,
      name: fields.name,
      categoryId: fields.categoryId,
      supplierId: fields.supplierId || undefined,
      unit: fields.unit,
      images,
      description: fields.description || undefined,
      barcode: fields.barcode || undefined,
      weight: fields.weight ? Number(fields.weight) : undefined,
      isActive: fields.isActive,
      variants,
      channelInputs,
    }

    try {
      if (editing) {
        await update(editing.id, formInput)
        toast.success('Đã cập nhật sản phẩm')
      } else {
        await add(formInput)
        toast.success('Đã thêm sản phẩm')
      }
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('ConstraintError') || msg.includes('unique')) {
        toast.error('SKU đã tồn tại, vui lòng dùng SKU khác')
      } else {
        toast.error('Lưu thất bại')
      }
    }
  }

  // --------------- Render ---------------

  const tabs: { key: Tab; label: string }[] = [
    { key: 'info', label: 'Thông tin' },
    { key: 'variants', label: `Biến thể${variants.length > 0 ? ` (${variants.length})` : ''}` },
    { key: 'channels', label: `Kênh bán${channelInputs.filter((c) => c.isListed).length > 0 ? ` (${channelInputs.filter((c) => c.isListed).length})` : ''}` },
  ]

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-card shadow-lg flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-6 py-4 shrink-0">
            <Dialog.Title className="text-base font-semibold">
              {editing ? 'Sửa sản phẩm' : 'Thêm sản phẩm'}
            </Dialog.Title>
            <Dialog.Close className="rounded-lg p-1 text-muted-foreground hover:bg-muted">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          {/* Tab nav */}
          <div className="flex border-b shrink-0">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setActiveTab(t.key)}
                className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === t.key
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
            {/* Tab content */}
            <div className="flex-1 overflow-y-auto px-6 py-5">

              {/* ============ TAB: THÔNG TIN ============ */}
              {activeTab === 'info' && (
                <div className="space-y-4">
                  {/* SKU + auto-generate */}
                  <div className="space-y-1">
                    <label className={labelCls}>
                      SKU <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-2">
                      <input {...register('sku')} className={inputCls} placeholder="VD: SP-20260325-A1B2" />
                      <button
                        type="button"
                        onClick={() => setValue('sku', generateProductSku())}
                        className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted shrink-0"
                        title="Tạo SKU tự động"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Tạo mới
                      </button>
                    </div>
                    {errors.sku && <p className={errorCls}>{errors.sku.message}</p>}
                  </div>

                  {/* Tên sản phẩm */}
                  <div className="space-y-1">
                    <label className={labelCls}>
                      Tên sản phẩm <span className="text-red-500">*</span>
                    </label>
                    <input {...register('name')} className={inputCls} placeholder="VD: Áo thun cotton unisex" autoFocus />
                    {errors.name && <p className={errorCls}>{errors.name.message}</p>}
                  </div>

                  {/* Danh mục + Đơn vị */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className={labelCls}>
                        Danh mục <span className="text-red-500">*</span>
                      </label>
                      <select {...register('categoryId')} className={inputCls}>
                        <option value="">— Chọn danh mục —</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      {errors.categoryId && <p className={errorCls}>{errors.categoryId.message}</p>}
                    </div>

                    <div className="space-y-1">
                      <label className={labelCls}>
                        Đơn vị <span className="text-red-500">*</span>
                      </label>
                      <input
                        {...register('unit')}
                        list="unit-list"
                        className={inputCls}
                        placeholder="cái, hộp, kg..."
                      />
                      <datalist id="unit-list">
                        {UNITS.map((u) => <option key={u} value={u} />)}
                      </datalist>
                      {errors.unit && <p className={errorCls}>{errors.unit.message}</p>}
                    </div>
                  </div>

                  {/* Nhà cung cấp */}
                  <div className="space-y-1">
                    <label className={labelCls}>Nhà cung cấp</label>
                    <select {...register('supplierId')} className={inputCls}>
                      <option value="">— Không chọn —</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Barcode + Cân nặng */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className={labelCls}>Barcode / Mã vạch</label>
                      <input {...register('barcode')} className={inputCls} placeholder="VD: 8938500000001" />
                    </div>
                    <div className="space-y-1">
                      <label className={labelCls}>Cân nặng (gram)</label>
                      <input
                        {...register('weight')}
                        type="number"
                        min={0}
                        className={inputCls}
                        placeholder="VD: 200"
                      />
                    </div>
                  </div>

                  {/* Mô tả */}
                  <div className="space-y-1">
                    <label className={labelCls}>Mô tả</label>
                    <textarea
                      {...register('description')}
                      rows={3}
                      className={`${inputCls} resize-none`}
                      placeholder="Mô tả ngắn về sản phẩm..."
                    />
                  </div>

                  {/* Ảnh sản phẩm */}
                  <div className="space-y-2">
                    <label className={labelCls}>Ảnh sản phẩm</label>
                    <div className="flex flex-wrap gap-2">
                      {images.map((img, i) => (
                        <div key={i} className="group relative h-20 w-20 overflow-hidden rounded-lg border">
                          <img src={img} alt="" className="h-full w-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removeImage(i)}
                            className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100"
                          >
                            <Trash2 className="h-4 w-4 text-white" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => imageInputRef.current?.click()}
                        className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                      >
                        <ImagePlus className="h-5 w-5" />
                        <span className="text-xs">Thêm ảnh</span>
                      </button>
                    </div>
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleImageUpload}
                    />
                  </div>

                  {/* Trạng thái */}
                  <div className="flex items-center gap-3">
                    <input
                      {...register('isActive')}
                      type="checkbox"
                      id="isActive"
                      className="h-4 w-4 rounded border accent-primary"
                    />
                    <label htmlFor="isActive" className={labelCls}>
                      Đang kinh doanh (hiển thị trong đơn hàng)
                    </label>
                  </div>
                </div>
              )}

              {/* ============ TAB: BIẾN THỂ ============ */}
              {activeTab === 'variants' && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Thêm biến thể nếu sản phẩm có nhiều màu sắc, kích cỡ, v.v.
                    Nếu không thêm, sản phẩm sẽ ở dạng đơn (single variant).
                  </p>

                  {variants.length === 0 ? (
                    <div className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
                      Chưa có biến thể nào. Sản phẩm ở dạng đơn.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {variants.map((v, i) => (
                        <div key={i} className="rounded-lg border bg-muted/20 p-4">
                          <div className="mb-3 flex items-center justify-between">
                            <span className="text-sm font-medium text-muted-foreground">Biến thể #{i + 1}</span>
                            <div className="flex items-center gap-3">
                              <label className="flex items-center gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  checked={v.isActive}
                                  onChange={(e) => updateVariant(i, 'isActive', e.target.checked)}
                                  className="h-4 w-4 rounded border accent-primary"
                                />
                                Đang bán
                              </label>
                              <button
                                type="button"
                                onClick={() => removeVariant(i)}
                                className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-red-500"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-xs font-medium text-muted-foreground">
                                Tên biến thể <span className="text-red-500">*</span>
                              </label>
                              <input
                                value={v.name}
                                onChange={(e) => updateVariant(i, 'name', e.target.value)}
                                className={inputCls}
                                placeholder="VD: Đỏ - L"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-medium text-muted-foreground">
                                SKU biến thể <span className="text-red-500">*</span>
                              </label>
                              <input
                                value={v.sku}
                                onChange={(e) => updateVariant(i, 'sku', e.target.value)}
                                className={inputCls}
                                placeholder="VD: SP-001-RED-L"
                              />
                            </div>
                          </div>
                          {variantErrors[i] && (
                            <p className="mt-1 text-xs text-red-500">{variantErrors[i]}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={addVariant}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed py-2.5 text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    Thêm biến thể
                  </button>
                </div>
              )}

              {/* ============ TAB: KÊNH BÁN ============ */}
              {activeTab === 'channels' && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Tick chọn các kênh đang bán sản phẩm này. Nhập SKU trên sàn để dễ đối soát đơn.
                  </p>

                  {activeChannels.length === 0 ? (
                    <div className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
                      Chưa có kênh bán nào. Vui lòng thêm kênh trong mục Kênh bán hàng.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {activeChannels.map((ch) => {
                        const ci = channelInputs.find((c) => c.channelId === ch.id)
                        const isListed = ci?.isListed ?? false
                        return (
                          <div
                            key={ch.id}
                            className={`rounded-lg border p-4 transition-colors ${isListed ? 'border-primary/30 bg-primary/5' : 'bg-muted/10'}`}
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                id={`ch-${ch.id}`}
                                checked={isListed}
                                onChange={() => toggleChannel(ch.id)}
                                className="h-4 w-4 rounded border accent-primary"
                              />
                              <label
                                htmlFor={`ch-${ch.id}`}
                                className="flex items-center gap-2 cursor-pointer flex-1"
                              >
                                <ChannelBadge name={ch.name} color={ch.color} />
                              </label>
                            </div>
                            {isListed && (
                              <div className="mt-3 space-y-1 pl-7">
                                <label className="text-xs font-medium text-muted-foreground">
                                  SKU trên {ch.name} (External SKU)
                                </label>
                                <input
                                  value={ci?.externalSku ?? ''}
                                  onChange={(e) => updateChannelSku(ch.id, e.target.value)}
                                  className={inputCls}
                                  placeholder={`SKU trên ${ch.name}...`}
                                />
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-between items-center border-t px-6 py-4 shrink-0">
              {/* Tab navigation buttons */}
              <div className="flex gap-2">
                {activeTab !== 'info' && (
                  <button
                    type="button"
                    onClick={() => setActiveTab(activeTab === 'channels' ? 'variants' : 'info')}
                    className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
                  >
                    ← Trước
                  </button>
                )}
                {activeTab !== 'channels' && (
                  <button
                    type="button"
                    onClick={() => setActiveTab(activeTab === 'info' ? 'variants' : 'channels')}
                    className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
                  >
                    Tiếp →
                  </button>
                )}
              </div>

              <div className="flex gap-3">
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
                  {isSubmitting ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Thêm sản phẩm'}
                </button>
              </div>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
