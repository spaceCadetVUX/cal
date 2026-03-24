import { SellerDatabase } from './schema'

// Singleton instance — dùng toàn bộ app
// Import từ đây, không tạo new SellerDatabase() ở nơi khác
const db = new SellerDatabase()

export default db
