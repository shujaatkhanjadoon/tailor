// src/app/customers/page.tsx
'use client'

import { useState, useMemo }          from 'react'
import { useRouter }                  from 'next/navigation'
import {
  Plus, Search, X,
  Users, Phone, ChevronRight,
  ShoppingBag, TrendingUp, Download,
} from 'lucide-react'
import type { CustomerRecord }        from '@/lib/db/schema'
import { useAuth }                    from '@/lib/auth/AuthContext'
import { CustomerCardSkeleton }       from '@/components/ui/Skeleton'
import { cn }                         from '@/lib/utils'
import { format, isToday, isYesterday } from 'date-fns'
import { useCustomers } from '@/hooks/useCustomers'
import { AppFooter } from '@/components/layout/AppFooter'
import { exportCSV } from '@/lib/export/download'

// ── Gender filter config ─────────────────────────────────────────

type GenderFilter = 'all' | 'male' | 'female' | 'child'

const GENDER_FILTERS: { key: GenderFilter; label: string }[] = [
  { key: 'all',    label: 'Sab'     },
  { key: 'male',   label: '👨 Mard'  },
  { key: 'female', label: '👩 Aurat' },
  { key: 'child',  label: '👶 Bacha' },
]

// ── Customer Card ─────────────────────────────────────────────────

function CustomerCard({
  customer,
  onClick,
}: {
  customer: CustomerRecord
  onClick:  () => void
}) {
  const initials = customer.name
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const lastOrderText = customer.lastOrderAt
    ? isToday(new Date(customer.lastOrderAt))
      ? 'Aaj'
      : isYesterday(new Date(customer.lastOrderAt))
      ? 'Kal'
      : format(new Date(customer.lastOrderAt), 'd MMM')
    : null

  const AVATAR_COLORS = [
    'bg-blue-100 text-blue-700',
    'bg-green-100 text-green-700',
    'bg-purple-100 text-purple-700',
    'bg-amber-100 text-amber-700',
    'bg-red-100 text-red-700',
    'bg-teal-100 text-teal-700',
  ]
  const colorIdx  = customer.name.charCodeAt(0) % AVATAR_COLORS.length
  const avatarCol = AVATAR_COLORS[colorIdx]

  return (
    <button
      onClick={onClick}
      className="w-full bg-white border border-slate-200 rounded-2xl p-4
                 text-left transition-all active:scale-[0.98] hover:border-slate-300
                 hover:shadow-sm"
    >
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className={cn(
          'w-12 h-12 rounded-full flex items-center justify-center',
          'font-bold text-sm shrink-0',
          avatarCol
        )}>
          {initials}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="font-bold text-slate-800 truncate">{customer.name}</p>
            {customer.gender === 'female' && (
              <span className="text-[10px] bg-pink-100 text-pink-600 font-semibold
                               px-1.5 py-0.5 rounded-full shrink-0">
                Aurat
              </span>
            )}
            {customer.gender === 'child' && (
              <span className="text-[10px] bg-amber-100 text-amber-600 font-semibold
                               px-1.5 py-0.5 rounded-full shrink-0">
                Bacha
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Phone size={10} />
            <span className="font-mono">{customer.phone}</span>
          </div>

          <div className="flex items-center gap-3 mt-1.5">
            {(customer.totalOrders ?? 0) > 0 && (
              <span className="flex items-center gap-1 text-[10px] text-slate-500">
                <ShoppingBag size={10} />
                {customer.totalOrders} orders
              </span>
            )}
            {lastOrderText && (
              <span className="text-[10px] text-slate-400">
                Aakhri: {lastOrderText}
              </span>
            )}
          </div>
        </div>

        <ChevronRight size={16} className="text-slate-300 shrink-0" />
      </div>
    </button>
  )
}

// ── Main Page ─────────────────────────────────────────────────────

export default function CustomersPage() {
  const router              = useRouter()
  const { shopId, isOwner } = useAuth()
  const [search,  setSearch]  = useState('')
  const [gender,  setGender]  = useState<GenderFilter>('all')
  const [sortBy,  setSortBy]  = useState<'name' | 'orders' | 'recent'>('recent')

  const { customers: allCustomers, isLoading, hasMore, loadMore } = useCustomers(shopId)

  // ── Filter + sort ─────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...allCustomers]

    // Gender filter
    if (gender !== 'all') {
      list = list.filter(c => c.gender === gender)
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q)
      )
    }

    // Sort
    if (sortBy === 'name') {
      list.sort((a, b) => a.name.localeCompare(b.name))
    } else if (sortBy === 'orders') {
      list.sort((a, b) => (b.totalOrders ?? 0) - (a.totalOrders ?? 0))
    } else {
      // Most recent order first, no order last
      list.sort((a, b) => {
        if (!a.lastOrderAt && !b.lastOrderAt) return 0
        if (!a.lastOrderAt) return 1
        if (!b.lastOrderAt) return -1
        return new Date(b.lastOrderAt).getTime() - new Date(a.lastOrderAt).getTime()
      })
    }

    return list
  }, [allCustomers, gender, search, sortBy])

  const hasFilters = search || gender !== 'all'
  const exportRows = filtered.map(c => ({
    name: c.name,
    phone: c.phone,
    gender: c.gender,
    totalOrders: c.totalOrders ?? 0,
    lastOrder: c.lastOrderAt ?? '',
    notes: c.notes ?? '',
  }))

  return (
    <div className="flex min-h-dvh flex-col overflow-x-clip bg-slate-50 pb-24 lg:pb-8">

      {/* ── HEADER ── */}
      <header className="bg-white border-b border-slate-100 px-4 pt-2 lg:pt-0 pb-4
                         sticky top-14 lg:top-1 z-10">
        <div className="mb-3 flex min-w-0 items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-slate-800">Gahak</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {isLoading
                ? 'Loading...'
                : `${filtered.length} customer${filtered.length !== 1 ? 's' : ''}`
              }
            </p>
          </div>
          {isOwner && (
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => exportCSV(exportRows, 'darzi-customers')}
                disabled={filtered.length === 0}
                className="flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-200 disabled:opacity-40"
              >
                <Download size={15} />
                <span className="hidden min-[420px]:inline">CSV</span>
              </button>
              <button
                onClick={() => router.push('/customers/new')}
                className="flex shrink-0 items-center gap-1.5 bg-blue-600 text-white
                           text-sm font-semibold px-4 py-2.5 rounded-xl
                           active:scale-95 transition-colors hover:bg-blue-700"
              >
                <Plus size={16} />
                Naya Gahak
              </button>
            </div>
          )}
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Naam ya phone number dhundein..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-9 py-2.5 bg-slate-100 rounded-xl text-sm
                       outline-none focus:bg-white border-2 border-transparent
                       focus:border-blue-500 transition-all placeholder:text-slate-400"
          />
          {search && (
            <button
              aria-label="Clear search"
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <X size={14} className="text-slate-400" />
            </button>
          )}
        </div>

        {/* Filter + sort row */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">

          {/* Gender pills */}
          {GENDER_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setGender(f.key)}
              className={cn(
                'shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold',
                'border transition-colors',
                gender === f.key
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
              )}
            >
              {f.label}
            </button>
          ))}

          {/* Divider */}
          <div className="w-px h-5 bg-slate-200 shrink-0 mx-1" />

          {/* Sort buttons */}
          {([
            { key: 'recent' as const, label: '🕐 Recent' },
            { key: 'name'   as const, label: '🔤 Naam'   },
            { key: 'orders' as const, label: '📦 Orders'  },
          ]).map(s => (
            <button
              key={s.key}
              onClick={() => setSortBy(s.key)}
              className={cn(
                'shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold',
                'border transition-colors',
                sortBy === s.key
                  ? 'bg-slate-800 text-white border-slate-800'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </header>

      {/* ── MAIN CONTENT ── */}
      <main className="flex-1 px-4 pt-4 pb-4">

        {/* Loading */}
        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <CustomerCardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Empty — no customers at all */}
        {!isLoading && allCustomers.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-5xl mb-4">👥</p>
            <p className="font-bold text-slate-600 text-base mb-1">Koi Gahak Nahi</p>
            <p className="text-sm text-slate-400 mb-6 max-w-xs">
              Pehle gahak ko register karein — ya order banate waqt automatically add ho jata hai
            </p>
            {isOwner && (
              <button
                onClick={() => router.push('/customers/new')}
                className="flex items-center gap-2 bg-blue-600 text-white
                           font-semibold px-6 py-3.5 rounded-2xl text-sm
                           active:scale-95 transition-transform"
              >
                <Plus size={16} />
                Pehla Gahak Add Karein
              </button>
            )}
          </div>
        )}

        {/* Empty — filter has no results */}
        {!isLoading && allCustomers.length > 0 && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-4xl mb-3">🔍</p>
            <p className="font-semibold text-slate-500 mb-1">Koi Gahak Nahi Mila</p>
            <p className="text-sm text-slate-400 mb-5">
              Alag naam ya filter try karein
            </p>
            <button
              onClick={() => { setSearch(''); setGender('all') }}
              className="text-blue-600 font-semibold text-sm underline"
            >
              Filters Clear Karein
            </button>
          </div>
        )}

        {/* Customer list */}
        {!isLoading && filtered.length > 0 && (
          <div className="space-y-3">

            {/* Summary strip */}
            {!hasFilters && allCustomers.length > 0 && (
              <div className="mb-2 grid grid-cols-3 gap-3 min-[380px]:grid-cols-3">
                {[
                  {
                    label: 'Total',
                    value: allCustomers.length,
                    color: 'text-blue-700',
                    bg:    'bg-blue-50',
                  },
                  {
                    label: 'Active',
                    value: allCustomers.filter(c => (c.totalOrders ?? 0) > 0).length,
                    color: 'text-green-700',
                    bg:    'bg-green-50',
                  },
                  {
                    label: 'Is Mahine',
                    value: allCustomers.filter(c => {
                      const thisMonth = new Date().toISOString().slice(0, 7)
                      return c.lastOrderAt?.startsWith(thisMonth)
                    }).length,
                    color: 'text-purple-700',
                    bg:    'bg-purple-50',
                  },
                ].map(s => (
                  <div
                    key={s.label}
                    className={cn(
                      'flex-1 rounded-2xl py-3 text-center',
                      s.bg
                    )}
                  >
                    <p className={cn('text-xl font-bold', s.color)}>{s.value}</p>
                    <p className="text-[10px] text-slate-500 font-medium mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
            )}

            {filtered.map(customer => (
              <CustomerCard
                key={customer.id}
                customer={customer}
                onClick={() => router.push(`/customers/${customer.id}`)}
              />
            ))}

            {/* Count footer */}
            {filtered.length >= 10 && (
              <p className="text-center text-xs text-slate-400 py-3">
                {filtered.length} customers dikh rahe hain
              </p>
            )}
            {hasMore && (
              <button
                onClick={loadMore}
                className="w-full rounded-2xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50"
              >
                Zyada Customers Dikhein
              </button>
            )}
          </div>
        )}
        {!isLoading && <AppFooter className="mt-4" />}
      </main>

    </div>
  )
}
