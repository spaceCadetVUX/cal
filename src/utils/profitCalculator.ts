import type { SellerDatabase } from '@/db/schema'

// ============================================================
// profitCalculator.ts
// Bước 2–4, 7–9: Tính lợi nhuận từ đơn vị → dòng → đơn → ròng
// ============================================================

// ---- Bước 2 & 3: Lợi nhuận trên 1 đơn vị ----

export interface CalcProfitPerUnitParams {
  sellingPrice: number
  costPrice: number
  platformFeePct: number // đã resolve từ channelFeeResolver
  paymentFeePct: number  // đã resolve từ channelFeeResolver
  packagingCost: number
  otherCost: number
}

export interface ProfitPerUnitResult {
  platformFee: number
  paymentFee: number
  totalChannelFee: number
  totalCostPerUnit: number
  grossProfitPerUnit: number
  profitMarginPerUnit: number // % revenue-based
}

/**
 * Tính lợi nhuận trên 1 đơn vị sản phẩm.
 *
 * Công thức:
 *   platformFee     = sellingPrice × platformFeePct / 100
 *   paymentFee      = sellingPrice × paymentFeePct  / 100
 *   totalChannelFee = platformFee + paymentFee
 *   totalCostPerUnit = costPrice + totalChannelFee + packagingCost + otherCost
 *   grossProfitPerUnit = sellingPrice - totalCostPerUnit
 *   profitMarginPerUnit = grossProfitPerUnit / sellingPrice × 100  (revenue-based)
 */
export function calcProfitPerUnit(params: CalcProfitPerUnitParams): ProfitPerUnitResult {
  const { sellingPrice, costPrice, platformFeePct, paymentFeePct, packagingCost, otherCost } = params

  const platformFee = sellingPrice * platformFeePct / 100
  const paymentFee = sellingPrice * paymentFeePct / 100
  const totalChannelFee = platformFee + paymentFee
  const totalCostPerUnit = costPrice + totalChannelFee + packagingCost + otherCost
  const grossProfitPerUnit = sellingPrice - totalCostPerUnit
  const profitMarginPerUnit = sellingPrice > 0 ? (grossProfitPerUnit / sellingPrice) * 100 : 0

  return {
    platformFee,
    paymentFee,
    totalChannelFee,
    totalCostPerUnit,
    grossProfitPerUnit,
    profitMarginPerUnit,
  }
}


// ---- Bước 4: Lợi nhuận toàn dòng (OrderItem) ----

export interface CalcOrderItemProfitParams extends CalcProfitPerUnitParams {
  quantity: number
}

export interface OrderItemProfitResult {
  platformFee: number      // fee cho toàn dòng
  paymentFee: number       // fee cho toàn dòng
  grossProfit: number      // lưu vào OrderItem.grossProfit
  subtotal: number         // COMPUTED — không lưu DB
  profitMargin: number     // COMPUTED — không lưu DB (revenue-based %)
}

/**
 * Tính lợi nhuận cho 1 dòng OrderItem (nhiều đơn vị).
 *
 * Công thức:
 *   subtotal    = sellingPrice × quantity         (COMPUTED)
 *   grossProfit = grossProfitPerUnit × quantity   (LƯU vào DB)
 *   profitMargin = grossProfit / subtotal × 100   (COMPUTED)
 */
export function calcOrderItemProfit(params: CalcOrderItemProfitParams): OrderItemProfitResult {
  const { quantity } = params
  const perUnit = calcProfitPerUnit(params)

  const subtotal = params.sellingPrice * quantity
  const grossProfit = perUnit.grossProfitPerUnit * quantity
  const profitMargin = subtotal > 0 ? (grossProfit / subtotal) * 100 : 0

  return {
    platformFee: perUnit.platformFee * quantity,
    paymentFee: perUnit.paymentFee * quantity,
    grossProfit,
    subtotal,
    profitMargin,
  }
}


// ---- Bước 7 & 8: Lợi nhuận đơn hàng ----

/**
 * Chi phí vận chuyển thực tế shop chịu.
 * netShippingCost < 0 nghĩa là sàn trợ giá nhiều hơn thực tế (lợi cho shop).
 */
export function calcNetShippingCost(sellerShippingFee: number, shippingSubsidy: number): number {
  return sellerShippingFee - shippingSubsidy
}

/**
 * Lợi nhuận gộp toàn bộ 1 đơn hàng (sau khi trừ phí vận chuyển ròng).
 *
 * Công thức:
 *   totalGrossProfit = Σ(OrderItem.grossProfit) - netShippingCost
 */
export function calcOrderProfit(
  itemGrossProfits: number[],
  sellerShippingFee: number,
  shippingSubsidy: number
): number {
  const totalItemProfit = itemGrossProfits.reduce((sum, p) => sum + p, 0)
  return totalItemProfit - calcNetShippingCost(sellerShippingFee, shippingSubsidy)
}

/**
 * Lợi nhuận ròng trong kỳ = lợi nhuận gộp - chi phí vận hành được phân bổ.
 *
 * Công thức:
 *   netProfit = totalGrossProfit - allocatedExpenses
 */
export function calcNetProfit(totalGrossProfit: number, allocatedExpenses: number): number {
  return totalGrossProfit - allocatedExpenses
}


// ---- Bước 9: Công nợ NCC ----

/**
 * Tính tổng công nợ còn lại với nhà cung cấp.
 *
 * Công thức:
 *   supplierDebt = Σ(ImportBatch.totalAmount where status='received')
 *                - Σ(SupplierPayment.amount)
 */
export async function calcSupplierDebt(supplierId: string, db: SellerDatabase): Promise<number> {
  const batches = await db.importBatches
    .where('supplierId')
    .equals(supplierId)
    .filter((b) => b.status === 'received')
    .toArray()
  const totalImported = batches.reduce((sum, b) => sum + b.totalAmount, 0)

  const payments = await db.supplierPayments
    .where('supplierId')
    .equals(supplierId)
    .toArray()
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0)

  return totalImported - totalPaid
}
