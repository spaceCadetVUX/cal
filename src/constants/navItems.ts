import {
  LayoutDashboard,
  Store,
  Tag,
  Truck,
  Users,
  Package,
  PackageOpen,
  Warehouse,
  CircleDollarSign,
  ShoppingCart,
  Receipt,
  BarChart3,
  Settings,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface NavItem {
  path: string
  label: string
  icon: LucideIcon
}

// Main navigation — one entry per top-level route
export const NAV_ITEMS: NavItem[] = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/channels', label: 'Kênh bán', icon: Store },
  { path: '/categories', label: 'Danh mục', icon: Tag },
  { path: '/suppliers', label: 'Nhà cung cấp', icon: Truck },
  { path: '/customers', label: 'Khách hàng', icon: Users },
  { path: '/products', label: 'Sản phẩm', icon: Package },
  { path: '/imports', label: 'Nhập hàng', icon: PackageOpen },
  { path: '/inventory', label: 'Tồn kho', icon: Warehouse },
  { path: '/pricing', label: 'Giá bán', icon: CircleDollarSign },
  { path: '/orders', label: 'Đơn bán', icon: ShoppingCart },
  { path: '/expenses', label: 'Chi phí', icon: Receipt },
  { path: '/reports', label: 'Báo cáo', icon: BarChart3 },
  { path: '/settings', label: 'Cài đặt', icon: Settings },
]
