// src/components/orders/OrderListCard.tsx
'use client'

import { useRouter } from 'next/navigation'
import { Clock, MessageCircle, User2, ChevronRight } from 'lucide-react'
import { OrderRecord } from '@/lib/db/schema'
import { ORDER_STATUS_CONFIG, GARMENT_LABELS } from '@/types'
import { cn } from '@/lib/utils'
import { format, formatDistanceToNow, isToday, isTomorrow } from 'date-fns'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db/schema'
import { Image } from 'lucide-react'
import { memo } from 'react'

interface OrderListCardProps {
  order: OrderRecord
  showCustomer?: boolean
  onStatusTap?: (order: OrderRecord) => void
  onAssignTap?: (order: OrderRecord) => void
  isOwner?: boolean
}

function formatDueDate(dateStr: string): { label: string; urgent: boolean } {
  const date = new Date(dateStr)
  const today = new Date().toISOString().split('T')[0]
  const isLate = dateStr < today

  if (isLate) return { label: `${formatDistanceToNow(date)} late`, urgent: true }
  if (isToday(date)) return { label: 'Aaj tayyar hona chahiye', urgent: true }
  if (isTomorrow(date)) return { label: 'Kal due hai', urgent: false }
  return { label: format(date, 'd MMM'), urgent: false }
}

export const OrderListCard = memo(function OrderListCard({
  order,
  showCustomer = true,
  onStatusTap,
  onAssignTap,
  isOwner = false,
}: OrderListCardProps) {
  const router = useRouter()
  const sc = ORDER_STATUS_CONFIG[order.status as keyof typeof ORDER_STATUS_CONFIG]
  const gc = GARMENT_LABELS[order.garmentType as keyof typeof GARMENT_LABELS]
  const balance = Math.max(0, order.totalPrice - order.amountPaid)
  const { label: dueLabel, urgent: dueUrgent } = formatDueDate(order.dueDate)
  const isTerminal = ['delivered', 'cancelled'].includes(order.status)

  const photoCount = useLiveQuery(
    () => db.photos.where('orderId').equals(order.id).count(),
    [order.id],
    0
  ) ?? 0

  const waLink = (() => {
    const phone = `92${order.customerPhone.replace(/^0/, '').replace(/\D/g, '')}`
    const msg = encodeURIComponent(
      `Assalam o Alaikum ${order.customerName}!\n` +
      `Aapka order #${String(order.orderNumber).padStart(3, '0')} tayyar hai! ✅\n` +
      (balance > 0 ? `Baaki: Rs.${balance.toLocaleString()}\nJaldi tashreef laaein 🙏` : 'Jaldi tashreef laaein 🙏')
    )
    return `https://wa.me/${phone}?text=${msg}`
  })()

  return (
    <div className={cn(
      'bg-white border rounded-2xl overflow-hidden transition-all',
      order.isUrgent === 1 && !isTerminal ? 'border-orange-300' :
        dueUrgent && !isTerminal ? 'border-red-200' : 'border-slate-200'
    )}>
      {/* Urgent ribbon */}
      {order.isUrgent === 1 && !isTerminal && (
        <div className="bg-orange-500 px-4 py-1">
          <p className="text-white text-[10px] font-bold uppercase tracking-wider">⚡ Urgent Order</p>
        </div>
      )}

      {/* Main content */}
      <div
        className="p-4 cursor-pointer active:bg-slate-50 transition-colors"
        onClick={() => router.push(`/orders/${order.id}`)}
      >
        {/* Row 1: order number + status badge */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-700">
              #{String(order.orderNumber).padStart(3, '0')}
            </span>
            {gc && (
              <span className="text-xs text-slate-400">
                {gc.emoji} {gc.label}
              </span>
            )}
          </div>
          {/* Status tap target */}
          <button
            onClick={e => {
              e.stopPropagation()
              if (!isTerminal && onStatusTap) onStatusTap(order)
            }}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors',
              sc.bg, sc.color, sc.border,
              !isTerminal && onStatusTap ? 'active:scale-95' : ''
            )}
          >
            <span>{sc.emoji}</span>
            <span>{sc.label}</span>
            {!isTerminal && onStatusTap && (
              <span className="opacity-50 text-[10px]">▾</span>
            )}
          </button>
        </div>

        {/* Row 2: customer name */}
        {showCustomer && (
          <p className="font-semibold text-slate-800 mb-1">{order.customerName}</p>
        )}

        {/* Row 3: assigned karigar */}
        {order.assignedToName && (
          <p className="text-xs text-blue-600 mb-2 flex items-center gap-1">
            <User2 size={10} />
            {order.assignedToName}
          </p>
        )}

        {/* Row 4: payment progress */}
        {order.totalPrice > 0 && !isTerminal && (
          <div className="mb-3">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-400">
                Rs.{order.amountPaid.toLocaleString()} / Rs.{order.totalPrice.toLocaleString()}
              </span>
              <span className={cn('font-semibold', balance > 0 ? 'text-red-500' : 'text-green-600')}>
                {balance > 0 ? `Rs.${balance.toLocaleString()} baaki` : 'Poora ✓'}
              </span>
            </div>
            <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full', balance === 0 ? 'bg-green-500' : 'bg-blue-500')}
                style={{ width: `${Math.min(100, Math.round((order.amountPaid / order.totalPrice) * 100))}%` }}
              />
            </div>
          </div>
        )}

        {/* Row 5: due date + actions */}
        <div className="flex items-center justify-between">
          <p className={cn('text-xs flex items-center gap-1', dueUrgent && !isTerminal ? 'text-red-600 font-semibold' : 'text-slate-400')}>
            <Clock size={10} />
            {dueLabel}
          </p>

          <div className="flex items-center gap-2">
            {/* Assign button — owner only, non-terminal */}
            {isOwner && !isTerminal && onAssignTap && (
              <button
                onClick={e => { e.stopPropagation(); onAssignTap(order) }}
                className={cn(
                  'text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border transition-colors',
                  order.assignedToName
                    ? 'border-blue-200 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300'
                )}
              >
                {order.assignedToName ? '✎ Reassign' : '+ Assign'}
              </button>
            )}

            {/* WhatsApp for ready orders */}
            {order.status === 'ready' && (
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="flex items-center gap-1 bg-green-500 text-white text-[11px]
                           font-semibold px-2.5 py-1.5 rounded-lg"
              >
                <MessageCircle size={11} />
                Bata Do
              </a>
            )}

            <ChevronRight size={14} className="text-slate-300" />
          </div>
        </div>
        {photoCount > 0 && (
          <span className="flex items-center gap-0.5 text-[10px] text-slate-400">
            <Image size={10} />
            {photoCount}
          </span>
        )}
      </div>
    </div>
  )
})