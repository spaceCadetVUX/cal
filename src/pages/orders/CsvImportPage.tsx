// ============================================================
// CsvImportPage.tsx — Import đơn hàng từ CSV Shopee / Lazada
// ============================================================

import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Upload, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { PageLayout } from '@/components/layout/PageLayout'
import { useOrderStore } from '@/stores/useOrderStore'
import { useChannelStore } from '@/stores/useChannelStore'
import { parseCsvOrders } from '@/utils/csvOrderParser'
import type { CsvOrder } from '@/utils/csvOrderParser'
import { formatVND, formatDate } from '@/utils/formatters'
import db from '@/db/db'
import type { Product, ProductVariant } from '@/types'

// --------------- Types ---------------

interface SkuMapping {
  externalSku: string
  productId: string
  variantId?: string
  productName: string
  variantName?: string
  costPrice: number
}

interface MappedOrderItem {
  externalSku: string
  productName: string
  quantity: number
  unitPrice: number
  mapping: SkuMapping | null
}

interface MappedOrder {
  csv: CsvOrder
  items: MappedOrderItem[]
  fullyMapped: boolean
}

type Step = 'upload' | 'preview' | 'done'

// --------------- Helpers ---------------

async function getLatestCostPrice(productId: string, variantId?: string): Promise<number> {
  const items = await db.importItems
    .where('productId')
    .equals(productId)
    .filter((i) => i.variantId === variantId)
    .toArray()
  if (items.length === 0) return 0
  // get from latest batch
  const batches = await db.importBatches.toArray()
  const batchDateMap = Object.fromEntries(batches.map((b) => [b.id, b.importDate]))
  items.sort((a, b) => {
    const da = batchDateMap[a.batchId]?.getTime() ?? 0
    const db2 = batchDateMap[b.batchId]?.getTime() ?? 0
    return db2 - da
  })
  return items[0].costPrice
}

async function buildSkuMappings(
  channelId: string,
  externalSkus: string[],
): Promise<Map<string, SkuMapping>> {
  const result = new Map<string, SkuMapping>()

  // 1. Look up via ProductChannelInfo.externalSku for this channel
  const channelInfos = await db.productChannelInfos
    .where('channelId')
    .equals(channelId)
    .toArray()

  const allProducts = await db.products.toArray()
  const allVariants = await db.productVariants.toArray()
  const productMap = Object.fromEntries(allProducts.map((p) => [p.id, p]))
  const variantMap = Object.fromEntries(allVariants.map((v) => [v.id, v]))

  for (const info of channelInfos) {
    if (!info.externalSku) continue
    const extSku = info.externalSku.trim().toLowerCase()
    if (!externalSkus.some((s) => s.trim().toLowerCase() === extSku)) continue
    const product = productMap[info.productId]
    if (!product) continue
    const variant = info.variantId ? variantMap[info.variantId] : undefined
    const costPrice = await getLatestCostPrice(info.productId, info.variantId)
    const originalSku = externalSkus.find((s) => s.trim().toLowerCase() === extSku) ?? info.externalSku
    result.set(originalSku, {
      externalSku: originalSku,
      productId: info.productId,
      variantId: info.variantId,
      productName: product.name,
      variantName: variant?.name,
      costPrice,
    })
  }

  // 2. Fallback: match by product.sku or variant.sku
  for (const extSku of externalSkus) {
    if (result.has(extSku)) continue
    const key = extSku.trim().toLowerCase()
    const matchedProduct = allProducts.find((p) => p.sku.toLowerCase() === key)
    if (matchedProduct) {
      const costPrice = await getLatestCostPrice(matchedProduct.id)
      result.set(extSku, {
        externalSku: extSku,
        productId: matchedProduct.id,
        productName: matchedProduct.name,
        costPrice,
      })
      continue
    }
    const matchedVariant = allVariants.find((v) => v.sku.toLowerCase() === key)
    if (matchedVariant) {
      const product = productMap[matchedVariant.productId]
      if (product) {
        const costPrice = await getLatestCostPrice(matchedVariant.productId, matchedVariant.id)
        result.set(extSku, {
          externalSku: extSku,
          productId: matchedVariant.productId,
          variantId: matchedVariant.id,
          productName: product.name,
          variantName: matchedVariant.name,
          costPrice,
        })
      }
    }
  }

  return result
}

// --------------- Component ---------------

export default function CsvImportPage() {
  const navigate = useNavigate()
  const { channels, load: loadChannels } = useChannelStore()
  const { createOrder } = useOrderStore()

  const [step, setStep] = useState<Step>('upload')
  const [channelId, setChannelId] = useState('')
  const [fileName, setFileName] = useState('')
  const [parsing, setParsing] = useState(false)
  const [mappedOrders, setMappedOrders] = useState<MappedOrder[]>([])
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [allVariants, setAllVariants] = useState<ProductVariant[]>([])
  const [manualMappings, setManualMappings] = useState<Record<string, string>>({}) // externalSku → productId:variantId?
  const [importing, setImporting] = useState(false)
  const [importResults, setImportResults] = useState<{ success: number; failed: number }>({ success: 0, failed: 0 })
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadChannels()
    Promise.all([db.products.toArray(), db.productVariants.toArray()]).then(([prods, vars]) => {
      setAllProducts(prods)
      setAllVariants(vars)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleFile = useCallback(
    async (file: File) => {
      if (!channelId) { toast.error('Chọn kênh bán trước'); return }
      setFileName(file.name)
      setParsing(true)
      try {
        const text = await file.text()
        const result = parseCsvOrders(text)

        if (result.errors.length > 0 && result.orders.length === 0) {
          toast.error(result.errors[0])
          return
        }

        // Collect all externalSkus
        const allSkus = [...new Set(result.orders.flatMap((o) => o.items.map((i) => i.externalSku)))]
        const skuMap = await buildSkuMappings(channelId, allSkus)

        const mapped: MappedOrder[] = result.orders.map((order) => {
          const items: MappedOrderItem[] = order.items.map((item) => ({
            externalSku: item.externalSku,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            mapping: skuMap.get(item.externalSku) ?? null,
          }))
          return {
            csv: order,
            items,
            fullyMapped: items.every((i) => i.mapping !== null),
          }
        })

        setMappedOrders(mapped)
        if (result.errors.length > 0) toast.warning(result.errors[0])
        else toast.success(`Đọc ${result.orders.length} đơn hàng từ ${result.format.toUpperCase()}`)
        setStep('preview')
      } catch (e) {
        toast.error(`Lỗi đọc file: ${e}`)
      } finally {
        setParsing(false)
      }
    },
    [channelId],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile],
  )

  const resolveMapping = (externalSku: string): SkuMapping | null => {
    const manual = manualMappings[externalSku]
    if (!manual) return null
    const [productId, variantId] = manual.split(':')
    const product = allProducts.find((p) => p.id === productId)
    if (!product) return null
    const variant = variantId ? allVariants.find((v) => v.id === variantId) : undefined
    return {
      externalSku,
      productId,
      variantId: variantId || undefined,
      productName: product.name,
      variantName: variant?.name,
      costPrice: 0, // manual mapping — no cost price, will be 0
    }
  }

  const getEffectiveMapping = (item: MappedOrderItem): SkuMapping | null => {
    return item.mapping ?? resolveMapping(item.externalSku)
  }

  // Unique unmapped SKUs for manual mapping UI
  const unmappedSkus = [
    ...new Set(
      mappedOrders
        .flatMap((o) => o.items)
        .filter((i) => i.mapping === null)
        .map((i) => i.externalSku),
    ),
  ]

  const readyOrders = mappedOrders.filter((o) =>
    o.items.every((i) => getEffectiveMapping(i) !== null),
  )

  const handleImport = async () => {
    if (readyOrders.length === 0) { toast.error('Không có đơn nào sẵn sàng import'); return }
    setImporting(true)
    let success = 0
    let failed = 0
    for (const mo of readyOrders) {
      try {
        const items = mo.items.map((item) => {
          const m = getEffectiveMapping(item)!
          return {
            productId: m.productId,
            variantId: m.variantId,
            quantity: item.quantity,
            sellingPrice: item.unitPrice,
            costPrice: m.costPrice,
            packagingCost: 0,
            otherCost: 0,
          }
        })
        await createOrder({
          channelId,
          externalOrderId: mo.csv.externalOrderId,
          orderDate: mo.csv.orderDate,
          paymentMethod: 'cod',
          buyerShippingFee: mo.csv.shippingFee,
          sellerShippingFee: 0,
          shippingSubsidy: 0,
          discountAmount: 0,
          items,
        })
        success++
      } catch {
        failed++
      }
    }
    setImportResults({ success, failed })
    setStep('done')
    setImporting(false)
  }

  const selectCls = 'rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring'

  // --------------- STEP: DONE ---------------
  if (step === 'done') {
    return (
      <PageLayout title="Import CSV">
        <div className="flex flex-col items-center gap-4 py-16">
          <CheckCircle2 className="h-12 w-12 text-green-500" />
          <h2 className="text-xl font-semibold">Import hoàn tất</h2>
          <p className="text-muted-foreground text-sm">
            Thành công: <span className="font-medium text-green-600">{importResults.success}</span> đơn
            {importResults.failed > 0 && (
              <> · Lỗi: <span className="font-medium text-red-600">{importResults.failed}</span> đơn</>
            )}
          </p>
          <button
            onClick={() => navigate('/orders')}
            className="rounded-lg bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Xem danh sách đơn hàng
          </button>
        </div>
      </PageLayout>
    )
  }

  // --------------- STEP: PREVIEW ---------------
  if (step === 'preview') {
    return (
      <PageLayout
        title="Import CSV — Xem trước"
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setStep('upload')}
              className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted"
            >
              <ArrowLeft className="h-4 w-4" />
              Quay lại
            </button>
            <button
              onClick={handleImport}
              disabled={importing || readyOrders.length === 0}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {importing && <Loader2 className="h-4 w-4 animate-spin" />}
              Import {readyOrders.length}/{mappedOrders.length} đơn
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Summary */}
          <div className="rounded-xl border bg-card p-4 flex flex-wrap gap-6 text-sm">
            <div><span className="text-muted-foreground">Tổng đơn: </span><span className="font-medium">{mappedOrders.length}</span></div>
            <div><span className="text-muted-foreground">Sẵn sàng: </span><span className="font-medium text-green-600">{readyOrders.length}</span></div>
            <div><span className="text-muted-foreground">Cần map: </span><span className="font-medium text-red-600">{mappedOrders.length - readyOrders.length}</span></div>
          </div>

          {/* Manual mapping for unmapped SKUs */}
          {unmappedSkus.length > 0 && (
            <div className="rounded-xl border bg-card p-4 space-y-3">
              <h3 className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                <AlertCircle className="inline h-4 w-4 mr-1" />
                Cần ánh xạ SKU ({unmappedSkus.length})
              </h3>
              {unmappedSkus.map((sku) => (
                <div key={sku} className="flex items-center gap-3 flex-wrap">
                  <code className="rounded bg-muted px-2 py-0.5 text-xs font-mono flex-shrink-0 max-w-48 truncate" title={sku}>{sku}</code>
                  <select
                    value={manualMappings[sku] ?? ''}
                    onChange={(e) => setManualMappings((prev) => ({ ...prev, [sku]: e.target.value }))}
                    className={`${selectCls} flex-1 min-w-40`}
                  >
                    <option value="">— Chọn sản phẩm —</option>
                    {allProducts.map((p) => {
                      const variants = allVariants.filter((v) => v.productId === p.id)
                      if (variants.length === 0) {
                        return <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                      }
                      return variants.map((v) => (
                        <option key={`${p.id}:${v.id}`} value={`${p.id}:${v.id}`}>
                          {p.name} — {v.name} ({v.sku})
                        </option>
                      ))
                    })}
                  </select>
                </div>
              ))}
            </div>
          )}

          {/* Order list */}
          <div className="space-y-3">
            {mappedOrders.map((mo) => {
              const isReady = mo.items.every((i) => getEffectiveMapping(i) !== null)
              return (
                <div key={mo.csv.externalOrderId} className="rounded-xl border bg-card overflow-hidden">
                  <div className={`px-4 py-2.5 flex items-center justify-between border-b ${isReady ? 'bg-green-50 dark:bg-green-950/20' : 'bg-amber-50 dark:bg-amber-950/20'}`}>
                    <div className="flex items-center gap-2">
                      {isReady
                        ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                        : <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                      }
                      <span className="font-mono text-sm font-medium">{mo.csv.externalOrderId}</span>
                      <span className="text-xs text-muted-foreground">{formatDate(mo.csv.orderDate)}</span>
                    </div>
                    <div className="text-sm font-medium">{formatVND(mo.csv.totalAmount)}</div>
                  </div>
                  <div className="divide-y">
                    {mo.items.map((item, idx) => {
                      const mapping = getEffectiveMapping(item)
                      return (
                        <div key={idx} className="px-4 py-2 flex items-center gap-4 text-sm">
                          <code className="text-xs font-mono text-muted-foreground w-32 truncate flex-shrink-0" title={item.externalSku}>{item.externalSku}</code>
                          <span className="flex-1 min-w-0">
                            {mapping
                              ? <span className="text-green-700 dark:text-green-400">{mapping.productName}{mapping.variantName ? ` — ${mapping.variantName}` : ''}</span>
                              : <span className="text-amber-700 dark:text-amber-400 italic">Chưa ánh xạ</span>
                            }
                          </span>
                          <span className="text-muted-foreground shrink-0">×{item.quantity}</span>
                          <span className="tabular-nums shrink-0">{formatVND(item.unitPrice)}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </PageLayout>
    )
  }

  // --------------- STEP: UPLOAD ---------------
  return (
    <PageLayout
      title="Import CSV đơn hàng"
      action={
        <button
          onClick={() => navigate('/orders')}
          className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại
        </button>
      }
    >
      <div className="max-w-lg space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium">Kênh bán</label>
          <select
            value={channelId}
            onChange={(e) => setChannelId(e.target.value)}
            className={`${selectCls} w-full`}
          >
            <option value="">— Chọn kênh —</option>
            {channels.filter((c) => c.isActive).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
          className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-12 cursor-pointer transition-colors ${
            channelId ? 'hover:border-primary hover:bg-primary/5' : 'opacity-50 cursor-not-allowed'
          }`}
        >
          {parsing
            ? <Loader2 className="h-8 w-8 animate-spin text-primary" />
            : <Upload className="h-8 w-8 text-muted-foreground" />
          }
          <div className="text-center">
            <p className="text-sm font-medium">{fileName || 'Kéo thả hoặc click để chọn file CSV'}</p>
            <p className="text-xs text-muted-foreground mt-1">Hỗ trợ: Shopee, Lazada (.csv)</p>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleFile(f)
            e.target.value = ''
          }}
        />
      </div>
    </PageLayout>
  )
}
