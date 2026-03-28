# MEMORY — Multi-Channel Seller Manager

> File này dành cho Claude. Đọc đầu mỗi conversation để không bị mất context.
> Cập nhật sau mỗi Sprint hoàn thành. Ngắn gọn — không thừa.

---

## Project

- **Tên:** Multi-Channel Seller Manager
- **Mục tiêu:** Quản lý bán hàng đa kênh (Shopee, Lazada, TikTok, Website, Offline, Custom)
- **Thư mục:** `C:/Users/vusu3/Desktop/Tool/cal`
- **Package manager:** pnpm
- **Kế hoạch đầy đủ + Data Models + Công thức:** → `PROJECT_PLAN.md`

---

## Tech Stack

| | |
|--|--|
| Framework | React 19 + TypeScript 5 + Vite 8 |
| Styling | Tailwind CSS 3.4 + CSS variables (light/dark) |
| UI | shadcn/ui manual (Radix UI + CVA + clsx + tailwind-merge) |
| State | Zustand 5 |
| Local DB | Dexie.js 4 (IndexedDB) |
| Routing | React Router 7 |
| Forms | React Hook Form 7 + Zod 4 |
| Table | TanStack Table 8 |
| Charts | Recharts 3 |
| Misc | date-fns 4, Lucide React, Sonner |
| Code quality | Prettier + prettier-plugin-tailwindcss + .editorconfig |
| Path alias | `@/` → `src/` (vite.config.ts + tsconfig.app.json) |

---

## Kiến trúc — Quy tắc KHÔNG được vi phạm

1. **`costPrice` KHÔNG lưu trong `PriceConfig`** → luôn lấy từ `ImportItem` mới nhất
2. **Computed fields KHÔNG lưu DB** (chỉ tính lúc runtime):
   - `InventoryRecord.availableQty` = `quantity - reservedQty`
   - `ImportItem.totalCost` = `quantity × costPrice`
   - `OrderItem.subtotal` = `sellingPrice × quantity`
   - `OrderItem.profitMargin` = `grossProfit / subtotal × 100`
   - `SupplierDebt` = `ImportBatch.totalAmount - Σ(SupplierPayment.amount)`
3. **Tồn kho CHUNG** — 1 `InventoryRecord` per product/variant, không chia theo kênh
4. **Phí kênh resolve:** `ChannelCategoryFee[channelId+categoryId]` > `SalesChannel.platformFeePct`
5. **Giá resolve:** `PriceConfig(channelId=X)` > `PriceConfig(channelId=null = base)`
6. **`profitMargin` = revenue-based** = `grossProfit / revenue × 100`, KHÔNG phải markup
7. **Công thức tính toán** chỉ được viết trong `src/utils/` — không viết lại ở nơi khác
8. **`OrderItem.costPrice`** = snapshot giá vốn lúc bán (lấy từ ImportItem, lưu lại để báo cáo)

---

## 18 Data Models (tóm tắt)

```
1.  AppSettings        — singleton
2.  SalesChannel       — kênh bán, có platformFeePct + paymentFeePct
3.  Category           — danh mục sản phẩm
4.  ChannelCategoryFee — override phí theo kênh × danh mục
5.  Supplier           — nhà cung cấp
6.  SupplierPayment    — thanh toán NCC (tính công nợ)
7.  Customer           — khách hàng offline/website
8.  Product            — sản phẩm (sku unique)
9.  ProductVariant     — biến thể (sku unique)
10. ProductChannelInfo — SP × kênh (externalSku, isListed)
11. PriceConfig        — giá bán (KHÔNG có costPrice)
12. ImportBatch        — lô nhập hàng
13. ImportItem         — chi tiết lô (nguồn DUY NHẤT của costPrice)
14. InventoryRecord    — tồn kho chung
15. StockMovement      — lịch sử biến động kho
16. Order              — đơn bán (có channelId, paymentMethod, buyerShippingFee, sellerShippingFee)
17. OrderItem          — chi tiết đơn (snapshot phí kênh tại thời điểm bán)
18. Expense            — chi phí vận hành (có isRecurring)
```

---

## Trạng thái Sprint

### Phase 1 — Local MVP
- [x] **1.1** Project Setup ✅
- [x] **1.2** Database Layer ✅
- [x] **1.3** Utility Functions ✅
- [x] **1.4** Layout & Navigation ✅
- [x] **1.5** Settings & Channels ✅
- [x] **1.6** Categories, Suppliers & Customers ✅
- [x] **1.7** Products ✅
- [x] **1.8** Imports & Inventory ✅
- [x] **1.9** Pricing ✅
- [x] **1.10** Orders + Quick POS ✅
- [x] **1.11** Dashboard MVP ✅
- [x] **1.12** Integration & Polish ✅

### Phase 2–4
- [x] **2.2** Reports (Doanh thu, Lợi nhuận, Kênh bán, Break-even) ✅
- [ ] Phase 2: còn lại — 2.1 Expenses, 2.3–2.6 ← **TIẾP THEO**
- [ ] Phase 3: Supabase Auth + Sync + RBAC (3 sprints)
- [ ] Phase 4: PWA + Mobile (2 sprints)

---

## Codebase hiện tại

### Cấu trúc src/ (đã tạo đủ thư mục)
```
src/
├── assets/
├── components/ui/
├── components/layout/
│   ├── AppLayout.tsx   ← shell: Sidebar + Header + <Outlet>
│   ├── Sidebar.tsx     ← collapsible nav (13 items, active state, tooltip when collapsed)
│   ├── Header.tsx      ← page title + dark toggle + search/bell placeholders
│   └── PageLayout.tsx  ← per-page wrapper: title bar + action slot + children
├── components/shared/
│   ├── StatCard.tsx      ← KPI card with trend indicator
│   ├── DataTable.tsx     ← TanStack Table wrapper (sort, global filter, pagination)
│   ├── ConfirmDialog.tsx ← Radix Dialog for delete confirmation
│   └── ChannelBadge.tsx  ← colored badge with auto text contrast
├── components/charts/
├── pages/
│   ├── dashboard/DashboardPage.tsx
│   ├── channels/ChannelsPage.tsx
│   ├── categories/CategoriesPage.tsx
│   ├── suppliers/SuppliersPage.tsx
│   ├── customers/CustomersPage.tsx
│   ├── products/ProductsPage.tsx         ← danh sách + filter (1.7)
│   ├── products/ProductFormDialog.tsx    ← form 3 tab: Info/Variants/Channels (1.7)
│   ├── products/ProductDetailPage.tsx    ← chi tiết SP (1.7)
│   ├── imports/ImportsPage.tsx           ← danh sách + filter (1.8)
│   ├── imports/ImportFormPage.tsx        ← tạo/sửa phiếu nhập (1.8)
│   ├── imports/ImportDetailPage.tsx      ← chi tiết + confirm/cancel (1.8)
│   ├── inventory/InventoryPage.tsx       ← tổng quan + điều chỉnh + lịch sử (1.8)
│   ├── pricing/PricingPage.tsx           ← 3 tab: danh sách/máy tính/gán giá (1.9)
│   ├── orders/OrdersPage.tsx             ← danh sách + filter kênh/trạng thái (1.10)
│   ├── orders/OrderFormPage.tsx          ← tạo đơn + real-time profit (1.10)
│   ├── orders/OrderDetailPage.tsx        ← chi tiết + breakdown + đổi trạng thái (1.10)
│   ├── orders/PosPage.tsx                ← Quick POS offline (1.10)
│   ├── expenses/ExpensesPage.tsx
│   ├── reports/ReportsPage.tsx
│   ├── settings/SettingsPage.tsx
│   └── NotFoundPage.tsx
├── stores/
├── db/
│   ├── schema.ts       ← SellerDatabase (Dexie), 18 tables
│   ├── db.ts           ← singleton instance
│   ├── seed.ts         ← chạy 1 lần, seed AppSettings+channels+categories+fees
│   └── migrations/
├── hooks/
├── utils/
│   ├── idGenerator.ts        ← generateId() = crypto.randomUUID()
│   ├── channelFeeResolver.ts ← resolveChannelFee(channelId, categoryId, db)
│   ├── priceCalculator.ts    ← calcMinSellingPrice(), calcSuggestedPrice()
│   ├── profitCalculator.ts   ← calcProfitPerUnit(), calcOrderItemProfit(), calcOrderProfit(), calcNetProfit(), calcSupplierDebt()
│   ├── inventoryHelper.ts    ← calcAvailableQty(), isLowStock()
│   └── formatters.ts         ← formatVND(), formatPct(), formatDate(), formatDateRange(), formatRelativeTime()
├── types/
│   └── index.ts        ← 18 TypeScript interfaces
├── constants/
│   ├── appConfig.ts    ← APP_CONFIG (name, version, currency)
│   └── channelDefaults.ts ← CHANNEL_DEFAULTS, SEED_CATEGORIES, phí theo danh mục
└── lib/
    └── utils.ts        ← cn()
```

### Files gốc
- `vite.config.ts` — alias @/, plugin react
- `tsconfig.app.json` — strict, paths @/*
- `tailwind.config.js` — darkMode class, CSS variable colors
- `src/index.css` — @tailwind directives + CSS variable tokens
- `src/App.tsx` — placeholder (chỉ render tên app)
- `src/main.tsx` — gọi runSeedIfNeeded() rồi mới render

### DB Schema (Dexie v1)
- 18 tables, đã có indexes cho các query phổ biến
- `[productId+channelId]`, `[channelId+categoryId]`, `[productId+variantId]` — compound indexes
- `&sku` trên Product và ProductVariant — unique index

### Seed data (chạy 1 lần khi app mở lần đầu)
- 1 AppSettings (businessName: "My Shop", defaultMinMarginPct: 20)
- 6 SalesChannel: Shopee, Lazada, TikTok Shop, Tiki, Website, Offline
- 19 Category (từ SEED_CATEGORIES)
- ChannelCategoryFees: Shopee (17 fees), Lazada (10 fees), Tiki (7 fees)

---

## Stores đã có

| File | Mô tả |
|------|-------|
| `src/stores/useSettingsStore.ts` | load/save AppSettings (Zustand) |
| `src/stores/useChannelStore.ts` | CRUD SalesChannel + ChannelCategoryFee (Zustand) |

## Ghi chú kỹ thuật quan trọng

- `<Toaster richColors position="top-right" />` đặt trong `App.tsx` — dùng `toast.success/error` từ `sonner`
- Settings: export/import JSON backup toàn bộ 18 bảng; reset clears all + re-runs `runSeedIfNeeded()`
- Channels form: chọn type → auto prefill platformFeePct/paymentFeePct/color từ `CHANNEL_DEFAULTS`; color picker dùng `<input type="color">`
- Category fees tab: chỉ hiện khi editing (không phải khi add mới); feePct=0 = dùng default của kênh (không lưu DB)
- `reviveDates()` helper trong SettingsPage: convert ISO strings → Date objects khi import backup

## Stores đã có

| Store | Chức năng |
|-------|-----------|
| `useSettingsStore` | load/save AppSettings |
| `useChannelStore` | CRUD SalesChannel + ChannelCategoryFee |
| `useCategoryStore` | CRUD Category, validate delete (block nếu có SP dùng) |
| `useSupplierStore` | CRUD Supplier + stats (productCount/debt) + addPayment/deletePayment |
| `useCustomerStore` | CRUD Customer + stats (orderCount/totalSpent, 0 đến Sprint 1.10) |
| `useProductStore` | CRUD Product + ProductVariant + ProductChannelInfo; stats: totalQty + listedChannelIds |
| `useImportStore` | CRUD ImportBatch + ImportItems; confirmBatch (→InventoryRecord + StockMovement); cancelBatch |
| `useInventoryStore` | load (với InventoryWithProduct join), adjust (delta + StockMovement), loadMovements |
| `usePriceStore` | upsert PriceConfig (in-place update), getLatestCostPrice (từ received ImportBatch), getEffectiveConfig (channel > base) |
| `useOrderStore` | CRUD Order + OrderItem; createOrder (snapshot fees, deduct inventory, StockMovement type=sale); updateStatus; deleteOrder; getOrderDetail |

## Routing đặc biệt

- `/suppliers/:id` → `SupplierDetailPage` (debt stats + payment history + add payment)
- `SupplierFormDialog` tách riêng file (`suppliers/SupplierFormDialog.tsx`) — dùng chung bởi cả list và detail page
- `/products/:id` → `ProductDetailPage` (info + variants + channels + tồn kho thực + giá thực)
- `ProductFormDialog` tách riêng file (`products/ProductFormDialog.tsx`) — dùng bởi list và detail page
- `/imports/new` + `/imports/:id/edit` → `ImportFormPage` (React Hook Form header + useState LineItemDraft[])
- `/imports/:id` → `ImportDetailPage` (info + StatCards + line items + confirm/cancel dialogs)

## Ghi chú kỹ thuật

- Categories delete: trả về error string nếu bị block, null nếu ok → toast error tương ứng
- Supplier delete: cascade xóa SupplierPayment trong transaction
- Payment date: HTML `<input type="date">` → parse `YYYY-MM-DD` → `new Date(y, m-1, d)` để tránh UTC offset
- SupplierDetailPage: resolve supplier từ store trước (fast), fallback về DB query nếu navigate thẳng
- CustomerStats (orderCount/totalSpent) được load từ DB lúc `load()` — sẽ tự có giá trị sau Sprint 1.10
- TypeBadge customer: retail=gray, wholesale=blue, vip=yellow
- Product delete: block nếu có ImportItems hoặc OrderItems; cascade xóa Variants/ChannelInfos/InventoryRecords/StockMovements/PriceConfigs
- Product SKU: unique index (`&sku`) → Dexie ném ConstraintError nếu trùng → bắt trong catch của form
- `generateProductSku()`: format `SP-YYYYMMDD-XXXX` (random 4 ký tự uppercase)
- ProductFormDialog 3 tab: Tab nav cuối form bằng nút "← Trước / Tiếp →"; submit button luôn visible
- Ảnh sản phẩm: lưu base64 trong IndexedDB (Phase 1); sẽ migrate sang Supabase Storage ở Phase 3
- ProductsPage: filter ngoài DataTable (useMemo) cho category/channel/status; DataTable globalFilter cho search text
- ProductDetail: `getDetail(id)` load variants + channelInfos từ DB song song; product resolve từ store hoặc DB

## Ghi chú kỹ thuật Sprint 1.8 + 1.9

- `confirmBatch()`: pending→received; upsert InventoryRecord dùng `.where('productId').equals(id).filter(r => r.variantId === item.variantId)` để tránh compound index null caveat
- `ImportFormPage`: pre-load catalog vào `Map<productId, {product, variants}>` lúc mount; LineItemDraft dùng useState
- `generateBatchCode()`: format `IMP-YYYYMMDD-XXXX`
- `InventoryPage` 2 tab: tổng quan (DataTable + AdjustDialog per row) + lịch sử biến động (MovementWithProduct)
- `PricingPage` 3 tab: danh sách (dedup by productId+variantId+channelId, show margin với AlertTriangle) / máy tính (auto-fill fees via resolveChannelFee) / gán giá (form + live preview, upsert in-place)
- `usePriceStore.upsert()`: update in-place nếu trùng (productId+variantId+channelId), insert mới nếu chưa có
- `PricingPage` → `ProductDetailPage`: Giá theo kênh (table: kênh/giá bán/giá vốn/lợi nhuận/biên) + Tồn kho (table: biến thể/tổng/dự trữ/khả dụng/cảnh báo)

## Ghi chú kỹ thuật Sprint 1.10

- `createOrder()`: transaction tạo Order + OrderItems + trừ InventoryRecord + StockMovement(type='sale', qty=-n)
- `OrderSummary` extends Order với computed: `totalGrossProfit`, `netProfit`, `profitMargin` (không lưu DB)
- `netProfit` = Σ(item.grossProfit) - (sellerShippingFee - shippingSubsidy)
- `totalRevenue` = Σ(sellingPrice×qty) - discountAmount (buyerShippingFee không tính vào revenue)
- Status transitions: pending→confirmed→shipping→delivered; pending/confirmed→cancelled; shipping→returned
- deleteOrder: block nếu shipping/delivered; tồn kho KHÔNG được hoàn trả (Phase 1)
- `generateOrderCode()`: format `ORD-YYYYMMDD-XXXX` (random 4 ký tự uppercase)
- PosPage: route riêng NGOÀI AppLayout (full-screen, không có sidebar)
- POS auto-select kênh type='offline' đầu tiên; nút quick-cash làm tròn đến 10k/50k/100k

## Ghi chú kỹ thuật Sprint 1.11

- `DashboardPage`: load 5 stores + `db.orderItems.toArray()` lúc mount (cho top products)
- `filteredOrders`: loại bỏ cancelled + lọc theo selectedChannelId
- `chartData30`: 30 vòng lặp daily buckets — dùng `useMemo([filteredOrders])`
- Donut chart: chỉ hiện khi "Tất cả kênh" (selectedChannelId = ''); dùng `ch.color` trực tiếp
- `ChartTooltip`: custom component để format số thành VND
- `fmtAxis()`: rút gọn Y-axis tick (1.5M / 500K)
- Alert panel: chỉ render khi `totalAlerts > 0`; 3 loại: giá < sàn / hết hàng / đơn pending
- Recharts: `ComposedChart` (Bar=revenue + Line=profit) + `PieChart` (innerRadius=60 = donut)

## Ghi chú kỹ thuật Sprint 1.12

- **Flow checks** (tất cả đúng):
  - `confirmBatch` → `InventoryRecord` upsert + `StockMovement(type='import')` ✅
  - `createOrder` → `InventoryRecord` deduction + `StockMovement(type='sale', qty=-n)` ✅
  - `getLatestCostPrice` → từ received ImportBatches, sort by importDate desc ✅
  - Debt = `Σ(received ImportBatch.totalAmount)` - `Σ(SupplierPayment.amount)` ✅
  - Computed fields không lưu DB (grossProfit lưu là intentional snapshot) ✅
- **useSupplierStore**: `addPayment`/`deletePayment` giờ cập nhật `stats` in-memory
- **SupplierDetailPage**: Lịch sử nhập hàng đã điền dữ liệu thực (tất cả batches của NCC, link đến detail)
- Toast notifications có ở mọi page với CRUD actions
- Loading states: `undefined` = loading, `null` = not found pattern dùng nhất quán ở detail pages
- `pnpm tsc --noEmit` passed — không có TypeScript errors

## Ghi chú kỹ thuật Sprint 2.2

- `reportAggregator.ts`: `loadReportData(range, channelId?)` → load orders+items từ Dexie; `aggregateByPeriod()` → fill tất cả period buckets (no gaps); `summarizeChannels()` → per-channel stats; `calcBreakEven()` → load expenses tháng hiện tại
- `exportUtils.ts`: `exportToXlsx()` (SheetJS, dynamic import); `exportToPdf()` (jsPDF + jspdf-autotable, dynamic import)
- ReportsPage 4 tabs: Revenue (10.1) AreaChart + comparison line; Profit (10.2) ComposedChart bars+margin line + horizontal channel bars; Channels (10.3) table với % tỷ trọng + progress bar; Break-even (10.9) progress bar + tính DT cần/ngày
- Comparison period = shift range back by same duration; shown as dashed line / % change in stat cards
- `autoGroupBy()`: day≤14d, week≤90d, month≤500d, quarter otherwise
- Break-even phụ thuộc Sprint 2.1 (Expenses) — hiện load db.expenses trực tiếp; nếu chưa có data → hiện hướng dẫn thêm chi phí
- Packages mới: `xlsx` (SheetJS), `jspdf`, `jspdf-autotable` — dynamic import để lazy-load

## Việc cần làm tiếp — Phase 2

**Sprint 2.1** — Expenses & Net Profit (làm trước để Break-even có đủ data):
- Trang Expenses + form thêm/sửa chi phí
- useExpenseStore (CRUD + stats)
- Recurring expense logic
- Dashboard thêm thẻ KPI net profit

---

*Cập nhật lần cuối: Sprint 2.2 hoàn thành — 2026-03-28*
