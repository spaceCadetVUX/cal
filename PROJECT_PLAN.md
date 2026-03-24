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

PriceConfig {
  id              : string (UUID)
  productId       : string        // FK → Product
  variantId       : string?       // FK → ProductVariant
  channelId       : string?       // FK → SalesChannel | null = base price

  costPrice       : number        // giá vốn
  sellingPrice    : number        // giá bán niêm yết
  minSellingPrice : number        // giá sàn (tự động tính hoặc nhập tay)
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
  id          : string (UUID)
  batchCode   : string          // mã lô, vd: IMP-2024-001
  supplierId  : string          // FK → Supplier
  importDate  : Date
  totalAmount : number          // tổng tiền lô nhập
  note        : string?
  status      : 'pending' | 'received' | 'cancelled'
  createdAt   : Date
  updatedAt   : Date
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
  costPrice   : number          // giá vốn tại thời điểm nhập
  totalCost   : number          // = quantity × costPrice
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
  quantity      : number        // tổng tồn kho hiện tại
  reservedQty   : number        // đang chờ giao (đã có đơn, chưa xuất)
  availableQty  : number        // = quantity - reservedQty (computed)
  lowStockAlert : number        // ngưỡng cảnh báo
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
  id              : string (UUID)
  orderCode       : string          // mã đơn nội bộ
  channelId       : string          // FK → SalesChannel ← kênh bán
  externalOrderId : string?         // mã đơn trên sàn (Shopee, Lazada...) hoặc mã hoá đơn
  orderDate       : Date
  status          : 'pending' | 'confirmed' | 'shipping' | 'delivered' | 'cancelled' | 'returned'
  shippingFee     : number          // phí vận chuyển thực tế
  shippingSubsidy : number          // sàn trợ giá ship (Shopee, Lazada...) hoặc 0
  discountAmount  : number          // giảm giá voucher/coupon
  totalRevenue    : number          // tổng doanh thu = Σ(items.sellingPrice × qty)
  note            : string?
  createdAt       : Date
  updatedAt       : Date
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
  sellingPrice     : number          // giá bán thực tế
  costPrice        : number          // giá vốn tại thời điểm bán (snapshot)

  // Phí kênh — lấy từ SalesChannel + ChannelCategoryFee tại thời điểm tạo đơn
  platformFeePct   : number          // % phí sàn
  platformFee      : number          // = sellingPrice × platformFeePct / 100
  paymentFeePct    : number          // % phí thanh toán
  paymentFee       : number          // = sellingPrice × paymentFeePct / 100

  packagingCost    : number
  otherCost        : number

  grossProfit      : number          // lợi nhuận gộp (tự động tính)
  profitMargin     : number          // % margin (tự động tính)
}
```

---

### 1.16 Expense (Chi phí vận hành)
```ts
Expense {
  id          : string (UUID)
  channelId   : string?       // FK → SalesChannel | null = chi phí chung
  category    : 'packaging' | 'shipping' | 'marketing' | 'software' | 'salary' | 'rent' | 'other'
  name        : string
  amount      : number
  date        : Date
  note        : string?
  createdAt   : Date
}
```

---

### Sơ đồ quan hệ (ERD tóm tắt)

```
AppSettings (1)

SalesChannel (nhiều)
  └── ChannelCategoryFee (nhiều) ──→ Category
  └── ProductChannelInfo (nhiều) ──→ Product / ProductVariant
  └── PriceConfig (nhiều, channelId?) ──→ Product / ProductVariant
  └── Order (nhiều)
        └── OrderItem (nhiều) ──→ Product / ProductVariant
  └── Expense (nhiều, channelId?)
  └── StockMovement (nhiều, channelId?)

Supplier (nhiều)
  └── ImportBatch (nhiều)
        └── ImportItem (nhiều) ──→ Product / ProductVariant

Product (nhiều)
  ├── ProductVariant (nhiều)
  └── InventoryRecord (1 per product/variant)
```

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
│   ├── pricing/
│   ├── expenses/
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

- Danh sách: tên, SĐT, địa chỉ, số SP, tổng nhập
- CRUD nhà cung cấp
- Chi tiết: lịch sử nhập hàng, tổng tiền đã nhập, danh sách sản phẩm

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
- Thêm nhiều sản phẩm + số lượng
- Giá bán thực tế (auto fill từ PriceConfig kênh, có thể sửa)
- Phí vận chuyển, trợ giá ship, giảm giá
- Phí kênh tự động tính theo SP × category × channel
- Breakdown lợi nhuận real-time khi nhập

#### 8.3 Chi tiết đơn
- Breakdown lợi nhuận từng dòng SP
- Tổng: doanh thu / phí kênh / phí TT / đóng gói / lợi nhuận gộp

#### 8.4 Import đơn hàng từ file
- Import CSV/Excel từ Shopee Seller Center, Lazada Order Export...
- Tự động map với sản phẩm trong hệ thống
- Template mẫu cho từng loại kênh

#### 8.5 Hoàn trả (Return)
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

#### 10.7 Export
- Xuất tất cả báo cáo ra Excel (.xlsx)
- Xuất ra PDF

---

### Module 11: Settings (Cài đặt)

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

### Phase 1 — Core MVP
> **Mục tiêu:** App chạy được, dữ liệu lưu local, multi-channel từ đầu

- [ ] Cài đặt project: Vite + React + TypeScript + Tailwind + shadcn/ui
- [ ] Cài đặt Dexie.js schema (toàn bộ 16 Data Models)
- [ ] Layout: Sidebar + Header + routing
- [ ] Module Settings: AppSettings
- [ ] Module Channels: CRUD kênh + cấu hình phí danh mục
- [ ] Module Categories: CRUD danh mục
- [ ] Module Suppliers: CRUD nhà cung cấp
- [ ] Module Products: CRUD + biến thể + khai báo kênh đang bán
- [ ] Module Imports: tạo + xác nhận lô nhập → cập nhật tồn kho
- [ ] Module Inventory: xem tồn kho + cảnh báo
- [ ] Module Pricing: Price Calculator (multi-channel) + gán giá
- [ ] Module Orders: tạo đơn thủ công (chọn kênh) + tính lợi nhuận
- [ ] Dashboard: KPI + breakdown theo kênh cơ bản

---

### Phase 2 — Advanced Features
> **Mục tiêu:** Báo cáo đầy đủ, quản lý giá nâng cao, UX tốt hơn

- [ ] Module Reports: tất cả biểu đồ + so sánh kênh + export Excel/PDF
- [ ] So sánh margin đa kênh trong Price Calculator
- [ ] Flash Sale Manager (per channel)
- [ ] Cập nhật giá hàng loạt (per channel)
- [ ] Import đơn từ CSV (Shopee, Lazada...)
- [ ] Module Expenses: chi phí gắn với kênh
- [ ] Lợi nhuận ròng (sau chi phí)
- [ ] Hoàn trả đơn hàng
- [ ] Tìm kiếm toàn cục
- [ ] Dark mode

---

### Phase 3 — Backend & Sync
> **Mục tiêu:** Đồng bộ đa thiết bị, bảo mật, multi-user

- [ ] Tích hợp Supabase (auth + DB + storage)
- [ ] Đăng ký / Đăng nhập (email + Google)
- [ ] Migrate IndexedDB → Supabase
- [ ] Realtime sync đa thiết bị
- [ ] Upload ảnh sản phẩm lên Supabase Storage
- [ ] Multi-business: quản lý nhiều doanh nghiệp
- [ ] Role-based access (chủ / nhân viên)

---

### Phase 4 — PWA & Mobile
> **Mục tiêu:** Dùng được trên điện thoại, offline

- [ ] PWA (cài lên Android/iOS)
- [ ] Offline mode + sync khi có mạng
- [ ] Giao diện mobile responsive hoàn chỉnh
- [ ] Push notification: hàng hết, đơn mới
- [ ] Quét barcode bằng camera điện thoại

---

## 6. Công thức tính toán

> Nguồn sự thật duy nhất cho tất cả phép tính.
> File thực thi: `src/utils/profitCalculator.ts` và `src/utils/priceCalculator.ts`

```
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

platformFee   = sellingPrice × resolvedPlatformFeePct / 100
paymentFee    = sellingPrice × resolvedPaymentFeePct  / 100
totalChannelFee = platformFee + paymentFee

totalCostPerUnit = costPrice
                 + totalChannelFee
                 + packagingCost
                 + otherCost


// =============================================
// BƯỚC 3: LỢI NHUẬN
// =============================================

grossProfit  = sellingPrice - totalCostPerUnit
profitMargin = grossProfit / sellingPrice × 100   // %


// =============================================
// BƯỚC 4: GIÁ SÀN (không lỗ)
// Giải phương trình grossProfit = 0
// =============================================

// Đặt: totalFeePct = resolvedPlatformFeePct + resolvedPaymentFeePct
// sellingPrice × (1 - totalFeePct/100) = costPrice + packagingCost + otherCost

minSellingPrice = (costPrice + packagingCost + otherCost)
                / (1 - (resolvedPlatformFeePct + resolvedPaymentFeePct) / 100)


// =============================================
// BƯỚC 5: GIÁ ĐỀ XUẤT (theo margin mong muốn)
// =============================================

suggestedPrice = (costPrice + packagingCost + otherCost)
               / (1 - (resolvedPlatformFeePct + resolvedPaymentFeePct) / 100
                    - minMarginPct / 100)


// =============================================
// BƯỚC 6: LỢI NHUẬN RÒNG (toàn bộ doanh nghiệp hoặc theo kênh)
// =============================================

// Tổng lợi nhuận gộp trong kỳ:
totalGrossProfit = Σ( OrderItem.grossProfit ) trong kỳ [lọc theo kênh nếu cần]

// Chi phí phân bổ:
allocatedExpenses = Σ( Expense.amount ) trong kỳ
                    [channelId = kênh đang xem, hoặc tất cả]

netProfit = totalGrossProfit - allocatedExpenses
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

*Document version: 2.0 — 2026-03-25*
*Thay đổi từ v1.0: Mở rộng từ Shopee-only sang multi-channel.
SalesChannel thay thế ShopeeSettings. ChannelCategoryFee, ProductChannelInfo là model mới.
Order.shopeeOrderId → externalOrderId, OrderItem.shopeeFeePct → platformFeePct.*

*Cập nhật document này mỗi khi có thay đổi lớn về tính năng hoặc data model.*
