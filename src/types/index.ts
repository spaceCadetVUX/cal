// ============================================================
// Types mirror 18 Data Models từ PROJECT_PLAN.md
// KHÔNG được tự ý thay đổi — đây là nguồn sự thật của TypeScript layer
// ============================================================

// 1. AppSettings
export interface AppSettings {
  id: string
  businessName: string
  defaultPackagingCost: number
  defaultMinMarginPct: number
  defaultLowStockAlert: number
  currency: string
  updatedAt: Date
}

// 2. SalesChannel
export type ChannelType = 'shopee' | 'lazada' | 'tiki' | 'tiktok' | 'website' | 'offline' | 'custom'

export interface SalesChannel {
  id: string
  name: string
  type: ChannelType
  platformFeePct: number
  paymentFeePct: number
  defaultShippingSubsidy: number
  color: string
  isActive: boolean
  note?: string
  createdAt: Date
  updatedAt: Date
}

// 3. Category
export interface Category {
  id: string
  name: string
  note?: string
  createdAt: Date
}

// 4. ChannelCategoryFee
export interface ChannelCategoryFee {
  id: string
  channelId: string
  categoryId: string
  feePct: number
}

// 5. Supplier
export interface Supplier {
  id: string
  name: string
  phone: string
  email?: string
  address?: string
  contactPerson?: string
  note?: string
  createdAt: Date
  updatedAt: Date
}

// 6. Product
export interface Product {
  id: string
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
  createdAt: Date
  updatedAt: Date
}

// 7. ProductVariant
export interface ProductVariant {
  id: string
  productId: string
  name: string
  sku: string
  isActive: boolean
}

// 8. ProductChannelInfo
export interface ProductChannelInfo {
  id: string
  productId: string
  variantId?: string
  channelId: string
  externalSku?: string
  isListed: boolean
  listedAt?: Date
  note?: string
}

// 9. PriceConfig
// NOTE: costPrice KHÔNG có ở đây — lấy từ ImportItem mới nhất
export interface PriceConfig {
  id: string
  productId: string
  variantId?: string
  channelId?: string // null = base price cho tất cả kênh
  sellingPrice: number
  minSellingPrice: number
  flashSalePrice?: number
  flashSaleStart?: Date
  flashSaleEnd?: Date
  packagingCost: number
  otherCost: number
  minMarginPct: number
  effectiveFrom: Date
  createdAt: Date
}

// 10. ImportBatch
export type ImportBatchStatus = 'pending' | 'received' | 'cancelled'

export interface ImportBatch {
  id: string
  batchCode: string
  supplierId: string
  invoiceNumber?: string
  importDate: Date
  totalAmount: number
  paidAmount: number
  note?: string
  status: ImportBatchStatus
  createdAt: Date
  updatedAt: Date
}

// 11. ImportItem
// NOTE: totalCost = quantity × costPrice — COMPUTED, không lưu DB
export interface ImportItem {
  id: string
  batchId: string
  productId: string
  variantId?: string
  quantity: number
  costPrice: number // nguồn duy nhất của costPrice trong toàn hệ thống
}

// 12. InventoryRecord
// NOTE: availableQty = quantity - reservedQty — COMPUTED, không lưu DB
export interface InventoryRecord {
  id: string
  productId: string
  variantId?: string
  quantity: number
  reservedQty: number
  lowStockAlert: number
  updatedAt: Date
}

// 13. StockMovement
export type StockMovementType = 'import' | 'sale' | 'return' | 'adjustment' | 'damage'

export interface StockMovement {
  id: string
  productId: string
  variantId?: string
  type: StockMovementType
  quantity: number // dương = nhập, âm = xuất
  channelId?: string
  refId?: string
  note?: string
  createdAt: Date
  createdBy?: string
}

// 14. Order
export type OrderStatus = 'pending' | 'confirmed' | 'shipping' | 'delivered' | 'cancelled' | 'returned'
export type PaymentMethod = 'cash' | 'bank_transfer' | 'momo' | 'vnpay' | 'zalopay' | 'cod' | 'card' | 'other'

export interface Order {
  id: string
  orderCode: string
  channelId: string
  customerId?: string
  externalOrderId?: string
  orderDate: Date
  status: OrderStatus
  buyerShippingFee: number
  sellerShippingFee: number
  shippingSubsidy: number
  discountAmount: number
  paymentMethod: PaymentMethod
  totalRevenue: number
  note?: string
  createdAt: Date
  updatedAt: Date
}

// 15. OrderItem
// NOTE: subtotal = sellingPrice × quantity — COMPUTED
// NOTE: profitMargin = grossProfit / subtotal × 100 — COMPUTED (revenue-based)
export interface OrderItem {
  id: string
  orderId: string
  productId: string
  variantId?: string
  quantity: number
  sellingPrice: number
  costPrice: number // snapshot tại thời điểm bán
  platformFeePct: number
  platformFee: number
  paymentFeePct: number
  paymentFee: number
  packagingCost: number
  otherCost: number
  grossProfit: number
}

// 16. Expense
export type ExpenseCategory = 'packaging' | 'shipping' | 'marketing' | 'software' | 'salary' | 'rent' | 'other'
export type RecurringInterval = 'monthly' | 'quarterly' | 'yearly'

export interface Expense {
  id: string
  channelId?: string
  category: ExpenseCategory
  name: string
  amount: number
  date: Date
  isRecurring: boolean
  recurringInterval?: RecurringInterval
  note?: string
  createdAt: Date
}

// 17. Customer
export type CustomerType = 'retail' | 'wholesale' | 'vip'

export interface Customer {
  id: string
  name: string
  phone?: string
  email?: string
  address?: string
  type: CustomerType
  note?: string
  createdAt: Date
  updatedAt: Date
}

// 18. SupplierPayment
export type SupplierPaymentMethod = 'cash' | 'bank_transfer' | 'other'

export interface SupplierPayment {
  id: string
  supplierId: string
  importBatchId?: string
  amount: number
  paymentDate: Date
  paymentMethod: SupplierPaymentMethod
  note?: string
  createdAt: Date
}
