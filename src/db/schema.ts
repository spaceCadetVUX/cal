import Dexie, { type EntityTable } from 'dexie'
import type {
  AppSettings,
  SalesChannel,
  Category,
  ChannelCategoryFee,
  Supplier,
  SupplierPayment,
  Customer,
  Product,
  ProductVariant,
  ProductChannelInfo,
  PriceConfig,
  ImportBatch,
  ImportItem,
  InventoryRecord,
  StockMovement,
  Order,
  OrderItem,
  Expense,
} from '@/types'

// ============================================================
// Dexie Database Schema — mirror 18 Data Models
// Version: 1
//
// QUAN TRỌNG: Chỉ index những field cần query/sort.
// Không index field ít dùng để tránh overhead.
// Khi thêm/sửa index → phải tăng version và viết migration.
// ============================================================

export class SellerDatabase extends Dexie {
  // 18 tables
  appSettings!: EntityTable<AppSettings, 'id'>
  salesChannels!: EntityTable<SalesChannel, 'id'>
  categories!: EntityTable<Category, 'id'>
  channelCategoryFees!: EntityTable<ChannelCategoryFee, 'id'>
  suppliers!: EntityTable<Supplier, 'id'>
  supplierPayments!: EntityTable<SupplierPayment, 'id'>
  customers!: EntityTable<Customer, 'id'>
  products!: EntityTable<Product, 'id'>
  productVariants!: EntityTable<ProductVariant, 'id'>
  productChannelInfos!: EntityTable<ProductChannelInfo, 'id'>
  priceConfigs!: EntityTable<PriceConfig, 'id'>
  importBatches!: EntityTable<ImportBatch, 'id'>
  importItems!: EntityTable<ImportItem, 'id'>
  inventoryRecords!: EntityTable<InventoryRecord, 'id'>
  stockMovements!: EntityTable<StockMovement, 'id'>
  orders!: EntityTable<Order, 'id'>
  orderItems!: EntityTable<OrderItem, 'id'>
  expenses!: EntityTable<Expense, 'id'>

  constructor() {
    super('SellerManagerDB')

    this.version(1).stores({
      // 1. AppSettings — singleton, query by id
      appSettings: 'id',

      // 2. SalesChannel
      salesChannels: 'id, type, isActive',

      // 3. Category
      categories: 'id, name',

      // 4. ChannelCategoryFee — query by channelId + categoryId
      channelCategoryFees: 'id, channelId, categoryId, [channelId+categoryId]',

      // 5. Supplier
      suppliers: 'id, name',

      // 6. SupplierPayment — query by supplierId, importBatchId
      supplierPayments: 'id, supplierId, importBatchId',

      // 7. Customer
      customers: 'id, name, type, phone',

      // 8. Product — sku phải unique
      products: 'id, &sku, categoryId, supplierId, isActive',

      // 9. ProductVariant — query by productId, sku phải unique
      productVariants: 'id, productId, &sku, isActive',

      // 10. ProductChannelInfo — query by productId + channelId
      productChannelInfos: 'id, productId, channelId, variantId, [productId+channelId]',

      // 11. PriceConfig — query by productId, channelId, variantId
      // effectiveFrom để sort lấy giá mới nhất
      priceConfigs: 'id, productId, channelId, variantId, effectiveFrom, [productId+channelId]',

      // 12. ImportBatch — query by supplierId, status, importDate
      importBatches: 'id, supplierId, status, importDate, batchCode',

      // 13. ImportItem — query by batchId, productId
      // importDate không có trong ImportItem nhưng cần lấy costPrice mới nhất:
      // → join qua ImportBatch.importDate khi query
      importItems: 'id, batchId, productId, variantId',

      // 14. InventoryRecord — 1 record per product/variant
      inventoryRecords: 'id, productId, variantId, [productId+variantId]',

      // 15. StockMovement — query by productId, type, channelId, createdAt
      stockMovements: 'id, productId, variantId, type, channelId, refId, createdAt',

      // 16. Order — query by channelId, status, orderDate, customerId
      orders: 'id, channelId, customerId, status, orderDate, orderCode',

      // 17. OrderItem — query by orderId, productId
      orderItems: 'id, orderId, productId, variantId',

      // 18. Expense — query by channelId, date, category
      expenses: 'id, channelId, date, category, isRecurring',
    })

    // Version 2: thêm index bị thiếu cho salesChannels.createdAt và products.name
    // (orderBy() trong Dexie yêu cầu field phải được index)
    this.version(2).stores({
      salesChannels: 'id, type, isActive, createdAt',
      products: 'id, &sku, categoryId, supplierId, isActive, name',
    })
  }
}
