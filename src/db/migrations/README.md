# DB Migrations

Khi cần thay đổi schema (thêm/sửa/xóa table hoặc index):

1. Tăng version trong `src/db/schema.ts`
2. Thêm `.version(N).stores({...})` block mới
3. Nếu cần transform data, thêm `.upgrade(tx => {...})`
4. Ghi lại thay đổi ở đây

## Version history

| Version | Ngày | Thay đổi |
|---------|------|---------|
| 1 | 2026-03-25 | Initial schema — 18 tables |
