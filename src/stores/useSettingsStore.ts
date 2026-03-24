import { create } from 'zustand'
import db from '@/db/db'
import { generateId } from '@/utils/idGenerator'
import type { AppSettings } from '@/types'

interface SettingsStore {
  settings: AppSettings | null
  loading: boolean
  load: () => Promise<void>
  save: (patch: Omit<AppSettings, 'id' | 'updatedAt'>) => Promise<void>
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: null,
  loading: false,

  load: async () => {
    set({ loading: true })
    const s = await db.appSettings.toCollection().first()
    set({ settings: s ?? null, loading: false })
  },

  // Upsert — updates if exists, creates if missing (shouldn't happen after seed)
  save: async (patch) => {
    const now = new Date()
    const existing = get().settings
    if (existing) {
      await db.appSettings.update(existing.id, { ...patch, updatedAt: now })
      set({ settings: { ...existing, ...patch, updatedAt: now } })
    } else {
      const s: AppSettings = { id: generateId(), ...patch, updatedAt: now }
      await db.appSettings.add(s)
      set({ settings: s })
    }
  },
}))
