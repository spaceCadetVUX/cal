# Hướng dẫn chạy project

## Yêu cầu

- [Node.js](https://nodejs.org/) v18+ (đang dùng v24)
- pnpm hoặc npm

---

## Lần đầu tiên (cài dependencies)

Mở terminal tại thư mục project:

```bash
# Nếu có pnpm
pnpm install

# Hoặc dùng npm
npm install
```

---

## Chạy dev server

```bash
# Nếu có pnpm
pnpm dev

# Hoặc dùng npm
npm run dev
```

Sau đó mở trình duyệt tại: **http://localhost:5173**

---

## Các lệnh khác

| Lệnh | Mô tả |
|------|-------|
| `pnpm dev` | Chạy dev server (hot reload) |
| `pnpm build` | Build production |
| `pnpm preview` | Preview bản build |

---

## Mở terminal trong VS Code

1. Nhấn **Ctrl + `** (backtick) để mở terminal tích hợp
2. Terminal sẽ tự mở đúng thư mục project
3. Chạy `npm run dev` là xong

---

## Lưu ý

- Data được lưu trong **IndexedDB** của trình duyệt — không cần server hay database ngoài
- Lần đầu mở app sẽ tự seed dữ liệu mẫu (6 kênh bán, 19 danh mục, phí kênh)
- Nếu muốn reset data: vào **Cài đặt → Reset toàn bộ dữ liệu**
