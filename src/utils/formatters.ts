import { format, formatDistanceToNow } from 'date-fns'
import { vi } from 'date-fns/locale'

// ============================================================
// formatters.ts
// Các hàm định dạng hiển thị — currency, percentage, date
// ============================================================

/**
 * Format số tiền VND.
 * Ví dụ: 1500000 → "1.500.000 ₫"
 */
export function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount)
}

/**
 * Format phần trăm.
 * Ví dụ: 12.5 → "12,5%"
 */
export function formatPct(value: number, decimals = 1): string {
  return `${value.toFixed(decimals).replace('.', ',')}%`
}

/**
 * Format ngày theo định dạng dd/MM/yyyy.
 * Ví dụ: new Date('2026-03-25') → "25/03/2026"
 */
export function formatDate(date: Date | string): string {
  return format(new Date(date), 'dd/MM/yyyy', { locale: vi })
}

/**
 * Format khoảng ngày.
 * Ví dụ: "25/03/2026 – 31/03/2026"
 */
export function formatDateRange(start: Date | string, end: Date | string): string {
  return `${formatDate(start)} – ${formatDate(end)}`
}

/**
 * Format thời gian tương đối (dùng cho thông báo, activity feed).
 * Ví dụ: "3 phút trước"
 */
export function formatRelativeTime(date: Date | string): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: vi })
}
