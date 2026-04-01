import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { AlertTriangle, ArrowLeft, Pencil, Package, ToggleLeft, ToggleRight } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { PageLayout } from '@/components/layout/PageLayout'
import { ChannelBadge } from '@/components/shared/ChannelBadge'
import { ProductFormDialog } from './ProductFormDialog'
import { useProductStore, type ProductDetail } from '@/stores/useProductStore'
import { useChannelStore } from '@/stores/useChannelStore'
import { useCategoryStore } from '@/stores/useCategoryStore'
import { useSupplierStore } from '@/stores/useSupplierStore'
import { useInventoryStore } from '@/stores/useInventoryStore'
import { usePriceStore } from '@/stores/usePriceStore'
import { formatDate, formatVND } from '@/utils/formatters'
import db from '@/db/db'
import type { InventoryWithProduct } from '@/stores/useInventoryStore'
import type { Product, PriceConfig, SalesChannel, StockMovement } from '@/types'

// --------------- Component ---------------

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { products, toggleActive, getDetail } = useProductStore()
  const { channels } = useChannelStore()
  const { categories } = useCategoryStore()
  const { suppliers } = useSupplierStore()
  const { items: inventoryItems, load: loadInventory } = useInventoryStore()
  const { configs: priceConfigs, latestCostPrices, load: loadPrices } = usePriceStore()

  const [product, setProduct] = useState<Product | null | undefined>(undefined) // undefined = loading
  const [detail, setDetail] = useState<ProductDetail | null>(null)
  const [editOpen, setEditOpen] = useState(false)

  // Resolve product từ store (fast) hoặc DB (direct navigation)
  useEffect(() => {
    if (!id) return
    const fromStore = products.find((p) => p.id === id)
    if (fromStore) {
      setProduct(fromStore)
    } else {
      db.products.get(id).then((p) => setProduct(p ?? null))
    }
  }, [id, products])

  // Load variants + channel infos
  useEffect(() => {
    if (!id) return
    getDetail(id).then(setDetail)
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Ensure inventory + price data is loaded
  useEffect(() => {
    if (inventoryItems.length === 0) loadInventory()
    if (priceConfigs.length === 0) loadPrices()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggleActive = async () => {
    if (!product) return
    try {
      await toggleActive(product.id)
      toast.success(product.isActive ? 'Đã ngừng kinh doanh' : 'Đã kích hoạt trở lại')
    } catch {
      toast.error('Cập nhật thất bại')
    }
  }

  // Helpers
  const getCategoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? '—'
  const getSupplierName = (id?: string) => (id ? (suppliers.find((s) => s.id === id)?.name ?? '—') : '—')
  const getChannel = (id: string) => channels.find((c) => c.id === id)

  // --------------- Render ---------------

  if (product === undefined) {
    return (
      <PageLayout title="Sản phẩm">
        <p className="text-muted-foreground">Đang tải...</p>
      </PageLayout>
    )
  }

  if (product === null) {
    return (
      <PageLayout title="Không tìm thấy">
        <p className="text-muted-foreground">Sản phẩm không tồn tại.</p>
        <button
          onClick={() => navigate('/products')}
          className="mt-4 text-sm text-primary hover:underline"
        >
          ← Quay lại danh sách
        </button>
      </PageLayout>
    )
  }

  const listedChannels = (detail?.channelInfos ?? []).filter((ci) => ci.isListed)
  const activeVariants = (detail?.variants ?? []).filter((v) => v.isActive)
  const inactiveVariants = (detail?.variants ?? []).filter((v) => !v.isActive)

  return (
    <PageLayout
      title={product.name}
      action={
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/products')}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" />
            Danh sách
          </button>
          <button
            onClick={handleToggleActive}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            {product.isActive ? (
              <>
                <ToggleRight className="h-4 w-4 text-green-500" />
                Đang kinh doanh
              </>
            ) : (
              <>
                <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                Ngừng kinh doanh
              </>
            )}
          </button>
          <button
            onClick={() => setEditOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <Pencil className="h-4 w-4" />
            Sửa
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* ---- Thông tin chung ---- */}
        <div className="rounded-xl border bg-card p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Thông tin sản phẩm
          </h3>

          {/* Ảnh sản phẩm */}
          {product.images && product.images.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {product.images.map((img, i) => (
                <img
                  key={i}
                  src={img}
                  alt=""
                  className="h-20 w-20 rounded-lg border object-cover"
                />
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-x-8 gap-y-2.5 text-sm">
            <InfoRow label="SKU" value={<span className="font-mono font-medium">{product.sku}</span>} />
            <InfoRow
              label="Trạng thái"
              value={
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                    product.isActive
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {product.isActive ? 'Đang kinh doanh' : 'Ngừng kinh doanh'}
                </span>
              }
            />
            <InfoRow label="Danh mục" value={getCategoryName(product.categoryId)} />
            <InfoRow label="Nhà cung cấp" value={getSupplierName(product.supplierId)} />
            <InfoRow label="Đơn vị" value={product.unit} />
            {product.barcode && <InfoRow label="Barcode" value={product.barcode} />}
            {product.weight && <InfoRow label="Cân nặng" value={`${product.weight} gram`} />}
            <InfoRow label="Ngày tạo" value={formatDate(product.createdAt)} />
            <InfoRow label="Cập nhật" value={formatDate(product.updatedAt)} />
            {product.description && (
              <div className="col-span-2">
                <InfoRow label="Mô tả" value={product.description} />
              </div>
            )}
          </div>
        </div>

        {/* ---- Biến thể ---- */}
        <div className="rounded-xl border bg-card p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Biến thể
            {detail?.variants && detail.variants.length > 0 && (
              <span className="ml-2 font-normal normal-case text-foreground">
                ({detail.variants.length})
              </span>
            )}
          </h3>

          {detail === null ? (
            <p className="text-sm text-muted-foreground">Đang tải...</p>
          ) : detail.variants.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Package className="h-4 w-4" />
              Sản phẩm đơn (không có biến thể)
            </div>
          ) : (
            <div className="space-y-2">
              {activeVariants.map((v) => (
                <div key={v.id} className="flex items-center justify-between rounded-lg border px-4 py-2.5 text-sm">
                  <div>
                    <span className="font-medium">{v.name}</span>
                    <span className="ml-3 font-mono text-xs text-muted-foreground">{v.sku}</span>
                  </div>
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    Đang bán
                  </span>
                </div>
              ))}
              {inactiveVariants.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between rounded-lg border px-4 py-2.5 text-sm opacity-60"
                >
                  <div>
                    <span className="font-medium">{v.name}</span>
                    <span className="ml-3 font-mono text-xs text-muted-foreground">{v.sku}</span>
                  </div>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    Ngừng bán
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ---- Kênh bán ---- */}
        <div className="rounded-xl border bg-card p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Kênh bán hàng
            {listedChannels.length > 0 && (
              <span className="ml-2 font-normal normal-case text-foreground">
                ({listedChannels.length} kênh)
              </span>
            )}
          </h3>

          {detail === null ? (
            <p className="text-sm text-muted-foreground">Đang tải...</p>
          ) : listedChannels.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa đăng bán trên kênh nào.</p>
          ) : (
            <div className="space-y-2">
              {listedChannels.map((ci) => {
                const ch = getChannel(ci.channelId)
                if (!ch) return null
                return (
                  <div key={ci.id} className="flex items-center gap-4 rounded-lg border px-4 py-2.5 text-sm">
                    <ChannelBadge name={ch.name} color={ch.color} />
                    {ci.externalSku ? (
                      <span className="text-muted-foreground">
                        External SKU:{' '}
                        <span className="font-mono text-foreground">{ci.externalSku}</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ---- Tồn kho ---- */}
        <InventorySection productId={product.id} inventoryItems={inventoryItems} />

        {/* ---- Giá theo kênh ---- */}
        <PricingSection
          productId={product.id}
          priceConfigs={priceConfigs}
          latestCostPrices={latestCostPrices}
          channels={channels}
        />

        {/* ---- Lịch sử bán hàng ---- */}
        <SalesHistorySection productId={product.id} channels={channels} />
      </div>

      <ProductFormDialog open={editOpen} onClose={() => setEditOpen(false)} editing={product} />
    </PageLayout>
  )
}

// --------------- Small helpers ---------------

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <span className="w-32 shrink-0 text-muted-foreground">{label}</span>
      <span className="font-medium">{typeof value === 'string' ? value || '—' : value}</span>
    </div>
  )
}

// --------------- Inventory section ---------------

function InventorySection({
  productId,
  inventoryItems,
}: {
  productId: string
  inventoryItems: InventoryWithProduct[]
}) {
  const rows = inventoryItems.filter((i) => i.record.productId === productId)

  return (
    <div className="rounded-xl border bg-card p-5">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Tồn kho
      </h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Chưa có dữ liệu tồn kho.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="pb-2 font-medium text-muted-foreground">Biến thể</th>
              <th className="pb-2 text-right font-medium text-muted-foreground">Tổng kho</th>
              <th className="pb-2 text-right font-medium text-muted-foreground">Dự trữ</th>
              <th className="pb-2 text-right font-medium text-muted-foreground">Khả dụng</th>
              <th className="pb-2 text-right font-medium text-muted-foreground">Cảnh báo</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map(({ record, variantName, availableQty, isLow }) => (
              <tr key={record.id} className="hover:bg-muted/20">
                <td className="py-2.5">{variantName ?? '—'}</td>
                <td className="py-2.5 text-right tabular-nums">{record.quantity}</td>
                <td className="py-2.5 text-right tabular-nums text-muted-foreground">
                  {record.reservedQty}
                </td>
                <td
                  className={`py-2.5 text-right tabular-nums font-medium ${
                    availableQty === 0
                      ? 'text-red-500'
                      : isLow
                        ? 'text-yellow-600 dark:text-yellow-400'
                        : 'text-green-600 dark:text-green-400'
                  }`}
                >
                  {availableQty}
                </td>
                <td className="py-2.5 text-right">
                  {isLow && (
                    <span className="inline-flex items-center gap-1 text-xs text-yellow-600 dark:text-yellow-400">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Sắp hết ({record.lowStockAlert})
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// --------------- Sales history section ---------------

function SalesHistorySection({ productId, channels }: { productId: string; channels: SalesChannel[] }) {
  const [movements, setMovements] = useState<StockMovement[]>([])

  useEffect(() => {
    db.stockMovements
      .where('productId')
      .equals(productId)
      .filter((m) => m.type === 'sale')
      .toArray()
      .then(setMovements)
  }, [productId])

  if (movements.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-5">
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Lịch sử bán hàng
        </h3>
        <p className="text-sm text-muted-foreground">Chưa có dữ liệu bán hàng.</p>
      </div>
    )
  }

  // Group by month + channelId
  const channelMap = Object.fromEntries(channels.map((c) => [c.id, c]))
  const channelIds = [...new Set(movements.map((m) => m.channelId).filter(Boolean))] as string[]

  const byMonth: Record<string, Record<string, number>> = {}
  for (const m of movements) {
    const d = new Date(m.createdAt)
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (!byMonth[monthKey]) byMonth[monthKey] = {}
    const chId = m.channelId ?? 'unknown'
    byMonth[monthKey][chId] = (byMonth[monthKey][chId] ?? 0) + Math.abs(m.quantity)
  }

  const data = Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, counts]) => ({ month, ...counts }))

  return (
    <div className="rounded-xl border bg-card p-5">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Lịch sử bán hàng
      </h3>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
          <Tooltip
            formatter={(value, name) => {
              const chName = channelMap[String(name)]?.name ?? String(name)
              return [String(value), chName] as [string, string]
            }}
          />
          <Legend
            formatter={(value) => channelMap[value]?.name ?? value}
            wrapperStyle={{ fontSize: 12 }}
          />
          {channelIds.map((chId) => {
            const ch = channelMap[chId]
            return (
              <Bar
                key={chId}
                dataKey={chId}
                stackId="a"
                fill={ch?.color ?? '#6b7280'}
                name={chId}
              />
            )
          })}
          {movements.some((m) => !m.channelId) && (
            <Bar dataKey="unknown" stackId="a" fill="#9ca3af" name="unknown" />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// --------------- Pricing section ---------------

function PricingSection({
  productId,
  priceConfigs,
  latestCostPrices,
  channels,
}: {
  productId: string
  priceConfigs: PriceConfig[]
  latestCostPrices: Record<string, number>
  channels: SalesChannel[]
}) {
  const rows = priceConfigs.filter((c) => c.productId === productId)
  const costPrice = latestCostPrices[productId] ?? null
  const channelMap = Object.fromEntries(channels.map((c) => [c.id, c]))

  return (
    <div className="rounded-xl border bg-card p-5">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Giá theo kênh
      </h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Chưa cấu hình giá.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="pb-2 font-medium text-muted-foreground">Kênh</th>
              <th className="pb-2 text-right font-medium text-muted-foreground">Giá bán</th>
              <th className="pb-2 text-right font-medium text-muted-foreground">Giá vốn</th>
              <th className="pb-2 text-right font-medium text-muted-foreground">Lợi nhuận</th>
              <th className="pb-2 text-right font-medium text-muted-foreground">Biên LN</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((cfg) => {
              const ch = cfg.channelId ? channelMap[cfg.channelId] : null
              const cost = costPrice ?? 0
              const grossProfit = cfg.sellingPrice - cost - cfg.packagingCost - cfg.otherCost
              const marginPct =
                cfg.sellingPrice > 0 ? (grossProfit / cfg.sellingPrice) * 100 : 0
              const isBelowMin = marginPct < cfg.minMarginPct

              return (
                <tr key={cfg.id} className="hover:bg-muted/20">
                  <td className="py-2.5">
                    {ch ? (
                      <span
                        className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium"
                        style={{ background: ch.color + '22', color: ch.color }}
                      >
                        {ch.name}
                      </span>
                    ) : (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        Base
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 text-right tabular-nums font-medium">
                    {formatVND(cfg.sellingPrice)}
                  </td>
                  <td className="py-2.5 text-right tabular-nums text-muted-foreground">
                    {costPrice !== null ? formatVND(cost) : '—'}
                  </td>
                  <td className="py-2.5 text-right tabular-nums">
                    {costPrice !== null ? formatVND(grossProfit) : '—'}
                  </td>
                  <td className="py-2.5 text-right tabular-nums">
                    <span
                      className={`inline-flex items-center gap-1 font-medium ${
                        isBelowMin
                          ? 'text-red-500'
                          : marginPct < 20
                            ? 'text-yellow-600 dark:text-yellow-400'
                            : 'text-green-600 dark:text-green-400'
                      }`}
                    >
                      {isBelowMin && <AlertTriangle className="h-3.5 w-3.5" />}
                      {marginPct.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
