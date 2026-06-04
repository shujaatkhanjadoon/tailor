// src/app/orders/page.tsx
'use client'

import { useState, Suspense }         from 'react'
import { useEffect }                  from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search, Plus, X, Filter, Download }    from 'lucide-react'
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
import { supabase } from '@/lib/supabase/client'
import { exportCSV, exportPrintablePDF } from '@/lib/export/download'
import { useTranslation } from 'react-i18next'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'

function OrdersContent() {
  const router      = useRouter()
  const searchParams = useSearchParams()
  const { shopId, isOwner, isKarigar, currentUser } = useAuth()
  const plan = usePlan()
  const { t } = useTranslation()

  const QUICK_FILTERS: { key: OrderFilter; label: string; emoji: string }[] = [
    { key: 'all',        label: t('orders.quickFilters.sab'),         emoji: '📋' },
    { key: 'overdue',    label: t('orders.quickFilters.deri'),        emoji: '🔴' },
    { key: 'ready',      label: t('orders.quickFilters.tayyar'),      emoji: '✅' },
    { key: 'today',      label: t('orders.quickFilters.aaj'),         emoji: '📅' },
    { key: 'unassigned', label: t('orders.quickFilters.binaAssign'),  emoji: '👤' },
  ]

  const STATUS_OPTIONS: { key: OrderStatus | 'all'; label: string }[] = [
    { key: 'all',       label: t('orders.filters.allStatus') },
    { key: 'received',  label: t('orders.statusLabelsShort.received') },
    { key: 'cutting',   label: t('orders.statusLabelsShort.cutting') },
    { key: 'stitching', label: t('orders.statusLabelsShort.stitching') },
    { key: 'finishing', label: t('orders.statusLabelsShort.finishing') },
    { key: 'ready',     label: t('orders.statusLabelsShort.ready') },
    { key: 'delivered', label: t('orders.statusLabelsShort.delivered') },
    { key: 'cancelled', label: t('orders.statusLabelsShort.cancelled') },
  ]

  const [statusSheet, setStatusSheet]         = useState<OrderRecord | null>(null)
  const [assignSheet, setAssignSheet]         = useState<OrderRecord | null>(null)
  const [showStatusDropdown, setShowStatusDropdown] = useState(false)

  const {
    orders,
    total,
    counts,
    hasMore,           loadMore,
    isLoading,
    statusFilter,      setStatusFilter,
    activeFilter,      setActiveFilter,
    searchQuery,       setSearchQuery,
    patchOrderInList,
    refresh,
  } = useOrders(
    shopId,
    isOwner ? 'owner' : 'karigar',
    currentUser?.id,
    { paginated: true }
  )

  const [photoCounts, setPhotoCounts] = useState<Record<string, number>>({})
  useEffect(() => {
    if (orders.length === 0) { setPhotoCounts({}); return }
    const ids = orders.map(o => o.id)
    ;supabase
      .from('order_photos')
      .select('order_id')
      .in('order_id', ids)
      .is('deleted_at', null)
      .then(({ data }: { data: { order_id: string }[] | null }) => {
        if (!data) return
        const counts: Record<string, number> = {}
        for (const row of data) {
          counts[row.order_id] = (counts[row.order_id] ?? 0) + 1
        }
        setPhotoCounts(counts)
      })
  }, [orders])

  useEffect(() => {
    const filter = searchParams.get('filter') as OrderFilter | null
    if (filter && QUICK_FILTERS.some(item => item.key === filter)) {
      setActiveFilter(filter)
    }
  }, [searchParams, setActiveFilter])

  const hasActiveFilters = searchQuery || statusFilter !== 'all' || activeFilter !== 'all'
  const exportRows = orders.map(o => ({
    order: String(o.orderNumber).padStart(3, '0'),
    customer: o.customerName,
    phone: o.customerPhone,
    garment: o.garmentType,
    status: o.status,
    dueDate: o.dueDate,
    total: o.totalPrice,
    paid: o.amountPaid,
    balance: Math.max(0, o.totalPrice - o.amountPaid),
    assignedTo: o.assignedToName ?? '',
  }))

  return (
    <div className="flex min-h-dvh flex-col overflow-x-clip bg-slate-50 pb-24 lg:pb-8">

      {/* ── HEADER ── */}
      <header className="bg-white border-b border-slate-100 px-4 pt-2 lg:pt-0 pb-4
                         sticky top-14 lg:top-1 z-10">
        <div className="mb-3 flex min-w-0 items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-slate-800">
              {isKarigar ? t('orders.titleKarigar') : t('orders.titleOwner')}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {isLoading
                ? t('orders.loading')
                : t('orders.showingCount', { count: orders.length, total })
              }
            </p>
          </div>
          {isOwner && (
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => exportCSV(exportRows, 'darzi-orders')}
                disabled={orders.length === 0}
                className="flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-200 disabled:opacity-40"
              >
                <Download size={15} />
                <span className="hidden min-[420px]:inline">{t('orders.exportCSV')}</span>
              </button>
              <button
                onClick={() => exportPrintablePDF('MeraDarzi Orders', exportRows, 'darzi-orders')}
                disabled={orders.length === 0}
                className="flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-200 disabled:opacity-40"
              >
                <Download size={15} />
                <span className="hidden min-[420px]:inline">{t('orders.exportPDF')}</span>
              </button>
              <button
                onClick={() => router.push('/orders/new')}
                className="flex items-center gap-1.5 bg-blue-600 text-white
                         text-sm font-semibold px-4 py-2.5 rounded-xl
                         active:scale-95 transition-colors hover:bg-blue-700"
              >
                <Plus size={15} />
                {t('orders.newOrder')}
              </button>
            </div>
          )}
        </div>

        {/* Search + Status filter */}
        <div className="mb-3 flex gap-2">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={t('orders.searchPlaceholder')}
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
                  ? ORDER_STATUS_CONFIG[statusFilter as OrderStatus]?.label ?? t('orders.filters.status')
                  : t('orders.filters.status')
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
              {isKarigar ? t('orders.emptyTitleKarigar') : t('orders.emptyTitleOwner')}
            </p>
            <p className="text-sm text-slate-400 mb-6">
              {isKarigar
                ? t('orders.emptyDescKarigar')
                : t('orders.emptyDescOwner')
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
                {t('orders.addFirstOrder')}
              </button>
            )}
          </div>
        )}

        {/* Empty state — filters applied but no results */}
        {!isLoading && orders.length === 0 && hasActiveFilters && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-4xl mb-3">🔍</p>
            <p className="font-semibold text-slate-500 mb-1">{t('orders.emptyFilterTitle')}</p>
            <p className="text-sm text-slate-400 mb-5">
              {t('orders.emptyFilterDesc')}
            </p>
            <button
              onClick={() => {
                setSearchQuery('')
                setStatusFilter('all')
                setActiveFilter('all')
              }}
              className="text-blue-600 font-semibold text-sm underline"
            >
              {t('orders.clearFilters')}
            </button>
          </div>
        )}

        {/* Order list */}
        {!isLoading && orders.length > 0 && (
          <div className="space-y-3">
            {isOwner && !plan.isLoading && !plan.canAddKarigar && (
              <div className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3">
                <p className="text-sm font-semibold text-blue-800">
                  {t('orders.upgradePlan')}
                </p>
                <button
                  onClick={() => plan.upgrade('professional')}
                  className="text-xs font-bold text-blue-700 underline mt-1"
                >
                  {t('orders.upgrade')}
                </button>
              </div>
            )}
            {orders.map(order => (
              <OrderListCard
                key={order.id}
                order={order}
                isOwner={isOwner}
                photoCount={photoCounts[order.id]}
                onStatusTap={o => setStatusSheet(o)}
                onAssignTap={isOwner ? o => setAssignSheet(o) : undefined}
              />
            ))}

            {hasMore && (
              <button
                onClick={loadMore}
                className="w-full rounded-2xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50"
              >
                {t('orders.loadMore')}
              </button>
            )}

            {/* End of list indicator */}
            {orders.length >= 20 && !hasMore && (
              <p className="text-center text-xs text-slate-400 py-4">
                {t('orders.endOfList', { count: orders.length })}
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
          onUpdate={(newStatus) => {
            patchOrderInList(statusSheet.id, { status: newStatus })
            setStatusSheet(null)
            refresh()
          }}
        />
      )}

      {/* ── ASSIGN SHEET ── */}
      {assignSheet && (
        <AssignSheet
          orderId={assignSheet.id}
          currentAssignee={assignSheet.assignedTo}
          onClose={() => setAssignSheet(null)}
          onAssigned={(memberId, memberName) => {
            patchOrderInList(assignSheet.id, { assignedTo: memberId, assignedToName: memberName })
            setAssignSheet(null)
            refresh()
          }}
        />
      )}
    </div>
  )
}

export default function OrdersPage() {
  return (
    <ErrorBoundary>
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
    </ErrorBoundary>
  )
}
