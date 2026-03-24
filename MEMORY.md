# MEMORY — Multi-Channel Seller Manager

> File này dành cho Claude. Cập nhật sau mỗi Sprint hoàn thành hoặc khi có thay đổi lớn.

---

## Project

- **Tên:** Multi-Channel Seller Manager
- **Mục tiêu:** Quản lý bán hàng đa kênh (Shopee, Lazada, TikTok, Website, Offline, Custom)
- **Thư mục:** `C:/Users/vusu3/Desktop/Tool/cal`
- **Package manager:** pnpm
- **Kế hoạch đầy đủ:** xem `PROJECT_PLAN.md` — đây là nguồn sự thật duy nhất

---

## Tech Stack

| | |
|--|--|
| Framework | React 19 + TypeScript 5 + Vite 8 |
| Styling | Tailwind CSS 3.4 + CSS variables |
| UI | shadcn/ui (manual setup, Radix UI + CVA + clsx + tailwind-merge) |
| State | Zustand 5 |
| Local DB | Dexie.js 4 (IndexedDB) |
| Routing | React Router 7 |
| Forms | React Hook Form 7 + Zod 4 |
| Table | TanStack Table 8 |
| Charts | Recharts 3 |
| Utilities | date-fns 4, Lucide React, Sonner |
| Code quality | Prettier + prettier-plugin-tailwindcss + .editorconfig |
| Alias | `@/` → `src/` |

---

## Kiến trúc quan trọng (không được sai)

1. **costPrice KHÔNG lưu trong PriceConfig** → luôn lấy từ `ImportItem` mới nhất của sản phẩm
2. **Computed fields KHÔNG lưu DB:**
   - `InventoryRecord.availableQty` = quantity - reservedQty
   - `ImportItem.totalCost` = quantity × costPrice
   - `OrderItem.subtotal` = sellingPrice × quantity
   - `OrderItem.profitMargin` = grossProfit / subtotal × 100
   - `SupplierDebt` = ImportBatch.totalAmount - Σ(SupplierPayment.amount)
3. **Tồn kho CHUNG** cho tất cả kênh — trừ kho bất kể bán kênh nào
4. **Luật ưu tiên phí:** ChannelCategoryFee > SalesChannel.platformFeePct
5. **Luật ưu tiên giá:** PriceConfig(channelId=X) > PriceConfig(channelId=null)
6. **profitMargin = revenue-based** (grossProfit / revenue × 100), KHÔNG phải markup
7. **Công thức tính toán** chỉ viết ở `src/utils/` — không được viết lại ở nơi khác

---

## 18 Data Models

```
1. AppSettings       — singleton, cấu hình chung
2. SalesChannel      — kênh bán (shopee/lazada/tiktok/website/offline/custom)
3. Category          — danh mục sản phẩm
4. ChannelCategoryFee — phí kênh × danh mục
5. Supplier          — nhà cung cấp
6. SupplierPayment   — thanh toán / công nợ NCC
7. Customer          — khách hàng (offline + website)
8. Product           — sản phẩm
9. ProductVariant    — biến thể sản phẩm
10. ProductChannelInfo — SP × kênh (external SKU, isListed)
11. PriceConfig      — cấu hình giá (base hoặc per-channel)
12. ImportBatch      — lô nhập hàng
13. ImportItem       — chi tiết lô nhập (nguồn duy nhất của costPrice)
14. InventoryRecord  — tồn kho (chung tất cả kênh)
15. StockMovement    — lịch sử biến động kho
16. Order            — đơn bán
17. OrderItem        — chi tiết đơn bán
18. Expense          — chi phí vận hành
```

---

## Roadmap — 23 Sprints

### Phase 1 — Local MVP (12 sprints)
- [x] **1.1** Project Setup ✅
- [ ] **1.2** Database Layer (18 tables Dexie + seed data)
- [ ] **1.3** Utility Functions (công thức, formatters)
- [ ] **1.4** Layout & Navigation
- [ ] **1.5** Settings & Channels
- [ ] **1.6** Categories, Suppliers, Customers
- [ ] **1.7** Products
- [ ] **1.8** Imports & Inventory
- [ ] **1.9** Pricing
- [ ] **1.10** Orders + Quick POS
- [ ] **1.11** Dashboard MVP
- [ ] **1.12** Integration & Polish

### Phase 2 — Advanced (6 sprints)
- [ ] 2.1 Expenses & Net Profit
- [ ] 2.2 Reports (doanh thu/lợi nhuận)
- [ ] 2.3 Reports (8 báo cáo còn lại)
- [ ] 2.4 Advanced Pricing (flash sale, bulk update)
- [ ] 2.5 Advanced Orders (import CSV, hoàn trả)
- [ ] 2.6 UX Polish (dark mode, global search)

### Phase 3 — Backend (3 sprints)
- [ ] 3.1 Supabase Auth
- [ ] 3.2 Data Migration & Sync
- [ ] 3.3 Storage + Multi-business + RBAC

### Phase 4 — PWA (2 sprints)
- [ ] 4.1 PWA & Offline
- [ ] 4.2 Mobile UX + barcode + push notification

---

## Cấu trúc src/

```
src/
├── assets/
├── components/ui/          ← shadcn components
├── components/layout/      ← Sidebar, Header, PageLayout
├── components/shared/      ← DataTable, StatCard, ChannelBadge, ConfirmDialog
├── components/charts/
├── pages/                  ← 12 modules (dashboard, channels, products, ...)
│   └── orders/pos/         ← Quick POS mode
├── stores/                 ← Zustand stores (1 per domain)
├── db/schema.ts            ← Dexie schema
├── db/db.ts                ← Dexie instance singleton
├── db/migrations/
├── hooks/                  ← useChannelFee, useProfitCalc, useInventoryAlert
├── utils/                  ← profitCalculator, priceCalculator, channelFeeResolver, formatters
├── types/                  ← TS interfaces mirror 18 models
├── constants/appConfig.ts
├── constants/channelDefaults.ts  ← phí mặc định Shopee/Lazada/TikTok/Tiki/Website/Offline
└── lib/utils.ts            ← cn()
```

---

## Files đã tạo (Sprint 1.1)

- `vite.config.ts` — alias `@/`
- `tsconfig.app.json` — paths `@/*`
- `tailwind.config.js` — CSS variables, darkMode: class
- `src/index.css` — Tailwind directives + CSS variable tokens
- `src/App.tsx` — placeholder đơn giản
- `src/lib/utils.ts` — cn()
- `src/constants/appConfig.ts` — APP_CONFIG
- `.prettierrc` — Prettier config
- `.editorconfig`
- Toàn bộ cấu trúc thư mục `src/`

---

*Cập nhật lần cuối: Sprint 1.1 hoàn thành — 2026-03-25*
