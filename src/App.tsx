import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AppLayout } from '@/components/layout/AppLayout'
import DashboardPage from '@/pages/dashboard/DashboardPage'
import ChannelsPage from '@/pages/channels/ChannelsPage'
import CategoriesPage from '@/pages/categories/CategoriesPage'
import SuppliersPage from '@/pages/suppliers/SuppliersPage'
import CustomersPage from '@/pages/customers/CustomersPage'
import ProductsPage from '@/pages/products/ProductsPage'
import ImportsPage from '@/pages/imports/ImportsPage'
import InventoryPage from '@/pages/inventory/InventoryPage'
import PricingPage from '@/pages/pricing/PricingPage'
import OrdersPage from '@/pages/orders/OrdersPage'
import PosPage from '@/pages/orders/PosPage'
import ExpensesPage from '@/pages/expenses/ExpensesPage'
import ReportsPage from '@/pages/reports/ReportsPage'
import SettingsPage from '@/pages/settings/SettingsPage'
import NotFoundPage from '@/pages/NotFoundPage'

function App() {
  return (
    <>
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="channels" element={<ChannelsPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="suppliers" element={<SuppliersPage />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="imports" element={<ImportsPage />} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="pricing" element={<PricingPage />} />
          <Route path="orders">
            <Route index element={<OrdersPage />} />
            <Route path="pos" element={<PosPage />} />
          </Route>
          <Route path="expenses" element={<ExpensesPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
    <Toaster richColors position="top-right" />
    </>
  )
}

export default App
