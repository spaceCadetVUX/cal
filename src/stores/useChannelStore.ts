import { create } from 'zustand'
import db from '@/db/db'
import { generateId } from '@/utils/idGenerator'
import type { SalesChannel, ChannelCategoryFee } from '@/types'

interface ChannelStore {
  channels: SalesChannel[]
  loading: boolean
  load: () => Promise<void>
  add: (data: Omit<SalesChannel, 'id' | 'createdAt' | 'updatedAt'>) => Promise<SalesChannel>
  update: (id: string, patch: Partial<Omit<SalesChannel, 'id' | 'createdAt'>>) => Promise<void>
  remove: (id: string) => Promise<void>
  toggleActive: (id: string) => Promise<void>
  loadCategoryFees: (channelId: string) => Promise<ChannelCategoryFee[]>
  // Replaces all fees for a channel; rows with feePct=0 are skipped (means "use channel default")
  saveCategoryFees: (channelId: string, fees: Array<{ categoryId: string; feePct: number }>) => Promise<void>
}

export const useChannelStore = create<ChannelStore>((set, get) => ({
  channels: [],
  loading: false,

  load: async () => {
    set({ loading: true })
    const channels = await db.salesChannels.orderBy('createdAt').toArray()
    set({ channels, loading: false })
  },

  add: async (data) => {
    const now = new Date()
    const channel: SalesChannel = { id: generateId(), ...data, createdAt: now, updatedAt: now }
    await db.salesChannels.add(channel)
    set((s) => ({ channels: [...s.channels, channel] }))
    return channel
  },

  update: async (id, patch) => {
    const now = new Date()
    await db.salesChannels.update(id, { ...patch, updatedAt: now })
    set((s) => ({
      channels: s.channels.map((c) => (c.id === id ? { ...c, ...patch, updatedAt: now } : c)),
    }))
  },

  remove: async (id) => {
    // Also remove all category fee overrides for this channel
    await db.transaction('rw', [db.salesChannels, db.channelCategoryFees], async () => {
      await db.salesChannels.delete(id)
      await db.channelCategoryFees.where('channelId').equals(id).delete()
    })
    set((s) => ({ channels: s.channels.filter((c) => c.id !== id) }))
  },

  toggleActive: async (id) => {
    const ch = get().channels.find((c) => c.id === id)
    if (ch) await get().update(id, { isActive: !ch.isActive })
  },

  loadCategoryFees: async (channelId) => {
    return db.channelCategoryFees.where('channelId').equals(channelId).toArray()
  },

  saveCategoryFees: async (channelId, fees) => {
    await db.transaction('rw', [db.channelCategoryFees], async () => {
      await db.channelCategoryFees.where('channelId').equals(channelId).delete()
      const rows: ChannelCategoryFee[] = fees
        .filter((f) => f.feePct > 0)
        .map((f) => ({ id: generateId(), channelId, categoryId: f.categoryId, feePct: f.feePct }))
      if (rows.length > 0) await db.channelCategoryFees.bulkAdd(rows)
    })
  },
}))
