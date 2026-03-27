import { create } from 'zustand'
import db from '@/db/db'
import { generateId } from '@/utils/idGenerator'
import type { Expense, ExpenseCategory, RecurringInterval } from '@/types'

// --------------- Types ---------------

export interface ExpenseInput {
  name: string
  category: ExpenseCategory
  amount: number
  date: Date
  channelId?: string
  isRecurring: boolean
  recurringInterval?: RecurringInterval
  note?: string
}

interface ExpenseStore {
  expenses: Expense[]
  loading: boolean
  load: () => Promise<void>
  add: (data: ExpenseInput) => Promise<Expense>
  update: (id: string, data: ExpenseInput) => Promise<void>
  remove: (id: string) => Promise<void>
  // Tự tạo bản sao chi phí recurring cho tháng hiện tại nếu chưa có
  generateRecurring: () => Promise<number> // returns số lượng đã tạo
}

// --------------- Store ---------------

export const useExpenseStore = create<ExpenseStore>((set, get) => ({
  expenses: [],
  loading: false,

  load: async () => {
    set({ loading: true })
    // Load newest first by date
    const expenses = await db.expenses.orderBy('date').reverse().toArray()
    set({ expenses, loading: false })
    // Sau khi load, tự generate recurring nếu cần
    await get().generateRecurring()
  },

  add: async (data) => {
    const expense: Expense = {
      id: generateId(),
      ...data,
      // Nếu không recurring thì bỏ qua recurringInterval
      recurringInterval: data.isRecurring ? data.recurringInterval : undefined,
      createdAt: new Date(),
    }
    await db.expenses.add(expense)
    // Thêm vào đầu mảng (mới nhất)
    set((s) => ({
      expenses: [expense, ...s.expenses],
    }))
    return expense
  },

  update: async (id, data) => {
    const patch: Partial<Expense> = {
      ...data,
      recurringInterval: data.isRecurring ? data.recurringInterval : undefined,
    }
    await db.expenses.update(id, patch)
    set((s) => ({
      expenses: s.expenses.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    }))
  },

  remove: async (id) => {
    await db.expenses.delete(id)
    set((s) => ({ expenses: s.expenses.filter((e) => e.id !== id) }))
  },

  generateRecurring: async () => {
    const now = new Date()
    const thisYear = now.getFullYear()
    const thisMonth = now.getMonth() // 0-based

    const allExpenses = get().expenses

    // Chỉ xét các expense recurring từ tháng trước trở về trước
    const recurringPastExpenses = allExpenses.filter((e) => {
      if (!e.isRecurring) return false
      const d = new Date(e.date)
      return !(d.getFullYear() === thisYear && d.getMonth() === thisMonth)
    })

    if (recurringPastExpenses.length === 0) return 0

    // Key để nhận dạng 1 expense: name + category + channelId
    const expenseKey = (e: Pick<Expense, 'name' | 'category' | 'channelId'>) =>
      `${e.name}||${e.category}||${e.channelId ?? ''}`

    // Các expense đã có trong tháng này
    const thisMonthKeys = new Set(
      allExpenses
        .filter((e) => {
          const d = new Date(e.date)
          return d.getFullYear() === thisYear && d.getMonth() === thisMonth
        })
        .map(expenseKey),
    )

    const toCreate: Expense[] = []
    const seenTemplates = new Set<string>() // tránh generate 2 lần cho cùng 1 template

    for (const t of recurringPastExpenses) {
      const key = expenseKey(t)
      if (seenTemplates.has(key)) continue
      seenTemplates.add(key)

      // Đã có trong tháng này rồi → bỏ qua
      if (thisMonthKeys.has(key)) continue

      // Tính khoảng cách tháng từ template đến tháng hiện tại
      const tDate = new Date(t.date)
      const monthsDiff =
        (thisYear - tDate.getFullYear()) * 12 + (thisMonth - tDate.getMonth())

      // Kiểm tra interval có khớp không
      const interval = t.recurringInterval ?? 'monthly'
      let shouldGenerate = false
      if (interval === 'monthly' && monthsDiff >= 1) shouldGenerate = true
      else if (interval === 'quarterly' && monthsDiff >= 3 && monthsDiff % 3 === 0)
        shouldGenerate = true
      else if (interval === 'yearly' && monthsDiff >= 12 && monthsDiff % 12 === 0)
        shouldGenerate = true

      if (!shouldGenerate) continue

      toCreate.push({
        id: generateId(),
        channelId: t.channelId,
        category: t.category,
        name: t.name,
        amount: t.amount,
        date: new Date(thisYear, thisMonth, 1), // ngày 1 của tháng hiện tại
        isRecurring: true,
        recurringInterval: t.recurringInterval,
        note: t.note,
        createdAt: new Date(),
      })
      // Đánh dấu đã tạo để không tạo duplicate trong cùng vòng lặp
      thisMonthKeys.add(key)
    }

    if (toCreate.length > 0) {
      await db.expenses.bulkAdd(toCreate)
      // Thêm vào store, giữ sort newest first
      set((s) => ({
        expenses: [...toCreate, ...s.expenses].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
        ),
      }))
    }

    return toCreate.length
  },
}))
