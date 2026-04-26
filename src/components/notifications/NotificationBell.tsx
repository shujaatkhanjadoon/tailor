// src/components/notifications/NotificationBell.tsx
'use client'

import { useState, useEffect } from 'react'
import { Bell, BellOff, X, Clock, AlertTriangle, CheckCircle } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useRouter } from 'next/navigation'
import { db, OrderRecord } from '@/lib/db/schema'
import { useAuth } from '@/lib/auth/AuthContext'
import { useNotificationCount } from '@/hooks/useNotifications'
import { notifPermission } from '@/lib/notifications/permission'
import { ORDER_STATUS_CONFIG } from '@/types'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'

export function NotificationBell() {
  const router            = useRouter()
  const { shopId }        = useAuth()
  const count             = useNotificationCount(shopId)
  const [open, setOpen]   = useState(false)
  const [hasPermission, setHasPermission] = useState(false)

  useEffect(() => {
    setHasPermission(notifPermission.current() === 'granted')
  }, [])

  const today    = new Date().toISOString().split('T')[0]
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]

  // Fetch the actual orders for the dropdown
  const alertOrders = useLiveQuery(
    async (): Promise<OrderRecord[]> => {
      if (!shopId) return []
      return db.orders
        .where('shopId').equals(shopId)
        .filter(o =>
          o._deleted === 0 &&
          !['delivered', 'cancelled'].includes(o.status) &&
          o.dueDate <= tomorrow
        )
        .reverse()
        .sortBy('dueDate')
    },
    [shopId, today],
    []
  )

  const safe     = alertOrders ?? []
  const overdue  = safe.filter(o => o.dueDate < today)
  const dueToday = safe.filter(o => o.dueDate === today)
  const dueTomr  = safe.filter(o => o.dueDate === tomorrow)

  return (
    <div className="relative">
      {/* Bell button */}
      <button
        aria-label={open ? 'Close notifications' : 'Open notifications'}
        onClick={() => setOpen(v => !v)}
        className="relative w-11 h-11 flex items-center justify-center
                   rounded-full bg-slate-100 hover:bg-slate-200 transition-colors"
      >
        {hasPermission
          ? <Bell size={18} className="text-slate-600" />
          : <BellOff size={18} className="text-slate-400" />
        }

        {/* Badge */}
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4.5 h-4.5 bg-red-500
                           text-white text-[10px] font-bold rounded-full flex items-center
                           justify-center px-1 leading-none">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-30"
            onClick={() => setOpen(false)}
          />

          <div className="absolute right-0 top-12 w-[320px] bg-white border border-slate-200
                          rounded-2xl shadow-xl z-40 overflow-hidden max-h-120 flex flex-col">

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-sm">Notifications</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { router.push('/settings/notifications'); setOpen(false) }}
                  className="text-xs text-blue-600 font-semibold"
                >
                  Settings
                </button>
                <button aria-label="Close notifications" onClick={() => setOpen(false)}>
                  <X size={15} className="text-slate-400" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1">

              {safe.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-center">
                  <CheckCircle size={32} className="text-green-400 mb-3" />
                  <p className="font-semibold text-slate-600 text-sm">Sab theek hai!</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Koi due orders nahi abhi
                  </p>
                </div>
              ) : (
                <>
                  {/* Overdue section */}
                  {overdue.length > 0 && (
                    <div>
                      <div className="px-4 py-2 bg-red-50 border-b border-red-100">
                        <p className="text-xs font-bold text-red-700 uppercase tracking-wide flex items-center gap-1">
                          <AlertTriangle size={11} />
                          {overdue.length} Deri Wale
                        </p>
                      </div>
                      {overdue.map(o => (
                        <NotifRow
                          key={o.id}
                          order={o}
                          variant="overdue"
                          onClick={() => {
                            router.push(`/orders/${o.id}`)
                            setOpen(false)
                          }}
                        />
                      ))}
                    </div>
                  )}

                  {/* Due today */}
                  {dueToday.length > 0 && (
                    <div>
                      <div className="px-4 py-2 bg-amber-50 border-b border-amber-100">
                        <p className="text-xs font-bold text-amber-700 uppercase tracking-wide flex items-center gap-1">
                          <Clock size={11} />
                          {dueToday.length} Aaj Due
                        </p>
                      </div>
                      {dueToday.map(o => (
                        <NotifRow
                          key={o.id}
                          order={o}
                          variant="today"
                          onClick={() => {
                            router.push(`/orders/${o.id}`)
                            setOpen(false)
                          }}
                        />
                      ))}
                    </div>
                  )}

                  {/* Due tomorrow */}
                  {dueTomr.length > 0 && (
                    <div>
                      <div className="px-4 py-2 bg-blue-50 border-b border-blue-100">
                        <p className="text-xs font-bold text-blue-700 uppercase tracking-wide flex items-center gap-1">
                          <Clock size={11} />
                          {dueTomr.length} Kal Due
                        </p>
                      </div>
                      {dueTomr.map(o => (
                        <NotifRow
                          key={o.id}
                          order={o}
                          variant="tomorrow"
                          onClick={() => {
                            router.push(`/orders/${o.id}`)
                            setOpen(false)
                          }}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Permission nudge if not granted */}
            {!hasPermission && (
              <div className="px-4 py-3 bg-amber-50 border-t border-amber-200">
                <p className="text-xs text-amber-700 font-medium">
                  🔔 Push notifications band hain.{' '}
                  <button
                    onClick={() => { router.push('/settings/notifications'); setOpen(false) }}
                    className="underline font-bold"
                  >
                    Enable karein
                  </button>
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function NotifRow({
  order, variant, onClick,
}: {
  order:   OrderRecord
  variant: 'overdue' | 'today' | 'tomorrow'
  onClick: () => void
}) {
  const sc     = ORDER_STATUS_CONFIG[order.status as keyof typeof ORDER_STATUS_CONFIG]
  const today  = new Date().toISOString().split('T')[0]

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 border-b border-slate-100
                 hover:bg-slate-50 text-left transition-colors"
    >
      {/* Status emoji */}
      <span className="text-lg shrink-0">{sc?.emoji ?? '📋'}</span>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 truncate">
          {order.customerName}
        </p>
        <p className="text-xs text-slate-400 truncate">
          #{String(order.orderNumber).padStart(3,'0')} · {sc?.label}
        </p>
      </div>

      <div className="shrink-0 text-right">
        <span className={cn(
          'text-[10px] font-bold px-2 py-1 rounded-full',
          variant === 'overdue'
            ? 'bg-red-100 text-red-700'
            : variant === 'today'
            ? 'bg-amber-100 text-amber-700'
            : 'bg-blue-100 text-blue-700'
        )}>
          {variant === 'overdue'
            ? formatDistanceToNow(new Date(order.dueDate)) + ' late'
            : variant === 'today'
            ? 'Aaj'
            : 'Kal'
          }
        </span>
      </div>
    </button>
  )
}
