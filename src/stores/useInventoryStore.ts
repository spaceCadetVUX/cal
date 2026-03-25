import { create } from 'zustand'
import db from '@/db/db'
import { generateId } from '@/utils/idGenerator'
import { calcAvailableQty, isLowStock } from '@/utils/inventoryHelper'
import type { InventoryRecord, StockMovement, Product } from '@/types'

// --------------- Types ---------------

export interface InventoryWithProduct {
  record: InventoryRecord
  product: Product
  variantName?: string   // tên biến thể nếu có
  availableQty: number   // COMPUTED: quantity - reservedQty
  isLow: boolean         // COMPUTED: availableQty <= lowStockAlert
}

export interface AdjustParams {
  productId: string
  variantId?: string
  delta: number    // dương = nhập thêm, âm = trừ
  note?: string
}

export interface MovementWithProduct extends StockMovement {
  productName: string
  variantName?: string
}

interface InventoryStore {
  items: InventoryWithProduct[]
  loading: boolean
  load: () => Promise<void>
  adjust: (params: AdjustParams) => Promise<void>
  // Lấy lịch sử biến động, kèm tên SP
  loadMovements: (filters?: {
    productId?: string
    type?: string
    limit?: number
  }) => Promise<MovementWithProduct[]>
}

// --------------- Store ---------------

export const useInventoryStore = create<InventoryStore>((set) => ({
  items: [],
  loading: false,

  load: async () => {
    set({ loading: true })
    const [records, products, variants] = await Promise.all([
      db.inventoryRecords.toArray(),
      db.products.toArray(),
      db.productVariants.toArray(),
    ])

    const productMap = Object.fromEntries(products.map((p) => [p.id, p]))
    const variantMap = Object.fromEntries(variants.map((v) => [v.id, v]))

    const items: InventoryWithProduct[] = records
      .map((record) => {
        const product = productMap[record.productId]
        if (!product) return null
        const variant = record.variantId ? variantMap[record.variantId] : undefined
        return {
          record,
          product,
          variantName: variant?.name,
          availableQty: calcAvailableQty(record),
          isLow: isLowStock(record),
        }
      })
      .filter((x): x is InventoryWithProduct => x !== null)
      // Sort: low stock first, then by product name
      .sort((a, b) => {
        if (a.isLow !== b.isLow) return a.isLow ? -1 : 1
        return a.product.name.localeCompare(b.product.name, 'vi')
      })

    set({ items, loading: false })
  },

  adjust: async ({ productId, variantId, delta, note }) => {
    if (delta === 0) return
    const now = new Date()

    await db.transaction('rw', [db.inventoryRecords, db.stockMovements], async () => {
      const existing = await db.inventoryRecords
        .where('productId')
        .equals(productId)
        .filter((r) => r.variantId === variantId)
        .first()

      if (existing) {
        const newQty = Math.max(0, existing.quantity + delta)
        await db.inventoryRecords.update(existing.id, { quantity: newQty, updatedAt: now })
      } else if (delta > 0) {
        // Tạo mới nếu chưa có (chỉ khi thêm)
        const settings = await db.appSettings.toCollection().first()
        await db.inventoryRecords.add({
          id: generateId(),
          productId,
          variantId,
          quantity: delta,
          reservedQty: 0,
          lowStockAlert: settings?.defaultLowStockAlert ?? 5,
          updatedAt: now,
        })
      }

      await db.stockMovements.add({
        id: generateId(),
        productId,
        variantId,
        type: 'adjustment',
        quantity: delta,
        note: note || undefined,
        createdAt: now,
      })
    })

    // Reload để phản ánh thay đổi
    const updated = await db.inventoryRecords
      .where('productId')
      .equals(productId)
      .filter((r) => r.variantId === variantId)
      .first()

    if (updated) {
      set((s) => ({
        items: s.items.map((item) =>
          item.record.id === updated.id
            ? {
                ...item,
                record: updated,
                availableQty: calcAvailableQty(updated),
                isLow: isLowStock(updated),
              }
            : item,
        ),
      }))
    }
  },

  loadMovements: async (filters = {}) => {
    const { productId, type, limit = 200 } = filters
    const [products, variants] = await Promise.all([
      db.products.toArray(),
      db.productVariants.toArray(),
    ])
    const productMap = Object.fromEntries(products.map((p) => [p.id, p]))
    const variantMap = Object.fromEntries(variants.map((v) => [v.id, v]))

    let query = db.stockMovements.orderBy('createdAt').reverse()
    const all = await query.toArray()

    const filtered = all
      .filter((m) => {
        if (productId && m.productId !== productId) return false
        if (type && m.type !== type) return false
        return true
      })
      .slice(0, limit)

    return filtered.map((m) => ({
      ...m,
      productName: productMap[m.productId]?.name ?? '—',
      variantName: m.variantId ? variantMap[m.variantId]?.name : undefined,
    }))
  },
}))
