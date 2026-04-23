// src/app/customers/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import { Search, UserPlus, Users, SlidersHorizontal, X } from 'lucide-react'
import { useAuth } from '@/lib/auth/AuthContext'
import { useCustomers } from '@/hooks/useCustomers'
import { CustomerCard } from '@/components/customers/CustomerCard'
import { db } from '@/lib/db/schema'
import { cn } from '@/lib/utils'
import { BottomNav } from '@/components/layout/BottomNav'

const GENDER_FILTERS = [
  { key: 'all',    label: 'Sab'    },
  { key: 'male',   label: 'Mard'   },
  { key: 'female', label: 'Aurat'  },
  { key: 'child',  label: 'Bachcha'},
] as const

export default function CustomersPage() {
  const router              = useRouter()
  const { shopId, isOwner } = useAuth()
  const [showFilters, setShowFilters] = useState(false)

  const {
    customers, total,
    query, setQuery,
    genderFilter, setGenderFilter,
  } = useCustomers(shopId)

  // Get order counts per customer in one query
 const orderCounts = useLiveQuery(
    async (): Promise<Record<string, number>> => {
      if (!shopId) return {}
      const orders = await db.orders
        .where('shopId').equals(shopId)
        .filter(o => o._deleted === 0)
        .toArray()
      return orders.reduce<Record<string, number>>((acc, o) => {
        acc[o.customerId] = (acc[o.customerId] || 0) + 1
        return acc
      }, {})
    },
    [shopId])

  // Pending balances per customer
  const pendingBalances = useLiveQuery(
    async (): Promise<Record<string, number>> => {
      if (!shopId) return {}
      const orders = await db.orders
        .where('shopId').equals(shopId)
        .filter(o =>
          o._deleted === 0 &&
          !['delivered', 'cancelled'].includes(o.status)
        )
        .toArray()
      return orders.reduce<Record<string, number>>((acc, o) => {
        const bal = Math.max(0, o.totalPrice - o.amountPaid)
        acc[o.customerId] = (acc[o.customerId] || 0) + bal
        return acc
      }, {})
    },
    [shopId])

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 pb-20">

      {/* ── HEADER ── */}
      <header className="bg-white border-b border-slate-100 px-4 pt-12 lg:pt-6 pb-4 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Hamare Gahak</h1>
            <p className="text-xs text-slate-400">{total} total gahak</p>
          </div>
          {isOwner && (
            <button
              onClick={() => router.push('/customers/new')}
              className="flex items-center gap-1.5 bg-blue-600 text-white
                         text-sm font-semibold px-4 py-2 rounded-xl
                         transition-colors active:scale-95"
            >
              <UserPlus size={15} />
              Naya
            </button>
          )}
        </div>

        {/* Search bar */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Naam ya number se dhundein..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-slate-100 rounded-xl text-sm
                         outline-none focus:bg-white border-2 border-transparent
                         focus:border-blue-500 transition-all"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <X size={14} className="text-slate-400" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(v => !v)}
            className={cn(
              'w-10 h-10 flex items-center justify-center rounded-xl border-2 transition-colors',
              showFilters
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'bg-slate-100 border-transparent text-slate-500'
            )}
          >
            <SlidersHorizontal size={16} />
          </button>
        </div>

        {/* Gender filter pills */}
        {showFilters && (
          <div className="flex gap-2 mt-2">
            {GENDER_FILTERS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setGenderFilter(key)}
                className={cn(
                  'flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-colors',
                  genderFilter === key
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-600 border-slate-200'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* ── LIST ── */}
      <main className="flex-1 px-4 pt-4 space-y-3">
        {customers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Users size={48} className="text-slate-200 mb-4" />
            <p className="font-semibold text-slate-500">
              {query ? 'Koi gahak nahi mila' : 'Abhi koi gahak nahi'}
            </p>
            <p className="text-sm text-slate-400 mt-1">
              {query ? 'Alag naam ya number try karein' : 'Pehla gahak add karein'}
            </p>
            {!query && isOwner && (
              <button
                onClick={() => router.push('/customers/new')}
                className="mt-4 flex items-center gap-2 bg-blue-600 text-white
                           font-semibold px-6 py-3 rounded-xl text-sm"
              >
                <UserPlus size={16} />
                Naya Gahak Add Karein
              </button>
            )}
          </div>
        ) : (
          customers.map(customer => (
            <CustomerCard
              key={customer.id}
              customer={customer}
              orderCount={orderCounts?.[customer.id] ?? 0}
              pendingBalance={pendingBalances?.[customer.id] ?? 0}
            />
          ))
        )}
      </main>

      <BottomNav />
    </div>
  )
}