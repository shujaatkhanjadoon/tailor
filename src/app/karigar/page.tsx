// src/app/karigar/page.tsx
'use client'

import { useState, useMemo }      from 'react'
import { useRouter }              from 'next/navigation'
import { useLiveQuery }           from 'dexie-react-hooks'
import {
  Scissors, LogOut, CheckCircle2,
  Clock, AlertTriangle, TrendingUp,
  Package, ChevronRight, Search,
  X, Filter, Calendar, Star,
  BarChart2, Zap, RefreshCw,
  User, Phone, MessageCircle,
} from 'lucide-react'
import { db, OrderRecord }        from '@/lib/db/schema'
import { orderOps }               from '@/lib/db/operations'
import { useAuth }                from '@/lib/auth/AuthContext'
import { ORDER_STATUS_CONFIG, GARMENT_LABELS, OrderStatus } from '@/types'
import { StatusUpdateSheet }      from '@/components/orders/StatusUpdateSheet'
import { cn }                     from '@/lib/utils'
import {
  format, isToday, isYesterday,
  startOfWeek, startOfMonth,
  isWithinInterval, endOfDay,
  differenceInDays,
} from 'date-fns'

// ── Types ────────────────────────────────────────────────────────

type TabId = 'home' | 'active' | 'history' | 'stats'

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'home',    label: 'Home',    icon: Scissors    },
  { id: 'active',  label: 'Active',  icon: Clock       },
  { id: 'history', label: 'History', icon: CheckCircle2 },
  { id: 'stats',   label: 'Stats',   icon: BarChart2   },
]

const ACTIVE_STATUSES: OrderStatus[] = [
  'received', 'cutting', 'stitching', 'finishing', 'ready',
]
const DONE_STATUSES: OrderStatus[] = ['delivered', 'cancelled']

// ── Helpers ──────────────────────────────────────────────────────

function dueDateLabel(dueDate: string): { text: string; color: string; urgent: boolean } {
  const today    = new Date().toISOString().split('T')[0]
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]
  const days     = differenceInDays(new Date(dueDate), new Date(today))

  if (dueDate < today)     return { text: 'Deri!',      color: 'text-red-600',    urgent: true  }
  if (dueDate === today)   return { text: 'Aaj Due',    color: 'text-amber-600',  urgent: true  }
  if (dueDate === tomorrow)return { text: 'Kal Due',    color: 'text-orange-500', urgent: true  }
  if (days <= 3)           return { text: `${days}d`,   color: 'text-amber-500',  urgent: false }
  return { text: format(new Date(dueDate), 'd MMM'),     color: 'text-slate-400',  urgent: false }
}

function orderDateLabel(createdAt: string): string {
  const d = new Date(createdAt)
  if (isToday(d))     return 'Aaj'
  if (isYesterday(d)) return 'Kal'
  return format(d, 'd MMM yyyy')
}

// ── Status Update Sheet Wrapper ───────────────────────────────────

function KarigarStatusSheet({
  order,
  onClose,
}: {
  order:   OrderRecord
  onClose: () => void
}) {
  return (
    <StatusUpdateSheet
      order={order}
      onClose={onClose}
      onUpdate={onClose}
    />
  )
}

// ── Order Card (Active) ───────────────────────────────────────────

function ActiveOrderCard({
  order,
  onStatusTap,
  onDetailTap,
}: {
  order:        OrderRecord
  onStatusTap:  (o: OrderRecord) => void
  onDetailTap:  (o: OrderRecord) => void
}) {
  const sc  = ORDER_STATUS_CONFIG[order.status as OrderStatus]
  const gc  = GARMENT_LABELS[order.garmentType as keyof typeof GARMENT_LABELS]
  const due = dueDateLabel(order.dueDate)

  return (
    <div className={cn(
      'bg-white border-2 rounded-2xl overflow-hidden transition-all',
      due.urgent ? 'border-amber-300' : 'border-slate-200'
    )}>
      {/* Urgent banner */}
      {due.urgent && order.dueDate < new Date().toISOString().split('T')[0] && (
        <div className="bg-red-500 px-4 py-1.5 flex items-center gap-2">
          <AlertTriangle size={12} className="text-white" />
          <p className="text-white text-xs font-bold">
            Yeh order late ho gaya hai!
          </p>
        </div>
      )}

      <div className="p-4">
        {/* Top row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="font-bold text-slate-800 truncate">
                {order.customerName}
              </p>
              {order.isUrgent === 1 && (
                <span className="shrink-0 flex items-center gap-0.5
                                 bg-red-100 text-red-600 text-[10px] font-bold
                                 px-1.5 py-0.5 rounded-full">
                  <Zap size={9} />
                  Urgent
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>#{String(order.orderNumber).padStart(3, '0')}</span>
              {gc && <><span>·</span><span>{gc.emoji} {gc.label}</span></>}
            </div>
          </div>

          {/* Status badge */}
          <div className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-full',
            'text-xs font-bold shrink-0',
            sc?.bg ?? 'bg-slate-100',
            sc?.color   ?? 'text-slate-700',
          )}>
            <span>{sc?.emoji}</span>
            <span>{sc?.label}</span>
          </div>
        </div>

        {/* Due date bar */}
        <div className="mb-3 rounded-xl bg-slate-50 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Calendar size={12} className={due.color} />
              <span className={cn('text-xs font-semibold', due.color)}>
                {due.text}
                {!due.urgent && ` — ${format(new Date(order.dueDate), 'd MMM')}`}
              </span>
            </div>
            <span className="text-xs font-semibold text-slate-500">
              Rs. {order.totalPrice.toLocaleString()}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
            {order.customerPhone && (
              <a
                href={`https://wa.me/92${order.customerPhone.replace(/^0/, '').replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-1 font-semibold text-green-700"
              >
                <MessageCircle size={11} />
                WhatsApp
              </a>
            )}
            <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1">
              <Phone size={10} /> {order.customerPhone || 'No phone'}
            </span>
            {order.specialInstructions && (
              <span className="line-clamp-1 inline-flex max-w-full rounded-full bg-amber-50 px-2 py-1 font-medium text-amber-700">
                {order.specialInstructions}
              </span>
            )}
          </div>
          {order.fabricPhotoUrl && (
            <img
              src={order.fabricPhotoUrl}
              alt="Fabric reference"
              className="mt-3 h-28 w-full rounded-xl object-cover"
            />
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => onStatusTap(order)}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white
                       font-bold py-2.5 rounded-xl text-sm transition-colors
                       active:scale-[0.98] flex items-center justify-center gap-1.5"
          >
            <RefreshCw size={14} />
            Status Update
          </button>
          <button
            onClick={() => onDetailTap(order)}
            className="w-10 h-10 flex items-center justify-center
                       bg-slate-100 rounded-xl text-slate-600 hover:bg-slate-200
                       transition-colors active:scale-95"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Order Card (History) ──────────────────────────────────────────

function HistoryOrderCard({ order }: { order: OrderRecord }) {
  const router = useRouter()
  const sc     = ORDER_STATUS_CONFIG[order.status as OrderStatus]
  const gc     = GARMENT_LABELS[order.garmentType as keyof typeof GARMENT_LABELS]

  return (
    <button
      onClick={() => router.push(`/orders/${order.id}`)}
      className="w-full bg-white border border-slate-200 rounded-2xl p-4
                 text-left hover:border-slate-300 active:scale-[0.98]
                 transition-all"
    >
      <div className="flex items-center gap-3">
        <div className={cn(
          'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-lg',
          order.status === 'delivered'
            ? 'bg-green-100'
            : 'bg-slate-100'
        )}>
          {sc?.emoji}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-slate-800 truncate text-sm">
              {order.customerName}
            </p>
            <span className={cn(
              'text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0',
              order.status === 'delivered'
                ? 'bg-green-100 text-green-700'
                : 'bg-slate-100 text-slate-500'
            )}>
              {sc?.label}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            #{String(order.orderNumber).padStart(3, '0')}
            {gc && ` · ${gc.emoji} ${gc.label}`}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            {orderDateLabel(order.createdAt)}
          </p>
        </div>
      </div>
    </button>
  )
}

// ── Stats Section ─────────────────────────────────────────────────

function StatsSection({ orders }: { orders: OrderRecord[] }) {
  const now          = new Date()
  const weekStart    = startOfWeek(now, { weekStartsOn: 1 })
  const monthStart   = startOfMonth(now)

  const completed    = orders.filter(o => o.status === 'delivered')
  const thisWeek     = completed.filter(o =>
    isWithinInterval(new Date(o.updatedAt), { start: weekStart, end: endOfDay(now) })
  )
  const thisMonth    = completed.filter(o =>
    isWithinInterval(new Date(o.updatedAt), { start: monthStart, end: endOfDay(now) })
  )

  const active       = orders.filter(o => ACTIVE_STATUSES.includes(o.status as OrderStatus))
  const overdue      = active.filter(o => o.dueDate < now.toISOString().split('T')[0])
  const urgent       = active.filter(o => o.isUrgent === 1)

  const totalDone    = completed.length
  const totalAll     = orders.length
  const completionPct = totalAll > 0
    ? Math.round((totalDone / totalAll) * 100)
    : 0

  // Status distribution for active
  const statusDist = ACTIVE_STATUSES.map(s => ({
    status:  s,
    count:   active.filter(o => o.status === s).length,
    cfg:     ORDER_STATUS_CONFIG[s],
  })).filter(s => s.count > 0)

  // Monthly breakdown (last 4 weeks)
  const weeks = Array.from({ length: 4 }, (_, i) => {
    const wStart = new Date(weekStart)
    wStart.setDate(wStart.getDate() - (3 - i) * 7)
    const wEnd   = new Date(wStart)
    wEnd.setDate(wEnd.getDate() + 6)
    const count  = completed.filter(o =>
      isWithinInterval(new Date(o.updatedAt), { start: wStart, end: endOfDay(wEnd) })
    ).length
    return {
      label: i === 3 ? 'Is Hafte' : `W${i + 1}`,
      count,
    }
  })

  const maxWeek = Math.max(...weeks.map(w => w.count), 1)

  return (
    <div className="space-y-4 pb-4">

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        {[
          {
            label:   'Is Hafte',
            value:   thisWeek.length,
            sub:     'complete',
            icon:    TrendingUp,
            bg:      'bg-blue-50',
            iconBg:  'bg-blue-100',
            iconCol: 'text-blue-600',
            valCol:  'text-blue-800',
          },
          {
            label:   'Is Mahine',
            value:   thisMonth.length,
            sub:     'complete',
            icon:    Star,
            bg:      'bg-green-50',
            iconBg:  'bg-green-100',
            iconCol: 'text-green-600',
            valCol:  'text-green-800',
          },
          {
            label:   'Active Orders',
            value:   active.length,
            sub:     'chal rahe hain',
            icon:    Clock,
            bg:      overdue.length > 0 ? 'bg-amber-50' : 'bg-slate-50',
            iconBg:  overdue.length > 0 ? 'bg-amber-100' : 'bg-slate-100',
            iconCol: overdue.length > 0 ? 'text-amber-600' : 'text-slate-500',
            valCol:  overdue.length > 0 ? 'text-amber-800' : 'text-slate-700',
          },
          {
            label:   'Total Done',
            value:   totalDone,
            sub:     `${completionPct}% rate`,
            icon:    CheckCircle2,
            bg:      'bg-purple-50',
            iconBg:  'bg-purple-100',
            iconCol: 'text-purple-600',
            valCol:  'text-purple-800',
          },
        ].map(card => (
          <div key={card.label} className={cn('rounded-2xl p-4', card.bg)}>
            <div className={cn(
              'w-9 h-9 rounded-xl flex items-center justify-center mb-3',
              card.iconBg
            )}>
              <card.icon size={17} className={card.iconCol} />
            </div>
            <p className={cn('text-2xl font-bold', card.valCol)}>{card.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{card.label}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Alert cards */}
      {(overdue.length > 0 || urgent.length > 0) && (
        <div className="space-y-2">
          {overdue.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-2xl
                            px-4 py-3 flex items-center gap-3">
              <AlertTriangle size={18} className="text-red-600 shrink-0" />
              <div>
                <p className="font-bold text-red-800 text-sm">
                  {overdue.length} Order Late!
                </p>
                <p className="text-red-600 text-xs">Jaldi complete karein</p>
              </div>
            </div>
          )}
          {urgent.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl
                            px-4 py-3 flex items-center gap-3">
              <Zap size={18} className="text-amber-600 shrink-0" />
              <div>
                <p className="font-bold text-amber-800 text-sm">
                  {urgent.length} Urgent Order
                </p>
                <p className="text-amber-600 text-xs">Priority basis par karein</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Weekly bar chart */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <h3 className="font-bold text-slate-800 text-sm mb-4">
          Weekly Performance
        </h3>
        <div className="flex items-end gap-2 h-32">
          {weeks.map((w, i) => {
            const pct = Math.round((w.count / maxWeek) * 100)
            const isCurrent = i === 3
            return (
              <div key={w.label} className="flex-1 flex flex-col items-center gap-1">
                <p className="text-xs font-bold text-slate-700">
                  {w.count > 0 ? w.count : '—'}
                </p>
                <div className="w-full flex items-end" style={{ height: '80px' }}>
                  <div
                    className={cn(
                      'w-full rounded-t-xl transition-all',
                      isCurrent ? 'bg-blue-600' : 'bg-slate-200'
                    )}
                    style={{ height: `${Math.max(pct, w.count > 0 ? 8 : 0)}%` }}
                  />
                </div>
                <p className={cn(
                  'text-[10px] font-semibold',
                  isCurrent ? 'text-blue-600' : 'text-slate-400'
                )}>
                  {w.label}
                </p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Status distribution */}
      {statusDist.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <h3 className="font-bold text-slate-800 text-sm mb-4">
            Active Orders Status
          </h3>
          <div className="space-y-3">
            {statusDist.map(({ status, count, cfg }) => {
              const pct = Math.round((count / active.length) * 100)
              return (
                <div key={status}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-slate-600 flex items-center gap-1.5">
                      {cfg?.emoji} {cfg?.label}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">{pct}%</span>
                      <span className="text-sm font-bold text-slate-700">{count}</span>
                    </div>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Completion rate */}
      <div className="bg-linear-to-br from-blue-600 to-blue-700 rounded-2xl p-5 text-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="font-bold text-lg">{completionPct}%</p>
            <p className="text-blue-200 text-sm">Completion Rate</p>
          </div>
          <div className="w-16 h-16 relative">
            <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
              <circle cx="18" cy="18" r="15.9"
                fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="3" />
              <circle cx="18" cy="18" r="15.9"
                fill="none" stroke="white" strokeWidth="3"
                strokeDasharray={`${completionPct} ${100 - completionPct}`}
                strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-bold text-white">{completionPct}%</span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/10 rounded-xl px-3 py-2.5 text-center">
            <p className="text-xl font-bold">{totalDone}</p>
            <p className="text-blue-200 text-xs">Mukammal</p>
          </div>
          <div className="bg-white/10 rounded-xl px-3 py-2.5 text-center">
            <p className="text-xl font-bold">{totalAll}</p>
            <p className="text-blue-200 text-xs">Total</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Home Tab ──────────────────────────────────────────────────────

function HomeTab({
  currentUser,
  allOrders,
  onStatusTap,
  onDetailTap,
  onTabChange,
}: {
  currentUser:  any
  allOrders:    OrderRecord[]
  onStatusTap:  (o: OrderRecord) => void
  onDetailTap:  (o: OrderRecord) => void
  onTabChange:  (tab: TabId) => void
}) {
  const now        = new Date()
  const today      = now.toISOString().split('T')[0]
  const tomorrow   = new Date(Date.now() + 86400000).toISOString().split('T')[0]

  const active     = allOrders.filter(o => ACTIVE_STATUSES.includes(o.status as OrderStatus))
  const overdue    = active.filter(o => o.dueDate < today)
  const dueToday   = active.filter(o => o.dueDate === today)
  const dueTomorrow= active.filter(o => o.dueDate === tomorrow)
  const thisWeekDone = allOrders.filter(o => {
    if (o.status !== 'delivered') return false
    const wStart = startOfWeek(now, { weekStartsOn: 1 })
    return isWithinInterval(new Date(o.updatedAt), { start: wStart, end: endOfDay(now) })
  })

  const greeting = (() => {
    const h = now.getHours()
    if (h < 12) return 'Subah Bakhair'
    if (h < 17) return 'Dopahar Bakhair'
    return 'Sham Bakhair'
  })()

  return (
    <div className="space-y-4 pb-4">

      {/* Greeting header */}
      <div className="bg-linear-to-br from-slate-800 to-slate-900 rounded-3xl p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-slate-400 text-sm">{greeting} 👋</p>
            <h2 className="text-white text-xl font-bold mt-0.5">
              {currentUser?.name ?? 'Karigar'}
            </h2>
            <p className="text-slate-500 text-xs mt-1 flex items-center gap-1">
              <Scissors size={10} />
              Karigar · My Darzi
            </p>
          </div>
          <div className="bg-blue-600 w-12 h-12 rounded-2xl flex items-center
                          justify-center shadow-lg shadow-blue-900/50">
            <User size={22} className="text-white" />
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Active',  value: active.length,      col: 'text-blue-300'  },
            { label: 'Aaj Due', value: dueToday.length,    col: dueToday.length > 0 ? 'text-amber-300' : 'text-slate-400' },
            { label: 'Is Hafte',value: thisWeekDone.length, col: 'text-green-300' },
          ].map(s => (
            <div key={s.label} className="bg-white/10 rounded-xl px-3 py-2.5 text-center">
              <p className={cn('text-xl font-bold', s.col)}>{s.value}</p>
              <p className="text-slate-500 text-[10px] mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Alert section */}
      {overdue.length > 0 && (
        <div
          className="bg-red-50 border-2 border-red-300 rounded-2xl p-4 cursor-pointer"
          onClick={() => onTabChange('active')}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-red-100 rounded-xl flex items-center justify-center">
              <AlertTriangle size={16} className="text-red-600" />
            </div>
            <div>
              <p className="font-bold text-red-800 text-sm">
                {overdue.length} Order Late Ho Gay{overdue.length > 1 ? 'e' : 'a'}!
              </p>
              <p className="text-red-500 text-xs">Fauran complete karein</p>
            </div>
            <ChevronRight size={16} className="text-red-400 ml-auto" />
          </div>
          <div className="space-y-1.5">
            {overdue.slice(0, 2).map(o => (
              <div key={o.id} className="flex items-center justify-between
                                         bg-red-100 rounded-xl px-3 py-2">
                <p className="text-red-800 text-xs font-semibold">{o.customerName}</p>
                <p className="text-red-600 text-[10px]">
                  {format(new Date(o.dueDate), 'd MMM')}
                </p>
              </div>
            ))}
            {overdue.length > 2 && (
              <p className="text-red-500 text-xs text-center font-semibold">
                + {overdue.length - 2} aur...
              </p>
            )}
          </div>
        </div>
      )}

      {/* Due today */}
      {dueToday.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={15} className="text-amber-600" />
            <p className="font-bold text-amber-800 text-sm">
              {dueToday.length} Order Aaj Due
            </p>
          </div>
          <div className="space-y-2">
            {dueToday.map(o => {
              const sc = ORDER_STATUS_CONFIG[o.status as OrderStatus]
              const gc = GARMENT_LABELS[o.garmentType as keyof typeof GARMENT_LABELS]
              return (
                <button
                  key={o.id}
                  onClick={() => onStatusTap(o)}
                  className="w-full flex items-center justify-between
                             bg-white border border-amber-200 rounded-xl px-3 py-2.5
                             text-left hover:bg-amber-50/50 transition-colors"
                >
                  <div>
                    <p className="font-semibold text-slate-800 text-sm">{o.customerName}</p>
                    <p className="text-xs text-slate-400">
                      {sc?.emoji} {sc?.label}
                      {gc && ` · ${gc.emoji} ${gc.label}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 text-blue-600 text-xs font-bold">
                    <RefreshCw size={12} />
                    Update
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Due tomorrow */}
      {dueTomorrow.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar size={14} className="text-blue-600" />
            <p className="font-bold text-blue-800 text-sm">
              Kal {dueTomorrow.length} Order Due
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {dueTomorrow.map(o => (
              <span key={o.id} className="bg-white border border-blue-200
                                          text-blue-700 text-xs font-medium
                                          px-2.5 py-1 rounded-full">
                {o.customerName}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Recent activity */}
      {active.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3
                          border-b border-slate-100">
            <p className="font-bold text-slate-800 text-sm">
              Mera Active Kaam
            </p>
            <button
              onClick={() => onTabChange('active')}
              className="text-blue-600 text-xs font-semibold flex items-center gap-1"
            >
              Sab Dekhein <ChevronRight size={12} />
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {active.slice(0, 3).map(o => {
              const sc  = ORDER_STATUS_CONFIG[o.status as OrderStatus]
              const gc  = GARMENT_LABELS[o.garmentType as keyof typeof GARMENT_LABELS]
              const due = dueDateLabel(o.dueDate)
              return (
                <button
                  key={o.id}
                  onClick={() => onStatusTap(o)}
                  className="w-full flex items-center gap-3 px-4 py-3
                             text-left hover:bg-slate-50 transition-colors"
                >
                  <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center
                                  justify-center shrink-0 text-base">
                    {sc?.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 text-sm truncate">
                      {o.customerName}
                    </p>
                    <p className="text-xs text-slate-400">
                      {gc?.emoji} {gc?.label} · {sc?.label}
                    </p>
                  </div>
                  <span className={cn('text-xs font-bold shrink-0', due.color)}>
                    {due.text}
                  </span>
                </button>
              )
            })}
          </div>
          {active.length > 3 && (
            <button
              onClick={() => onTabChange('active')}
              className="w-full py-3 text-center text-blue-600 text-xs
                         font-semibold border-t border-slate-100 hover:bg-slate-50"
            >
              + {active.length - 3} aur orders dekhein
            </button>
          )}
        </div>
      )}

      {/* All clear */}
      {active.length === 0 && overdue.length === 0 && (
        <div className="bg-green-50 border border-green-200 rounded-2xl
                        p-8 text-center">
          <CheckCircle2 size={40} className="text-green-500 mx-auto mb-3" />
          <p className="font-bold text-green-800 text-lg mb-1">
            Sab Kaam Mukammal! 🎉
          </p>
          <p className="text-green-600 text-sm">
            Abhi koi active order nahi hai
          </p>
        </div>
      )}
    </div>
  )
}

// ── Active Orders Tab ─────────────────────────────────────────────

function ActiveTab({
  orders,
  onStatusTap,
  onDetailTap,
}: {
  orders:      OrderRecord[]
  onStatusTap: (o: OrderRecord) => void
  onDetailTap: (o: OrderRecord) => void
}) {
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all')
  const [search, setSearch]             = useState('')

  const filtered = useMemo(() => {
    let list = orders.filter(o => ACTIVE_STATUSES.includes(o.status as OrderStatus))

    if (statusFilter !== 'all') {
      list = list.filter(o => o.status === statusFilter)
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(o =>
        o.customerName.toLowerCase().includes(q) ||
        String(o.orderNumber).includes(q)
      )
    }

    // Sort: overdue first, then by due date
    return list.sort((a, b) => {
      const today = new Date().toISOString().split('T')[0]
      const aLate = a.dueDate < today ? -1 : 0
      const bLate = b.dueDate < today ? -1 : 0
      if (aLate !== bLate) return aLate - bLate
      return a.dueDate.localeCompare(b.dueDate)
    })
  }, [orders, statusFilter, search])

  return (
    <div className="space-y-3 pb-4">

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Naam ya order # dhundein..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-8 py-2.5 bg-slate-100 rounded-xl text-sm
                     outline-none focus:bg-white border-2 border-transparent
                     focus:border-blue-500 transition-all placeholder:text-slate-400"
        />
        {search && (
          <button onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2">
            <X size={13} className="text-slate-400" />
          </button>
        )}
      </div>

      {/* Status filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {['all', ...ACTIVE_STATUSES].map(s => {
          const cfg   = s !== 'all' ? ORDER_STATUS_CONFIG[s as OrderStatus] : null
          const count = s === 'all'
            ? orders.filter(o => ACTIVE_STATUSES.includes(o.status as OrderStatus)).length
            : orders.filter(o => o.status === s).length
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s as OrderStatus | 'all')}
              className={cn(
                'shrink-0 flex items-center gap-1.5 px-3 py-1.5',
                'rounded-full text-xs font-semibold border transition-colors',
                statusFilter === s
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-600 border-slate-200'
              )}
            >
              {cfg ? `${cfg.emoji} ${cfg.label}` : '📋 Sab'}
              {count > 0 && (
                <span className={cn(
                  'text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-4.5 text-center',
                  statusFilter === s
                    ? 'bg-white/30 text-white'
                    : 'bg-slate-100 text-slate-600'
                )}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Order count */}
      <p className="text-xs text-slate-400 font-medium">
        {filtered.length} order{filtered.length !== 1 ? 's' : ''}
        {search && ` mein mila`}
      </p>

      {/* Orders */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-3xl mb-3">
            {search ? '🔍' : '✅'}
          </p>
          <p className="font-semibold text-slate-500">
            {search ? 'Koi order nahi mila' : 'Koi active order nahi'}
          </p>
          <p className="text-sm text-slate-400 mt-1">
            {search ? 'Alag naam try karein' : 'Owner aapko orders assign kare ga'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(order => (
            <ActiveOrderCard
              key={order.id}
              order={order}
              onStatusTap={onStatusTap}
              onDetailTap={onDetailTap}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── History Tab ───────────────────────────────────────────────────

function HistoryTab({ orders }: { orders: OrderRecord[] }) {
  const [search,      setSearch]      = useState('')
  const [filter,      setFilter]      = useState<'all' | 'delivered' | 'cancelled'>('all')
  const [timeFilter,  setTimeFilter]  = useState<'all' | 'week' | 'month'>('all')

  const done = useMemo(() => {
    const now        = new Date()
    const weekStart  = startOfWeek(now, { weekStartsOn: 1 })
    const monthStart = startOfMonth(now)

    let list = orders.filter(o =>
      DONE_STATUSES.includes(o.status as OrderStatus)
    )

    if (filter !== 'all') {
      list = list.filter(o => o.status === filter)
    }

    if (timeFilter === 'week') {
      list = list.filter(o =>
        isWithinInterval(new Date(o.updatedAt), { start: weekStart, end: endOfDay(now) })
      )
    } else if (timeFilter === 'month') {
      list = list.filter(o =>
        isWithinInterval(new Date(o.updatedAt), { start: monthStart, end: endOfDay(now) })
      )
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(o =>
        o.customerName.toLowerCase().includes(q) ||
        String(o.orderNumber).includes(q)
      )
    }

    return list.sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
  }, [orders, filter, timeFilter, search])

  // Group by date
  const grouped = useMemo(() => {
    const groups: Record<string, OrderRecord[]> = {}
    done.forEach(o => {
      const d = new Date(o.updatedAt)
      const key = isToday(d) ? 'Aaj'
        : isYesterday(d) ? 'Kal'
        : format(d, 'd MMMM yyyy')
      if (!groups[key]) groups[key] = []
      groups[key].push(o)
    })
    return Object.entries(groups)
  }, [done])

  const deliveredCount = orders.filter(o => o.status === 'delivered').length
  const cancelledCount = orders.filter(o => o.status === 'cancelled').length

  return (
    <div className="space-y-3 pb-4">

      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3 text-center">
          <p className="text-2xl font-bold text-green-700">{deliveredCount}</p>
          <p className="text-xs text-green-600 font-medium mt-0.5">✓ Delivered</p>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-center">
          <p className="text-2xl font-bold text-slate-600">{cancelledCount}</p>
          <p className="text-xs text-slate-500 font-medium mt-0.5">✗ Cancelled</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Purane orders dhundein..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-8 py-2.5 bg-slate-100 rounded-xl text-sm
                     outline-none focus:bg-white border-2 border-transparent
                     focus:border-blue-500 transition-all placeholder:text-slate-400"
        />
        {search && (
          <button onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2">
            <X size={13} className="text-slate-400" />
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {[
          { key: 'all',       label: 'Sab'       },
          { key: 'delivered', label: '✓ Delivered'},
          { key: 'cancelled', label: '✗ Cancelled'},
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key as typeof filter)}
            className={cn(
              'shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold',
              'border transition-colors',
              filter === f.key
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-slate-600 border-slate-200'
            )}
          >
            {f.label}
          </button>
        ))}

        <div className="w-px h-5 bg-slate-200 shrink-0 mx-1 self-center" />

        {[
          { key: 'all',   label: 'Sab Waqt' },
          { key: 'week',  label: 'Is Hafte' },
          { key: 'month', label: 'Is Mahine'},
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setTimeFilter(f.key as typeof timeFilter)}
            className={cn(
              'shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold',
              'border transition-colors',
              timeFilter === f.key
                ? 'bg-slate-700 text-white border-slate-700'
                : 'bg-white text-slate-600 border-slate-200'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Grouped list */}
      {grouped.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-3xl mb-3">📦</p>
          <p className="font-semibold text-slate-500">
            {search ? 'Koi order nahi mila' : 'Koi history nahi'}
          </p>
          <p className="text-sm text-slate-400 mt-1">
            {timeFilter !== 'all'
              ? 'Alag time filter try karein'
              : 'Delivered orders yahan dikhenge'
            }
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([date, grpOrders]) => (
            <div key={date}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                  {date}
                </p>
                <p className="text-xs text-slate-400">
                  {grpOrders.length} order{grpOrders.length > 1 ? 's' : ''}
                </p>
              </div>
              <div className="space-y-2">
                {grpOrders.map(o => (
                  <HistoryOrderCard key={o.id} order={o} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main Karigar Page ─────────────────────────────────────────────

export default function KarigarPage() {
  const router               = useRouter()
  const { currentUser, shopId, logout } = useAuth()
  const [activeTab, setActiveTab] = useState<TabId>('home')
  const [statusSheet, setStatusSheet] = useState<OrderRecord | null>(null)

  // Load all assigned orders
  const allOrders = useLiveQuery(
    async (): Promise<OrderRecord[]> => {
      if (!currentUser?.id) return []
      return db.orders
        .where('assignedTo').equals(currentUser.id)
        .filter(o => o._deleted === 0)
        .reverse()
        .sortBy('createdAt')
    },
    [currentUser?.id]
  ) ?? []

  const activeCount = allOrders.filter(o =>
    ACTIVE_STATUSES.includes(o.status as OrderStatus)
  ).length

  const overdueCount = allOrders.filter(o =>
    ACTIVE_STATUSES.includes(o.status as OrderStatus) &&
    o.dueDate < new Date().toISOString().split('T')[0]
  ).length

  const handleLogout = () => {
    logout()
    window.location.href = '/auth'
  }

  const handleDetailTap = (order: OrderRecord) => {
    router.push(`/orders/${order.id}`)
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">

      {/* ── Header ── */}
      <header className="bg-white border-b border-slate-100 px-4 pt-12 pb-3
                         sticky top-0 z-20 lg:pt-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center">
              <Scissors size={16} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-slate-800 text-sm leading-tight">
                {currentUser?.name ?? 'Karigar'}
              </p>
              <p className="text-slate-400 text-[10px]">My Darzi</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Overdue badge */}
            {overdueCount > 0 && (
              <button
                onClick={() => setActiveTab('active')}
                className="flex items-center gap-1 bg-red-100 border border-red-200
                           text-red-700 text-xs font-bold px-2.5 py-1.5 rounded-full"
              >
                <AlertTriangle size={11} />
                {overdueCount} Deri
              </button>
            )}

            <button
              onClick={handleLogout}
              className="w-9 h-9 flex items-center justify-center rounded-xl
                         bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
              aria-label="Logout"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-100 rounded-2xl p-1">
          {TABS.map(tab => {
            const isActive  = activeTab === tab.id
            const showBadge = tab.id === 'active' && activeCount > 0

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl',
                  'text-xs font-semibold transition-all relative',
                  isActive
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                )}
              >
                <tab.icon size={13} />
                <span className="hidden sm:inline">{tab.label}</span>

                {/* Badge */}
                {showBadge && (
                  <span className={cn(
                    'absolute -top-1 -right-1 min-w-4 h-4 rounded-full',
                    'flex items-center justify-center text-[9px] font-bold px-1',
                    overdueCount > 0
                      ? 'bg-red-500 text-white'
                      : 'bg-blue-600 text-white'
                  )}>
                    {activeCount}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </header>

      {/* ── Content ── */}
      <main className="flex-1 px-4 pt-4">
        {activeTab === 'home' && (
          <HomeTab
            currentUser={currentUser}
            allOrders={allOrders}
            onStatusTap={setStatusSheet}
            onDetailTap={handleDetailTap}
            onTabChange={setActiveTab}
          />
        )}

        {activeTab === 'active' && (
          <ActiveTab
            orders={allOrders}
            onStatusTap={setStatusSheet}
            onDetailTap={handleDetailTap}
          />
        )}

        {activeTab === 'history' && (
          <HistoryTab orders={allOrders} />
        )}

        {activeTab === 'stats' && (
          <StatsSection orders={allOrders} />
        )}
      </main>

      {/* ── Status Update Sheet ── */}
      {statusSheet && (
        <KarigarStatusSheet
          order={statusSheet}
          onClose={() => setStatusSheet(null)}
        />
      )}
    </div>
  )
}
