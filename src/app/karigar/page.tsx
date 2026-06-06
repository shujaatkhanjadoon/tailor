'use client'

import { useState, useMemo }      from 'react'
import { useRouter }              from 'next/navigation'
import {
  Scissors, LogOut, CheckCircle2,
  Clock, AlertTriangle, TrendingUp,
  ChevronRight, Search,
  X, Calendar, Star,
  BarChart2, Zap, RefreshCw,
  User, Phone, MessageCircle,
} from 'lucide-react'
import type { OrderRecord }       from '@/lib/db/schema'
import { useAuth }                from '@/lib/auth/AuthContext'
import { useOrders }              from '@/hooks/useOrders'
import { ORDER_STATUS_CONFIG, GARMENT_LABELS, OrderStatus } from '@/types'
import { StatusUpdateSheet }      from '@/components/orders/StatusUpdateSheet'
import { SpecialInstructionsSummary } from '@/components/orders/SpecialInstructionsSummary'
import { cn }                     from '@/lib/utils'
import {
  format, isToday, isYesterday,
  startOfWeek, startOfMonth,
  isWithinInterval, endOfDay,
  differenceInDays,
} from 'date-fns'
import Image from 'next/image'
import { useTranslation } from 'react-i18next'

type TabId = 'home' | 'active' | 'history' | 'stats'

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

function KarigarStatusSheet({ order, onClose, onUpdated }: {
  order: OrderRecord
  onClose: () => void
  onUpdated: (newStatus: OrderStatus) => void
}) {
  return (
    <StatusUpdateSheet
      order={order}
      onClose={onClose}
      onUpdate={(newStatus) => { onUpdated(newStatus); onClose() }}
    />
  )
}

function ActiveOrderCard({ order, onStatusTap, onDetailTap }: {
  order: OrderRecord
  onStatusTap: (o: OrderRecord) => void
  onDetailTap: (o: OrderRecord) => void
}) {
  const { t } = useTranslation()
  const sc  = ORDER_STATUS_CONFIG[order.status as OrderStatus]
  const gc  = GARMENT_LABELS[order.garmentType as keyof typeof GARMENT_LABELS]
  const due = dueDateLabel(order.dueDate)

  return (
    <div role="button" tabIndex={0} onClick={() => onDetailTap(order)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onDetailTap(order) }}
      className={cn('bg-white border-2 rounded-2xl overflow-hidden transition-all cursor-pointer hover:border-blue-200 hover:shadow-sm active:scale-[0.99]',
        due.urgent ? 'border-amber-300' : 'border-slate-200')}>
      {due.urgent && order.dueDate < new Date().toISOString().split('T')[0] && (
        <div className="bg-red-500 px-4 py-1.5 flex items-center gap-2">
          <AlertTriangle size={12} className="text-white" />
          <p className="text-white text-xs font-bold">{t('karigar.home.lateOrder')}</p>
        </div>
      )}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="font-bold text-slate-800 truncate">{order.customerName}</p>
              {order.isUrgent === 1 && (
                <span className="shrink-0 flex items-center gap-0.5 bg-red-100 text-red-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  <Zap size={9} /> {t('karigar.home.urgentLabel', 'Urgent')}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>#{String(order.orderNumber).padStart(3, '0')}</span>
              {gc && <><span>·</span><span>{gc.emoji} {gc.label}</span></>}
            </div>
          </div>
          <button type="button" onClick={(e) => { e.stopPropagation(); onStatusTap(order) }}
            className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold shrink-0 active:scale-95 transition-transform',
              sc?.bg ?? 'bg-slate-100', sc?.color ?? 'text-slate-700')}>
            <span>{sc?.emoji}</span><span>{sc?.label}</span>
          </button>
        </div>
        <div className="mb-3 rounded-xl bg-slate-50 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Calendar size={12} className={due.color} />
              <span className={cn('text-xs font-semibold', due.color)}>{due.text}{!due.urgent && ` — ${format(new Date(order.dueDate), 'd MMM')}`}</span>
            </div>
            <span className="text-xs font-semibold text-slate-500">Rs. {order.totalPrice.toLocaleString()}</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
            {order.customerPhone && (
              <a href={`https://wa.me/92${order.customerPhone.replace(/^0/, '').replace(/\D/g, '')}`}
                target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-1 font-semibold text-green-700">
                <MessageCircle size={11} /> {t('karigar.active.whatsapp')}
              </a>
            )}
            <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1">
              <Phone size={10} /> {order.customerPhone || 'No phone'}
            </span>
            {order.specialInstructions && <SpecialInstructionsSummary value={order.specialInstructions} compact className="mt-1 w-full" />}
          </div>
          {order.fabricPhotoUrl && (
            <img src={order.fabricPhotoUrl} alt="Fabric reference" className="mt-3 h-28 w-full rounded-xl object-cover" />
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={(e) => { e.stopPropagation(); onStatusTap(order) }}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-sm transition-colors active:scale-[0.98] flex items-center justify-center gap-1.5">
            <RefreshCw size={14} /> {t('karigar.active.statusUpdate')}
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDetailTap(order) }}
            className="w-10 h-10 flex items-center justify-center bg-slate-100 rounded-xl text-slate-600 hover:bg-slate-200 transition-colors active:scale-95">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}

function HistoryOrderCard({ order }: { order: OrderRecord }) {
  const router = useRouter()
  const { t } = useTranslation()
  const sc = ORDER_STATUS_CONFIG[order.status as OrderStatus]
  const gc = GARMENT_LABELS[order.garmentType as keyof typeof GARMENT_LABELS]

  return (
    <button onClick={() => router.push(`/orders/${order.id}`)}
      className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-left hover:border-slate-300 active:scale-[0.98] transition-all">
      <div className="flex items-center gap-3">
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-lg',
          order.status === 'delivered' ? 'bg-green-100' : 'bg-slate-100')}>{sc?.emoji}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-slate-800 truncate text-sm">{order.customerName}</p>
            <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0',
              order.status === 'delivered' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500')}>{sc?.label}</span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">#{String(order.orderNumber).padStart(3, '0')}{gc && ` · ${gc.emoji} ${gc.label}`}</p>
          <p className="text-xs text-slate-400 mt-0.5">{orderDateLabel(order.createdAt)}</p>
        </div>
      </div>
    </button>
  )
}

function StatsSection({ orders }: { orders: OrderRecord[] }) {
  const { t } = useTranslation()
  const now = new Date()
  const weekStart = startOfWeek(now, { weekStartsOn: 1 })
  const monthStart = startOfMonth(now)
  const ACTIVE_STATUSES: OrderStatus[] = ['received', 'cutting', 'stitching', 'finishing', 'ready']

  const completed = orders.filter(o => o.status === 'delivered')
  const thisWeek = completed.filter(o => isWithinInterval(new Date(o.updatedAt), { start: weekStart, end: endOfDay(now) }))
  const thisMonth = completed.filter(o => isWithinInterval(new Date(o.updatedAt), { start: monthStart, end: endOfDay(now) }))
  const active = orders.filter(o => ACTIVE_STATUSES.includes(o.status as OrderStatus))
  const overdue = active.filter(o => o.dueDate < now.toISOString().split('T')[0])
  const urgent = active.filter(o => o.isUrgent === 1)
  const totalDone = completed.length
  const totalAll = orders.length
  const completionPct = totalAll > 0 ? Math.round((totalDone / totalAll) * 100) : 0

  const statusDist = ACTIVE_STATUSES.map(s => ({
    status: s, count: active.filter(o => o.status === s).length, cfg: ORDER_STATUS_CONFIG[s],
  })).filter(s => s.count > 0)

  const weeks = Array.from({ length: 4 }, (_, i) => {
    const wStart = new Date(weekStart); wStart.setDate(wStart.getDate() - (3 - i) * 7)
    const wEnd = new Date(wStart); wEnd.setDate(wEnd.getDate() + 6)
    const count = completed.filter(o => isWithinInterval(new Date(o.updatedAt), { start: wStart, end: endOfDay(wEnd) })).length
    return { label: i === 3 ? t('karigar.stats.thisWeek') : `W${i + 1}`, count }
  })
  const maxWeek = Math.max(...weeks.map(w => w.count), 1)

  return (
    <div className="space-y-4 pb-4">
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: t('karigar.stats.thisWeek'), value: thisWeek.length, sub: t('karigar.stats.thisWeekComplete'), icon: TrendingUp, bg: 'bg-blue-50', iconBg: 'bg-blue-100', iconCol: 'text-blue-600', valCol: 'text-blue-800' },
          { label: t('karigar.stats.thisMonth'), value: thisMonth.length, sub: t('karigar.stats.thisWeekComplete'), icon: Star, bg: 'bg-green-50', iconBg: 'bg-green-100', iconCol: 'text-green-600', valCol: 'text-green-800' },
          { label: t('karigar.stats.activeOrders'), value: active.length, sub: t('karigar.stats.inProgressLabel'), icon: Clock, bg: overdue.length > 0 ? 'bg-amber-50' : 'bg-slate-50', iconBg: overdue.length > 0 ? 'bg-amber-100' : 'bg-slate-100', iconCol: overdue.length > 0 ? 'text-amber-600' : 'text-slate-500', valCol: overdue.length > 0 ? 'text-amber-800' : 'text-slate-700' },
          { label: t('karigar.stats.totalDone'), value: totalDone, sub: t('karigar.stats.completionPct', { pct: completionPct }), icon: CheckCircle2, bg: 'bg-purple-50', iconBg: 'bg-purple-100', iconCol: 'text-purple-600', valCol: 'text-purple-800' },
        ].map(card => (
          <div key={card.label} className={cn('rounded-2xl p-4', card.bg)}>
            <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center mb-3', card.iconBg)}>
              <card.icon size={17} className={card.iconCol} />
            </div>
            <p className={cn('text-2xl font-bold', card.valCol)}>{card.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{card.label}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{card.sub}</p>
          </div>
        ))}
      </div>

      {(overdue.length > 0 || urgent.length > 0) && (
        <div className="space-y-2">
          {overdue.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-center gap-3">
              <AlertTriangle size={18} className="text-red-600 shrink-0" />
              <div>
                <p className="font-bold text-red-800 text-sm">{t('karigar.stats.orderLate', { count: overdue.length })}</p>
                <p className="text-red-600 text-xs">{t('karigar.stats.completeSoon2')}</p>
              </div>
            </div>
          )}
          {urgent.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-center gap-3">
              <Zap size={18} className="text-amber-600 shrink-0" />
              <div>
                <p className="font-bold text-amber-800 text-sm">{t('karigar.stats.urgentOrder', { count: urgent.length })}</p>
                <p className="text-amber-600 text-xs">{t('karigar.stats.priority')}</p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <h3 className="font-bold text-slate-800 text-sm mb-4">{t('karigar.stats.weeklyPerformance')}</h3>
        <div className="flex items-end gap-2 h-32">
          {weeks.map((w, i) => {
            const pct = Math.round((w.count / maxWeek) * 100)
            const isCurrent = i === 3
            return (
              <div key={w.label} className="flex-1 flex flex-col items-center gap-1">
                <p className="text-xs font-bold text-slate-700">{w.count > 0 ? w.count : '—'}</p>
                <div className="w-full flex items-end" style={{ height: '80px' }}>
                  <div className={cn('w-full rounded-t-xl transition-all', isCurrent ? 'bg-blue-600' : 'bg-slate-200')}
                    style={{ height: `${Math.max(pct, w.count > 0 ? 8 : 0)}%` }} />
                </div>
                <p className={cn('text-[10px] font-semibold', isCurrent ? 'text-blue-600' : 'text-slate-400')}>{w.label}</p>
              </div>
            )
          })}
        </div>
      </div>

      {statusDist.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <h3 className="font-bold text-slate-800 text-sm mb-4">{t('karigar.stats.activeOrdersStatus')}</h3>
          <div className="space-y-3">
            {statusDist.map(({ status, count, cfg }) => {
              const pct = Math.round((count / active.length) * 100)
              return (
                <div key={status}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-slate-600 flex items-center gap-1.5">{cfg?.emoji} {cfg?.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">{pct}%</span>
                      <span className="text-sm font-bold text-slate-700">{count}</span>
                    </div>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="bg-linear-to-br from-blue-600 to-blue-700 rounded-2xl p-5 text-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="font-bold text-lg">{completionPct}%</p>
            <p className="text-blue-200 text-sm">{t('karigar.stats.completionRate')}</p>
          </div>
          <div className="w-16 h-16 relative">
            <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="3" />
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="white" strokeWidth="3"
                strokeDasharray={`${completionPct} ${100 - completionPct}`} strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-bold text-white">{completionPct}%</span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/10 rounded-xl px-3 py-2.5 text-center">
            <p className="text-xl font-bold">{totalDone}</p>
            <p className="text-blue-200 text-xs">{t('karigar.stats.mukammal')}</p>
          </div>
          <div className="bg-white/10 rounded-xl px-3 py-2.5 text-center">
            <p className="text-xl font-bold">{totalAll}</p>
            <p className="text-blue-200 text-xs">{t('karigar.stats.total')}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function HomeTab({ currentUser, allOrders, onStatusTap, onDetailTap, onTabChange }: {
  currentUser: any
  allOrders: OrderRecord[]
  onStatusTap: (o: OrderRecord) => void
  onDetailTap: (o: OrderRecord) => void
  onTabChange: (tab: TabId) => void
}) {
  const { t } = useTranslation()
  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const tomorrow = new Date(now.getTime() + 86400000).toISOString().split('T')[0]
  const ACTIVE_STATUSES: OrderStatus[] = ['received', 'cutting', 'stitching', 'finishing', 'ready']

  const active = allOrders.filter(o => ACTIVE_STATUSES.includes(o.status as OrderStatus))
  const overdue = active.filter(o => o.dueDate < today)
  const dueToday = active.filter(o => o.dueDate === today)
  const dueTomorrow = active.filter(o => o.dueDate === tomorrow)
  const thisWeekDone = allOrders.filter(o => {
    if (o.status !== 'delivered') return false
    const wStart = startOfWeek(now, { weekStartsOn: 1 })
    return isWithinInterval(new Date(o.updatedAt), { start: wStart, end: endOfDay(now) })
  })

  const greeting = (() => {
    const h = now.getHours()
    if (h < 11) return t('karigar.home.greeting')
    if (h < 16) return t('karigar.home.greetingAfternoon')
    if (h < 18) return t('karigar.home.greetingEvening')
    return t('karigar.home.greetingNight')
  })()

  return (
    <div className="space-y-4 pb-4">
      <div className="bg-linear-to-br from-slate-800 to-slate-900 rounded-3xl p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-slate-400 text-sm">{greeting} 👋</p>
            <h2 className="text-white text-xl font-bold mt-0.5">{currentUser?.name ?? 'Karigar'}</h2>
            <p className="text-slate-500 text-xs mt-1 flex items-center gap-1">
              <Scissors size={10} /> {t('karigar.role')} · MeraDarzi
            </p>
          </div>
          <div className="bg-blue-600 w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-900/50">
            <User size={22} className="text-white" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: t('karigar.home.active'), value: active.length, col: 'text-blue-300' },
            { label: t('karigar.home.dueToday'), value: dueToday.length, col: dueToday.length > 0 ? 'text-amber-300' : 'text-slate-400' },
            { label: t('karigar.home.thisWeek'), value: thisWeekDone.length, col: 'text-green-300' },
          ].map(s => (
            <div key={s.label} className="bg-white/10 rounded-xl px-3 py-2.5 text-center">
              <p className={cn('text-xl font-bold', s.col)}>{s.value}</p>
              <p className="text-slate-500 text-[10px] mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {overdue.length > 0 && (
        <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-4 cursor-pointer" onClick={() => onTabChange('active')}>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-red-100 rounded-xl flex items-center justify-center"><AlertTriangle size={16} className="text-red-600" /></div>
            <div>
              <p className="font-bold text-red-800 text-sm">{t('karigar.home.overdue', { count: overdue.length })}</p>
              <p className="text-red-500 text-xs">{t('karigar.home.completeSoon')}</p>
            </div>
            <ChevronRight size={16} className="text-red-400 ms-auto" />
          </div>
          <div className="space-y-1.5">
            {overdue.slice(0, 2).map(o => (
              <div key={o.id} className="flex items-center justify-between bg-red-100 rounded-xl px-3 py-2">
                <p className="text-red-800 text-xs font-semibold">{o.customerName}</p>
                <p className="text-red-600 text-[10px]">{format(new Date(o.dueDate), 'd MMM')}</p>
              </div>
            ))}
            {overdue.length > 2 && <p className="text-red-500 text-xs text-center font-semibold">+ {overdue.length - 2} aur...</p>}
          </div>
        </div>
      )}

      {dueToday.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={15} className="text-amber-600" />
            <p className="font-bold text-amber-800 text-sm">{t('karigar.home.dueTodayCount', { count: dueToday.length })}</p>
          </div>
          <div className="space-y-2">
            {dueToday.map(o => {
              const sc = ORDER_STATUS_CONFIG[o.status as OrderStatus]
              const gc = GARMENT_LABELS[o.garmentType as keyof typeof GARMENT_LABELS]
              return (
                <div key={o.id} role="button" tabIndex={0} onClick={() => onDetailTap(o)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onDetailTap(o) }}
                  className="w-full flex items-center justify-between bg-white border border-amber-200 rounded-xl px-3 py-2.5 text-left hover:bg-amber-50/50 transition-colors active:scale-[0.99]">
                  <div>
                    <p className="font-semibold text-slate-800 text-sm">{o.customerName}</p>
                    <p className="text-xs text-slate-400">#{String(o.orderNumber).padStart(3, '0')} · {sc?.emoji} {sc?.label}{gc && ` · ${gc.emoji} ${gc.label}`}</p>
                  </div>
                  <div role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); onStatusTap(o) }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onStatusTap(o) } }}
                    className="flex min-h-9 items-center gap-1.5 rounded-full bg-blue-50 px-3 text-blue-600 text-xs font-bold">
                    <RefreshCw size={12} /> {t('karigar.active.statusUpdate')}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {dueTomorrow.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar size={14} className="text-blue-600" />
            <p className="font-bold text-blue-800 text-sm">{t('karigar.home.dueTomorrow', { count: dueTomorrow.length })}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {dueTomorrow.map(o => (
              <span key={o.id} className="bg-white border border-blue-200 text-blue-700 text-xs font-medium px-2.5 py-1 rounded-full">{o.customerName}</span>
            ))}
          </div>
        </div>
      )}

      {active.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <p className="font-bold text-slate-800 text-sm">{t('karigar.home.myWork')}</p>
            <button onClick={() => onTabChange('active')} className="text-blue-600 text-xs font-semibold flex items-center gap-1">
              {t('karigar.home.sabDekhein')} <ChevronRight size={12} />
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {active.slice(0, 3).map(o => {
              const sc = ORDER_STATUS_CONFIG[o.status as OrderStatus]
              const gc = GARMENT_LABELS[o.garmentType as keyof typeof GARMENT_LABELS]
              const due = dueDateLabel(o.dueDate)
              return (
                <div key={o.id} role="button" tabIndex={0} onClick={() => onDetailTap(o)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onDetailTap(o) }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors active:scale-[0.99]">
                  <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center shrink-0 text-base">{sc?.emoji}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 text-sm truncate">{o.customerName}</p>
                    <p className="text-xs text-slate-400">#{String(o.orderNumber).padStart(3, '0')} · {gc?.emoji} {gc?.label}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={cn('text-xs font-bold', due.color)}>{due.text}</span>
                    <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); onStatusTap(o) }}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onStatusTap(o) } }}
                      className={cn('rounded-full px-2.5 py-1 text-[10px] font-bold', sc?.bg, sc?.color)}>{sc?.label}</span>
                  </div>
                </div>
              )
            })}
          </div>
          {active.length > 3 && (
            <button onClick={() => onTabChange('active')}
              className="w-full py-3 text-center text-blue-600 text-xs font-semibold border-t border-slate-100 hover:bg-slate-50">
              {t('karigar.home.aurOrders', { count: active.length - 3 })}
            </button>
          )}
        </div>
      )}

      {active.length === 0 && overdue.length === 0 && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center">
          <CheckCircle2 size={40} className="text-green-500 mx-auto mb-3" />
          <p className="font-bold text-green-800 text-lg mb-1">{t('karigar.home.allClear')}</p>
          <p className="text-green-600 text-sm">{t('karigar.home.allClearDesc')}</p>
        </div>
      )}
    </div>
  )
}

function ActiveTab({ orders, onStatusTap, onDetailTap }: {
  orders: OrderRecord[]
  onStatusTap: (o: OrderRecord) => void
  onDetailTap: (o: OrderRecord) => void
}) {
  const { t } = useTranslation()
  const ACTIVE_STATUSES: OrderStatus[] = ['received', 'cutting', 'stitching', 'finishing', 'ready']
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all')
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    let list = orders.filter(o => ACTIVE_STATUSES.includes(o.status as OrderStatus))
    if (statusFilter !== 'all') list = list.filter(o => o.status === statusFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(o => o.customerName.toLowerCase().includes(q) || String(o.orderNumber).includes(q))
    }
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
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input type="text" placeholder={t('karigar.active.searchPlaceholder')} value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-8 py-2.5 bg-slate-100 rounded-xl text-sm outline-none focus:bg-white border-2 border-transparent focus:border-blue-500 transition-all placeholder:text-slate-400" />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
            <X size={13} className="text-slate-400" />
          </button>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {['all', ...ACTIVE_STATUSES].map(s => {
          const cfg = s !== 'all' ? ORDER_STATUS_CONFIG[s as OrderStatus] : null
          const count = s === 'all' ? orders.filter(o => ACTIVE_STATUSES.includes(o.status as OrderStatus)).length : orders.filter(o => o.status === s).length
          return (
            <button key={s} onClick={() => setStatusFilter(s as OrderStatus | 'all')}
              className={cn('shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors',
                statusFilter === s ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200')}>
              {cfg ? `${cfg.emoji} ${cfg.label}` : t('karigar.active.filterAll')}
              {count > 0 && (
                <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-4.5 text-center',
                  statusFilter === s ? 'bg-white/30 text-white' : 'bg-slate-100 text-slate-600')}>{count}</span>
              )}
            </button>
          )
        })}
      </div>

      <p className="text-xs text-slate-400 font-medium">
        {t('karigar.active.ordersFound', { count: filtered.length, plural: filtered.length !== 1 ? 's' : '' })}
        {search && ` ${t('karigar.active.foundIn')}`}
      </p>

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-3xl mb-3">{search ? '🔍' : '✅'}</p>
          <p className="font-semibold text-slate-500">{search ? t('karigar.active.noSearch') : t('karigar.active.noActive')}</p>
          <p className="text-sm text-slate-400 mt-1">{search ? t('karigar.active.noSearchDesc') : t('karigar.active.noActiveDesc')}</p>
        </div>
      ) : (
        <div className="space-y-3">{filtered.map(order => (
          <ActiveOrderCard key={order.id} order={order} onStatusTap={onStatusTap} onDetailTap={onDetailTap} />
        ))}</div>
      )}
    </div>
  )
}

function HistoryTab({ orders }: { orders: OrderRecord[] }) {
  const { t } = useTranslation()
  const DONE_STATUSES: OrderStatus[] = ['delivered', 'cancelled']
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'delivered' | 'cancelled'>('all')
  const [timeFilter, setTimeFilter] = useState<'all' | 'week' | 'month'>('all')

  const done = useMemo(() => {
    const now = new Date()
    const weekStart = startOfWeek(now, { weekStartsOn: 1 })
    const monthStart = startOfMonth(now)
    let list = orders.filter(o => DONE_STATUSES.includes(o.status as OrderStatus))
    if (filter !== 'all') list = list.filter(o => o.status === filter)
    if (timeFilter === 'week') list = list.filter(o => isWithinInterval(new Date(o.updatedAt), { start: weekStart, end: endOfDay(now) }))
    else if (timeFilter === 'month') list = list.filter(o => isWithinInterval(new Date(o.updatedAt), { start: monthStart, end: endOfDay(now) }))
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(o => o.customerName.toLowerCase().includes(q) || String(o.orderNumber).includes(q))
    }
    return list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  }, [orders, filter, timeFilter, search])

  const grouped = useMemo(() => {
    const groups: Record<string, OrderRecord[]> = {}
    done.forEach(o => {
      const d = new Date(o.updatedAt)
      const key = isToday(d) ? t('karigar.history.groupToday') : isYesterday(d) ? t('karigar.history.groupYesterday') : format(d, 'd MMMM yyyy')
      if (!groups[key]) groups[key] = []
      groups[key].push(o)
    })
    return Object.entries(groups)
  }, [done])

  const deliveredCount = orders.filter(o => o.status === 'delivered').length
  const cancelledCount = orders.filter(o => o.status === 'cancelled').length

  return (
    <div className="space-y-3 pb-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3 text-center">
          <p className="text-2xl font-bold text-green-700">{deliveredCount}</p>
          <p className="text-xs text-green-600 font-medium mt-0.5">{t('karigar.history.summaryDelivered')}</p>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-center">
          <p className="text-2xl font-bold text-slate-600">{cancelledCount}</p>
          <p className="text-xs text-slate-500 font-medium mt-0.5">{t('karigar.history.summaryCancelled')}</p>
        </div>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input type="text" placeholder={t('karigar.history.searchPlaceholder')} value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-8 py-2.5 bg-slate-100 rounded-xl text-sm outline-none focus:bg-white border-2 border-transparent focus:border-blue-500 transition-all placeholder:text-slate-400" />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
            <X size={13} className="text-slate-400" />
          </button>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {[
          { key: 'all', label: t('karigar.history.filterAll') },
          { key: 'delivered', label: t('karigar.history.filterDelivered') },
          { key: 'cancelled', label: t('karigar.history.filterCancelled') },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key as typeof filter)}
            className={cn('shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors',
              filter === f.key ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200')}>
            {f.label}
          </button>
        ))}
        <div className="w-px h-5 bg-slate-200 shrink-0 mx-1 self-center" />
        {[
          { key: 'all', label: t('karigar.history.timeAll') },
          { key: 'week', label: t('karigar.history.timeWeek') },
          { key: 'month', label: t('karigar.history.timeMonth') },
        ].map(f => (
          <button key={f.key} onClick={() => setTimeFilter(f.key as typeof timeFilter)}
            className={cn('shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors',
              timeFilter === f.key ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-600 border-slate-200')}>
            {f.label}
          </button>
        ))}
      </div>

      {grouped.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-3xl mb-3">📦</p>
          <p className="font-semibold text-slate-500">{search ? t('karigar.history.noResults') : t('karigar.history.noHistory')}</p>
          <p className="text-sm text-slate-400 mt-1">
            {timeFilter !== 'all' ? t('karigar.history.emptyNoTime') : t('karigar.history.emptyNoHistory')}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([date, grpOrders]) => (
            <div key={date}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">{date}</p>
                <p className="text-xs text-slate-400">{t('karigar.history.count', { count: grpOrders.length })}</p>
              </div>
              <div className="space-y-2">{grpOrders.map(o => <HistoryOrderCard key={o.id} order={o} />)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function KarigarPage() {
  const router = useRouter()
  const { currentUser, shopId, logout } = useAuth()
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<TabId>('home')
  const [statusSheet, setStatusSheet] = useState<OrderRecord | null>(null)
  const ACTIVE_STATUSES: OrderStatus[] = ['received', 'cutting', 'stitching', 'finishing', 'ready']

  const { orders: allOrders, isLoading, patchOrderInList, refresh } = useOrders(shopId, 'karigar', currentUser?.id)

  const activeCount = allOrders.filter(o => ACTIVE_STATUSES.includes(o.status as OrderStatus)).length
  const overdueCount = allOrders.filter(o =>
    ACTIVE_STATUSES.includes(o.status as OrderStatus) && o.dueDate < new Date().toISOString().split('T')[0]
  ).length

  const handleLogout = async () => { await logout(); window.location.href = '/auth' }
  const handleDetailTap = (order: OrderRecord) => router.push(`/orders/${order.id}`)

  const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: 'home',    label: t('karigar.tabs.home'),    icon: Scissors },
    { id: 'active',  label: t('karigar.tabs.active'),  icon: Clock },
    { id: 'history', label: t('karigar.tabs.history'), icon: CheckCircle2 },
    { id: 'stats',   label: t('karigar.tabs.stats'),   icon: BarChart2 },
  ]

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-100 px-4 pt-12 pb-3 sticky top-0 z-20 lg:pt-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 flex items-center justify-center">
              <Image src="/icon.svg" alt="MeraDarzi" width={32} height={32} loading="eager" />
            </div>
            <div>
              <p className="font-bold text-slate-800 text-sm leading-tight">{currentUser?.name ?? 'Karigar'}</p>
              <p className="text-slate-400 text-[10px]">MeraDarzi</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {overdueCount > 0 && (
              <button onClick={() => setActiveTab('active')}
                className="flex items-center gap-1 bg-red-100 border border-red-200 text-red-700 text-xs font-bold px-2.5 py-1.5 rounded-full">
                <AlertTriangle size={11} /> {t('karigar.stats.orderLateBadge', { count: overdueCount })}
              </button>
            )}
            <button onClick={handleLogout}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
              aria-label={t('karigar.logout')}>
              <LogOut size={16} />
            </button>
          </div>
        </div>

        <div className="flex gap-1 bg-slate-100 rounded-2xl p-1">
          {TABS.map(tab => {
            const isActive = activeTab === tab.id
            const showBadge = tab.id === 'active' && activeCount > 0
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={cn('flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all relative',
                  isActive ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
                <tab.icon size={13} />
                <span className="hidden sm:inline">{tab.label}</span>
                {showBadge && (
                  <span className={cn('absolute -top-1 -right-1 min-w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold px-1',
                    overdueCount > 0 ? 'bg-red-500 text-white' : 'bg-blue-600 text-white')}>
                    {activeCount}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </header>

      <main className="flex-1 px-4 pt-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw size={24} className="animate-spin text-blue-600" />
          </div>
        ) : (
          <>
            {activeTab === 'home' && <HomeTab currentUser={currentUser} allOrders={allOrders} onStatusTap={setStatusSheet} onDetailTap={handleDetailTap} onTabChange={setActiveTab} />}
            {activeTab === 'active' && <ActiveTab orders={allOrders} onStatusTap={setStatusSheet} onDetailTap={handleDetailTap} />}
            {activeTab === 'history' && <HistoryTab orders={allOrders} />}
            {activeTab === 'stats' && <StatsSection orders={allOrders} />}
          </>
        )}
      </main>

      {statusSheet && (
        <KarigarStatusSheet order={statusSheet} onClose={() => setStatusSheet(null)}
          onUpdated={(newStatus) => { patchOrderInList(statusSheet.id, { status: newStatus }); refresh() }} />
      )}
    </div>
  )
}
