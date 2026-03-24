import type { InventoryRecord } from '@/types'

// ============================================================
// inventoryHelper.ts
// Tính tồn kho khả dụng và kiểm tra cảnh báo hàng sắp hết
// ============================================================

/**
 * Số lượng khả dụng = tổng tồn kho - số đang giữ chỗ (reserved).
 * COMPUTED — không lưu DB.
 */
export function calcAvailableQty(record: Pick<InventoryRecord, 'quantity' | 'reservedQty'>): number {
  return record.quantity - record.reservedQty
}

/**
 * Kiểm tra có đang ở mức cảnh báo hàng sắp hết không.
 * Cảnh báo khi availableQty <= lowStockAlert.
 */
export function isLowStock(record: Pick<InventoryRecord, 'quantity' | 'reservedQty' | 'lowStockAlert'>): boolean {
  return calcAvailableQty(record) <= record.lowStockAlert
}
