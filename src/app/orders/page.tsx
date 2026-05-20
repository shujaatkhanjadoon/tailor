// src/app/orders/page.tsx
'use client'

import { useState, Suspense }         from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search, Plus, X, Filter }    from 'lucide-react'
import { useAuth }                    from '@/lib/auth/AuthContext'
import { useOrders, OrderFilter }     from '@/hooks/useOrders'
import { OrderListCard }              from '@/components/orders/OrderListCard'
import { StatusUpdateSheet }          from '@/components/orders/StatusUpdateSheet'
import { AssignSheet }                from '@/components/orders/AssignSheet'
import { OrderRecord }                from '@/lib/db/schema'
import { ORDER_STATUS_CONFIG, OrderStatus } from '@/types'
import { cn }                         from '@/lib/utils'
import { OrderCardSkeleton }          from '@/components/ui/Skeleton'
import { usePlan }                    from '@/hooks/usePlan'
import { AppFooter }                  from '@/components/layout/AppFooter'

const QUICK_FILTERS: { key: OrderFilter; label: string; emoji: string }[] = [
  { key: 'all',        label: 'Sab',         emoji: '📋' },
  { key: 'overdue',    label: 'Deri',        emoji: '🔴' },
  { key: 'ready',      label: 'Tayyar',      emoji: '✅' },
  { key: 'today',      label: 'Aaj',         emoji: '📅' },
  { key: 'unassigned', label: 'Bina Assign', emoji: '👤' },
]

const STATUS_OPTIONS: { key: OrderStatus | 'all'; label: string }[] = [
  { key: 'all',       label: 'Sab Status' },
  { key: 'received',  label: 'Kapra Mila' },
  { key: 'cutting',   label: 'Katai'      },
  { key: 'stitching', label: 'Silai'      },
  { key: 'finishing', label: 'Finishing'  },
  { key: 'ready',     label: 'Tayyar'     },
  { key: 'delivered', label: 'De Diya'    },
  { key: 'cancelled', label: 'Cancel'     },
]

function OrdersContent() {
  const router      = useRouter()
  const { shopId, isOwner, isKarigar, currentUser } = useAuth()
  const plan = usePlan()

  const [statusSheet, setStatusSheet]         = useState<OrderRecord | null>(null)
  const [assignSheet, setAssignSheet]         = useState<OrderRecord | null>(null)
  const [showStatusDropdown, setShowStatusDropdown] = useState(false)

  const {
    orders,
    total,
    counts,
    isLoading,         // ← comes from useOrders hook
    statusFilter,      setStatusFilter,
    activeFilter,      setActiveFilter,
    searchQuery,       setSearchQuery,
  } = useOrders(
    shopId,
    isOwner ? 'owner' : 'karigar',
    currentUser?.id
  )

  const hasActiveFilters = searchQuery || statusFilter !== 'all' || activeFilter !== 'all'

  return (
    <div className="flex min-h-dvh flex-col overflow-x-clip bg-slate-50 pb-24 lg:pb-8">

      {/* ── HEADER ── */}
      <header className="bg-white border-b border-slate-100 px-4 pt-12 lg:pt-6 pb-4
                         sticky top-0 z-10">
        <div className="mb-3 flex min-w-0 items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-slate-800">
              {isKarigar ? 'Mere Orders' : 'Sare Orders'}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {isLoading
                ? 'Loading...'
                : `${orders.length} dikh rahe · ${total} total`
              }
            </p>
          </div>
          {isOwner && (
            <button
              onClick={() => router.push('/orders/new')}
              className="flex shrink-0 items-center gap-1.5 bg-blue-600 text-white
                         text-sm font-semibold px-4 py-2.5 rounded-xl
                         active:scale-95 transition-colors hover:bg-blue-700"
            >
              <Plus size={15} />
              Naya
            </button>
          )}
        </div>

        {/* Search + Status filter */}
        <div className="mb-3 flex gap-2">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Naam, number ya tracking code..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-9 py-2.5 bg-slate-100 rounded-xl text-sm
                         outline-none focus:bg-white border-2 border-transparent
                         focus:border-blue-500 transition-all placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                aria-label="Clear search"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <X size={14} className="text-slate-400" />
              </button>
            )}
          </div>

          {/* Status dropdown */}
          <div className="relative shrink-0">
            <button
              onClick={() => setShowStatusDropdown(v => !v)}
              className={cn(
                'h-10 px-3 flex items-center gap-1.5 rounded-xl border-2',
                'text-sm font-medium transition-colors',
                statusFilter !== 'all'
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-slate-100 border-transparent text-slate-500 hover:bg-slate-200'
              )}
            >
              <Filter size={14} />
              <span className="hidden sm:inline">
                {statusFilter !== 'all'
                  ? ORDER_STATUS_CONFIG[statusFilter as OrderStatus]?.label ?? 'Status'
                  : 'Status'
                }
              </span>
            </button>

            {showStatusDropdown && (
              <>
                {/* Backdrop */}
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowStatusDropdown(false)}
                />
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
                        'w-full text-left px-4 py-3 text-sm transition-colors border-b',
                        'border-slate-100 last:border-0',
                        statusFilter === key
                          ? 'bg-blue-50 text-blue-700 font-semibold'
                          : 'text-slate-700 hover:bg-slate-50'
                      )}
                    >
                      {key !== 'all' && (
                        <span className="mr-1.5">
                          {ORDER_STATUS_CONFIG[key as OrderStatus]?.emoji}
                        </span>
                      )}
                      {label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Quick filter pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {QUICK_FILTERS.map(({ key, label, emoji }) => {
            const count = key === 'all'        ? total
              : key === 'overdue'              ? counts.overdue
              : key === 'ready'               ? counts.ready
              : key === 'today'               ? counts.today
              : counts.unassigned
            const hasAlert = (key === 'overdue' || key === 'unassigned') && count > 0

            return (
              <button
                key={key}
                onClick={() => setActiveFilter(key)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full',
                  'text-xs font-semibold shrink-0 border transition-colors',
                  activeFilter === key
                    ? hasAlert
                      ? 'bg-red-600 text-white border-red-600'
                      : 'bg-blue-600 text-white border-blue-600'
                    : hasAlert
                    ? 'bg-red-50 text-red-700 border-red-200'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                )}
              >
                <span>{emoji}</span>
                <span>{label}</span>
                {count > 0 && (
                  <span className={cn(
                    'text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-4.5 text-center',
                    activeFilter === key
                      ? 'bg-white/30 text-white'
                      : hasAlert
                      ? 'bg-red-200 text-red-800'
                      : 'bg-slate-100 text-slate-600'
                  )}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </header>

      {/* ── MAIN CONTENT ── */}
      <main className="flex-1 px-4 pt-4 pb-4">

        {/* Loading skeletons */}
        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <OrderCardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Empty state — no orders at all */}
        {!isLoading && orders.length === 0 && !hasActiveFilters && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-5xl mb-4">📋</p>
            <p className="font-bold text-slate-600 text-base mb-1">
              {isKarigar ? 'Koi order assign nahi' : 'Koi order nahi'}
            </p>
            <p className="text-sm text-slate-400 mb-6">
              {isKarigar
                ? 'Owner aapko orders assign kare ga'
                : 'Pehla order add kar ke kaam shuru karein'
              }
            </p>
            {isOwner && (
              <button
                onClick={() => router.push('/orders/new')}
                className="flex items-center gap-2 bg-blue-600 text-white
                           font-semibold px-6 py-3.5 rounded-2xl text-sm
                           active:scale-95 transition-transform"
              >
                <Plus size={16} />
                Naya Order Add Karein
              </button>
            )}
          </div>
        )}

        {/* Empty state — filters applied but no results */}
        {!isLoading && orders.length === 0 && hasActiveFilters && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-4xl mb-3">🔍</p>
            <p className="font-semibold text-slate-500 mb-1">Koi order nahi mila</p>
            <p className="text-sm text-slate-400 mb-5">
              Alag filter try karein ya search clear karein
            </p>
            <button
              onClick={() => {
                setSearchQuery('')
                setStatusFilter('all')
                setActiveFilter('all')
              }}
              className="text-blue-600 font-semibold text-sm underline"
            >
              Sab Filters Hatayein
            </button>
          </div>
        )}

        {/* Order list */}
        {!isLoading && orders.length > 0 && (
          <div className="space-y-3">
            {isOwner && !plan.isLoading && !plan.canAddKarigar && (
              <div className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3">
                <p className="text-sm font-semibold text-blue-800">
                  Karigar assignment Professional plan mein available hai.
                </p>
                <button
                  onClick={() => plan.upgrade('professional')}
                  className="text-xs font-bold text-blue-700 underline mt-1"
                >
                  Upgrade karein
                </button>
              </div>
            )}
            {orders.map(order => (
              <OrderListCard
                key={order.id}
                order={order}
                isOwner={isOwner}
                onStatusTap={o => setStatusSheet(o)}
                onAssignTap={isOwner ? o => setAssignSheet(o) : undefined}
              />
            ))}

            {/* End of list indicator */}
            {orders.length >= 20 && (
              <p className="text-center text-xs text-slate-400 py-4">
                {orders.length} orders dikh rahe hain
              </p>
            )}
          </div>
        )}
        {!isLoading && <AppFooter className="mt-4" />}
      </main>


      {/* ── STATUS UPDATE SHEET ── */}
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

export default function OrdersPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 pb-20">
        <div className="bg-white border-b border-slate-100 px-4 pt-12 pb-4 h-36" />
        <div className="px-4 pt-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <OrderCardSkeleton key={i} />
          ))}
        </div>
      </div>
    }>
      <OrdersContent />
    </Suspense>
  )
}
