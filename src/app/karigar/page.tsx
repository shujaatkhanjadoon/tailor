// src/app/karigar/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import { LogOut, Clock, CheckCircle2, Scissors, AlertCircle } from 'lucide-react'
import { useAuth } from '@/lib/auth/AuthContext'
import { db, OrderRecord } from '@/lib/db/schema'
import { ORDER_STATUS_CONFIG, GARMENT_LABELS, OrderStatus } from '@/types'
import { StatusUpdateSheet } from '@/components/orders/StatusUpdateSheet'
import { cn } from '@/lib/utils'
import { format, formatDistanceToNow } from 'date-fns'

export default function KarigarHomePage() {
  const router                    = useRouter()
  const { currentUser, logout }   = useAuth()
  const [statusOrder, setStatusOrder] = useState<OrderRecord | null>(null)
  const [greeting,    setGreeting]    = useState('Salam')

  useEffect(() => {
    const h = new Date().getHours()
    setGreeting(h < 12 ? 'Subah Bakhair' : h < 17 ? 'Salam' : 'Assalam o Alaikum')
  }, [])

  const myOrders = useLiveQuery(
    async (): Promise<OrderRecord[]> => {
      if (!currentUser) return []
      return db.orders
        .where('assignedTo').equals(currentUser.id)
        .filter(o => o._deleted === 0 && !['delivered','cancelled'].includes(o.status))
        .reverse()
        .sortBy('dueDate')
    },
    [currentUser?.id]
  )

  const today      = new Date().toISOString().split('T')[0]
  const safe       = myOrders ?? []
  const overdue    = safe.filter(o => o.dueDate < today)
  const dueToday   = safe.filter(o => o.dueDate === today)
  const upcoming   = safe.filter(o => o.dueDate > today)

  const handleLogout = () => {
    logout()
    // Use replace not push — prevents back-button loop
    router.replace('/auth')
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-8">

      {/* Header */}
      <div className="bg-linear-to-br from-green-800 to-green-600 px-5 pt-14 pb-8">
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="text-green-200 text-sm">{greeting} 👋</p>
            <h1 className="text-2xl font-bold text-white mt-0.5">
              {currentUser?.name?.split(' ')[0] || 'Karigar'}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <Scissors size={12} className="text-green-300" />
              <span className="text-green-300 text-xs">
                {currentUser?.speciality || 'Karigar'}
              </span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-9 h-9 bg-white/15 rounded-full flex items-center justify-center"
          >
            <LogOut size={15} className="text-white" />
          </button>
        </div>

        {/* My stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total Kaam',   value: safe.length,     color: 'text-white'       },
            { label: 'Aaj Due',      value: dueToday.length, color: 'text-yellow-300'  },
            { label: 'Deri',         value: overdue.length,  color: overdue.length > 0 ? 'text-red-300' : 'text-white' },
          ].map(s => (
            <div key={s.label} className="bg-white/15 rounded-2xl px-3 py-3 text-center">
              <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
              <p className="text-green-200 text-[10px] mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 space-y-5 pt-5">

        {/* Overdue alert */}
        {overdue.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-center gap-3">
            <AlertCircle size={20} className="text-red-600 shrink-0" />
            <div>
              <p className="text-sm font-bold text-red-700">
                {overdue.length} order late ho gaye!
              </p>
              <p className="text-xs text-red-500 mt-0.5">Turant kaam mein lao</p>
            </div>
          </div>
        )}

        {/* Empty state */}
        {safe.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <CheckCircle2 size={48} className="text-slate-200 mb-4" />
            <p className="font-semibold text-slate-500">Aaj koi kaam nahi!</p>
            <p className="text-sm text-slate-400 mt-1">Ustad ne koi order assign nahi kiya</p>
          </div>
        )}

        {/* Orders grouped by urgency */}
        {[
          { title: '🔴 Deri Wale', orders: overdue,  urgency: 'overdue'  },
          { title: '📅 Aaj Due',   orders: dueToday, urgency: 'today'    },
          { title: '📋 Aage Wale', orders: upcoming, urgency: 'upcoming' },
        ].map(group => {
          if (group.orders.length === 0) return null
          return (
            <section key={group.title}>
              <h2 className="text-sm font-bold text-slate-600 mb-2">{group.title}</h2>
              <div className="space-y-3">
                {group.orders.map(order => (
                  <KarigarOrderCard
                    key={order.id}
                    order={order}
                    onStatusTap={() => setStatusOrder(order)}
                  />
                ))}
              </div>
            </section>
          )
        })}
      </div>

      {/* Status sheet */}
      {statusOrder && (
        <StatusUpdateSheet
          order={statusOrder}
          onClose={() => setStatusOrder(null)}
          onUpdate={() => setStatusOrder(null)}
        />
      )}
    </div>
  )
}

// ── Karigar Order Card — no payment info shown ────────────────────
function KarigarOrderCard({
  order,
  onStatusTap,
}: {
  order:       OrderRecord
  onStatusTap: () => void
}) {
  const sc      = ORDER_STATUS_CONFIG[order.status as OrderStatus]
  const gc      = GARMENT_LABELS[order.garmentType as keyof typeof GARMENT_LABELS]
  const today   = new Date().toISOString().split('T')[0]
  const isLate  = order.dueDate < today

  return (
    <div className={cn(
      'bg-white border rounded-2xl p-4 transition-all',
      isLate           ? 'border-red-200 bg-red-50/30'    :
      order.isUrgent === 1 ? 'border-orange-200 bg-orange-50/20' : 'border-slate-200'
    )}>
      {/* Top row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-700 text-sm">
            #{String(order.orderNumber).padStart(3,'0')}
          </span>
          {order.isUrgent === 1 && (
            <span className="text-[10px] font-bold bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full">
              URGENT
            </span>
          )}
        </div>
        {/* Status — tappable to update */}
        <button
          onClick={onStatusTap}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold active:scale-95 transition-transform',
            sc.bg, sc.color, sc.border
          )}
        >
          {sc.emoji} {sc.label}
          <span className="opacity-50 text-[10px]">▾</span>
        </button>
      </div>

      {/* Garment info — NO customer name or payment shown to karigar */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">{gc?.emoji}</span>
        <div>
          <p className="font-semibold text-slate-800 text-sm">{gc?.label}</p>
          {order.specialInstructions && (
            <p className="text-xs text-amber-700 mt-0.5 line-clamp-1">
              📝 {order.specialInstructions}
            </p>
          )}
        </div>
      </div>

      {/* Due date */}
      <div className="flex items-center gap-1.5">
        <Clock size={12} className={isLate ? 'text-red-500' : 'text-slate-400'} />
        <span className={cn(
          'text-xs font-medium',
          isLate ? 'text-red-600 font-bold' : 'text-slate-400'
        )}>
          {isLate
            ? `${formatDistanceToNow(new Date(order.dueDate))} late!`
            : `Due: ${format(new Date(order.dueDate), 'EEEE, d MMM')}`
          }
        </span>
      </div>
    </div>
  )
}