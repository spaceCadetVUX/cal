import { create } from 'zustand'
import db from '@/db/db'
import { generateId } from '@/utils/idGenerator'
import type { Product, ProductVariant, ProductChannelInfo } from '@/types'

// --------------- Types ---------------

export interface ProductStats {
  totalQty: number          // sum of InventoryRecord.quantity cho product này
  listedChannelIds: string[] // channelId nơi isListed = true
}

export interface VariantInput {
  id?: string   // undefined = mới tạo
  name: string
  sku: string
  isActive: boolean
}

export interface ChannelInput {
  channelId: string
  externalSku?: string
  isListed: boolean
}

export interface ProductFormInput {
  sku: string
  name: string
  categoryId: string
  supplierId?: string
  unit: string
  images: string[]
  description?: string
  barcode?: string
  weight?: number
  isActive: boolean
  variants: VariantInput[]
  channelInputs: ChannelInput[]
}

export interface ProductDetail {
  variants: ProductVariant[]
  channelInfos: ProductChannelInfo[]
}

// --------------- Store ---------------

interface ProductStore {
  products: Product[]
  stats: Record<string, ProductStats>
  loading: boolean
  load: () => Promise<void>
  add: (data: ProductFormInput) => Promise<Product>
  update: (id: string, data: ProductFormInput) => Promise<void>
  // null = xóa thành công, string = thông báo lỗi
  remove: (id: string) => Promise<string | null>
  toggleActive: (id: string) => Promise<void>
  getDetail: (productId: string) => Promise<ProductDetail>
}

export const useProductStore = create<ProductStore>((set, get) => ({
  products: [],
  stats: {},
  loading: false,

  load: async () => {
    set({ loading: true })
    const products = await db.products.orderBy('name').toArray()

    const statsArr = await Promise.all(
      products.map(async (p) => {
        const [inventoryRecords, channelInfos] = await Promise.all([
          db.inventoryRecords.where('productId').equals(p.id).toArray(),
          db.productChannelInfos
            .where('productId')
            .equals(p.id)
            .filter((ci) => ci.isListed)
            .toArray(),
        ])
        const totalQty = inventoryRecords.reduce((sum, r) => sum + r.quantity, 0)
        const listedChannelIds = channelInfos.map((ci) => ci.channelId)
        return [p.id, { totalQty, listedChannelIds }] as const
      }),
    )

    set({ products, stats: Object.fromEntries(statsArr), loading: false })
  },

  add: async (data) => {
    const now = new Date()
    const product: Product = {
      id: generateId(),
      sku: data.sku,
      name: data.name,
      categoryId: data.categoryId,
      supplierId: data.supplierId || undefined,
      unit: data.unit,
      images: data.images,
      description: data.description || undefined,
      barcode: data.barcode || undefined,
      weight: data.weight || undefined,
      isActive: data.isActive,
      createdAt: now,
      updatedAt: now,
    }

    const variants: ProductVariant[] = data.variants.map((v) => ({
      id: generateId(),
      productId: product.id,
      name: v.name,
      sku: v.sku,
      isActive: v.isActive,
    }))

    const channelInfos: ProductChannelInfo[] = data.channelInputs
      .filter((ci) => ci.isListed)
      .map((ci) => ({
        id: generateId(),
        productId: product.id,
        channelId: ci.channelId,
        externalSku: ci.externalSku || undefined,
        isListed: true,
        listedAt: now,
      }))

    await db.transaction(
      'rw',
      [db.products, db.productVariants, db.productChannelInfos],
      async () => {
        await db.products.add(product)
        if (variants.length > 0) await db.productVariants.bulkAdd(variants)
        if (channelInfos.length > 0) await db.productChannelInfos.bulkAdd(channelInfos)
      },
    )

    const listedChannelIds = channelInfos.map((ci) => ci.channelId)
    set((s) => ({
      products: [...s.products, product].sort((a, b) => a.name.localeCompare(b.name, 'vi')),
      stats: { ...s.stats, [product.id]: { totalQty: 0, listedChannelIds } },
    }))

    return product
  },

  update: async (id, data) => {
    const now = new Date()
    const patch: Partial<Product> = {
      sku: data.sku,
      name: data.name,
      categoryId: data.categoryId,
      supplierId: data.supplierId || undefined,
      unit: data.unit,
      images: data.images,
      description: data.description || undefined,
      barcode: data.barcode || undefined,
      weight: data.weight || undefined,
      isActive: data.isActive,
      updatedAt: now,
    }

    // Giữ nguyên id cũ của variant nếu có, tạo mới nếu không
    const newVariants: ProductVariant[] = data.variants.map((v) => ({
      id: v.id ?? generateId(),
      productId: id,
      name: v.name,
      sku: v.sku,
      isActive: v.isActive,
    }))

    const newChannelInfos: ProductChannelInfo[] = data.channelInputs
      .filter((ci) => ci.isListed)
      .map((ci) => ({
        id: generateId(),
        productId: id,
        channelId: ci.channelId,
        externalSku: ci.externalSku || undefined,
        isListed: true,
        listedAt: now,
      }))

    await db.transaction(
      'rw',
      [db.products, db.productVariants, db.productChannelInfos],
      async () => {
        await db.products.update(id, patch)
        await db.productVariants.where('productId').equals(id).delete()
        if (newVariants.length > 0) await db.productVariants.bulkAdd(newVariants)
        await db.productChannelInfos.where('productId').equals(id).delete()
        if (newChannelInfos.length > 0) await db.productChannelInfos.bulkAdd(newChannelInfos)
      },
    )

    const listedChannelIds = newChannelInfos.map((ci) => ci.channelId)
    set((s) => ({
      products: s.products
        .map((p) => (p.id === id ? { ...p, ...patch } : p))
        .sort((a, b) => a.name.localeCompare(b.name, 'vi')),
      stats: {
        ...s.stats,
        [id]: { ...s.stats[id], listedChannelIds },
      },
    }))
  },

  remove: async (id) => {
    const [importCount, orderCount] = await Promise.all([
      db.importItems.where('productId').equals(id).count(),
      db.orderItems.where('productId').equals(id).count(),
    ])
    if (importCount > 0)
      return `Không thể xóa — sản phẩm đã có ${importCount} lần nhập hàng`
    if (orderCount > 0)
      return `Không thể xóa — sản phẩm đã có ${orderCount} đơn bán`

    await db.transaction(
      'rw',
      [
        db.products,
        db.productVariants,
        db.productChannelInfos,
        db.inventoryRecords,
        db.stockMovements,
        db.priceConfigs,
      ],
      async () => {
        await Promise.all([
          db.products.delete(id),
          db.productVariants.where('productId').equals(id).delete(),
          db.productChannelInfos.where('productId').equals(id).delete(),
          db.inventoryRecords.where('productId').equals(id).delete(),
          db.stockMovements.where('productId').equals(id).delete(),
          db.priceConfigs.where('productId').equals(id).delete(),
        ])
      },
    )

    set((s) => ({
      products: s.products.filter((p) => p.id !== id),
      stats: Object.fromEntries(Object.entries(s.stats).filter(([k]) => k !== id)),
    }))
    return null
  },

  toggleActive: async (id) => {
    const product = get().products.find((p) => p.id === id)
    if (!product) return
    const now = new Date()
    await db.products.update(id, { isActive: !product.isActive, updatedAt: now })
    set((s) => ({
      products: s.products.map((p) =>
        p.id === id ? { ...p, isActive: !p.isActive, updatedAt: now } : p,
      ),
    }))
  },

  getDetail: async (productId) => {
    const [variants, channelInfos] = await Promise.all([
      db.productVariants.where('productId').equals(productId).toArray(),
      db.productChannelInfos.where('productId').equals(productId).toArray(),
    ])
    return { variants, channelInfos }
  },
}))

// --------------- Helper: auto-generate SKU ---------------

export function generateProductSku(): string {
  const d = new Date()
  const date = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `SP-${date}-${rand}`
}
