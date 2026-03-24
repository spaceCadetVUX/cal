import type { ChannelType } from '@/types'

// ============================================================
// Phí mặc định các sàn Việt Nam — Section 7 của PROJECT_PLAN.md
// Dùng làm giá trị prefill khi tạo SalesChannel mới.
// Người dùng có thể override bất kỳ giá trị nào.
// ============================================================

export interface ChannelDefault {
  type: ChannelType
  name: string
  platformFeePct: number
  paymentFeePct: number
  defaultShippingSubsidy: number
  color: string
}

// Phí mặc định theo loại kênh (không theo danh mục)
export const CHANNEL_DEFAULTS: Record<ChannelType, ChannelDefault> = {
  shopee: {
    type: 'shopee',
    name: 'Shopee',
    platformFeePct: 3,
    paymentFeePct: 1,
    defaultShippingSubsidy: 0,
    color: '#EE4D2D',
  },
  lazada: {
    type: 'lazada',
    name: 'Lazada',
    platformFeePct: 3,
    paymentFeePct: 1,
    defaultShippingSubsidy: 0,
    color: '#0F146D',
  },
  tiki: {
    type: 'tiki',
    name: 'Tiki',
    platformFeePct: 8,
    paymentFeePct: 1,
    defaultShippingSubsidy: 0,
    color: '#1A94FF',
  },
  tiktok: {
    type: 'tiktok',
    name: 'TikTok Shop',
    platformFeePct: 2,
    paymentFeePct: 1,
    defaultShippingSubsidy: 0,
    color: '#010101',
  },
  website: {
    type: 'website',
    name: 'Website',
    platformFeePct: 0,
    paymentFeePct: 1.1, // VNPay mặc định
    defaultShippingSubsidy: 0,
    color: '#6366F1',
  },
  offline: {
    type: 'offline',
    name: 'Cửa hàng',
    platformFeePct: 0,
    paymentFeePct: 0,
    defaultShippingSubsidy: 0,
    color: '#10B981',
  },
  custom: {
    type: 'custom',
    name: 'Kênh khác',
    platformFeePct: 0,
    paymentFeePct: 0,
    defaultShippingSubsidy: 0,
    color: '#8B5CF6',
  },
}

// Phí theo danh mục — dùng khi seed ChannelCategoryFee
// key: categoryName (sẽ match với Category.name khi seed)
export const SHOPEE_CATEGORY_FEES: Record<string, number> = {
  'Thời trang nữ': 4,
  'Thời trang nam': 4,
  'Thời trang trẻ em': 4,
  'Giày dép': 4,
  'Túi xách, Ví': 4,
  'Đồng hồ': 3,
  'Đồ trang sức, Phụ kiện': 3,
  'Điện thoại & Phụ kiện': 2,
  'Máy tính & Laptop': 2,
  'Thiết bị điện tử': 2,
  'Nhà cửa & Đời sống': 3,
  'Sức khỏe & Làm đẹp': 4,
  'Thực phẩm & Đồ uống': 2,
  'Mẹ & Bé': 3,
  'Thể thao & Dã ngoại': 3,
  'Ô tô & Xe máy': 2,
  'Sách & Văn phòng phẩm': 3,
  'Chăm sóc thú cưng': 3,
  'Khác': 3,
}

export const LAZADA_CATEGORY_FEES: Record<string, number> = {
  'Thời trang nữ': 4,
  'Thời trang nam': 4,
  'Thời trang trẻ em': 4,
  'Điện thoại & Phụ kiện': 2,
  'Máy tính & Laptop': 2,
  'Thiết bị điện tử': 2,
  'Sức khỏe & Làm đẹp': 4,
  'Nhà cửa & Đời sống': 3,
  'Thể thao & Dã ngoại': 3,
  'Khác': 3,
}

export const TIKI_CATEGORY_FEES: Record<string, number> = {
  'Sách & Văn phòng phẩm': 10,
  'Điện thoại & Phụ kiện': 5,
  'Máy tính & Laptop': 5,
  'Thời trang nữ': 12,
  'Thời trang nam': 12,
  'Sức khỏe & Làm đẹp': 12,
  'Khác': 8,
}

// Seed channels — 6 kênh mặc định được tạo lúc app khởi động lần đầu
export const SEED_CHANNELS = [
  'shopee',
  'lazada',
  'tiktok',
  'tiki',
  'website',
  'offline',
] as const satisfies readonly ChannelType[]

// Seed categories — danh mục mặc định
export const SEED_CATEGORIES = [
  'Thời trang nữ',
  'Thời trang nam',
  'Thời trang trẻ em',
  'Giày dép',
  'Túi xách, Ví',
  'Đồng hồ',
  'Đồ trang sức, Phụ kiện',
  'Điện thoại & Phụ kiện',
  'Máy tính & Laptop',
  'Thiết bị điện tử',
  'Nhà cửa & Đời sống',
  'Sức khỏe & Làm đẹp',
  'Thực phẩm & Đồ uống',
  'Mẹ & Bé',
  'Thể thao & Dã ngoại',
  'Ô tô & Xe máy',
  'Sách & Văn phòng phẩm',
  'Chăm sóc thú cưng',
  'Khác',
] as const
