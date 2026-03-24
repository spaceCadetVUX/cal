import type { SellerDatabase } from '@/db/schema'

// ============================================================
// channelFeeResolver.ts
// Bước 1: Xác định phí kênh theo đúng thứ tự ưu tiên:
//   ChannelCategoryFee[channelId+categoryId] > SalesChannel.platformFeePct
// ============================================================

export interface ResolvedChannelFee {
  platformFeePct: number
  paymentFeePct: number
}

/**
 * Resolve phí kênh cho 1 sản phẩm tại 1 kênh bán.
 * Ưu tiên: ChannelCategoryFee > SalesChannel.platformFeePct
 *
 * @param channelId - ID kênh bán
 * @param categoryId - ID danh mục sản phẩm (optional — nếu không có thì dùng fee mặc định của kênh)
 * @param db        - Dexie database instance
 */
export async function resolveChannelFee(
  channelId: string,
  categoryId: string | undefined,
  db: SellerDatabase
): Promise<ResolvedChannelFee> {
  const channel = await db.salesChannels.get(channelId)
  if (!channel) throw new Error(`SalesChannel not found: ${channelId}`)

  let platformFeePct = channel.platformFeePct

  if (categoryId) {
    const categoryFee = await db.channelCategoryFees
      .where('[channelId+categoryId]')
      .equals([channelId, categoryId])
      .first()
    if (categoryFee) {
      platformFeePct = categoryFee.feePct
    }
  }

  return {
    platformFeePct,
    paymentFeePct: channel.paymentFeePct,
  }
}
