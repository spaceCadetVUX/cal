import { create } from 'zustand'
import db from '@/db/db'
import { generateId } from '@/utils/idGenerator'
import type { ImportBatch, ImportItem } from '@/types'

// --------------- Types ---------------

export interface ImportItemInput {
  productId: string
  variantId?: string
  quantity: number
  costPrice: number
}

export interface ImportBatchInput {
  batchCode: string
  supplierId: string
  importDate: Date
  invoiceNumber?: string
  note?: string
  items: ImportItemInput[]
}

export interface ImportBatchDetail {
  batch: ImportBatch
  items: ImportItem[]
}

interface ImportStore {
  batches: ImportBatch[]
  loading: boolean
  load: () => Promise<void>
  createBatch: (input: ImportBatchInput) => Promise<ImportBatch>
  // Chỉ cho phép edit khi status = pending
  updateBatch: (id: string, input: ImportBatchInput) => Promise<void>
  // pending → received; cập nhật InventoryRecord + StockMovement
  confirmBatch: (id: string) => Promise<void>
  // pending → cancelled; không đổi tồn kho
  cancelBatch: (id: string) => Promise<void>
  // Chỉ xóa được pending/cancelled
  deleteBatch: (id: string) => Promise<string | null>
  getBatchDetail: (id: string) => Promise<ImportBatchDetail | null>
}

// --------------- Helper ---------------

export function generateBatchCode(): string {
  const d = new Date()
  const date = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `IMP-${date}-${rand}`
}

// --------------- Store ---------------

export const useImportStore = create<ImportStore>((set, get) => ({
  batches: [],
  loading: false,

  load: async () => {
    set({ loading: true })
    const batches = await db.importBatches.orderBy('importDate').reverse().toArray()
    set({ batches, loading: false })
  },

  createBatch: async (input) => {
    const now = new Date()
    const totalAmount = input.items.reduce((sum, i) => sum + i.quantity * i.costPrice, 0)

    const batch: ImportBatch = {
      id: generateId(),
      batchCode: input.batchCode,
      supplierId: input.supplierId,
      invoiceNumber: input.invoiceNumber || undefined,
      importDate: input.importDate,
      totalAmount,
      paidAmount: 0,
      note: input.note || undefined,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    }

    const items: ImportItem[] = input.items.map((i) => ({
      id: generateId(),
      batchId: batch.id,
      productId: i.productId,
      variantId: i.variantId,
      quantity: i.quantity,
      costPrice: i.costPrice,
    }))

    await db.transaction('rw', [db.importBatches, db.importItems], async () => {
      await db.importBatches.add(batch)
      await db.importItems.bulkAdd(items)
    })

    set((s) => ({ batches: [batch, ...s.batches] }))
    return batch
  },

  updateBatch: async (id, input) => {
    const existing = get().batches.find((b) => b.id === id)
    if (!existing || existing.status !== 'pending') return

    const now = new Date()
    const totalAmount = input.items.reduce((sum, i) => sum + i.quantity * i.costPrice, 0)

    const patch: Partial<ImportBatch> = {
      batchCode: input.batchCode,
      supplierId: input.supplierId,
      invoiceNumber: input.invoiceNumber || undefined,
      importDate: input.importDate,
      totalAmount,
      note: input.note || undefined,
      updatedAt: now,
    }

    const newItems: ImportItem[] = input.items.map((i) => ({
      id: generateId(),
      batchId: id,
      productId: i.productId,
      variantId: i.variantId,
      quantity: i.quantity,
      costPrice: i.costPrice,
    }))

    await db.transaction('rw', [db.importBatches, db.importItems], async () => {
      await db.importBatches.update(id, patch)
      await db.importItems.where('batchId').equals(id).delete()
      await db.importItems.bulkAdd(newItems)
    })

    set((s) => ({
      batches: s.batches.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    }))
  },

  confirmBatch: async (id) => {
    const batch = get().batches.find((b) => b.id === id)
    if (!batch || batch.status !== 'pending') return

    const now = new Date()
    const items = await db.importItems.where('batchId').equals(id).toArray()

    // Lấy ngưỡng cảnh báo mặc định từ AppSettings
    const settings = await db.appSettings.toCollection().first()
    const defaultLowStockAlert = settings?.defaultLowStockAlert ?? 5

    await db.transaction('rw', [db.importBatches, db.inventoryRecords, db.stockMovements], async () => {
      await db.importBatches.update(id, { status: 'received', updatedAt: now })

      for (const item of items) {
        // Tìm InventoryRecord hiện tại cho product/variant này
        const existing = await db.inventoryRecords
          .where('productId')
          .equals(item.productId)
          .filter((r) => r.variantId === item.variantId)
          .first()

        if (existing) {
          await db.inventoryRecords.update(existing.id, {
            quantity: existing.quantity + item.quantity,
            updatedAt: now,
          })
        } else {
          await db.inventoryRecords.add({
            id: generateId(),
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
            reservedQty: 0,
            lowStockAlert: defaultLowStockAlert,
            updatedAt: now,
          })
        }

        // Tạo StockMovement
        await db.stockMovements.add({
          id: generateId(),
          productId: item.productId,
          variantId: item.variantId,
          type: 'import',
          quantity: item.quantity,
          refId: batch.id,
          note: `Lô nhập ${batch.batchCode}`,
          createdAt: now,
        })
      }
    })

    set((s) => ({
      batches: s.batches.map((b) =>
        b.id === id ? { ...b, status: 'received', updatedAt: now } : b,
      ),
    }))
  },

  cancelBatch: async (id) => {
    const batch = get().batches.find((b) => b.id === id)
    if (!batch || batch.status !== 'pending') return
    const now = new Date()
    await db.importBatches.update(id, { status: 'cancelled', updatedAt: now })
    set((s) => ({
      batches: s.batches.map((b) =>
        b.id === id ? { ...b, status: 'cancelled', updatedAt: now } : b,
      ),
    }))
  },

  deleteBatch: async (id) => {
    const batch = get().batches.find((b) => b.id === id)
    if (!batch) return null
    if (batch.status === 'received') return 'Không thể xóa lô đã nhận hàng'

    await db.transaction('rw', [db.importBatches, db.importItems], async () => {
      await db.importBatches.delete(id)
      await db.importItems.where('batchId').equals(id).delete()
    })

    set((s) => ({ batches: s.batches.filter((b) => b.id !== id) }))
    return null
  },

  getBatchDetail: async (id) => {
    const [batch, items] = await Promise.all([
      db.importBatches.get(id),
      db.importItems.where('batchId').equals(id).toArray(),
    ])
    if (!batch) return null
    return { batch, items }
  },
}))
