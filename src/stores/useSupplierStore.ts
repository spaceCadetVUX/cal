import { create } from 'zustand'
import db from '@/db/db'
import { generateId } from '@/utils/idGenerator'
import type { Supplier, SupplierPayment } from '@/types'

export interface SupplierStats {
  productCount: number
  totalImported: number // sum of received ImportBatch.totalAmount
  totalPaid: number    // sum of SupplierPayment.amount
  debt: number         // totalImported - totalPaid
}

interface SupplierStore {
  suppliers: Supplier[]
  stats: Record<string, SupplierStats>
  loading: boolean
  load: () => Promise<void>
  add: (data: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Supplier>
  update: (id: string, patch: Partial<Omit<Supplier, 'id' | 'createdAt'>>) => Promise<void>
  remove: (id: string) => Promise<void>
  addPayment: (data: Omit<SupplierPayment, 'id' | 'createdAt'>) => Promise<SupplierPayment>
  deletePayment: (id: string) => Promise<void>
}

export const useSupplierStore = create<SupplierStore>((set) => ({
  suppliers: [],
  stats: {},
  loading: false,

  load: async () => {
    set({ loading: true })
    const suppliers = await db.suppliers.orderBy('name').toArray()

    // Compute list-level stats for each supplier in parallel
    const statsArr = await Promise.all(
      suppliers.map(async (s) => {
        const [productCount, batches, payments] = await Promise.all([
          db.products.where('supplierId').equals(s.id).count(),
          db.importBatches
            .where('supplierId')
            .equals(s.id)
            .filter((b) => b.status === 'received')
            .toArray(),
          db.supplierPayments.where('supplierId').equals(s.id).toArray(),
        ])
        const totalImported = batches.reduce((sum, b) => sum + b.totalAmount, 0)
        const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0)
        return [s.id, { productCount, totalImported, totalPaid, debt: totalImported - totalPaid }] as const
      }),
    )
    set({ suppliers, stats: Object.fromEntries(statsArr), loading: false })
  },

  add: async (data) => {
    const now = new Date()
    const supplier: Supplier = { id: generateId(), ...data, createdAt: now, updatedAt: now }
    await db.suppliers.add(supplier)
    set((s) => ({ suppliers: [...s.suppliers, supplier] }))
    return supplier
  },

  update: async (id, patch) => {
    const now = new Date()
    await db.suppliers.update(id, { ...patch, updatedAt: now })
    set((s) => ({
      suppliers: s.suppliers.map((sup) => (sup.id === id ? { ...sup, ...patch, updatedAt: now } : sup)),
    }))
  },

  // Cascade delete: remove supplier + all their payments
  remove: async (id) => {
    await db.transaction('rw', [db.suppliers, db.supplierPayments], async () => {
      await db.suppliers.delete(id)
      await db.supplierPayments.where('supplierId').equals(id).delete()
    })
    set((s) => ({
      suppliers: s.suppliers.filter((sup) => sup.id !== id),
      stats: Object.fromEntries(Object.entries(s.stats).filter(([k]) => k !== id)),
    }))
  },

  addPayment: async (data) => {
    const payment: SupplierPayment = { id: generateId(), ...data, createdAt: new Date() }
    await db.supplierPayments.add(payment)
    return payment
  },

  deletePayment: async (id) => {
    await db.supplierPayments.delete(id)
  },
}))
