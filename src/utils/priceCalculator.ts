// ============================================================
// priceCalculator.ts
// Bước 5 & 6: Tính giá sàn (không lỗ) và giá đề xuất (theo margin mong muốn)
// ============================================================

export interface CalcMinSellingPriceParams {
  costPrice: number
  packagingCost: number
  otherCost: number
  platformFeePct: number // đã resolve từ channelFeeResolver
  paymentFeePct: number  // đã resolve từ channelFeeResolver
}

/**
 * Giá sàn — giá bán tối thiểu để không lỗ (grossProfit = 0).
 *
 * Công thức:
 *   minSellingPrice = (costPrice + packagingCost + otherCost)
 *                   / (1 - (platformFeePct + paymentFeePct) / 100)
 */
export function calcMinSellingPrice(params: CalcMinSellingPriceParams): number {
  const { costPrice, packagingCost, otherCost, platformFeePct, paymentFeePct } = params
  const totalFeePct = platformFeePct + paymentFeePct
  const divisor = 1 - totalFeePct / 100
  if (divisor <= 0) return Infinity
  return (costPrice + packagingCost + otherCost) / divisor
}

export interface CalcSuggestedPriceParams extends CalcMinSellingPriceParams {
  minMarginPct: number // % margin tối thiểu mong muốn (revenue-based)
}

/**
 * Giá đề xuất — giá bán để đạt đúng margin mong muốn.
 *
 * Công thức:
 *   suggestedPrice = (costPrice + packagingCost + otherCost)
 *                  / (1 - (platformFeePct + paymentFeePct) / 100 - minMarginPct / 100)
 */
export function calcSuggestedPrice(params: CalcSuggestedPriceParams): number {
  const { costPrice, packagingCost, otherCost, platformFeePct, paymentFeePct, minMarginPct } = params
  const totalFeePct = platformFeePct + paymentFeePct
  const divisor = 1 - totalFeePct / 100 - minMarginPct / 100
  if (divisor <= 0) return Infinity
  return (costPrice + packagingCost + otherCost) / divisor
}
