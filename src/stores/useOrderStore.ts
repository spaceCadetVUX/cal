import { create } from 'zustand'
import db from '@/db/db'
import { generateId } from '@/utils/idGenerator'
import { calcOrderItemProfit } from '@/utils/profitCalculator'
import { resolveChannelFee } from '@/utils/channelFeeResolver'
import type { Order, OrderItem, OrderStatus, PaymentMethod } from '@/types'

// --------------- Types ---------------

export interface OrderItemInput {
  productId: string
  variantId?: string
  categoryId?: string   // để resolve fee theo category
  quantity: number
  sellingPrice: number
  costPrice: number     // snapshot từ ImportItem
  packagingCost: number
  otherCost: number
}

export interface CreateOrderInput {
  channelId: string
  customerId?: string
  externalOrderId?: string
  orderDate: Date
  paymentMethod: PaymentMethod
  buyerShippingFee: number
  sellerShippingFee: number
  shippingSubsidy: number
  discountAmount: number
  note?: string
  items: OrderItemInput[]
}

// Order + computed profit (không lưu DB)
export interface OrderSummary extends Order {
  totalGrossProfit: number  // Σ(item.grossProfit)
  netProfit: number         // totalGrossProfit - (sellerShippingFee - shippingSubsidy)
  profitMargin: number      // netProfit / totalRevenue × 100 (revenue-based)
}

function generateOrderCode(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `ORD-${yyyy}${mm}${dd}-${rand}`
}

function computeSummary(order: Order, items: OrderItem[]): OrderSummary {
  const totalGrossProfit = items.reduce((s, i) => s + i.grossProfit, 0)
  const netShipping = order.sellerShippingFee - order.shippingSubsidy
  const netProfit = totalGrossProfit - netShipping
  const profitMargin = order.totalRevenue > 0 ? (netProfit / order.totalRevenue) * 100 : 0
  return { ...order, totalGrossProfit, netProfit, profitMargin }
}

// --------------- Store ---------------

interface OrderStore {
  orders: OrderSummary[]
  loading: boolean

  load: () => Promise<void>
  createOrder: (input: CreateOrderInput) => Promise<Order>
  updateStatus: (id: string, status: OrderStatus) => Promise<void>
  deleteOrder: (id: string) => Promise<string | null>
  getOrderDetail: (id: string) => Promise<{ order: Order; items: OrderItem[] } | null>
}

export const useOrderStore = create<OrderStore>((set, get) => ({
  orders: [],
  loading: false,

  load: async () => {
    set({ loading: true })
    const [orders, allItems] = await Promise.all([
      db.orders.orderBy('orderDate').reverse().toArray(),
      db.orderItems.toArray(),
    ])

    const itemsByOrder: Record<string, OrderItem[]> = {}
    for (const item of allItems) {
      if (!itemsByOrder[item.orderId]) itemsByOrder[item.orderId] = []
      itemsByOrder[item.orderId].push(item)
    }

    const summaries: OrderSummary[] = orders.map((order) =>
      computeSummary(order, itemsByOrder[order.id] ?? []),
    )

    set({ orders: summaries, loading: false })
  },

  createOrder: async (input) => {
    const now = new Date()
    const orderId = generateId()

    // Resolve fees + tính lợi nhuận từng dòng
    const orderItems: OrderItem[] = await Promise.all(
      input.items.map(async (item) => {
        const { platformFeePct, paymentFeePct } = await resolveChannelFee(
          input.channelId,
          item.categoryId,
          db,
        )
        const calc = calcOrderItemProfit({
          sellingPrice: item.sellingPrice,
          costPrice: item.costPrice,
          platformFeePct,
          paymentFeePct,
          packagingCost: item.packagingCost,
          otherCost: item.otherCost,
          quantity: item.quantity,
        })
        return {
          id: generateId(),
          orderId,
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          sellingPrice: item.sellingPrice,
          costPrice: item.costPrice,
          platformFeePct,
          platformFee: calc.platformFee,
          paymentFeePct,
          paymentFee: calc.paymentFee,
          packagingCost: item.packagingCost,
          otherCost: item.otherCost,
          grossProfit: calc.grossProfit,
        } satisfies OrderItem
      }),
    )

    // totalRevenue = Σ(sellingPrice × qty) - discountAmount
    const totalRevenue =
      orderItems.reduce((s, i) => s + i.sellingPrice * i.quantity, 0) - input.discountAmount

    const order: Order = {
      id: orderId,
      orderCode: generateOrderCode(),
      channelId: input.channelId,
      customerId: input.customerId,
      externalOrderId: input.externalOrderId || undefined,
      orderDate: input.orderDate,
      status: 'confirmed',
      buyerShippingFee: input.buyerShippingFee,
      sellerShippingFee: input.sellerShippingFee,
      shippingSubsidy: input.shippingSubsidy,
      discountAmount: input.discountAmount,
      paymentMethod: input.paymentMethod,
      totalRevenue,
      note: input.note || undefined,
      createdAt: now,
      updatedAt: now,
    }

    await db.transaction('rw', [db.orders, db.orderItems, db.inventoryRecords, db.stockMovements], async () => {
      await db.orders.add(order)
      await db.orderItems.bulkAdd(orderItems)

      // Trừ tồn kho + tạo StockMovement per item
      for (const item of orderItems) {
        const existing = await db.inventoryRecords
          .where('productId')
          .equals(item.productId)
          .filter((r) => r.variantId === item.variantId)
          .first()

        if (existing) {
          const newQty = Math.max(0, existing.quantity - item.quantity)
          await db.inventoryRecords.update(existing.id, { quantity: newQty, updatedAt: now })
        }

        await db.stockMovements.add({
          id: generateId(),
          productId: item.productId,
          variantId: item.variantId,
          type: 'sale',
          quantity: -item.quantity,
          channelId: input.channelId,
          refId: orderId,
          createdAt: now,
        })
      }
    })

    const summary = computeSummary(order, orderItems)
    set((s) => ({ orders: [summary, ...s.orders] }))
    return order
  },

  updateStatus: async (id, status) => {
    const now = new Date()
    await db.orders.update(id, { status, updatedAt: now })
    set((s) => ({
      orders: s.orders.map((o) =>
        o.id === id ? { ...o, status, updatedAt: now } : o,
      ),
    }))
  },

  deleteOrder: async (id) => {
    const order = get().orders.find((o) => o.id === id)
    if (!order) return 'Đơn hàng không tồn tại'
    if (order.status === 'delivered' || order.status === 'shipping') {
      return 'Không thể xóa đơn đang giao hoặc đã giao'
    }
    await db.transaction('rw', [db.orders, db.orderItems], async () => {
      await db.orderItems.where('orderId').equals(id).delete()
      await db.orders.delete(id)
    })
    set((s) => ({ orders: s.orders.filter((o) => o.id !== id) }))
    return null
  },

  getOrderDetail: async (id) => {
    const order = await db.orders.get(id)
    if (!order) return null
    const items = await db.orderItems.where('orderId').equals(id).toArray()
    return { order, items }
  },
}))
