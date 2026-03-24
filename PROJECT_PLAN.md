# Multi-Channel Seller Manager — Project Plan

> Mục tiêu: Ứng dụng web quản lý toàn diện cho người bán hàng đa kênh
> (Shopee, Lazada, TikTok Shop, Website, Cửa hàng offline, và bất kỳ kênh custom nào).
> Build theo từng Phase, dữ liệu nhất quán từ đầu đến cuối.

---

## Mục lục

1. [Data Models (Cấu trúc dữ liệu)](#1-data-models)
2. [Tech Stack](#2-tech-stack)
3. [Kiến trúc thư mục](#3-kiến-trúc-thư-mục)
4. [Tính năng chi tiết theo Module](#4-tính-năng-chi-tiết-theo-module)
5. [Roadmap theo Phase](#5-roadmap-theo-phase)
6. [Công thức tính toán](#6-công-thức-tính-toán)
7. [Phí mặc định các sàn Việt Nam](#7-phí-mặc-định-các-sàn-việt-nam)

---

## 1. Data Models

> Đây là nguồn sự thật duy nhất (single source of truth).
> Mọi tính năng đều dựa vào các model này. Không được tự ý thay đổi cấu trúc.

---

### 1.1 AppSettings (Cấu hình ứng dụng)
```ts
AppSettings {
  id                   : string (UUID)   // singleton — chỉ có 1 record
  businessName         : string
  defaultPackagingCost : number          // chi phí đóng gói mặc định
  defaultMinMarginPct  : number          // % lợi nhuận tối thiểu mặc định
  defaultLowStockAlert : number          // ngưỡng cảnh báo tồn kho mặc định
  currency             : string          // 'VND' (mở rộng sau)
  updatedAt            : Date
}
```

---

### 1.2 SalesChannel (Kênh bán hàng)
```ts
SalesChannel {
  id                     : string (UUID)
  name                   : string
  // Loại kênh — quyết định công thức tính phí
  type                   : 'shopee'
                         | 'lazada'
                         | 'tiki'
                         | 'tiktok'
                         | 'website'
                         | 'offline'    // cửa hàng, chợ, hội chợ
                         | 'custom'     // bất kỳ kênh nào khác

  platformFeePct         : number       // % phí sàn (0 nếu offline)
  paymentFeePct          : number       // % phí thanh toán / cổng thanh toán
  defaultShippingSubsidy : number       // trợ giá ship mặc định của sàn
  color                  : string       // hex color — dùng để hiển thị badge
  isActive               : boolean
  note                   : string?
  createdAt              : Date
  updatedAt              : Date
}
```

> **Ví dụ khai báo:**
> - `{ name: "Shopee Chính", type: "shopee", platformFeePct: 3, paymentFeePct: 1 }`
> - `{ name: "Website vuahanghieu.vn", type: "website", platformFeePct: 0, paymentFeePct: 1.5 }` *(VNPay)*
> - `{ name: "Cửa hàng Q.1", type: "offline", platformFeePct: 0, paymentFeePct: 0 }`
> - `{ name: "TikTok Shop", type: "tiktok", platformFeePct: 2, paymentFeePct: 1 }`

---

### 1.3 Category (Danh mục sản phẩm)
```ts
Category {
  id        : string (UUID)
  name      : string          // tên danh mục nội bộ, vd: "Thời trang nữ"
  note      : string?
  createdAt : Date
}
```

---

### 1.4 ChannelCategoryFee (Phí theo danh mục × kênh)
```ts
// Mỗi kênh có thể thu phí khác nhau theo từng danh mục sản phẩm.
// Nếu không có record này, dùng platformFeePct của SalesChannel làm mặc định.

ChannelCategoryFee {
  id          : string (UUID)
  channelId   : string        // FK → SalesChannel
  categoryId  : string        // FK → Category
  feePct      : number        // % phí ghi đè cho danh mục này trên kênh này
}
```

---

### 1.5 Supplier (Nhà cung cấp)
```ts
Supplier {
  id            : string (UUID)
  name          : string
  phone         : string
  email         : string?
  address       : string?
  contactPerson : string?
  note          : string?
  createdAt     : Date
  updatedAt     : Date
}
```

---

### 1.6 Product (Sản phẩm)
```ts
Product {
  id          : string (UUID)
  sku         : string        // mã sản phẩm nội bộ — duy nhất
  name        : string
  categoryId  : string        // FK → Category
  supplierId  : string?       // nhà cung cấp chính
  unit        : string        // cái, hộp, kg, bộ, cặp...
  images      : string[]      // URL ảnh
  description : string?
  barcode     : string?
  weight      : number?       // gram — dùng tính phí ship
  isActive    : boolean
  createdAt   : Date
  updatedAt   : Date
}
```

---

### 1.7 ProductVariant (Biến thể sản phẩm)
```ts
ProductVariant {
  id        : string (UUID)
  productId : string          // FK → Product
  name      : string          // vd: "Đỏ - L", "Xanh - M"
  sku       : string          // SKU nội bộ của biến thể
  isActive  : boolean
}
```

---

### 1.8 ProductChannelInfo (Thông tin sản phẩm trên từng kênh)
```ts
// Mỗi sản phẩm có thể được bán trên nhiều kênh với SKU và giá khác nhau.

ProductChannelInfo {
  id          : string (UUID)
  productId   : string        // FK → Product
  variantId   : string?       // FK → ProductVariant
  channelId   : string        // FK → SalesChannel
  externalSku : string?       // SKU trên sàn đó (Shopee SKU, Lazada SKU...)
  isListed    : boolean       // đang bán trên kênh này không
  listedAt    : Date?
  note        : string?
}
```

---

### 1.9 PriceConfig (Cấu hình giá)
```ts
// channelId = null  → giá gốc (base price), áp dụng cho tất cả kênh chưa có giá riêng
// channelId = <id>  → giá riêng cho kênh đó
//
// LƯU Ý: costPrice KHÔNG lưu ở đây.
// costPrice luôn được lấy từ ImportItem mới nhất của sản phẩm tại thời điểm tính toán.
// Lý do: tránh trùng lặp và mâu thuẫn dữ liệu khi giá vốn thay đổi theo từng lô nhập.

PriceConfig {
  id              : string (UUID)
  productId       : string        // FK → Product
  variantId       : string?       // FK → ProductVariant
  channelId       : string?       // FK → SalesChannel | null = base price

  sellingPrice    : number        // giá bán niêm yết
  minSellingPrice : number        // giá sàn — tính từ công thức hoặc nhập tay
  flashSalePrice  : number?       // giá flash sale / khuyến mãi
  flashSaleStart  : Date?
  flashSaleEnd    : Date?

  packagingCost   : number        // chi phí đóng gói
  otherCost       : number        // chi phí phát sinh khác
  minMarginPct    : number        // % lợi nhuận tối thiểu mong muốn

  effectiveFrom   : Date          // giá có hiệu lực từ ngày này
  createdAt       : Date
}
```

> **Luật ưu tiên giá:**
> `Giá kênh cụ thể` > `Giá base (channelId = null)`

---

### 1.10 ImportBatch (Lô nhập hàng)
```ts
ImportBatch {
  id            : string (UUID)
  batchCode     : string          // mã lô, vd: IMP-2024-001
  supplierId    : string          // FK → Supplier
  invoiceNumber : string?         // số hoá đơn của NCC để đối soát
  importDate    : Date
  totalAmount   : number          // tổng tiền lô nhập (= Σ ImportItem.totalCost)
  paidAmount    : number          // số tiền đã thanh toán cho NCC
  note          : string?
  status        : 'pending' | 'received' | 'cancelled'
  createdAt     : Date
  updatedAt     : Date
}
```

---

### 1.11 ImportItem (Chi tiết lô nhập)
```ts
ImportItem {
  id          : string (UUID)
  batchId     : string          // FK → ImportBatch
  productId   : string          // FK → Product
  variantId   : string?         // FK → ProductVariant
  quantity    : number
  costPrice   : number          // giá vốn tại thời điểm nhập — đây là nguồn duy nhất của costPrice
  // totalCost = quantity × costPrice — COMPUTED, không lưu DB, tính lúc runtime
}
```

---

### 1.12 InventoryRecord (Tồn kho)
```ts
// Tồn kho là CHUNG cho tất cả kênh — không chia kho theo kênh.
// Khi bán ở bất kỳ kênh nào, tồn kho đều trừ từ đây.

InventoryRecord {
  id            : string (UUID)
  productId     : string
  variantId     : string?
  quantity      : number        // tổng tồn kho hiện tại — lưu DB
  reservedQty   : number        // đang chờ giao (đã có đơn, chưa xuất) — lưu DB
  // availableQty = quantity - reservedQty — COMPUTED, không lưu DB, tính lúc runtime
  lowStockAlert : number        // ngưỡng cảnh báo hàng sắp hết
  updatedAt     : Date
}
```

---

### 1.13 StockMovement (Lịch sử biến động kho)
```ts
StockMovement {
  id          : string (UUID)
  productId   : string
  variantId   : string?
  type        : 'import' | 'sale' | 'return' | 'adjustment' | 'damage'
  quantity    : number          // dương = nhập, âm = xuất
  channelId   : string?         // kênh bán liên quan (nếu type = sale/return)
  refId       : string?         // ID ImportBatch hoặc Order liên quan
  note        : string?
  createdAt   : Date
  createdBy   : string?
}
```

---

### 1.14 Order (Đơn bán)
```ts
Order {
  id                : string (UUID)
  orderCode         : string          // mã đơn nội bộ
  channelId         : string          // FK → SalesChannel
  customerId        : string?         // FK → Customer (nếu có)
  externalOrderId   : string?         // mã đơn trên sàn (Shopee, Lazada...) hoặc mã hoá đơn offline
  orderDate         : Date
  status            : 'pending' | 'confirmed' | 'shipping' | 'delivered' | 'cancelled' | 'returned'

  // Phí vận chuyển — tách rõ ai chịu
  buyerShippingFee  : number          // phí ship khách trả
  sellerShippingFee : number          // phí ship shop chịu (trừ vào lợi nhuận)
  shippingSubsidy   : number          // sàn trợ giá ship (Shopee, Lazada...) hoặc 0

  discountAmount    : number          // giảm giá voucher/coupon
  paymentMethod     : 'cash' | 'bank_transfer' | 'momo' | 'vnpay' | 'zalopay' | 'cod' | 'card' | 'other'
  totalRevenue      : number          // tổng doanh thu = Σ(items.sellingPrice × qty) - discountAmount
  note              : string?
  createdAt         : Date
  updatedAt         : Date
}
```

---

### 1.15 OrderItem (Chi tiết đơn bán)
```ts
OrderItem {
  id               : string (UUID)
  orderId          : string          // FK → Order
  productId        : string          // FK → Product
  variantId        : string?
  quantity         : number
  sellingPrice     : number          // giá bán thực tế (mỗi đơn vị)
  costPrice        : number          // snapshot giá vốn tại thời điểm bán
                                     // (lấy từ ImportItem mới nhất, lưu lại để báo cáo lịch sử)

  // Phí kênh — snapshot tại thời điểm tạo đơn (không thay đổi dù cấu hình kênh sau này thay đổi)
  platformFeePct   : number          // % phí sàn
  platformFee      : number          // = sellingPrice × platformFeePct / 100
  paymentFeePct    : number          // % phí thanh toán
  paymentFee       : number          // = sellingPrice × paymentFeePct / 100

  packagingCost    : number
  otherCost        : number

  // subtotal = sellingPrice × quantity — COMPUTED, không lưu DB
  grossProfit      : number          // lợi nhuận gộp = subtotal - (costPrice + fees + costs) × qty
  // profitMargin = grossProfit / (sellingPrice × quantity) × 100 — COMPUTED, không lưu DB
  // Lưu ý: profitMargin là revenue-based margin (% trên doanh thu), KHÔNG phải markup
}
```

---

### 1.16 Expense (Chi phí vận hành)
```ts
Expense {
  id                : string (UUID)
  channelId         : string?       // FK → SalesChannel | null = chi phí chung toàn bộ
  category          : 'packaging' | 'shipping' | 'marketing' | 'software' | 'salary' | 'rent' | 'other'
  name              : string
  amount            : number
  date              : Date
  isRecurring       : boolean       // chi phí lặp lại hàng tháng (lương, mặt bằng, phần mềm...)
  recurringInterval : 'monthly' | 'quarterly' | 'yearly' | null  // null nếu isRecurring = false
  note              : string?
  createdAt         : Date
}
```

---

### 1.17 Customer (Khách hàng)
```ts
// Dùng cho kênh offline và website.
// Kênh Shopee/Lazada thường không lộ thông tin khách — để null là được.

Customer {
  id           : string (UUID)
  name         : string
  phone        : string?
  email        : string?
  address      : string?
  type         : 'retail'      // khách lẻ
               | 'wholesale'   // khách sỉ / đại lý
               | 'vip'         // khách thân thiết
  note         : string?
  createdAt    : Date
  updatedAt    : Date
}
```

---

### 1.18 SupplierPayment (Thanh toán / Công nợ NCC)
```ts
// Theo dõi các lần thanh toán cho nhà cung cấp.
// Công nợ còn lại = ImportBatch.totalAmount - Σ(SupplierPayment.amount) của lô đó.

SupplierPayment {
  id            : string (UUID)
  supplierId    : string        // FK → Supplier
  importBatchId : string?       // FK → ImportBatch | null nếu thanh toán tổng không gắn với lô cụ thể
  amount        : number        // số tiền đã thanh toán
  paymentDate   : Date
  paymentMethod : 'cash' | 'bank_transfer' | 'other'
  note          : string?
  createdAt     : Date
}
```

---

### Sơ đồ quan hệ (ERD tóm tắt)

```
AppSettings (1 record duy nhất)

SalesChannel (nhiều)
  ├── ChannelCategoryFee (nhiều) ──→ Category
  ├── ProductChannelInfo (nhiều) ──→ Product / ProductVariant
  ├── PriceConfig (nhiều, channelId?) ──→ Product / ProductVariant
  ├── Order (nhiều)
  │     ├── OrderItem (nhiều) ──→ Product / ProductVariant
  │     └── Customer? ──→ Customer
  ├── Expense (nhiều, channelId?)
  └── StockMovement (nhiều, channelId?)

Supplier (nhiều)
  ├── ImportBatch (nhiều)
  │     ├── ImportItem (nhiều) ──→ Product / ProductVariant
  │     └── SupplierPayment (nhiều)
  └── SupplierPayment (nhiều, importBatchId?)

Customer (nhiều)
  └── Order (nhiều)

Product (nhiều)
  ├── ProductVariant (nhiều)
  └── InventoryRecord (1 per product/variant)
```

**Computed fields (không lưu DB):**
- `InventoryRecord.availableQty` = `quantity` - `reservedQty`
- `ImportItem.totalCost` = `quantity` × `costPrice`
- `OrderItem.subtotal` = `sellingPrice` × `quantity`
- `OrderItem.profitMargin` = `grossProfit` / `subtotal` × 100
- `SupplierPayment debt` = `ImportBatch.totalAmount` - Σ(`SupplierPayment.amount`)

---

## 2. Tech Stack

### Phase 1–2 (Frontend only)

| Thành phần | Công nghệ | Phiên bản | Ghi chú |
|------------|-----------|-----------|---------|
| Framework | React | 18.x | Component-based UI |
| Build tool | Vite | 5.x | Nhanh, HMR tốt |
| Language | TypeScript | 5.x | Type-safe, bắt buộc |
| Styling | Tailwind CSS | 3.x | Utility-first, responsive |
| UI Components | shadcn/ui | latest | Accessible, customizable |
| State management | Zustand | 4.x | Nhẹ hơn Redux |
| Local Database | Dexie.js (IndexedDB) | 3.x | Offline-first, hỗ trợ migration |
| Form | React Hook Form | 7.x | Hiệu năng cao |
| Validation | Zod | 3.x | TypeScript-native schema |
| Routing | React Router | 6.x | SPA routing |
| Charts | Recharts | 2.x | Biểu đồ doanh thu/lợi nhuận |
| Date | date-fns | 3.x | Xử lý ngày tháng |
| Icons | Lucide React | latest | Icon nhất quán |
| Notifications | Sonner | latest | Toast thông báo |
| Table | TanStack Table | 8.x | Sort/filter/pagination dữ liệu lớn |
| Export | xlsx + jsPDF | latest | Xuất Excel, PDF báo cáo |

### Phase 3 (Backend + Sync)

| Thành phần | Công nghệ | Ghi chú |
|------------|-----------|---------|
| Backend-as-a-Service | Supabase | PostgreSQL + Auth + Realtime + Storage |
| Authentication | Supabase Auth | Email/password, Google OAuth |
| Realtime sync | Supabase Realtime | Đồng bộ đa thiết bị |
| File storage | Supabase Storage | Ảnh sản phẩm |
| ORM | Drizzle ORM | Type-safe SQL |

### Phase 4 (PWA / Mobile)

| Thành phần | Công nghệ | Ghi chú |
|------------|-----------|---------|
| PWA | Vite PWA Plugin | Cài app lên điện thoại |
| Offline sync | Dexie Cloud | Sync offline ↔ online |

---

## 3. Kiến trúc thư mục

```
src/
├── assets/
├── components/
│   ├── ui/                    # shadcn/ui base components
│   ├── layout/                # Sidebar, Header, PageLayout
│   ├── shared/                # DataTable, ConfirmDialog, StatCard, ChannelBadge...
│   └── charts/                # ProfitChart, RevenueChart, ChannelBreakdownChart...
│
├── pages/
│   ├── dashboard/
│   ├── channels/              # quản lý kênh bán hàng
│   ├── products/
│   ├── suppliers/
│   ├── imports/
│   ├── inventory/
│   ├── orders/
│   │   └── pos/               # Quick POS mode
│   ├── pricing/
│   ├── expenses/
│   ├── customers/
│   ├── reports/
│   └── settings/
│
├── stores/                    # Zustand stores
│   ├── useChannelStore.ts
│   ├── useProductStore.ts
│   ├── useSupplierStore.ts
│   ├── useInventoryStore.ts
│   ├── useOrderStore.ts
│   ├── usePriceStore.ts
│   ├── useCustomerStore.ts
│   └── useSettingsStore.ts
│
├── db/
│   ├── schema.ts              # Dexie schema — mirror toàn bộ Data Models
│   ├── db.ts                  # Dexie instance
│   └── migrations/            # version migrations
│
├── hooks/
│   ├── useChannelFee.ts       # tính phí kênh cho 1 sản phẩm/đơn
│   ├── useProfitCalc.ts       # tính lợi nhuận real-time
│   └── useInventoryAlert.ts
│
├── utils/
│   ├── profitCalculator.ts    # tất cả công thức — nguồn sự thật duy nhất
│   ├── priceCalculator.ts     # tính giá sàn, giá đề xuất
│   ├── channelFeeResolver.ts  # resolve phí kênh theo category
│   ├── inventoryHelper.ts
│   └── formatters.ts          # format VND, %, ngày
│
├── types/                     # TypeScript interfaces — mirror Data Models
│   ├── channel.ts
│   ├── product.ts
│   ├── order.ts
│   ├── customer.ts
│   ├── supplier.ts
│   └── ...
│
├── constants/
│   ├── channelDefaults.ts     # phí mặc định theo loại kênh + danh mục
│   └── appConfig.ts
│
└── lib/
    └── utils.ts               # cn() và helper dùng chung
```

---

## 4. Tính năng chi tiết theo Module

---

### Module 1: Dashboard (Tổng quan)

- **Bộ lọc kênh**: Xem tất cả kênh hoặc chọn 1 kênh cụ thể
- **Thẻ KPI hôm nay**: Doanh thu, Lợi nhuận, Số đơn, Margin TB (có thể lọc theo kênh)
- **Thẻ KPI tháng này**: So sánh với tháng trước (% tăng/giảm)
- **Biểu đồ doanh thu 30 ngày** — line chart, có thể stack theo kênh
- **Biểu đồ lợi nhuận 30 ngày** — bar chart
- **Breakdown doanh thu theo kênh** — donut/pie chart
- **Top 5 sản phẩm bán chạy** (số lượng + doanh thu)
- **Top 5 sản phẩm lãi nhiều nhất** (profit + margin)
- **Danh sách hàng sắp hết** (dưới ngưỡng cảnh báo)
- **Đơn hàng gần nhất** (10 đơn mới nhất, có badge kênh)
- **Cảnh báo**:
  - Giá bán < giá sàn (theo từng kênh)
  - Hàng sắp hết / hết hàng
  - Flash sale đang chạy
  - Đơn chưa xử lý

---

### Module 2: Channels (Kênh bán hàng)

#### 2.1 Danh sách kênh
- Bảng: Tên, Loại, Phí sàn, Phí TT, Số đơn tháng này, Doanh thu tháng này, Trạng thái
- Badge màu riêng cho từng kênh

#### 2.2 Thêm / Sửa kênh
- Tên kênh (vd: "Shopee Mall", "Website chính")
- Loại kênh (chọn từ list: Shopee / Lazada / Tiki / TikTok / Website / Offline / Custom)
- % Phí sàn (prefill theo loại, có thể sửa)
- % Phí thanh toán (prefill, có thể sửa)
- Trợ giá ship mặc định
- Màu badge
- Ghi chú

#### 2.3 Cấu hình phí theo danh mục
- Override phí sàn cho từng danh mục (ChannelCategoryFee)
- Bảng: Danh mục × Phí — dễ chỉnh sửa

#### 2.4 Chi tiết kênh
- Thống kê: tổng đơn, tổng doanh thu, tổng lợi nhuận, margin TB
- Biểu đồ doanh thu kênh theo thời gian
- Danh sách sản phẩm đang bán trên kênh này
- Lịch sử đơn hàng của kênh

---

### Module 3: Products (Sản phẩm)

#### 3.1 Danh sách sản phẩm
- Bảng: SKU, Tên, Danh mục, Tồn kho, Giá vốn, Đang bán trên (badge kênh), Trạng thái
- Tìm kiếm theo tên / SKU / barcode
- Lọc theo danh mục, nhà cung cấp, kênh đang bán, trạng thái tồn kho

#### 3.2 Thêm / Sửa sản phẩm
- Thông tin cơ bản: SKU, tên, danh mục, nhà cung cấp chính, đơn vị, mô tả
- Upload ảnh (nhiều ảnh)
- Barcode / mã vạch
- Cân nặng (gram)
- Thêm biến thể (màu, size, v.v.)
- **Tab "Kênh bán"**: tick chọn kênh đang bán + nhập External SKU từng kênh

#### 3.3 Chi tiết sản phẩm
- Thông tin chung
- **Giá theo kênh**: bảng kênh × giá bán × margin × giá sàn
- Tồn kho theo biến thể
- Lịch sử nhập hàng
- Lịch sử bán theo kênh (biểu đồ stacked bar)
- Lịch sử giá vốn

---

### Module 4: Suppliers (Nhà cung cấp)

- Danh sách: tên, SĐT, địa chỉ, số SP, tổng nhập, **công nợ hiện tại**
- CRUD nhà cung cấp
- Chi tiết NCC:
  - Thông tin liên hệ
  - Lịch sử nhập hàng
  - **Công nợ**: tổng tiền nhập, tổng đã trả, còn nợ
  - **Lịch sử thanh toán** (SupplierPayment)
  - Nút "Ghi nhận thanh toán" → tạo SupplierPayment
  - Danh sách sản phẩm từ NCC này
  - **Lịch sử giá vốn theo NCC** (giá NCC thay đổi ra sao qua thời gian)

---

### Module 5: Imports (Nhập hàng)

#### 5.1 Danh sách lô nhập
- Bảng: Mã lô, NCC, Ngày nhập, Số SP, Tổng tiền, Trạng thái
- Lọc theo NCC, ngày, trạng thái

#### 5.2 Tạo phiếu nhập
- Chọn nhà cung cấp, ngày nhập
- Thêm nhiều dòng: sản phẩm/biến thể, số lượng, giá vốn
- Tự động tính tổng
- Xác nhận → cập nhật InventoryRecord + StockMovement
- Tự động tạo PriceConfig mới nếu giá vốn thay đổi

#### 5.3 Chi tiết & quản lý lô
- Danh sách sản phẩm trong lô
- Nút "Xác nhận nhận hàng" / "Hủy lô"

---

### Module 6: Inventory (Tồn kho)

#### 6.1 Tổng quan tồn kho
- Bảng: SP, SKU, Tồn kho, Đang giữ, Có thể bán, Giá trị tồn (theo giá vốn), Cảnh báo
- Lọc: tất cả / sắp hết / hết hàng
- Tổng giá trị tồn kho toàn bộ

#### 6.2 Điều chỉnh tồn kho
- Cộng / trừ thủ công (lý do: hàng hỏng, kiểm đếm, v.v.)
- Ghi vào StockMovement

#### 6.3 Lịch sử biến động kho
- Timeline: nhập / xuất (kèm kênh bán) / điều chỉnh
- Lọc theo SP, loại biến động, kênh, ngày

#### 6.4 Cài đặt cảnh báo
- Đặt ngưỡng cảnh báo cho từng SP

---

### Module 7: Pricing (Quản lý giá)

#### 7.1 Bảng giá tổng quan
- Bảng: SP, Giá vốn, và cột giá cho từng kênh (giá bán, margin, giá sàn)
- Cảnh báo đỏ: giá bán < giá sàn
- Cảnh báo vàng: margin < mức tối thiểu

#### 7.2 Price Calculator (Máy tính giá)
- **Input:**
  - Giá vốn
  - Chọn kênh → tự động điền % phí sàn + % phí TT
  - Chọn danh mục → override phí nếu có ChannelCategoryFee
  - % phí sàn (có thể sửa tay)
  - % phí thanh toán (có thể sửa tay)
  - Phí đóng gói
  - Chi phí khác
  - % lợi nhuận mong muốn
- **Output (real-time):**
  - Giá bán tối thiểu (không lỗ)
  - Giá bán đề xuất (theo % margin mong muốn)
  - Lợi nhuận tuyệt đối (VND)
  - % Margin thực tế
  - Breakdown: giá vốn / phí sàn / phí TT / đóng gói / chi phí khác / lợi nhuận
- **So sánh đa kênh**: nhập giá bán → hiển thị bảng margin theo từng kênh cùng lúc

#### 7.3 Gán giá cho sản phẩm
- Gán PriceConfig base (áp dụng tất cả kênh)
- Gán PriceConfig riêng cho kênh cụ thể

#### 7.4 Lịch sử giá
- Giá vốn theo từng lô nhập
- Margin theo kênh qua các thời kỳ

#### 7.5 Flash Sale / Khuyến mãi
- Đặt giá flash sale + thời gian cho từng kênh
- Cảnh báo nếu giá flash sale < giá sàn

#### 7.6 Cập nhật giá hàng loạt
- Chọn nhiều SP + chọn kênh → tăng/giảm theo % hoặc số tiền cố định

---

### Module 8: Orders (Đơn bán)

#### 8.1 Danh sách đơn
- Bảng: Mã đơn, Kênh (badge), Ngày, Doanh thu, Lợi nhuận, Margin, Trạng thái
- Lọc theo kênh, trạng thái, ngày, khoảng lợi nhuận
- Tìm kiếm theo mã đơn nội bộ / mã đơn ngoài

#### 8.2 Tạo đơn bán thủ công
- **Chọn kênh** → tự động áp dụng phí kênh đó
- Chọn khách hàng (hoặc tạo mới, hoặc để trống nếu vãng lai)
- Thêm nhiều sản phẩm + số lượng
- Giá bán thực tế (auto fill từ PriceConfig kênh, có thể sửa)
- Phương thức thanh toán
- Phí vận chuyển (buyerShippingFee / sellerShippingFee / shippingSubsidy)
- Voucher / giảm giá
- Phí kênh tự động tính theo SP × category × channel
- Breakdown lợi nhuận real-time khi nhập

#### 8.3 Quick POS Mode (cho cửa hàng offline)
- Giao diện tối giản: tìm SP nhanh bằng tên/barcode, chọn số lượng, thu tiền
- Tự động chọn kênh offline mặc định
- Tổng tiền + tiền thối real-time
- In hoá đơn / biên lai đơn giản
- Không cần điền đủ thông tin như form tạo đơn thông thường

#### 8.4 Chi tiết đơn
- Breakdown lợi nhuận từng dòng SP
- Tổng: doanh thu / phí kênh / phí TT / đóng gói / chi phí ship / lợi nhuận gộp

#### 8.5 Import đơn hàng từ file
- Import CSV/Excel từ Shopee Seller Center, Lazada Order Export...
- Tự động map với sản phẩm trong hệ thống
- Template mẫu cho từng loại kênh

#### 8.6 Hoàn trả (Return)
- Tạo đơn hoàn → cộng lại tồn kho
- Ghi nhận lý do hoàn trả

---

### Module 9: Expenses (Chi phí vận hành)

- Thêm chi phí: gắn với kênh cụ thể hoặc chi phí chung
- Loại: đóng gói, marketing, phần mềm, lương, mặt bằng, khác
- Danh sách theo tháng, lọc theo kênh
- Lợi nhuận ròng = Lợi nhuận gộp - Chi phí vận hành (phân bổ theo kênh nếu có)

---

### Module 10: Reports (Báo cáo)

#### 10.1 Báo cáo Doanh thu
- Theo ngày / tuần / tháng / quý / năm
- Lọc theo kênh hoặc tất cả kênh
- Line chart: doanh thu tổng & stack theo kênh
- So sánh cùng kỳ

#### 10.2 Báo cáo Lợi nhuận
- Lợi nhuận gộp và ròng
- Margin TB theo thời gian
- Bar chart lợi nhuận theo kênh

#### 10.3 Báo cáo Kênh bán
- So sánh các kênh: doanh thu, lợi nhuận, số đơn, margin TB
- Kênh nào hiệu quả nhất (ROI)
- Phí sàn tổng đã trả cho từng kênh

#### 10.4 Báo cáo Sản phẩm
- Top bán chạy (qty + revenue) — lọc theo kênh
- Top lãi nhiều nhất (profit + margin)
- SP không bán được (0 đơn trong N ngày)

#### 10.5 Báo cáo Tồn kho
- Giá trị tồn theo thời gian
- Tỷ lệ xoay vòng hàng (inventory turnover)

#### 10.6 Báo cáo Chi phí
- Breakdown chi phí theo loại & kênh
- Chi phí vs Doanh thu vs Lợi nhuận

#### 10.7 Báo cáo Công nợ NCC
- Danh sách NCC + tổng công nợ hiện tại
- Lịch sử thanh toán từng NCC
- Cảnh báo NCC có công nợ lâu chưa trả

#### 10.8 Báo cáo Khách hàng
- Top khách chi tiêu nhiều nhất
- Khách hàng quay lại (repeat buyers)
- Khách hàng không mua lại trong N ngày (churn risk)
- Doanh thu trung bình mỗi đơn theo loại khách (retail / wholesale / vip)

#### 10.9 Break-even Analysis
- Cần bán bao nhiêu đơn / bao nhiêu doanh thu để bù toàn bộ chi phí tháng này
- Hiển thị tiến độ đạt break-even trong tháng hiện tại

#### 10.10 Export
- Xuất tất cả báo cáo ra Excel (.xlsx)
- Xuất ra PDF

---

### Module 11: Customers (Khách hàng)

- Danh sách: tên, SĐT, loại (retail/wholesale/vip), tổng đơn, tổng chi tiêu
- Tìm kiếm theo tên / SĐT
- Thêm / Sửa khách hàng
- Chi tiết khách hàng:
  - Thông tin liên hệ
  - Lịch sử mua hàng (danh sách đơn)
  - Tổng chi tiêu / số đơn / giá trị đơn TB
  - Sản phẩm hay mua nhất

---

### Module 12: Settings (Cài đặt)

- Tên doanh nghiệp
- Chi phí đóng gói mặc định
- % lợi nhuận tối thiểu mặc định
- Ngưỡng cảnh báo tồn kho mặc định
- Đơn vị tiền tệ
- Export toàn bộ data (backup JSON)
- Import data từ file backup
- Xóa toàn bộ data (reset)

---

## 5. Roadmap theo Phase

> **Quy tắc đọc:**
> - Mỗi Sprint phải hoàn thành **100%** trước khi bắt đầu Sprint tiếp theo
> - `[dep: X.Y]` = task này phụ thuộc vào Sprint X.Y phải xong trước
> - **Done criteria** = tiêu chí xác nhận Sprint hoàn thành

---

## PHASE 1 — Local MVP (Chạy offline, lưu IndexedDB)

---

### ✅ Sprint 1.1 — Project Setup
> **Mục tiêu:** Khởi tạo project, cấu hình đầy đủ, chạy được trên browser
> **Done:** `pnpm build` không lỗi ✅

- [x] Khởi tạo project: `pnpm create vite` với template React + TypeScript
- [x] Cài dependencies: Tailwind CSS v3 + cấu hình `tailwind.config`
- [x] Cài shadcn/ui thủ công (Radix UI + CVA + clsx + tailwind-merge)
- [x] Cài thư viện: Zustand, Dexie.js, React Router v7, date-fns, Lucide React, Sonner
- [x] Cài thư viện: React Hook Form + Zod, TanStack Table, Recharts
- [x] Thiết lập Prettier + `.editorconfig`
- [x] Thiết lập alias path `@/` trong `vite.config.ts` + `tsconfig.app.json`
- [x] Tạo cấu trúc thư mục `src/` theo Section 3
- [x] Tạo file `src/lib/utils.ts` với hàm `cn()`
- [x] Tạo file `src/constants/appConfig.ts` (tên app, version)

---

### ✅ Sprint 1.2 — Database Layer
> **Mục tiêu:** Toàn bộ schema Dexie.js sẵn sàng, seed data chạy được
> `[dep: 1.1]`
> **Done:** `pnpm build` không lỗi ✅

- [x] Tạo `src/db/schema.ts` — SellerDatabase extends Dexie, đủ 18 tables với indexes
- [x] Tạo `src/db/db.ts` — singleton instance
- [x] Tạo `src/db/migrations/README.md` — version history
- [x] Tạo `src/constants/channelDefaults.ts` — phí Shopee/Lazada/TikTok/Tiki/Website/Offline
- [x] Tạo `src/db/seed.ts` — AppSettings + 6 channels + 19 categories + ChannelCategoryFees
- [x] Tạo `src/types/index.ts` — 18 TypeScript interfaces đúng theo Data Models
- [x] Tạo `src/utils/idGenerator.ts` — crypto.randomUUID()
- [x] Gắn seed vào `main.tsx` — chạy trước render, skip nếu đã có data

---

### Sprint 1.3 — Utility Functions ✅
> **Mục tiêu:** Toàn bộ logic tính toán viết xong, có thể test độc lập
> `[dep: 1.2]`
> **Done:** Mỗi function có input/output test thủ công pass

- [x] `src/utils/channelFeeResolver.ts`
  - `resolveChannelFee(channelId, categoryId)` → `{ platformFeePct, paymentFeePct }`
  - Logic: ChannelCategoryFee override > SalesChannel default
- [x] `src/utils/priceCalculator.ts`
  - `calcMinSellingPrice(costPrice, fees, packagingCost, otherCost)` → `number`
  - `calcSuggestedPrice(costPrice, fees, packagingCost, otherCost, minMarginPct)` → `number`
- [x] `src/utils/profitCalculator.ts`
  - `calcProfitPerUnit(sellingPrice, costPrice, fees, packagingCost, otherCost)` → `{ grossProfit, profitMargin }`
  - `calcOrderItemProfit(item)` → `{ grossProfit, subtotal, profitMargin }` — COMPUTED
  - `calcOrderProfit(order, items)` → `{ totalRevenue, totalCost, grossProfit, netShippingCost }`
  - `calcNetProfit(grossProfit, expenses)` → `number`
  - `calcSupplierDebt(supplierId, batches, payments)` → `number`
- [x] `src/utils/inventoryHelper.ts`
  - `calcAvailableQty(quantity, reservedQty)` → `number` — COMPUTED
  - `isLowStock(available, lowStockAlert)` → `boolean`
- [x] `src/utils/formatters.ts`
  - `formatVND(amount)` → `"1.250.000 ₫"`
  - `formatPct(value)` → `"12.5%"`
  - `formatDate(date)` → `"25/03/2026"`
  - `formatDateRange(from, to)` → string
- [x] `src/utils/idGenerator.ts` — `generateId()` → UUID v4

---

### Sprint 1.4 — Layout & Navigation ✅
> **Mục tiêu:** Layout chính + routing hoàn chỉnh, điều hướng giữa các trang
> `[dep: 1.1]`
> **Done:** Click từng menu item → đúng trang, không lỗi console

- [x] Tạo `src/components/layout/Sidebar.tsx`
  - Logo + tên app
  - Menu items: Dashboard, Kênh bán, Danh mục, NCC, Khách hàng, Sản phẩm, Nhập hàng, Tồn kho, Giá, Đơn bán, Chi phí, Báo cáo, Cài đặt
  - Active state theo route hiện tại
  - Collapse/expand sidebar
- [x] Tạo `src/components/layout/Header.tsx`
  - Tiêu đề trang hiện tại
  - Nút tìm kiếm toàn cục (placeholder, chức năng Phase 2)
  - Thông báo / alert badge
- [x] Tạo `src/components/layout/PageLayout.tsx` — wrapper cho mọi trang (title + children)
- [x] Cấu hình React Router: tất cả routes cho 12 module + 404 page
- [x] Tạo placeholder page cho từng module (chỉ render tên trang)
- [x] Tạo `src/components/shared/StatCard.tsx` — thẻ KPI tái sử dụng
- [x] Tạo `src/components/shared/DataTable.tsx` — wrapper TanStack Table với sort/filter/pagination
- [x] Tạo `src/components/shared/ConfirmDialog.tsx` — dialog xác nhận xóa
- [x] Tạo `src/components/shared/ChannelBadge.tsx` — badge màu tên kênh

---

### Sprint 1.5 — Settings & Channels
> **Mục tiêu:** Cấu hình app + quản lý kênh bán đầy đủ
> `[dep: 1.3, 1.4]`
> **Done:** Tạo/sửa/xóa kênh thành công, phí lưu đúng vào DB

- [ ] **Trang Settings:**
  - Form sửa AppSettings: tên doanh nghiệp, packagingCost mặc định, minMarginPct mặc định, lowStockAlert mặc định
  - Nút Export backup JSON (toàn bộ DB)
  - Nút Import từ file backup
  - Nút Reset toàn bộ data (có confirm dialog)
- [ ] **Zustand store:** `useSettingsStore` — load/save AppSettings
- [ ] **Trang Channels — danh sách:**
  - Bảng: Tên, Loại, Phí sàn, Phí TT, Trạng thái
  - Badge màu cho từng kênh
  - Nút Thêm / Sửa / Xóa / Bật-Tắt
- [ ] **Form Thêm/Sửa kênh:**
  - Các field theo model SalesChannel
  - Dropdown loại kênh → prefill phí mặc định từ `channelDefaults.ts`
  - Color picker cho badge
- [ ] **Tab "Phí theo danh mục"** trong chi tiết kênh:
  - Bảng danh mục × phí (editable inline)
  - Lưu vào ChannelCategoryFee
- [ ] **Zustand store:** `useChannelStore` — CRUD SalesChannel + ChannelCategoryFee

---

### Sprint 1.6 — Categories, Suppliers & Customers
> **Mục tiêu:** Master data cơ bản sẵn sàng để dùng trong các module sau
> `[dep: 1.4]`
> **Done:** CRUD 3 module hoạt động, validate form đúng

- [ ] **Trang Categories:**
  - Danh sách + Thêm/Sửa/Xóa danh mục
  - Validate: không xóa nếu có sản phẩm đang dùng
- [ ] **Trang Suppliers — danh sách:**
  - Bảng: Tên, SĐT, Số SP, Tổng nhập, Công nợ
  - Tìm kiếm theo tên / SĐT
- [ ] **Form Thêm/Sửa NCC:** đầy đủ fields theo model Supplier
- [ ] **Trang Chi tiết NCC:**
  - Thông tin + lịch sử nhập hàng (hiện tại placeholder, đổ data ở Sprint 1.8)
  - Công nợ: tổng nhập / đã trả / còn nợ (tính từ `calcSupplierDebt`)
  - Danh sách SupplierPayment
  - Form "Ghi nhận thanh toán" → tạo SupplierPayment
- [ ] **Trang Customers — danh sách:**
  - Bảng: Tên, SĐT, Loại, Tổng đơn, Tổng chi tiêu
  - Lọc theo loại (retail/wholesale/vip)
- [ ] **Form Thêm/Sửa Customer:** đầy đủ fields
- [ ] **Zustand stores:** `useSupplierStore`, `useCustomerStore`

---

### Sprint 1.7 — Products
> **Mục tiêu:** Quản lý sản phẩm + biến thể + khai báo kênh
> `[dep: 1.5, 1.6]`
> **Done:** Thêm SP có biến thể, gắn 2+ kênh, lưu đúng vào DB

- [ ] **Trang Products — danh sách:**
  - Bảng: SKU, Tên, Danh mục, Tồn kho, Kênh đang bán (badges), Trạng thái
  - Tìm kiếm theo tên / SKU / barcode
  - Lọc theo danh mục, kênh, trạng thái
  - Nút Thêm / Sửa / Xóa / Bật-Tắt
- [ ] **Form Thêm/Sửa sản phẩm — Tab "Thông tin":**
  - SKU (auto-generate hoặc nhập tay), tên, danh mục, NCC, đơn vị, mô tả, barcode, cân nặng
  - Upload ảnh (lưu base64 vào IndexedDB ở Phase 1, migrate sang Storage ở Phase 3)
- [ ] **Form Thêm/Sửa sản phẩm — Tab "Biến thể":**
  - Thêm/xóa biến thể, mỗi biến thể có tên + SKU riêng
  - Sản phẩm không có biến thể cũng được (single variant mode)
- [ ] **Form Thêm/Sửa sản phẩm — Tab "Kênh bán":**
  - Checkbox chọn kênh đang bán
  - Nhập External SKU cho từng kênh được chọn
  - Lưu vào ProductChannelInfo
- [ ] **Trang Chi tiết sản phẩm:**
  - Thông tin chung
  - Bảng giá theo kênh (placeholder, đổ data ở Sprint 1.9)
  - Tồn kho theo biến thể (placeholder, đổ data ở Sprint 1.8)
  - Lịch sử nhập / bán (placeholder, đổ data ở Sprint 1.8 / 1.10)
- [ ] **Zustand store:** `useProductStore`

---

### Sprint 1.8 — Imports & Inventory
> **Mục tiêu:** Nhập hàng → tồn kho tự động cập nhật
> `[dep: 1.7]`
> **Done:** Xác nhận lô nhập → InventoryRecord và StockMovement được tạo đúng

- [ ] **Trang Imports — danh sách:**
  - Bảng: Mã lô, NCC, Ngày nhập, Số SP, Tổng tiền, Trạng thái
  - Lọc theo NCC, trạng thái, ngày
- [ ] **Form tạo phiếu nhập:**
  - Chọn NCC, ngày nhập, số hoá đơn NCC
  - Thêm dòng sản phẩm: chọn SP/biến thể, số lượng, giá vốn
  - Tổng tiền tự tính real-time (COMPUTED)
  - Ghi chú
  - Lưu với status = `pending`
- [ ] **Action "Xác nhận nhận hàng":**
  - Đổi status → `received`
  - Upsert InventoryRecord (cộng `quantity`)
  - Tạo StockMovement (type = `import`)
  - **Không** tạo PriceConfig — giá vốn lấy từ ImportItem khi cần
- [ ] **Action "Hủy lô":** đổi status → `cancelled`, không thay đổi tồn kho
- [ ] **Trang Inventory — tổng quan:**
  - Bảng: SP, SKU, Tồn kho, Đang giữ, Có thể bán (COMPUTED), Giá trị tồn, Cảnh báo
  - Lọc: tất cả / sắp hết / hết hàng
  - Tổng giá trị tồn kho cuối bảng
- [ ] **Form điều chỉnh tồn kho:** cộng/trừ số lượng + lý do → tạo StockMovement (type = `adjustment`)
- [ ] **Trang lịch sử biến động kho:** timeline + lọc theo SP / loại / ngày
- [ ] Hiển thị cảnh báo tồn kho trên trang chi tiết sản phẩm
- [ ] **Zustand stores:** `useInventoryStore`

---

### Sprint 1.9 — Pricing
> **Mục tiêu:** Price Calculator + gán giá per-channel hoạt động
> `[dep: 1.7, 1.8]` (cần costPrice từ ImportItem)
> **Done:** Nhập giá vốn + chọn kênh → tính đúng giá sàn, giá đề xuất, margin

- [ ] **Trang Pricing — bảng giá tổng quan:**
  - Bảng: SP, Giá vốn (từ ImportItem mới nhất), sau đó 1 cột per kênh active: giá bán / margin / cảnh báo
  - Cảnh báo đỏ: giá bán < giá sàn
  - Cảnh báo vàng: margin < minMarginPct
- [ ] **Price Calculator (standalone tool):**
  - Input: giá vốn, chọn kênh, chọn danh mục, phí đóng gói, chi phí khác, % margin mong muốn
  - Khi chọn kênh + danh mục → `resolveChannelFee()` tự điền % phí
  - Output real-time: giá sàn, giá đề xuất, lợi nhuận VND, % margin, breakdown
- [ ] **Form gán giá cho sản phẩm:**
  - Chọn SP / biến thể
  - Chọn kênh (hoặc "base — áp dụng tất cả")
  - Nhập sellingPrice, packagingCost, otherCost, minMarginPct
  - `minSellingPrice` tự tính + hiển thị
  - Lưu vào PriceConfig
- [ ] Hiển thị "Bảng giá theo kênh" trong trang chi tiết sản phẩm
- [ ] **Zustand store:** `usePriceStore`

---

### Sprint 1.10 — Orders
> **Mục tiêu:** Tạo đơn bán + tính lợi nhuận real-time + Quick POS
> `[dep: 1.8, 1.9]`
> **Done:** Tạo đơn → tồn kho trừ đúng, lợi nhuận tính đúng theo công thức Section 6

- [ ] **Trang Orders — danh sách:**
  - Bảng: Mã đơn, Kênh (badge), Ngày, Doanh thu, Lợi nhuận, Margin, Trạng thái
  - Lọc theo kênh, trạng thái, ngày
  - Tìm kiếm theo mã đơn
- [ ] **Form tạo đơn bán thủ công:**
  - Chọn kênh → resolve phí tự động
  - Chọn khách hàng (optional)
  - Thêm SP/biến thể: giá bán auto-fill từ PriceConfig, có thể sửa
  - Phương thức thanh toán
  - buyerShippingFee / sellerShippingFee / shippingSubsidy / discountAmount
  - Breakdown lợi nhuận real-time (COMPUTED): từng dòng SP + tổng đơn
  - Khi submit: tạo Order + OrderItems, trừ InventoryRecord, tạo StockMovement (type = `sale`)
- [ ] **Quick POS Mode:**
  - Route riêng: `/orders/pos`
  - Tìm SP bằng tên/barcode → thêm vào giỏ
  - Tổng tiền + nhập tiền khách → hiển thị tiền thối
  - Nút "Thanh toán" → tạo đơn (auto chọn kênh offline mặc định)
  - Giao diện tối giản, không cần form phức tạp
- [ ] **Trang chi tiết đơn:**
  - Breakdown từng OrderItem: doanh thu / phí kênh / phí TT / đóng gói / lợi nhuận
  - Tổng đơn
  - Nút đổi trạng thái đơn
- [ ] **Zustand store:** `useOrderStore`

---

### Sprint 1.11 — Dashboard MVP
> **Mục tiêu:** Dashboard có đủ dữ liệu thực từ các module đã build
> `[dep: 1.10]` (cần đủ data flow)
> **Done:** Dashboard hiển thị đúng số liệu, không hardcode

- [ ] **Bộ lọc kênh** ở đầu trang (All / chọn 1 kênh)
- [ ] **Thẻ KPI hôm nay:** Doanh thu, Lợi nhuận, Số đơn, Margin TB
- [ ] **Thẻ KPI tháng này:** + % so với tháng trước (tăng xanh / giảm đỏ)
- [ ] **Line chart doanh thu 30 ngày** (Recharts) — stack theo kênh nếu xem All
- [ ] **Bar chart lợi nhuận 30 ngày**
- [ ] **Donut chart breakdown doanh thu theo kênh**
- [ ] **Top 5 sản phẩm bán chạy** (qty + revenue)
- [ ] **Danh sách hàng sắp hết** (dưới ngưỡng cảnh báo)
- [ ] **10 đơn hàng gần nhất** (có badge kênh + trạng thái)
- [ ] **Panel cảnh báo:**
  - Sản phẩm giá bán < giá sàn (per kênh)
  - Hàng sắp hết / hết hàng
  - Đơn đang pending

---

### Sprint 1.12 — Integration & Polish Phase 1
> **Mục tiêu:** Kết nối toàn bộ, kiểm tra data flow end-to-end
> `[dep: 1.11]`
> **Done:** Flow hoàn chỉnh: nhập hàng → giá → bán → dashboard cập nhật đúng

- [ ] Kiểm tra flow: Nhập hàng → tồn kho tăng đúng
- [ ] Kiểm tra flow: Tạo đơn → tồn kho giảm đúng, StockMovement ghi đúng
- [ ] Kiểm tra flow: Giá vốn từ ImportItem mới nhất được resolve đúng ở mọi nơi
- [ ] Kiểm tra: Công nợ NCC tính đúng (ImportBatch.totalAmount - SupplierPayments)
- [ ] Kiểm tra: computed fields không bao giờ lưu vào DB
- [ ] Điền đủ thông tin vào các trang chi tiết (SP, NCC, khách hàng) đang để placeholder
- [ ] Kiểm tra validate form: required fields, số âm, SKU trùng
- [ ] Thêm loading states + error states cho mọi thao tác DB
- [ ] Thêm toast notifications (Sonner) cho mọi action thành công / thất bại
- [ ] Kiểm tra responsive trên màn hình 1280px / 1440px / 1920px

---

## PHASE 2 — Advanced Features

---

### Sprint 2.1 — Expenses & Net Profit
> **Mục tiêu:** Theo dõi chi phí vận hành, tính được lợi nhuận ròng
> `[dep: 1.12]`
> **Done:** Thêm chi phí recurring → lợi nhuận ròng tháng này cập nhật đúng

- [ ] **Trang Expenses:**
  - Danh sách chi phí: lọc theo tháng, kênh, loại
  - Tổng chi phí tháng (phân chia: kênh cụ thể / chung)
- [ ] **Form thêm/sửa chi phí:** đầy đủ fields + toggle `isRecurring`
- [ ] **Recurring expense generator:** đầu mỗi tháng tự tạo bản sao expense recurring
- [ ] Hiển thị lợi nhuận ròng (`netProfit`) trong Dashboard (thêm thẻ KPI mới)
- [ ] `useExpenseStore`

---

### Sprint 2.2 — Reports (Doanh thu & Lợi nhuận)
> **Mục tiêu:** Báo cáo doanh thu và lợi nhuận với biểu đồ đầy đủ
> `[dep: 2.1]`
> **Done:** Biểu đồ hiển thị đúng data, export Excel ra file đúng

- [ ] Bộ lọc chung cho Reports: date range picker (ngày/tuần/tháng/quý/năm), chọn kênh
- [ ] **Báo cáo 10.1 — Doanh thu:** line chart + so sánh cùng kỳ
- [ ] **Báo cáo 10.2 — Lợi nhuận:** gross + net, bar chart theo kênh
- [ ] **Báo cáo 10.3 — Kênh bán:** bảng so sánh + phí sàn đã trả
- [ ] **Báo cáo 10.9 — Break-even:** tính tháng này cần bao nhiêu doanh thu để bù chi phí
- [ ] Cài `xlsx` → export mỗi báo cáo ra file `.xlsx`
- [ ] Cài `jsPDF` → export báo cáo ra `.pdf`

---

### Sprint 2.3 — Reports (Sản phẩm, Tồn kho, Chi phí, Công nợ, Khách hàng)
> **Mục tiêu:** Hoàn thiện toàn bộ 10 báo cáo
> `[dep: 2.2]`
> **Done:** 10 báo cáo đều có data thực, export được

- [ ] **Báo cáo 10.4 — Sản phẩm:** top bán chạy, top lãi cao, SP không bán được
- [ ] **Báo cáo 10.5 — Tồn kho:** giá trị tồn + inventory turnover
- [ ] **Báo cáo 10.6 — Chi phí:** breakdown loại + kênh
- [ ] **Báo cáo 10.7 — Công nợ NCC:** danh sách + cảnh báo nợ lâu
- [ ] **Báo cáo 10.8 — Khách hàng:** top khách, repeat buyers, churn risk

---

### Sprint 2.4 — Advanced Pricing
> **Mục tiêu:** Flash sale, cập nhật giá hàng loạt, so sánh đa kênh
> `[dep: 1.12]`
> **Done:** Flash sale tự kết thúc đúng giờ, bulk update đúng

- [ ] **So sánh đa kênh trong Price Calculator:** nhập 1 giá bán → bảng margin theo tất cả kênh
- [ ] **Flash Sale Manager:**
  - Form: chọn SP, chọn kênh, nhập giá sale, thời gian bắt đầu/kết thúc
  - Cảnh báo nếu giá sale < giá sàn
  - Dashboard hiển thị flash sale đang chạy
  - Tự reset `flashSalePrice` → null khi hết hạn (check khi app load)
- [ ] **Cập nhật giá hàng loạt:**
  - Chọn nhiều SP (checkbox) + chọn kênh
  - Tăng/giảm theo % hoặc số tiền cố định
  - Preview trước khi áp dụng

---

### Sprint 2.5 — Advanced Orders
> **Mục tiêu:** Import đơn CSV, hoàn trả, lịch sử đầy đủ
> `[dep: 1.12]`
> **Done:** Import 10 đơn từ CSV Shopee → map đúng sản phẩm, tồn kho trừ đúng

- [ ] **Import đơn từ CSV:**
  - Parser cho định dạng Shopee Seller Center export
  - Parser cho định dạng Lazada Order export
  - UI upload file + preview trước khi xác nhận
  - Map SKU ngoài → SKU nội bộ (qua ProductChannelInfo.externalSku)
  - Tạo Order + OrderItems + cập nhật tồn kho sau khi xác nhận
- [ ] **Hoàn trả đơn hàng:**
  - Chọn đơn → tạo return order
  - Chọn sản phẩm trả lại + số lượng
  - Cộng lại tồn kho + tạo StockMovement (type = `return`)
  - Cập nhật Order.status → `returned`
- [ ] Lịch sử bán theo kênh trong trang chi tiết sản phẩm (biểu đồ stacked bar)
- [ ] Lịch sử đơn hàng trong trang chi tiết khách hàng

---

### Sprint 2.6 — UX Polish
> **Mục tiêu:** Trải nghiệm người dùng hoàn chỉnh
> `[dep: 2.5]`
> **Done:** Không có broken state, dark mode hoạt động, search toàn cục tìm được

- [ ] **Dark mode:** toggle trong Header, lưu preference vào localStorage
- [ ] **Global search:** tìm kiếm SP / đơn hàng / NCC / khách hàng toàn bộ app
- [ ] **Keyboard shortcuts:** `Ctrl+K` mở global search, `Ctrl+N` tạo mới (context-aware)
- [ ] Empty states đẹp cho mọi bảng dữ liệu trống
- [ ] Skeleton loading cho mọi trang
- [ ] Confirm dialog trước khi xóa bất kỳ dữ liệu nào
- [ ] Pagination nhất quán trên tất cả DataTable
- [ ] Responsive kiểm tra lại toàn bộ (1280px → 1920px)

---

## PHASE 3 — Backend & Cloud Sync

---

### Sprint 3.1 — Supabase Setup & Auth
> **Mục tiêu:** Kết nối Supabase, đăng nhập được, bảo vệ routes
> `[dep: 2.6]`
> **Done:** Đăng nhập Google → vào được app, đăng xuất → redirect về login

- [ ] Tạo Supabase project + cấu hình `.env`
- [ ] Tạo schema PostgreSQL trên Supabase mirror đúng 18 Data Models
- [ ] Cài `@supabase/supabase-js` + tạo `src/lib/supabase.ts`
- [ ] Trang đăng nhập: Email/Password + Google OAuth
- [ ] Auth guard: bảo vệ tất cả routes, redirect nếu chưa đăng nhập
- [ ] User session persistence (auto refresh token)
- [ ] Trang Profile: xem thông tin tài khoản + đổi mật khẩu

---

### Sprint 3.2 — Data Migration & Sync
> **Mục tiêu:** Data từ IndexedDB lên Supabase, sync 2 chiều
> `[dep: 3.1]`
> **Done:** Sửa dữ liệu trên thiết bị A → thiết bị B thấy ngay (< 2 giây)

- [ ] **Migration tool:** đọc toàn bộ IndexedDB → upload lên Supabase (1 lần duy nhất)
- [ ] **Data layer abstraction:** tạo `src/db/repository/` — mỗi entity có interface chung, swap giữa Dexie ↔ Supabase không đổi logic UI
- [ ] Thay thế Dexie reads bằng Supabase queries
- [ ] Thay thế Dexie writes bằng Supabase mutations
- [ ] Bật Supabase Realtime cho các bảng: orders, inventory_records, price_configs
- [ ] Conflict resolution: last-write-wins với timestamp
- [ ] Offline fallback: nếu mất mạng → dùng IndexedDB cache, sync khi có mạng lại

---

### Sprint 3.3 — Storage, Multi-business & RBAC
> **Mục tiêu:** Ảnh trên cloud, nhiều doanh nghiệp, phân quyền
> `[dep: 3.2]`
> **Done:** Nhân viên đăng nhập → không thấy tab Reports, không xóa được dữ liệu

- [ ] **Supabase Storage:** migrate ảnh SP từ base64 IndexedDB → Supabase Storage bucket
- [ ] **Multi-business:** mỗi user có thể tạo nhiều "business", data isolated theo business_id
- [ ] **Invite member:** chủ shop mời email nhân viên vào business
- [ ] **RBAC — 3 roles:**
  - `owner`: toàn quyền
  - `manager`: xem báo cáo, quản lý đơn/kho, không xóa master data
  - `staff`: chỉ tạo đơn + Quick POS, không xem báo cáo tài chính
- [ ] Row Level Security (RLS) trên tất cả Supabase tables

---

## PHASE 4 — PWA & Mobile

---

### Sprint 4.1 — PWA & Offline
> **Mục tiêu:** Cài được app lên điện thoại, dùng được khi offline
> `[dep: 3.2]`
> **Done:** Cài lên iPhone/Android, mở app khi tắt mạng → vẫn dùng được Quick POS

- [ ] Cài `vite-plugin-pwa` + cấu hình manifest (icon, name, theme color)
- [ ] Service worker: cache app shell + static assets
- [ ] Offline mode: Quick POS hoạt động hoàn toàn offline (đọc/ghi IndexedDB)
- [ ] Sync queue: đơn tạo offline → tự sync lên Supabase khi có mạng
- [ ] Banner "Bạn đang offline" khi mất kết nối
- [ ] "Có bản cập nhật mới" prompt khi SW cập nhật

---

### Sprint 4.2 — Mobile UX & Features
> **Mục tiêu:** Giao diện mobile hoàn chỉnh + tính năng native
> `[dep: 4.1]`
> **Done:** Toàn bộ app dùng được bằng ngón tay trên màn hình 390px

- [ ] Responsive layout mobile: Sidebar → bottom navigation bar trên mobile
- [ ] Quick POS layout tối ưu cho màn hình nhỏ (touch-friendly)
- [ ] **Quét barcode bằng camera:** tích hợp `@zxing/browser`, dùng trong Quick POS + tìm SP
- [ ] **Push notification (Web Push):**
  - Hàng sắp hết
  - Đơn mới (khi có import CSV hoặc sync)
- [ ] Swipe-to-delete trên mobile list views
- [ ] Pull-to-refresh trên mobile

---

## Tóm tắt số lượng Sprints

| Phase | Số Sprint | Nội dung chính |
|-------|-----------|----------------|
| Phase 1 | 12 sprints | Local MVP đầy đủ, offline-first |
| Phase 2 | 6 sprints | Báo cáo, pricing nâng cao, import CSV, UX |
| Phase 3 | 3 sprints | Supabase auth + sync + RBAC |
| Phase 4 | 2 sprints | PWA + mobile UX |
| **Tổng** | **23 sprints** | |

> **Nguyên tắc:** Sau Sprint 1.12, app đã dùng được hoàn toàn trong thực tế (chỉ offline).
> Mỗi Phase tiếp theo là **additive** — không phá vỡ những gì đã build.

---

## 6. Công thức tính toán

> Nguồn sự thật duy nhất cho tất cả phép tính.
> File thực thi: `src/utils/profitCalculator.ts`, `src/utils/priceCalculator.ts`, `src/utils/channelFeeResolver.ts`
> **Không được viết lại công thức ở bất kỳ chỗ nào khác.**

```
// =============================================
// BƯỚC 0: LẤY GIÁ VỐN
// (costPrice KHÔNG lưu trong PriceConfig)
// =============================================

costPrice = ImportItem mới nhất (importDate gần nhất) của product/variant đó


// =============================================
// BƯỚC 1: XÁC ĐỊNH PHÍ KÊNH
// (logic trong: src/utils/channelFeeResolver.ts)
// =============================================

// Ưu tiên: ChannelCategoryFee > SalesChannel.platformFeePct
resolvedPlatformFeePct =
  ChannelCategoryFee[channelId][categoryId]?.feePct
  ?? SalesChannel[channelId].platformFeePct

resolvedPaymentFeePct = SalesChannel[channelId].paymentFeePct


// =============================================
// BƯỚC 2: TÍNH PHÍ TRÊN MỖI ĐƠN VỊ SẢN PHẨM
// =============================================

platformFee     = sellingPrice × resolvedPlatformFeePct / 100
paymentFee      = sellingPrice × resolvedPaymentFeePct  / 100
totalChannelFee = platformFee + paymentFee

totalCostPerUnit = costPrice
                 + totalChannelFee
                 + packagingCost
                 + otherCost


// =============================================
// BƯỚC 3: LỢI NHUẬN TRÊN 1 ĐƠN VỊ
// =============================================

grossProfitPerUnit = sellingPrice - totalCostPerUnit

// profitMargin là REVENUE-BASED MARGIN (% trên doanh thu), KHÔNG phải markup
// markup = grossProfitPerUnit / costPrice × 100  (khác nhau — không nhầm lẫn)
profitMarginPerUnit = grossProfitPerUnit / sellingPrice × 100   // %


// =============================================
// BƯỚC 4: LỢI NHUẬN TOÀN DÒNG (OrderItem)
// =============================================

subtotal    = sellingPrice × quantity          // COMPUTED — không lưu DB
grossProfit = grossProfitPerUnit × quantity    // LƯU vào OrderItem.grossProfit
profitMargin = grossProfit / subtotal × 100    // COMPUTED — không lưu DB


// =============================================
// BƯỚC 5: GIÁ SÀN (không lỗ)
// Giải phương trình: grossProfitPerUnit = 0
// =============================================

// sellingPrice × (1 - totalFeePct/100) = costPrice + packagingCost + otherCost

minSellingPrice = (costPrice + packagingCost + otherCost)
                / (1 - (resolvedPlatformFeePct + resolvedPaymentFeePct) / 100)


// =============================================
// BƯỚC 6: GIÁ ĐỀ XUẤT (theo margin mong muốn)
// =============================================

suggestedPrice = (costPrice + packagingCost + otherCost)
               / (1 - (resolvedPlatformFeePct + resolvedPaymentFeePct) / 100
                    - minMarginPct / 100)


// =============================================
// BƯỚC 7: CHI PHÍ VẬN CHUYỂN THỰC TẾ SHOP CHỊU
// =============================================

netShippingCost = Order.sellerShippingFee - Order.shippingSubsidy
// netShippingCost < 0 nghĩa là sàn trợ giá nhiều hơn thực tế (lợi cho shop)


// =============================================
// BƯỚC 8: LỢI NHUẬN RÒNG (toàn bộ hoặc theo kênh)
// =============================================

totalGrossProfit  = Σ( OrderItem.grossProfit ) trong kỳ [lọc theo kênh nếu cần]
                  - Σ( Order.netShippingCost ) trong kỳ [lọc theo kênh nếu cần]

allocatedExpenses = Σ( Expense.amount ) trong kỳ
                    [channelId = kênh đang xem, hoặc tất cả nếu xem tổng]

netProfit = totalGrossProfit - allocatedExpenses


// =============================================
// BƯỚC 9: CÔNG NỢ NCC
// =============================================

supplierDebt(supplierId) =
  Σ( ImportBatch.totalAmount ) của NCC đó (status = 'received')
  - Σ( SupplierPayment.amount ) của NCC đó
```

---

## 7. Phí mặc định các sàn Việt Nam

> Dùng làm giá trị prefill trong `src/constants/channelDefaults.ts`
> Người dùng có thể override bất kỳ giá trị nào.

### Shopee

| Danh mục | Phí dịch vụ |
|----------|-------------|
| Thời trang nữ / nam / trẻ em | 4.0% |
| Giày dép | 4.0% |
| Túi xách, Ví | 4.0% |
| Đồng hồ | 3.0% |
| Đồ trang sức, Phụ kiện | 3.0% |
| Điện thoại & Phụ kiện | 2.0% |
| Máy tính & Laptop | 2.0% |
| Thiết bị điện tử | 2.0% |
| Nhà cửa & Đời sống | 3.0% |
| Sức khỏe & Làm đẹp | 4.0% |
| Thực phẩm & Đồ uống | 2.0% |
| Mẹ & Bé | 3.0% |
| Thể thao & Dã ngoại | 3.0% |
| Ô tô & Xe máy | 2.0% |
| Sách & Văn phòng phẩm | 3.0% |
| Chăm sóc thú cưng | 3.0% |
| Khác | 3.0% |

> Phí thanh toán Shopee: **1.0%**

### Lazada

| Danh mục | Phí dịch vụ |
|----------|-------------|
| Thời trang | 4.0% |
| Điện tử | 2.0% |
| Làm đẹp & Sức khỏe | 4.0% |
| Nhà cửa & Đời sống | 3.0% |
| Thể thao | 3.0% |
| Khác | 3.0% |

> Phí thanh toán Lazada: **1.0%**

### TikTok Shop

| Loại | Phí |
|------|-----|
| Phí dịch vụ cố định | 2.0% |
| Phí thanh toán | 1.0% |

### Tiki

| Danh mục | Phí dịch vụ |
|----------|-------------|
| Sách | 10.0% |
| Điện tử | 5.0% |
| Thời trang | 12.0% |
| Làm đẹp | 12.0% |
| Khác | 8.0% |

> Phí thanh toán Tiki: **1.0%**

### Website (tự vận hành)

| Cổng thanh toán | Phí |
|-----------------|-----|
| VNPay | 1.1% - 1.65% |
| Momo | 1.5% |
| ZaloPay | 1.5% |
| Chuyển khoản / Tiền mặt | 0% |

> Phí sàn = 0% (tự vận hành)

### Offline (cửa hàng / chợ)

> Phí sàn = 0%, Phí thanh toán = 0% (tiền mặt)
> Có thể thêm chi phí thuê mặt bằng vào Expense

---

*Document version: 4.0 — 2026-03-25*

**Changelog:**
- v1.0: Shopee-only, cấu trúc cơ bản
- v2.0: Multi-channel. SalesChannel thay ShopeeSettings. ChannelCategoryFee, ProductChannelInfo. Order.externalOrderId, OrderItem.platformFeePct
- v3.0: Sửa lỗi kiến trúc (xóa costPrice khỏi PriceConfig, đánh dấu computed fields). Thêm model Customer, SupplierPayment. Thêm Order.paymentMethod, buyerShippingFee, sellerShippingFee. Thêm Expense.isRecurring. ImportBatch.invoiceNumber, paidAmount. Quick POS mode. Báo cáo công nợ NCC, khách hàng, break-even. Làm rõ profitMargin là revenue-based.
- v4.0: Chia nhỏ Roadmap thành 23 Sprints với done criteria, dependency rõ ràng. Phase 1 = 12 sprints (local MVP), Phase 2 = 6 sprints (advanced), Phase 3 = 3 sprints (backend), Phase 4 = 2 sprints (PWA/mobile).

*Cập nhật document này mỗi khi có thay đổi lớn về tính năng hoặc data model.*
