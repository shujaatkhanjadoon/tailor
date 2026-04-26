// src/app/orders/page.tsx
'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search, Plus, X, Filter } from 'lucide-react'
import { useAuth } from '@/lib/auth/AuthContext'
import { useOrders, OrderFilter } from '@/hooks/useOrders'
import { OrderListCard } from '@/components/orders/OrderListCard'
import { StatusUpdateSheet } from '@/components/orders/StatusUpdateSheet'
import { AssignSheet } from '@/components/orders/AssignSheet'
import { BottomNav } from '@/components/layout/BottomNav'
import { OrderRecord } from '@/lib/db/schema'
import { ORDER_STATUS_CONFIG, OrderStatus } from '@/types'
import { cn } from '@/lib/utils'
import { OrderCardSkeleton } from '@/components/ui/Skeleton'
import { EmptyState, EMPTY_STATES } from '@/components/ui/EmptyState'

const QUICK_FILTERS: { key: OrderFilter; label: string; emoji: string }[] = [
  { key: 'all',        label: 'Sab',        emoji: '📋' },
  { key: 'overdue',    label: 'Deri',       emoji: '🔴' },
  { key: 'ready',      label: 'Tayyar',     emoji: '✅' },
  { key: 'today',      label: 'Aaj',        emoji: '📅' },
  { key: 'unassigned', label: 'Bina Assign',emoji: '👤' },
]

const STATUS_OPTIONS: { key: OrderStatus | 'all'; label: string }[] = [
  { key: 'all',       label: 'Sab Status'  },
  { key: 'received',  label: 'Kapra Mila'  },
  { key: 'cutting',   label: 'Katai'       },
  { key: 'stitching', label: 'Silai'       },
  { key: 'finishing', label: 'Finishing'   },
  { key: 'ready',     label: 'Tayyar'      },
  { key: 'delivered', label: 'De Diya'     },
]

function OrdersContent() {
  const router                     = useRouter()
  const searchParams               = useSearchParams()
  const { shopId, isOwner, isKarigar, currentUser } = useAuth()

  const [statusSheet, setStatusSheet] = useState<OrderRecord | null>(null)
  const [assignSheet, setAssignSheet] = useState<OrderRecord | null>(null)
  const [showStatusDropdown, setShowStatusDropdown] = useState(false)
  const [isLoading, _setIsLoading] = useState(true)

  const {
    orders, total, counts,
    statusFilter,   setStatusFilter,
    activeFilter,   setActiveFilter,
    searchQuery,    setSearchQuery,
  } = useOrders(
    shopId,
    isOwner ? 'owner' : 'karigar',
    currentUser?.id
  )

  // Loading state:
if (isLoading) {
  return (
    <div className="px-4 pt-4">
      {Array.from({ length: 4 }).map((_, i) => <OrderCardSkeleton key={i} />)}
    </div>
  )
}

// Empty state:
if (orders.length === 0) {
  return (
    <EmptyState
      {...EMPTY_STATES.orders}
      action={{
        label:   'Naya Order',
        onClick: () => router.push('/orders/new'),
        icon:    Plus,
      }}
    />
  )
}

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 pb-20">

      {/* ── HEADER ── */}
      <header className="bg-white border-b border-slate-100 px-4 pt-12 lg:pt-6 pb-4 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold text-slate-800">
              {isKarigar ? 'Mere Orders' : 'Sare Orders'}
            </h1>
            <p className="text-xs text-slate-400">
              {orders.length} dikh rahe hain · {total} total
            </p>
          </div>
          {isOwner && (
            <button
              onClick={() => router.push('/orders/new')}
              className="flex items-center gap-1.5 bg-blue-600 text-white
                         text-sm font-semibold px-4 py-2 rounded-xl active:scale-95 transition-colors"
            >
              <Plus size={15} />
              Naya
            </button>
          )}
        </div>

        {/* Search */}
        <div className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Naam, number ya order # dhundein..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-9 py-2.5 bg-slate-100 rounded-xl text-sm
                         outline-none focus:bg-white border-2 border-transparent
                         focus:border-blue-500 transition-all"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X size={14} className="text-slate-400" />
              </button>
            )}
          </div>

          {/* Status filter dropdown button */}
          <div className="relative">
            <button
              onClick={() => setShowStatusDropdown(v => !v)}
              className={cn(
                'h-10 px-3 flex items-center gap-1.5 rounded-xl border-2 text-sm font-medium transition-colors',
                statusFilter !== 'all'
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-slate-100 border-transparent text-slate-500'
              )}
            >
              <Filter size={14} />
              {statusFilter !== 'all'
                ? ORDER_STATUS_CONFIG[statusFilter as OrderStatus]?.label
                : 'Status'}
            </button>

            {showStatusDropdown && (
              <div className="absolute right-0 top-12 bg-white border border-slate-200
                              rounded-2xl shadow-xl z-20 overflow-hidden w-44">
                {STATUS_OPTIONS.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => {
                      setStatusFilter(key)
                      setShowStatusDropdown(false)
                    }}
                    className={cn(
                      'w-full text-left px-4 py-3 text-sm transition-colors',
                      statusFilter === key
                        ? 'bg-blue-50 text-blue-700 font-semibold'
                        : 'text-slate-700 hover:bg-slate-50'
                    )}
                  >
                    {key !== 'all' && ORDER_STATUS_CONFIG[key as OrderStatus]?.emoji + ' '}
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick filter pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {QUICK_FILTERS.map(({ key, label, emoji }) => {
            const count = key === 'all' ? total
              : key === 'overdue'    ? counts.overdue
              : key === 'ready'      ? counts.ready
              : key === 'today'      ? counts.today
              : counts.unassigned
            const hasAlert = (key === 'overdue' || key === 'unassigned') && count > 0

            return (
              <button
                key={key}
                onClick={() => setActiveFilter(key)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold',
                  'shrink-0 border transition-colors',
                  activeFilter === key
                    ? hasAlert
                      ? 'bg-red-600 text-white border-red-600'
                      : 'bg-blue-600 text-white border-blue-600'
                    : hasAlert
                    ? 'bg-red-50 text-red-700 border-red-200'
                    : 'bg-white text-slate-600 border-slate-200'
                )}
              >
                <span>{emoji}</span>
                <span>{label}</span>
                {count > 0 && (
                  <span className={cn(
                    'text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-4.5 text-center',
                    activeFilter === key
                      ? 'bg-white/30 text-white'
                      : hasAlert ? 'bg-red-200 text-red-800' : 'bg-slate-100 text-slate-600'
                  )}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </header>

      {/* ── ORDER LIST ── */}
      <main className="flex-1 px-4 pt-4 space-y-3">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-4xl mb-3">📋</p>
            <p className="font-semibold text-slate-500">
              {searchQuery ? 'Koi order nahi mila' : 'Is filter mein koi order nahi'}
            </p>
            <p className="text-sm text-slate-400 mt-1">
              {activeFilter !== 'all' ? 'Alag filter try karein' : 'Naya order add karein'}
            </p>
          </div>
        ) : (
          orders.map(order => (
            <OrderListCard
              key={order.id}
              order={order}
              isOwner={isOwner}
              onStatusTap={o => setStatusSheet(o)}
              onAssignTap={isOwner ? o => setAssignSheet(o) : undefined}
            />
          ))
        )}
      </main>

      <BottomNav />

      {/* ── STATUS SHEET ── */}
      {statusSheet && (
        <StatusUpdateSheet
          order={statusSheet}
          onClose={() => setStatusSheet(null)}
          onUpdate={() => setStatusSheet(null)}
        />
      )}

      {/* ── ASSIGN SHEET ── */}
      {assignSheet && (
        <AssignSheet
          orderId={assignSheet.id}
          currentAssignee={assignSheet.assignedTo}
          onClose={() => setAssignSheet(null)}
          onAssigned={() => setAssignSheet(null)}
        />
      )}
    </div>
  )
}

// Wrap in Suspense because useSearchParams requires it in Next.js app router
export default function OrdersPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <OrdersContent />
    </Suspense>
  )
}