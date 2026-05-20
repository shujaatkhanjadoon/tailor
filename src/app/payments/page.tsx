// src/app/payments/page.tsx
'use client'

import { useState } from 'react'
import { Plus, Search, X, Filter, TrendingUp } from 'lucide-react'
import { useAuth }                from '@/lib/auth/AuthContext'
import { usePayments, usePendingBalances, PaymentFilter, PaymentMethod } from '@/hooks/usePayments'
import { PaymentCard }            from '@/components/payments/PaymentCard'
import { PaymentSummaryStrip }    from '@/components/payments/PaymentSummaryStrip'
import { QuickPaymentSheet }      from '@/components/payments/QuickPaymentSheet'
import { cn }                     from '@/lib/utils'
import { PaymentCardSkeleton } from '@/components/ui/Skeleton'
import { AppFooter } from '@/components/layout/AppFooter'

const DATE_FILTERS: { key: PaymentFilter; label: string }[] = [
  { key: 'all',        label: 'Sab'       },
  { key: 'today',      label: 'Aaj'       },
  { key: 'this_week',  label: 'Is Hafte'  },
  { key: 'this_month', label: 'Is Mahine' },
]

const METHOD_FILTERS: { key: PaymentMethod; label: string; emoji: string }[] = [
  { key: 'all',       label: 'Sab',       emoji: '📋' },
  { key: 'cash',      label: 'Cash',      emoji: '💵' },
  { key: 'easypaisa', label: 'Easypaisa', emoji: '📱' },
  { key: 'jazzcash',  label: 'JazzCash',  emoji: '📲' },
  { key: 'bank',      label: 'Bank',      emoji: '🏦' },
]

export default function PaymentsPage() {
  const { shopId, isOwner }   = useAuth()
  const [showSheet, setShowSheet] = useState(false)
  const [showMethodFilter, setShowMethodFilter] = useState(false)

  const {
    payments, stats,
    filter,       setFilter,
    methodFilter, setMethodFilter,
    searchQuery,  setSearchQuery,
    isLoading,
  } = usePayments(shopId)

  const { totalPending } = usePendingBalances(shopId)

  // Group payments by date for display
  const groupedPayments = payments.reduce<Record<string, typeof payments>>((acc, p) => {
    const date = new Date(p.paidAt)
    const key  = date.toLocaleDateString('en-PK', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    })
    if (!acc[key]) acc[key] = []
    acc[key].push(p)
    return acc
  }, {})

  if (isLoading) {
  return (
    <div className="px-4 pt-4 space-y-3 min-h-100">
      {Array.from({ length: 4 }).map((_, i) => <PaymentCardSkeleton key={i} />)}
    </div>
  )
}

  return (
    <div className="flex min-h-dvh flex-col overflow-x-clip bg-slate-50 pb-24 lg:pb-8">

      {/* ── HEADER ── */}
      <header className="bg-white border-b border-slate-100 px-4 pt-2 lg:pt-0 pb-4 sticky top-14 lg:top-1  z-10">
        <div className="mb-4 flex min-w-0 items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-slate-800">Payments</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {stats.filteredCount} entries · Rs. {stats.filteredTotal.toLocaleString()} received
            </p>
          </div>
          {isOwner && (
            <button
              onClick={() => setShowSheet(true)}
              className="flex shrink-0 items-center gap-1.5 bg-green-600 hover:bg-green-700
                         text-white text-sm font-semibold px-4 py-2.5 rounded-xl
                         transition-colors active:scale-95"
            >
              <Plus size={16} />
              Record Karein
            </button>
          )}
        </div>

        {/* Search */}
        <div className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Naam ya order # dhundein..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-9 py-2.5 bg-slate-100 rounded-xl text-sm
                         outline-none focus:bg-white border-2 border-transparent
                         focus:border-blue-500 transition-all"
            />
            {searchQuery && (
              <button
                aria-label="Clear payment search"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <X size={14} className="text-slate-400" />
              </button>
            )}
          </div>
          {/* Method filter toggle */}
          <button
            aria-label="Toggle payment method filters"
            onClick={() => setShowMethodFilter(v => !v)}
            className={cn(
              'h-10 px-3 flex items-center gap-1.5 rounded-xl border-2 text-sm font-medium transition-colors',
              methodFilter !== 'all'
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'bg-slate-100 border-transparent text-slate-500'
            )}
          >
            <Filter size={14} />
          </button>
        </div>

        {/* Method filter row */}
        {showMethodFilter && (
          <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
            {METHOD_FILTERS.map(m => (
              <button
                key={m.key}
                onClick={() => { setMethodFilter(m.key); setShowMethodFilter(false) }}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold',
                  'shrink-0 border transition-colors',
                  methodFilter === m.key
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-600 border-slate-200'
                )}
              >
                <span>{m.emoji}</span>
                {m.label}
              </button>
            ))}
          </div>
        )}

        {/* Date filter pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {DATE_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                'shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold border transition-colors',
                filter === f.key
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-600 border-slate-200'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </header>

      {/* ── MAIN CONTENT ── */}
      <main className="flex-1 px-4 pt-4 space-y-5">

        {/* Summary strip */}
        <PaymentSummaryStrip
          todayTotal={stats.todayTotal}
          weekTotal={stats.weekTotal}
          monthTotal={stats.monthTotal}
          totalPending={totalPending}
          onFilterClick={f => setFilter(f)}
          activeFilter={filter}
        />

        {(stats.filteredApplied > 0 || stats.filteredTips > 0 || stats.filteredOverpayments > 0) && (
          <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-3">
            {[
              { label: 'Orders par apply', value: stats.filteredApplied, color: 'text-blue-700', bg: 'bg-blue-50' },
              { label: 'Tips', value: stats.filteredTips, color: 'text-amber-700', bg: 'bg-amber-50' },
              { label: 'Extra / overpay', value: stats.filteredOverpayments, color: 'text-violet-700', bg: 'bg-violet-50' },
            ].map(item => (
              <div key={item.label} className={cn('rounded-2xl border border-slate-200 p-3', item.bg)}>
                <p className={cn('text-base font-bold', item.color)}>Rs. {item.value.toLocaleString()}</p>
                <p className="mt-0.5 text-[11px] font-medium text-slate-500">{item.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Method breakdown bar */}
        {stats.methodBreakdown && stats.monthTotal > 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={15} className="text-slate-500" />
              <p className="text-sm font-bold text-slate-700">
                {filter === 'all' ? 'Is Mahine Ka' : ''} Payment Breakdown
              </p>
            </div>

            {/* Method bars */}
            <div className="space-y-2.5">
              {[
                { key:'cash',      label:'Cash',      emoji:'💵', val:stats.methodBreakdown.cash,      color:'bg-green-500' },
                { key:'easypaisa', label:'Easypaisa', emoji:'📱', val:stats.methodBreakdown.easypaisa, color:'bg-teal-500'  },
                { key:'jazzcash',  label:'JazzCash',  emoji:'📲', val:stats.methodBreakdown.jazzcash,  color:'bg-red-500'   },
                { key:'bank',      label:'Bank',      emoji:'🏦', val:stats.methodBreakdown.bank,       color:'bg-blue-500'  },
              ].filter(m => m.val > 0).map(m => {
                const total = stats.todayTotal + stats.weekTotal + stats.monthTotal > 0
                  ? Object.values(stats.methodBreakdown).reduce((a,b) => a+b, 0)
                  : 1
                const pct = Math.round((m.val / total) * 100)
                return (
                  <div key={m.key}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="flex items-center gap-1.5 font-medium text-slate-600">
                        {m.emoji} {m.label}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">{pct}%</span>
                        <span className="font-bold text-slate-700">
                          Rs. {m.val.toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all duration-500', m.color)}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── PAYMENT LIST ── */}
        <div className="min-h-100 space-y-5">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>

        ) : payments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-4xl mb-4">💰</p>
            <p className="font-semibold text-slate-500">
              {searchQuery || filter !== 'all' || methodFilter !== 'all'
                ? 'Koi payment nahi mili'
                : 'Abhi koi payment nahi'}
            </p>
            <p className="text-sm text-slate-400 mt-1">
              {searchQuery || filter !== 'all' || methodFilter !== 'all'
                ? 'Filter hatayein ya alag dhundein'
                : 'Pehla payment record karein'}
            </p>
            {isOwner && !searchQuery && (
              <button
                onClick={() => setShowSheet(true)}
                className="mt-4 flex items-center gap-2 bg-green-600 text-white
                           font-semibold px-6 py-3 rounded-xl text-sm"
              >
                <Plus size={16} />
                Payment Record Karein
              </button>
            )}
          </div>

        ) : (
          // Grouped by date
          Object.entries(groupedPayments).map(([dateLabel, dayPayments]) => (
            <div key={dateLabel}>
              {/* Date group header */}
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  {dateLabel}
                </p>
                <p className="text-xs font-bold text-slate-600">
                  Rs. {dayPayments.reduce((s,p) => s+p.amount, 0).toLocaleString()}
                </p>
              </div>

              {/* Payment cards */}
              <div className="space-y-2">
                {dayPayments.map(p => (
                  <PaymentCard key={p.id} payment={p} />
                ))}
              </div>
            </div>
          ))
        )}
        </div>
        {!isLoading && <AppFooter />}
      </main>


      {/* ── QUICK PAYMENT SHEET ── */}
      {showSheet && (
        <QuickPaymentSheet
          onClose={() => setShowSheet(false)}
          onSaved={() => setShowSheet(false)}
        />
      )}
    </div>
  )
}
