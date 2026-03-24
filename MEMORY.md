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
- [ ] **1.4** Layout & Navigation ← **TIẾP THEO**
- [ ] **1.5** Settings & Channels
- [ ] **1.6** Categories, Suppliers, Customers
- [ ] **1.7** Products
- [ ] **1.8** Imports & Inventory
- [ ] **1.9** Pricing
- [ ] **1.10** Orders + Quick POS
- [ ] **1.11** Dashboard MVP
- [ ] **1.12** Integration & Polish

### Phase 2–4
- [ ] Phase 2: Báo cáo, Advanced Pricing, Import CSV, UX Polish (6 sprints)
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
├── components/shared/
├── components/charts/
├── pages/{dashboard,channels,products,suppliers,imports,
│         inventory,orders/pos,pricing,expenses,customers,
│         reports,settings}/
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

## Sprint 1.4 — Việc cần làm

Layout & Navigation theo `PROJECT_PLAN.md Sprint 1.4`:

- `src/components/layout/Sidebar.tsx` — Logo, menu 13 items, active state theo route
- `src/components/layout/Header.tsx` — Tên trang, dark/light toggle, breadcrumb
- `src/components/layout/AppLayout.tsx` — Wrapper: Sidebar + Header + `<Outlet>`
- `src/App.tsx` — React Router 7: BrowserRouter + routes + AppLayout
- Tạo page placeholder cho từng route (chỉ cần h1 đúng tên)
- Cài thêm nếu thiếu: `react-router-dom`, `sonner` toast

---

*Cập nhật lần cuối: Sprint 1.3 hoàn thành — 2026-03-25*
