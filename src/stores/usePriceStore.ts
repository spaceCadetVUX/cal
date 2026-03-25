import { create } from 'zustand'
import db from '@/db/db'
import { generateId } from '@/utils/idGenerator'
import type { PriceConfig } from '@/types'

// --------------- Types ---------------

export interface PriceConfigInput {
  productId: string
  variantId?: string
  channelId?: string       // undefined/null = base price
  sellingPrice: number
  minSellingPrice: number
  packagingCost: number
  otherCost: number
  minMarginPct: number
}

interface PriceStore {
  configs: PriceConfig[]
  // Giá vốn mới nhất per product/variant: key = `productId|variantId`
  latestCostPrices: Record<string, number>
  loading: boolean

  load: () => Promise<void>
  // Upsert: nếu đã có config cho cùng (productId, variantId, channelId) → update; chưa có → tạo mới
  upsert: (input: PriceConfigInput) => Promise<PriceConfig>
  remove: (id: string) => Promise<void>

  // Lấy costPrice mới nhất từ ImportItem (qua batch có status=received, importDate mới nhất)
  getLatestCostPrice: (productId: string, variantId?: string) => Promise<number | null>

  // Sync cost prices vào store (gọi sau load hoặc sau khi confirm batch)
  refreshCostPrices: (productIds?: string[]) => Promise<void>

  // Lấy config hiệu quả nhất (channel-specific > base) — SYNC từ in-memory
  getEffectiveConfig: (productId: string, variantId?: string | null, channelId?: string | null) => PriceConfig | null
}

// --------------- Store ---------------

export const usePriceStore = create<PriceStore>((set, get) => ({
  configs: [],
  latestCostPrices: {},
  loading: false,

  load: async () => {
    set({ loading: true })
    const configs = await db.priceConfigs.orderBy('effectiveFrom').reverse().toArray()
    set({ configs, loading: false })
    // Tải cost prices cho tất cả products có config
    const productIds = [...new Set(configs.map((c) => c.productId))]
    await get().refreshCostPrices(productIds)
  },

  upsert: async (input) => {
    const now = new Date()
    // Tìm config hiện tại cho cùng key
    const existing = get().configs.find(
      (c) =>
        c.productId === input.productId &&
        (c.variantId ?? undefined) === (input.variantId ?? undefined) &&
        (c.channelId ?? undefined) === (input.channelId ?? undefined),
    )

    if (existing) {
      const patch: Partial<PriceConfig> = {
        sellingPrice: input.sellingPrice,
        minSellingPrice: input.minSellingPrice,
        packagingCost: input.packagingCost,
        otherCost: input.otherCost,
        minMarginPct: input.minMarginPct,
        effectiveFrom: now,
      }
      await db.priceConfigs.update(existing.id, patch)
      const updated = { ...existing, ...patch }
      set((s) => ({
        configs: s.configs.map((c) => (c.id === existing.id ? updated : c)),
      }))
      return updated
    } else {
      const config: PriceConfig = {
        id: generateId(),
        productId: input.productId,
        variantId: input.variantId,
        channelId: input.channelId,
        sellingPrice: input.sellingPrice,
        minSellingPrice: input.minSellingPrice,
        packagingCost: input.packagingCost,
        otherCost: input.otherCost,
        minMarginPct: input.minMarginPct,
        effectiveFrom: now,
        createdAt: now,
      }
      await db.priceConfigs.add(config)
      set((s) => ({ configs: [config, ...s.configs] }))
      return config
    }
  },

  remove: async (id) => {
    await db.priceConfigs.delete(id)
    set((s) => ({ configs: s.configs.filter((c) => c.id !== id) }))
  },

  getLatestCostPrice: async (productId, variantId) => {
    // Lấy tất cả ImportBatches đã nhận, sort theo importDate desc
    const batches = await db.importBatches
      .where('status')
      .equals('received')
      .sortBy('importDate')
    batches.reverse()

    for (const batch of batches) {
      const item = await db.importItems
        .where('batchId')
        .equals(batch.id)
        .filter(
          (i) =>
            i.productId === productId &&
            (i.variantId ?? undefined) === (variantId ?? undefined),
        )
        .first()
      if (item) return item.costPrice
    }
    return null
  },

  refreshCostPrices: async (productIds) => {
    const ids = productIds ?? [
      ...new Set(get().configs.map((c) => c.productId)),
    ]
    if (ids.length === 0) return

    const entries = await Promise.all(
      ids.map(async (pid) => {
        const cost = await get().getLatestCostPrice(pid)
        return [pid, cost] as const
      }),
    )

    const updates = Object.fromEntries(
      entries.filter(([, cost]) => cost !== null) as [string, number][],
    )

    set((s) => ({ latestCostPrices: { ...s.latestCostPrices, ...updates } }))
  },

  getEffectiveConfig: (productId, variantId, channelId) => {
    const { configs } = get()
    const vid = variantId ?? undefined
    const cid = channelId ?? undefined

    // Channel-specific → base
    const channelConfig = cid
      ? configs.find(
          (c) =>
            c.productId === productId &&
            (c.variantId ?? undefined) === vid &&
            c.channelId === cid,
        )
      : undefined

    if (channelConfig) return channelConfig

    // Base price (channelId = null/undefined)
    return (
      configs.find(
        (c) =>
          c.productId === productId &&
          (c.variantId ?? undefined) === vid &&
          !c.channelId,
      ) ?? null
    )
  },
}))
