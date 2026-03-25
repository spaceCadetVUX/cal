import { create } from 'zustand'
import db from '@/db/db'
import { generateId } from '@/utils/idGenerator'
import type { Category } from '@/types'

interface CategoryStore {
  categories: Category[]
  loading: boolean
  load: () => Promise<void>
  add: (data: Omit<Category, 'id' | 'createdAt'>) => Promise<void>
  update: (id: string, patch: Partial<Omit<Category, 'id' | 'createdAt'>>) => Promise<void>
  // Returns error message if blocked, null if deleted successfully
  remove: (id: string) => Promise<string | null>
}

export const useCategoryStore = create<CategoryStore>((set) => ({
  categories: [],
  loading: false,

  load: async () => {
    set({ loading: true })
    const categories = await db.categories.orderBy('name').toArray()
    set({ categories, loading: false })
  },

  add: async (data) => {
    const category: Category = { id: generateId(), ...data, createdAt: new Date() }
    await db.categories.add(category)
    set((s) => ({
      categories: [...s.categories, category].sort((a, b) => a.name.localeCompare(b.name, 'vi')),
    }))
  },

  update: async (id, patch) => {
    await db.categories.update(id, patch)
    set((s) => ({ categories: s.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)) }))
  },

  // Block delete if any product references this category
  remove: async (id) => {
    const count = await db.products.where('categoryId').equals(id).count()
    if (count > 0) return `Không thể xóa — đang có ${count} sản phẩm dùng danh mục này`
    await db.categories.delete(id)
    set((s) => ({ categories: s.categories.filter((c) => c.id !== id) }))
    return null
  },
}))
