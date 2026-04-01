// ============================================================
// GlobalSearch.tsx — Ctrl+K global search across all entities
// ============================================================

import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Package, ShoppingCart, Users, Truck, X } from 'lucide-react'
import db from '@/db/db'

interface SearchResult {
  id: string
  type: 'product' | 'order' | 'customer' | 'supplier'
  title: string
  subtitle: string
  path: string
}

const TYPE_CONFIG = {
  product:  { label: 'Sản phẩm',      icon: Package,      cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  order:    { label: 'Đơn hàng',      icon: ShoppingCart, cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  customer: { label: 'Khách hàng',    icon: Users,        cls: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  supplier: { label: 'Nhà cung cấp',  icon: Truck,        cls: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
}

async function searchAll(q: string): Promise<SearchResult[]> {
  const kw = q.toLowerCase().trim()
  if (!kw) return []

  const [products, orders, customers, suppliers] = await Promise.all([
    db.products.toArray(),
    db.orders.toArray(),
    db.customers.toArray(),
    db.suppliers.toArray(),
  ])

  const results: SearchResult[] = []

  for (const p of products) {
    if (p.name.toLowerCase().includes(kw) || p.sku.toLowerCase().includes(kw)) {
      results.push({ id: p.id, type: 'product', title: p.name, subtitle: p.sku, path: `/products/${p.id}` })
    }
  }
  for (const o of orders) {
    if (
      o.orderCode.toLowerCase().includes(kw) ||
      (o.externalOrderId ?? '').toLowerCase().includes(kw)
    ) {
      results.push({
        id: o.id,
        type: 'order',
        title: o.orderCode,
        subtitle: o.externalOrderId ? `Mã ngoài: ${o.externalOrderId}` : new Date(o.orderDate).toLocaleDateString('vi-VN'),
        path: `/orders/${o.id}`,
      })
    }
  }
  for (const c of customers) {
    if (c.name.toLowerCase().includes(kw) || (c.phone ?? '').toLowerCase().includes(kw)) {
      results.push({ id: c.id, type: 'customer', title: c.name, subtitle: c.phone ?? c.email ?? '', path: `/customers/${c.id}` })
    }
  }
  for (const s of suppliers) {
    if (s.name.toLowerCase().includes(kw) || (s.phone ?? '').toLowerCase().includes(kw)) {
      results.push({ id: s.id, type: 'supplier', title: s.name, subtitle: s.phone ?? '', path: `/suppliers/${s.id}` })
    }
  }

  return results.slice(0, 30)
}

interface Props {
  open: boolean
  onClose: () => void
}

export function GlobalSearch({ open, onClose }: Props) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('')
      setResults([])
      setActiveIdx(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Search on query change
  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    const t = setTimeout(() => {
      searchAll(query).then((r) => { setResults(r); setActiveIdx(0) })
    }, 150)
    return () => clearTimeout(t)
  }, [query])

  // Keyboard navigation
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIdx((i) => Math.min(i + 1, results.length - 1))
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIdx((i) => Math.max(i - 1, 0))
      }
      if (e.key === 'Enter' && results[activeIdx]) {
        select(results[activeIdx])
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, results, activeIdx]) // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.children[activeIdx] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIdx])

  const select = (r: SearchResult) => {
    navigate(r.path)
    onClose()
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[10vh]"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-xl rounded-xl border bg-background shadow-2xl overflow-hidden">
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm SP, đơn hàng, khách hàng, NCC..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center rounded border px-1.5 py-0.5 text-xs text-muted-foreground">Esc</kbd>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <ul ref={listRef} className="max-h-[min(400px,60vh)] overflow-y-auto py-1">
            {results.map((r, i) => {
              const cfg = TYPE_CONFIG[r.type]
              const Icon = cfg.icon
              return (
                <li
                  key={r.id}
                  onClick={() => select(r)}
                  onMouseEnter={() => setActiveIdx(i)}
                  className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                    i === activeIdx ? 'bg-accent' : 'hover:bg-accent/50'
                  }`}
                >
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${cfg.cls}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{r.title}</p>
                    {r.subtitle && <p className="text-xs text-muted-foreground truncate">{r.subtitle}</p>}
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${cfg.cls}`}>
                    {cfg.label}
                  </span>
                </li>
              )
            })}
          </ul>
        )}

        {/* Empty state */}
        {query.trim() && results.length === 0 && (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Không tìm thấy kết quả cho "<span className="font-medium text-foreground">{query}</span>"
          </div>
        )}

        {/* Hint when no query */}
        {!query.trim() && (
          <div className="px-4 py-4">
            <p className="text-xs text-muted-foreground mb-2">Gợi ý tìm kiếm</p>
            <div className="flex flex-wrap gap-2">
              {(['Sản phẩm', 'Đơn hàng', 'Khách hàng', 'Nhà cung cấp'] as const).map((hint) => (
                <span key={hint} className="rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground">{hint}</span>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
              <span><kbd className="rounded border px-1 py-0.5">↑↓</kbd> Di chuyển</span>
              <span><kbd className="rounded border px-1 py-0.5">Enter</kbd> Chọn</span>
              <span><kbd className="rounded border px-1 py-0.5">Esc</kbd> Đóng</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
