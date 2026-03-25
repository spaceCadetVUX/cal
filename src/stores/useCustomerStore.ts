import { create } from 'zustand'
import db from '@/db/db'
import { generateId } from '@/utils/idGenerator'
import type { Customer } from '@/types'

export interface CustomerStats {
  orderCount: number
  totalSpent: number // sum of Order.totalRevenue — populated once Sprint 1.10 adds orders
}

interface CustomerStore {
  customers: Customer[]
  stats: Record<string, CustomerStats>
  loading: boolean
  load: () => Promise<void>
  add: (data: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Customer>
  update: (id: string, patch: Partial<Omit<Customer, 'id' | 'createdAt'>>) => Promise<void>
  remove: (id: string) => Promise<void>
}

export const useCustomerStore = create<CustomerStore>((set) => ({
  customers: [],
  stats: {},
  loading: false,

  load: async () => {
    set({ loading: true })
    const customers = await db.customers.orderBy('name').toArray()

    const statsArr = await Promise.all(
      customers.map(async (c) => {
        const orders = await db.orders.where('customerId').equals(c.id).toArray()
        const totalSpent = orders.reduce((sum, o) => sum + o.totalRevenue, 0)
        return [c.id, { orderCount: orders.length, totalSpent }] as const
      }),
    )
    set({ customers, stats: Object.fromEntries(statsArr), loading: false })
  },

  add: async (data) => {
    const now = new Date()
    const customer: Customer = { id: generateId(), ...data, createdAt: now, updatedAt: now }
    await db.customers.add(customer)
    set((s) => ({ customers: [...s.customers, customer] }))
    return customer
  },

  update: async (id, patch) => {
    const now = new Date()
    await db.customers.update(id, { ...patch, updatedAt: now })
    set((s) => ({
      customers: s.customers.map((c) => (c.id === id ? { ...c, ...patch, updatedAt: now } : c)),
    }))
  },

  remove: async (id) => {
    await db.customers.delete(id)
    set((s) => ({
      customers: s.customers.filter((c) => c.id !== id),
      stats: Object.fromEntries(Object.entries(s.stats).filter(([k]) => k !== id)),
    }))
  },
}))
