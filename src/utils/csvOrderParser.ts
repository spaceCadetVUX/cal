// ============================================================
// csvOrderParser.ts — Shopee & Lazada CSV Order Import
// ============================================================

export type CsvFormat = 'shopee' | 'lazada' | 'unknown'

export interface CsvOrderItem {
  externalSku: string
  productName: string
  variantName: string
  quantity: number
  unitPrice: number
}

export interface CsvOrder {
  externalOrderId: string
  orderDate: Date
  items: CsvOrderItem[]
  totalAmount: number
  shippingFee: number
  platformFee: number
  buyerName?: string
}

export interface CsvParseResult {
  format: CsvFormat
  orders: CsvOrder[]
  errors: string[]
  rawRowCount: number
}

// --------------- Low-level CSV ---------------

function parseCsvLine(line: string, sep: string): string[] {
  const result: string[] = []
  let cur = ''
  let inQuote = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuote) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++ }
      else if (ch === '"') inQuote = false
      else cur += ch
    } else {
      if (ch === '"') inQuote = true
      else if (line.slice(i, i + sep.length) === sep) { result.push(cur.trim()); cur = ''; i += sep.length - 1 }
      else cur += ch
    }
  }
  result.push(cur.trim())
  return result
}

function parseCsvText(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const clean = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = clean.split('\n').filter((l) => l.trim())
  if (lines.length < 2) return { headers: [], rows: [] }

  const firstLine = lines[0]
  // Tab-separated if more tabs than commas
  const tabs = (firstLine.match(/\t/g) ?? []).length
  const commas = (firstLine.match(/,/g) ?? []).length
  const sep = tabs > commas ? '\t' : ','

  const headers = parseCsvLine(lines[0], sep).map((h) => h.replace(/^["']|["']$/g, '').trim())
  const rows = lines.slice(1).map((line) => {
    const values = parseCsvLine(line, sep)
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = (values[i] ?? '').trim() })
    return row
  })
  return { headers, rows }
}

// --------------- Format detection ---------------

function detectFormat(headers: string[]): CsvFormat {
  const hl = headers.map((h) => h.toLowerCase())
  if (
    hl.some((h) => h.includes('sku reference')) ||
    hl.some((h) => h.includes('mã sản phẩm')) ||
    (hl.some((h) => h === 'order id') && hl.some((h) => h.includes('deal price')))
  ) return 'shopee'
  if (
    hl.some((h) => h === 'order number') ||
    hl.some((h) => h.includes('item status')) ||
    hl.some((h) => h === 'seller sku')
  ) return 'lazada'
  return 'unknown'
}

// --------------- Helpers ---------------

function parseNum(s: string): number {
  return parseFloat(s.replace(/[^0-9.-]/g, '')) || 0
}

function parseDateStr(s: string): Date {
  if (!s) return new Date()
  const clean = s.trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(clean)) return new Date(clean)
  const dmy = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (dmy) return new Date(`${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`)
  const parsed = new Date(clean)
  return isNaN(parsed.getTime()) ? new Date() : parsed
}

function getCol(row: Record<string, string>, candidates: string[]): string {
  for (const c of candidates) {
    const k = Object.keys(row).find((k) => k.toLowerCase().trim() === c.toLowerCase())
    if (k !== undefined && row[k]) return row[k]
  }
  return ''
}

// --------------- Shopee parser ---------------

function parseShopeeOrders(rows: Record<string, string>[]): CsvOrder[] {
  const map = new Map<string, CsvOrder>()

  for (const row of rows) {
    const orderId = getCol(row, ['order id', 'mã đơn hàng', 'orderid'])
    if (!orderId) continue

    const sku = getCol(row, ['sku reference no.', 'sku reference no', 'mã sản phẩm (sku)', 'mã sản phẩm', 'seller sku'])
    const productName = getCol(row, ['product name', 'tên sản phẩm', 'product'])
    if (!sku && !productName) continue

    const qty = parseNum(getCol(row, ['quantity', 'số lượng', 'qty'])) || 1
    const unitPrice = parseNum(getCol(row, ['deal price', 'unit price sgd', 'unit price', 'giá bán', 'giá thực tế']))
    const total = parseNum(getCol(row, ['total amount', 'tổng tiền đơn hàng', 'order total']))
    const ship = parseNum(getCol(row, ['actual shipping cost', 'shipping fee', 'phí vận chuyển']))
    const fee = parseNum(getCol(row, ['commission fee', 'hoa hồng', 'transaction fee', 'phí xử lý']))
    const dateStr = getCol(row, ['order paid time', 'order creation time', 'order creation date', 'ngày đặt hàng', 'ship time'])

    if (!map.has(orderId)) {
      map.set(orderId, {
        externalOrderId: orderId,
        orderDate: parseDateStr(dateStr),
        items: [],
        totalAmount: total,
        shippingFee: ship,
        platformFee: fee,
        buyerName: getCol(row, ['buyer username', 'tên người mua', 'receiver name']),
      })
    }

    map.get(orderId)!.items.push({
      externalSku: sku || productName,
      productName,
      variantName: getCol(row, ['variation name', 'biến thể sản phẩm', 'tên biến thể', 'variation']),
      quantity: qty,
      unitPrice,
    })
  }

  return [...map.values()]
}

// --------------- Lazada parser ---------------

function parseLazadaOrders(rows: Record<string, string>[]): CsvOrder[] {
  const map = new Map<string, CsvOrder>()

  for (const row of rows) {
    const orderId = getCol(row, ['order number', 'orderid', 'order id'])
    if (!orderId) continue

    const sku = getCol(row, ['seller sku', 'sku', 'seller product sku'])
    const productName = getCol(row, ['name', 'item name', 'product name'])
    if (!sku && !productName) continue

    const qty = parseNum(getCol(row, ['qty ordered', 'quantity', 'qty'])) || 1
    const unitPrice = parseNum(getCol(row, ['unit price', 'paid price', 'item price']))
    const total = parseNum(getCol(row, ['order amount', 'total amount']))
    const ship = parseNum(getCol(row, ['shipping fee', 'delivery fee', 'estimated shipping fee']))
    const dateStr = getCol(row, ['created at', 'order date', 'order creation date'])

    if (!map.has(orderId)) {
      map.set(orderId, {
        externalOrderId: orderId,
        orderDate: parseDateStr(dateStr),
        items: [],
        totalAmount: total,
        shippingFee: ship,
        platformFee: 0,
        buyerName: getCol(row, ['customer name', 'customer', 'buyer name']),
      })
    }

    map.get(orderId)!.items.push({
      externalSku: sku || productName,
      productName,
      variantName: getCol(row, ['variation', 'product variation']),
      quantity: qty,
      unitPrice,
    })
  }

  return [...map.values()]
}

// --------------- Main entry ---------------

export function parseCsvOrders(csvText: string): CsvParseResult {
  try {
    const { headers, rows } = parseCsvText(csvText)
    if (headers.length === 0) {
      return { format: 'unknown', orders: [], errors: ['File CSV trống hoặc không đọc được'], rawRowCount: 0 }
    }

    const format = detectFormat(headers)
    let orders: CsvOrder[]

    if (format === 'lazada') {
      orders = parseLazadaOrders(rows)
    } else {
      // shopee or unknown — try shopee parser
      orders = parseShopeeOrders(rows)
    }

    const errors: string[] = []
    if (orders.length === 0) errors.push('Không tìm thấy đơn hàng nào. Kiểm tra định dạng CSV.')

    return { format: orders.length > 0 ? (format === 'unknown' ? 'shopee' : format) : format, orders, errors, rawRowCount: rows.length }
  } catch (e) {
    return { format: 'unknown', orders: [], errors: [`Lỗi đọc file: ${e}`], rawRowCount: 0 }
  }
}
