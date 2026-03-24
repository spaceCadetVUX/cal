import db from './db'
import { generateId } from '@/utils/idGenerator'
import {
  CHANNEL_DEFAULTS,
  SEED_CHANNELS,
  SEED_CATEGORIES,
  SHOPEE_CATEGORY_FEES,
  LAZADA_CATEGORY_FEES,
  TIKI_CATEGORY_FEES,
} from '@/constants/channelDefaults'
import type { AppSettings, SalesChannel, Category, ChannelCategoryFee } from '@/types'

// ============================================================
// Seed data — chạy 1 lần duy nhất lúc app khởi động lần đầu.
// Kiểm tra bằng cách check AppSettings có tồn tại chưa.
// Nếu đã có → skip toàn bộ.
// ============================================================

export async function runSeedIfNeeded(): Promise<void> {
  const existingSettings = await db.appSettings.count()
  if (existingSettings > 0) return // đã seed rồi, skip

  await db.transaction(
    'rw',
    [db.appSettings, db.salesChannels, db.categories, db.channelCategoryFees],
    async () => {
      await seedAppSettings()
      const categoryIdMap = await seedCategories()
      const channelIdMap = await seedChannels()
      await seedChannelCategoryFees(channelIdMap, categoryIdMap)
    }
  )
}

// ---- 1. AppSettings ----
async function seedAppSettings(): Promise<void> {
  const settings: AppSettings = {
    id: generateId(),
    businessName: 'My Shop',
    defaultPackagingCost: 0,
    defaultMinMarginPct: 20,
    defaultLowStockAlert: 5,
    currency: 'VND',
    updatedAt: new Date(),
  }
  await db.appSettings.add(settings)
}

// ---- 2. Categories ----
// Trả về map: categoryName → id (dùng để tạo ChannelCategoryFee)
async function seedCategories(): Promise<Map<string, string>> {
  const now = new Date()
  const idMap = new Map<string, string>()

  const categories: Category[] = SEED_CATEGORIES.map((name) => {
    const id = generateId()
    idMap.set(name, id)
    return { id, name, createdAt: now }
  })

  await db.categories.bulkAdd(categories)
  return idMap
}

// ---- 3. SalesChannels ----
// Trả về map: channelType → id (dùng để tạo ChannelCategoryFee)
async function seedChannels(): Promise<Map<string, string>> {
  const now = new Date()
  const idMap = new Map<string, string>()

  const channels: SalesChannel[] = SEED_CHANNELS.map((type) => {
    const defaults = CHANNEL_DEFAULTS[type]
    const id = generateId()
    idMap.set(type, id)
    return {
      id,
      name: defaults.name,
      type,
      platformFeePct: defaults.platformFeePct,
      paymentFeePct: defaults.paymentFeePct,
      defaultShippingSubsidy: defaults.defaultShippingSubsidy,
      color: defaults.color,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    }
  })

  await db.salesChannels.bulkAdd(channels)
  return idMap
}

// ---- 4. ChannelCategoryFees ----
// Tạo fee overrides cho Shopee, Lazada, Tiki theo bảng phí Section 7
async function seedChannelCategoryFees(
  channelIdMap: Map<string, string>,
  categoryIdMap: Map<string, string>
): Promise<void> {
  const fees: ChannelCategoryFee[] = []

  const addFees = (
    channelType: string,
    feeTable: Record<string, number>
  ) => {
    const channelId = channelIdMap.get(channelType)
    if (!channelId) return

    for (const [categoryName, feePct] of Object.entries(feeTable)) {
      const categoryId = categoryIdMap.get(categoryName)
      if (!categoryId) continue
      fees.push({ id: generateId(), channelId, categoryId, feePct })
    }
  }

  addFees('shopee', SHOPEE_CATEGORY_FEES)
  addFees('lazada', LAZADA_CATEGORY_FEES)
  addFees('tiki', TIKI_CATEGORY_FEES)

  if (fees.length > 0) {
    await db.channelCategoryFees.bulkAdd(fees)
  }
}
