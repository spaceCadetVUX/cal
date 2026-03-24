# Shopee Seller Manager — Project Plan

> Mục tiêu: Ứng dụng web quản lý toàn diện cho người bán hàng trên Shopee.
> Build theo từng Phase, dữ liệu nhất quán từ đầu đến cuối.

---

## Mục lục

1. [Data Models (Cấu trúc dữ liệu)](#1-data-models)
2. [Tech Stack](#2-tech-stack)
3. [Kiến trúc thư mục](#3-kiến-trúc-thư-mục)
4. [Tính năng chi tiết theo Module](#4-tính-năng-chi-tiết-theo-module)
5. [Roadmap theo Phase](#5-roadmap-theo-phase)
6. [Công thức tính toán](#6-công-thức-tính-toán)
7. [Phí Shopee Việt Nam](#7-phí-shopee-việt-nam)

---

## 1. Data Models

> Đây là nguồn sự thật duy nhất (single source of truth). Mọi tính năng đều dựa vào các model này.

### 1.1 Supplier (Nhà cung cấp)
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

### 1.2 Category (Danh mục sản phẩm)
```ts
Category {
  id              : string (UUID)
  name            : string
  shopeeCategory  : string          // tên danh mục Shopee tương ứng
  shopeeFeePct    : number          // % phí dịch vụ Shopee của danh mục này
  createdAt       : Date
}
```

### 1.3 Product (Sản phẩm)
```ts
Product {
  id              : string (UUID)
  sku             : string          // mã sản phẩm nội bộ
  shopeeSku       : string?         // mã SKU trên Shopee
  name            : string
  categoryId      : string          // FK → Category
  supplierId      : string?         // nhà cung cấp chính
  unit            : string          // cái, hộp, kg, bộ...
  images          : string[]        // URL ảnh
  description     : string?
  barcode         : string?
  weight          : number?         // gram, dùng tính phí ship
  isActive        : boolean
  createdAt       : Date
  updatedAt       : Date
}
```

### 1.4 ProductVariant (Biến thể sản phẩm)
```ts
ProductVariant {
  id        : string (UUID)
  productId : string          // FK → Product
  name      : string          // vd: "Đỏ - L", "Xanh - M"
  sku       : string
  isActive  : boolean
}
```

### 1.5 PriceConfig (Cấu hình giá)
```ts
PriceConfig {
  id                : string (UUID)
  productId         : string         // FK → Product
  variantId         : string?        // FK → ProductVariant (nếu có)
  costPrice         : number         // giá vốn
  sellingPrice      : number         // giá bán niêm yết
  minSellingPrice   : number         // giá sàn (tự động tính hoặc nhập tay)
  flashSalePrice    : number?        // giá flash sale
  flashSaleStart    : Date?
  flashSaleEnd      : Date?
  packagingCost     : number         // chi phí đóng gói
  otherCost         : number         // chi phí khác
  minMarginPct      : number         // % lợi nhuận tối thiểu mong muốn
  effectiveFrom     : Date           // giá có hiệu lực từ ngày nào
  createdAt         : Date
}
```

### 1.6 ImportBatch (Lô nhập hàng)
```ts
ImportBatch {
  id            : string (UUID)
  batchCode     : string          // mã lô nhập, vd: IMP-2024-001
  supplierId    : string          // FK → Supplier
  importDate    : Date
  totalAmount   : number          // tổng tiền lô nhập
  note          : string?
  status        : 'pending' | 'received' | 'cancelled'
  createdAt     : Date
  updatedAt     : Date
}
```

### 1.7 ImportItem (Chi tiết lô nhập)
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

### 1.8 InventoryRecord (Tồn kho)
```ts
InventoryRecord {
  id            : string (UUID)
  productId     : string        // FK → Product
  variantId     : string?
  quantity      : number        // số lượng hiện tại
  reservedQty   : number        // số đang chờ giao (đã có đơn nhưng chưa giao)
  availableQty  : number        // = quantity - reservedQty
  lowStockAlert : number        // ngưỡng cảnh báo hàng sắp hết
  updatedAt     : Date
}
```

### 1.9 StockMovement (Lịch sử biến động kho)
```ts
StockMovement {
  id          : string (UUID)
  productId   : string
  variantId   : string?
  type        : 'import' | 'sale' | 'return' | 'adjustment' | 'damage'
  quantity    : number          // dương = nhập, âm = xuất
  refId       : string?         // ID đơn nhập / đơn bán liên quan
  note        : string?
  createdAt   : Date
  createdBy   : string?
}
```

### 1.10 Order (Đơn bán)
```ts
Order {
  id              : string (UUID)
  orderCode       : string          // mã đơn nội bộ
  shopeeOrderId   : string?         // mã đơn Shopee
  orderDate       : Date
  status          : 'pending' | 'confirmed' | 'shipping' | 'delivered' | 'cancelled' | 'returned'
  shippingFee     : number          // phí vận chuyển
  shopeeShippingSubsidy : number    // Shopee trợ giá ship (nếu có)
  discountAmount  : number          // giảm giá voucher/shop
  totalRevenue    : number          // tổng doanh thu = Σ(items)
  note            : string?
  createdAt       : Date
  updatedAt       : Date
}
```

### 1.11 OrderItem (Chi tiết đơn bán)
```ts
OrderItem {
  id            : string (UUID)
  orderId       : string          // FK → Order
  productId     : string          // FK → Product
  variantId     : string?
  quantity      : number
  sellingPrice  : number          // giá bán thực tế
  costPrice     : number          // giá vốn tại thời điểm bán (snapshot)
  shopeeFeePct  : number          // % phí dịch vụ Shopee tại thời điểm bán
  shopeeFee     : number          // = sellingPrice × shopeeFeePct
  paymentFee    : number          // = sellingPrice × 1%
  packagingCost : number
  otherCost     : number
  profit        : number          // lợi nhuận thực tế (tự động tính)
  profitMargin  : number          // % margin
}
```

### 1.12 Expense (Chi phí vận hành)
```ts
Expense {
  id          : string (UUID)
  category    : 'packaging' | 'shipping' | 'marketing' | 'software' | 'other'
  name        : string
  amount      : number
  date        : Date
  note        : string?
  createdAt   : Date
}
```

### 1.13 ShopeeSettings (Cấu hình Shopee)
```ts
ShopeeSettings {
  id                    : string (UUID)
  shopName              : string
  paymentFeePct         : number    // mặc định 1%
  defaultPackagingCost  : number
  defaultMinMarginPct   : number    // % lợi nhuận tối thiểu mặc định
  updatedAt             : Date
}
```

---

## 2. Tech Stack

### Phase 1–2 (Frontend only)

| Thành phần | Công nghệ | Phiên bản | Ghi chú |
|------------|-----------|-----------|---------|
| Framework | React | 18.x | Component-based UI |
| Build tool | Vite | 5.x | Nhanh, HMR tốt |
| Language | TypeScript | 5.x | Type-safe, tránh lỗi runtime |
| Styling | Tailwind CSS | 3.x | Utility-first, responsive |
| UI Components | shadcn/ui | latest | Accessible, customizable |
| State management | Zustand | 4.x | Nhẹ, dễ dùng hơn Redux |
| Local Database | Dexie.js (IndexedDB) | 3.x | Offline-first, schema migration |
| Form | React Hook Form | 7.x | Hiệu năng cao |
| Validation | Zod | 3.x | Schema validation TypeScript-native |
| Routing | React Router | 6.x | SPA routing |
| Charts | Recharts | 2.x | Biểu đồ doanh thu/lợi nhuận |
| Date | date-fns | 3.x | Xử lý ngày tháng |
| Icons | Lucide React | latest | Icon nhất quán |
| Notifications | Sonner | latest | Toast thông báo |
| Table | TanStack Table | 8.x | Bảng dữ liệu lớn, sort/filter |
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
| Offline sync | Dexie Cloud | Đồng bộ offline ↔ online |

---

## 3. Kiến trúc thư mục

```
src/
├── assets/                  # ảnh, font tĩnh
├── components/
│   ├── ui/                  # shadcn/ui base components
│   ├── layout/              # Sidebar, Header, PageLayout
│   ├── shared/              # DataTable, ConfirmDialog, StatCard...
│   └── charts/              # ProfitChart, RevenueChart...
├── pages/
│   ├── dashboard/
│   ├── products/
│   ├── suppliers/
│   ├── imports/
│   ├── inventory/
│   ├── orders/
│   ├── pricing/
│   ├── expenses/
│   ├── reports/
│   └── settings/
├── stores/                  # Zustand stores
│   ├── useProductStore.ts
│   ├── useSupplierStore.ts
│   ├── useInventoryStore.ts
│   ├── useOrderStore.ts
│   ├── usePriceStore.ts
│   └── useSettingsStore.ts
├── db/
│   ├── schema.ts            # Dexie schema định nghĩa tất cả tables
│   ├── db.ts                # Dexie instance
│   └── migrations/          # version migrations
├── hooks/                   # custom hooks
├── utils/
│   ├── profitCalculator.ts  # tất cả công thức tính lợi nhuận
│   ├── priceCalculator.ts   # tính giá sàn, margin
│   ├── inventoryHelper.ts
│   └── formatters.ts        # format tiền VND, %, ngày
├── types/                   # TypeScript interfaces (mirror Data Models)
├── constants/
│   ├── shopeeCategories.ts  # danh sách % phí theo danh mục
│   └── appConfig.ts
└── lib/
    └── utils.ts             # cn() và các helper dùng chung
```

---

## 4. Tính năng chi tiết theo Module

---

### Module 1: Dashboard (Tổng quan)

- **Thẻ KPI hôm nay**: Doanh thu, Lợi nhuận, Số đơn, Margin trung bình
- **Thẻ KPI tháng này**: So sánh với tháng trước (% tăng/giảm)
- **Biểu đồ doanh thu 30 ngày** (line chart)
- **Biểu đồ lợi nhuận 30 ngày** (bar chart)
- **Top 5 sản phẩm bán chạy** (theo số lượng và doanh thu)
- **Top 5 sản phẩm lãi nhiều nhất**
- **Danh sách hàng sắp hết** (dưới ngưỡng cảnh báo)
- **Đơn hàng gần nhất** (5 đơn mới nhất)
- **Cảnh báo**: sản phẩm giá bán < giá sàn, hàng hết, đơn chưa xử lý

---

### Module 2: Products (Sản phẩm)

#### 2.1 Danh sách sản phẩm
- Bảng: SKU, Tên, Danh mục, Tồn kho, Giá vốn, Giá bán, Margin, Trạng thái
- Tìm kiếm theo tên / SKU / barcode
- Lọc theo danh mục, nhà cung cấp, trạng thái, mức tồn kho
- Sort theo bất kỳ cột
- Pagination

#### 2.2 Thêm / Sửa sản phẩm
- Thông tin cơ bản: SKU, tên, danh mục, nhà cung cấp chính, đơn vị, mô tả
- Upload ảnh sản phẩm (nhiều ảnh)
- Barcode / mã vạch
- Cân nặng (phục vụ tính phí ship)
- Thêm biến thể (màu sắc, size, v.v.)
- Trạng thái: đang bán / ngừng bán

#### 2.3 Chi tiết sản phẩm
- Toàn bộ thông tin
- Lịch sử giá vốn (theo các lần nhập)
- Cấu hình giá hiện tại
- Tồn kho theo biến thể
- Lịch sử nhập hàng
- Lịch sử bán hàng
- Biểu đồ doanh thu sản phẩm

---

### Module 3: Suppliers (Nhà cung cấp)

- Danh sách nhà cung cấp: tên, SĐT, địa chỉ, số mặt hàng đang cung cấp
- Thêm / Sửa / Xóa nhà cung cấp
- Chi tiết nhà cung cấp:
  - Thông tin liên hệ
  - Lịch sử nhập hàng từ NCC này
  - Tổng tiền đã nhập từ NCC
  - Danh sách sản phẩm từ NCC

---

### Module 4: Imports (Nhập hàng)

#### 4.1 Danh sách lô nhập
- Bảng: Mã lô, NCC, Ngày nhập, Số mặt hàng, Tổng tiền, Trạng thái
- Lọc theo nhà cung cấp, ngày, trạng thái

#### 4.2 Tạo phiếu nhập
- Chọn nhà cung cấp
- Ngày nhập
- Thêm nhiều dòng sản phẩm: sản phẩm, biến thể, số lượng, giá vốn
- Ghi chú
- Tự động tính tổng tiền lô nhập
- Xác nhận nhập → tự động cập nhật tồn kho + lịch sử biến động kho
- Tự động tạo PriceConfig mới nếu giá vốn thay đổi

#### 4.3 Chi tiết lô nhập
- Toàn bộ danh sách sản phẩm đã nhập
- Trạng thái từng mặt hàng
- Nút "Xác nhận nhận hàng" / "Hủy lô"

---

### Module 5: Inventory (Tồn kho)

#### 5.1 Tổng quan tồn kho
- Bảng: Sản phẩm, SKU, Tồn kho, Đang giữ, Có thể bán, Giá trị tồn kho, Cảnh báo
- Lọc: tất cả / sắp hết / hết hàng / dư thừa
- Giá trị tổng tồn kho (theo giá vốn)

#### 5.2 Điều chỉnh tồn kho
- Cộng / trừ tồn kho thủ công (có lý do: hàng hỏng, kiểm đếm lại, v.v.)
- Ghi lại vào StockMovement

#### 5.3 Lịch sử biến động kho
- Timeline: nhập/xuất/điều chỉnh
- Lọc theo sản phẩm, loại biến động, ngày

#### 5.4 Cài đặt ngưỡng cảnh báo
- Đặt mức cảnh báo hàng sắp hết cho từng sản phẩm

---

### Module 6: Pricing (Quản lý giá)

#### 6.1 Bảng giá tổng quan
- Bảng: Sản phẩm, Giá vốn, Giá bán, Giá sàn, Margin, Flash Sale, Cảnh báo
- Cảnh báo đỏ: giá bán < giá sàn
- Cảnh báo vàng: margin < mức tối thiểu

#### 6.2 Calculator giá (Price Wizard)
- **Input:**
  - Giá vốn
  - Danh mục Shopee (tự động điền % phí)
  - % phí dịch vụ Shopee (tùy chỉnh)
  - % phí thanh toán (mặc định 1%)
  - Phí đóng gói
  - Chi phí khác
  - % lợi nhuận mong muốn
- **Output (real-time):**
  - Giá bán tối thiểu (không lỗ)
  - Giá bán đề xuất (theo % lợi nhuận mong muốn)
  - Lợi nhuận tuyệt đối (VND)
  - % Margin thực tế
  - Breakdown chi tiết từng khoản phí

#### 6.3 Lịch sử giá
- Xem giá vốn theo từng lô nhập
- So sánh margin qua các thời kỳ

#### 6.4 Flash Sale Manager
- Đặt giá flash sale + thời gian bắt đầu/kết thúc
- Cảnh báo nếu giá flash sale < giá sàn
- Tự động hiển thị giá flash sale trong dashboard khi đang chạy

#### 6.5 Cập nhật giá hàng loạt
- Chọn nhiều sản phẩm → tăng/giảm giá bán theo % hoặc số tiền cố định

---

### Module 7: Orders (Đơn bán)

#### 7.1 Danh sách đơn
- Bảng: Mã đơn, Mã Shopee, Ngày, Doanh thu, Chi phí, Lợi nhuận, Trạng thái
- Lọc theo trạng thái, ngày, khoảng lợi nhuận
- Tìm kiếm theo mã đơn Shopee

#### 7.2 Tạo đơn bán thủ công
- Thêm nhiều sản phẩm + số lượng
- Nhập giá bán thực tế (có thể khác giá niêm yết)
- Phí vận chuyển
- Voucher / giảm giá
- Shopee tự động điền phí theo danh mục
- Tự động tính lợi nhuận từng dòng và toàn đơn

#### 7.3 Chi tiết đơn
- Breakdown lợi nhuận từng sản phẩm
- Tổng doanh thu / tổng chi phí / tổng lợi nhuận

#### 7.4 Import đơn hàng
- Import file CSV/Excel từ Shopee Seller Center
- Tự động map với sản phẩm trong hệ thống

#### 7.5 Xử lý hoàn trả (Return)
- Tạo đơn hoàn trả → tự động cộng lại tồn kho
- Ghi nhận lý do hoàn trả

---

### Module 8: Expenses (Chi phí vận hành)

- Thêm chi phí: đóng gói, marketing, phần mềm, v.v.
- Danh sách chi phí theo tháng
- Tổng chi phí vận hành tháng
- Lợi nhuận ròng = Lợi nhuận gộp - Chi phí vận hành

---

### Module 9: Reports (Báo cáo)

#### 9.1 Báo cáo Doanh thu
- Theo ngày / tuần / tháng / quý / năm
- Line chart doanh thu theo thời gian
- So sánh cùng kỳ

#### 9.2 Báo cáo Lợi nhuận
- Lợi nhuận gộp và ròng
- Margin trung bình theo thời gian
- Bar chart lợi nhuận

#### 9.3 Báo cáo Sản phẩm
- Top sản phẩm bán chạy (quantity + revenue)
- Top sản phẩm lãi cao nhất (profit + margin)
- Sản phẩm không bán được (0 đơn trong N ngày)

#### 9.4 Báo cáo Tồn kho
- Giá trị tồn kho theo thời gian
- Tỷ lệ xoay vòng hàng tồn kho (inventory turnover)

#### 9.5 Báo cáo Chi phí
- Breakdown chi phí theo loại
- Chi phí vs Doanh thu vs Lợi nhuận (stacked bar)

#### 9.6 Export
- Xuất tất cả báo cáo ra Excel (.xlsx)
- Xuất ra PDF

---

### Module 10: Settings (Cài đặt)

- Thông tin shop Shopee
- Cấu hình phí thanh toán mặc định
- Cấu hình % phí Shopee mặc định theo danh mục
- Chi phí đóng gói mặc định
- % lợi nhuận tối thiểu mặc định
- Ngưỡng cảnh báo tồn kho mặc định
- Đơn vị tiền tệ (VND)
- Export toàn bộ data (backup JSON)
- Import data từ file backup
- Xóa toàn bộ data (reset)

---

## 5. Roadmap theo Phase

### Phase 1 — Core MVP
> **Mục tiêu:** App chạy được, dữ liệu lưu local, tính năng cốt lõi

**Deliverables:**
- [ ] Cài đặt project: Vite + React + TypeScript + Tailwind + shadcn/ui
- [ ] Cài đặt Dexie.js schema (tất cả tables theo Data Models)
- [ ] Layout chính: Sidebar + Header + routing
- [ ] Module Settings: cấu hình shop + phí Shopee
- [ ] Module Categories: quản lý danh mục + phí Shopee
- [ ] Module Suppliers: CRUD nhà cung cấp
- [ ] Module Products: CRUD sản phẩm + biến thể
- [ ] Module Imports: tạo + xác nhận lô nhập → cập nhật tồn kho
- [ ] Module Inventory: xem tồn kho + cảnh báo sắp hết
- [ ] Module Pricing: Price Calculator + gán giá cho sản phẩm
- [ ] Module Orders: tạo đơn thủ công + tính lợi nhuận
- [ ] Dashboard: KPI cơ bản hôm nay + tháng này

---

### Phase 2 — Advanced Features
> **Mục tiêu:** Báo cáo đầy đủ, quản lý giá nâng cao, UX tốt hơn

**Deliverables:**
- [ ] Module Reports: tất cả biểu đồ + export Excel/PDF
- [ ] Flash Sale Manager
- [ ] Cập nhật giá hàng loạt
- [ ] Import đơn hàng từ CSV Shopee
- [ ] Module Expenses: chi phí vận hành
- [ ] Lợi nhuận ròng (sau chi phí vận hành)
- [ ] Lịch sử biến động kho chi tiết
- [ ] Xử lý hoàn trả đơn hàng
- [ ] Tìm kiếm toàn cục (global search)
- [ ] Dark mode

---

### Phase 3 — Backend & Sync
> **Mục tiêu:** Đồng bộ đa thiết bị, bảo mật, multi-user

**Deliverables:**
- [ ] Tích hợp Supabase (auth + database + storage)
- [ ] Đăng ký / Đăng nhập (email + Google)
- [ ] Migrate local data lên Supabase
- [ ] Realtime sync giữa các thiết bị
- [ ] Upload ảnh sản phẩm lên Supabase Storage
- [ ] Multi-shop: quản lý nhiều gian hàng Shopee
- [ ] Role-based access (chủ shop / nhân viên)

---

### Phase 4 — PWA & Mobile
> **Mục tiêu:** Dùng được trên điện thoại, offline

**Deliverables:**
- [ ] Cấu hình PWA (cài app lên Android/iOS)
- [ ] Offline mode + sync khi có mạng
- [ ] Giao diện mobile responsive hoàn chỉnh
- [ ] Notification: cảnh báo hàng hết, đơn mới
- [ ] Quét barcode bằng camera điện thoại

---

## 6. Công thức tính toán

> Đây là nguồn sự thật duy nhất cho mọi phép tính. Không được tính theo cách khác.

```
// =============================================
// A. PHÍ SHOPEE
// =============================================

shopeeFee     = sellingPrice × shopeeFeePct / 100
paymentFee    = sellingPrice × paymentFeePct / 100   // paymentFeePct mặc định = 1

totalFees     = shopeeFee + paymentFee

// =============================================
// B. CHI PHÍ TRÊN MỖI SẢN PHẨM
// =============================================

totalCostPerUnit = costPrice
                 + totalFees
                 + packagingCost
                 + otherCost

// =============================================
// C. LỢI NHUẬN
// =============================================

grossProfit   = sellingPrice - totalCostPerUnit
profitMargin  = grossProfit / sellingPrice × 100   // %

// =============================================
// D. GIÁ BÁN TỐI THIỂU (không lỗ)
// =============================================

// Giải phương trình: sellingPrice - sellingPrice×(shopeeFeePct+paymentFeePct)/100 - costPrice - packagingCost - otherCost = 0

minSellingPrice = (costPrice + packagingCost + otherCost)
                / (1 - (shopeeFeePct + paymentFeePct) / 100)

// =============================================
// E. GIÁ BÁN ĐỀ XUẤT (theo margin mong muốn)
// =============================================

suggestedPrice  = (costPrice + packagingCost + otherCost)
                / (1 - (shopeeFeePct + paymentFeePct) / 100 - minMarginPct / 100)

// =============================================
// F. LỢI NHUẬN RÒNG (toàn shop)
// =============================================

netProfit = Σ(grossProfit tất cả đơn trong kỳ)
          - Σ(expenses trong kỳ)
```

---

## 7. Phí Shopee Việt Nam

> Cập nhật: 2024. Dùng làm giá trị mặc định trong `constants/shopeeCategories.ts`

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
| Văn phòng phẩm & Dụng cụ học sinh | 3.0% |
| Sách & Văn phòng phẩm | 3.0% |
| Chăm sóc thú cưng | 3.0% |
| Khác | 3.0% |

> Phí thanh toán (áp dụng cho tất cả danh mục): **1.0%**

---

*Document version: 1.0 — 2026-03-25*
*Cập nhật document này mỗi khi có thay đổi lớn về tính năng hoặc data model.*
