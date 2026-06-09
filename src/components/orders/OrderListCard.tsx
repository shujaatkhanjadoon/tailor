// src/components/orders/OrderListCard.tsx
'use client'

import { useRouter } from 'next/navigation'
import { Clock, MessageCircle, User2, ChevronRight } from 'lucide-react'
import { OrderRecord } from '@/lib/db/schema'
import { ORDER_STATUS_CONFIG, GARMENT_LABELS } from '@/types'
import { cn } from '@/lib/utils'
import { format, formatDistanceToNow, isToday, isTomorrow } from 'date-fns'
import { Image } from 'lucide-react'
import { memo, useEffect, useState } from 'react'
import { orderBalance, orderPaymentProgress } from '@/lib/payments/calculations'
import { recipientLabel } from '@/lib/order-recipient'
import { supabase } from '@/lib/supabase/client'
import { useTranslation } from 'react-i18next'

interface OrderListCardProps {
  order: OrderRecord
  showCustomer?: boolean
  onStatusTap?: (order: OrderRecord) => void
  onAssignTap?: (order: OrderRecord) => void
  isOwner?: boolean
  photoCount?: number
  // Bulk selection props
  selectionMode?: boolean
  isSelected?: boolean
  onToggleSelect?: (id: string) => void
}

function formatDueDate(dateStr: string, t: any): { label: string; urgent: boolean } {
  const date = new Date(dateStr)
  const today = new Date().toISOString().split('T')[0]
  const isLate = dateStr < today

  if (isLate) return { label: t('orders.dueDate.late', { time: formatDistanceToNow(date) }), urgent: true }
  if (isToday(date)) return { label: t('orders.dueDate.dueToday'), urgent: true }
  if (isTomorrow(date)) return { label: t('orders.dueDate.dueTomorrow'), urgent: false }
  return { label: format(date, 'd MMM'), urgent: false }
}

export const OrderListCard = memo(function OrderListCard({
  order,
  showCustomer = true,
  onStatusTap,
  onAssignTap,
  isOwner = false,
  photoCount: propPhotoCount,
  selectionMode = false,
  isSelected = false,
  onToggleSelect,
}: OrderListCardProps) {
  const router = useRouter()
  const { t } = useTranslation()
  const sc = ORDER_STATUS_CONFIG[order.status as keyof typeof ORDER_STATUS_CONFIG]
  const gc = GARMENT_LABELS[order.garmentType as keyof typeof GARMENT_LABELS]
  const balance = orderBalance(order)
  const { label: dueLabel, urgent: dueUrgent } = formatDueDate(order.dueDate, t)
  const isTerminal = ['delivered', 'cancelled'].includes(order.status)

  const [localPhotoCount, setLocalPhotoCount] = useState(0)
  const photoCount = propPhotoCount ?? localPhotoCount
  useEffect(() => {
    if (propPhotoCount !== undefined) return
    let cancelled = false
    supabase
      .from('order_photos')
      .select('id', { count: 'exact' })
      .eq('order_id', order.id)
      .is('deleted_at', null)
      .then(({ count }: { count: number | null }) => {
        if (!cancelled) setLocalPhotoCount(count ?? 0)
      })
    return () => { cancelled = true }
  }, [order.id, propPhotoCount])

  const waLink = (() => {
    const phone = `92${order.customerPhone.replace(/^0/, '').replace(/\D/g, '')}`
    const balanceStr = balance > 0
      ? t('orders.card.whatsappBalance', { amount: balance.toLocaleString() })
      : ''
    const msg = encodeURIComponent(
      t('orders.card.whatsappMsg', {
        customer: order.customerName,
        orderNumber: String(order.orderNumber).padStart(3, '0'),
        balanceMsg: balanceStr,
      })
    )
    return `https://wa.me/${phone}?text=${msg}`
  })()

  return (
    <div className={cn(
      'flex items-start',
      selectionMode && 'gap-2'
    )}>
      {/* Selection checkbox */}
      {selectionMode && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleSelect?.(order.id) }}
          className="mt-3 shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center
            transition-colors"
          style={{
            borderColor: isSelected ? '#2563eb' : '#cbd5e1',
            backgroundColor: isSelected ? '#2563eb' : 'transparent',
          }}
          aria-label={isSelected ? 'Deselect order' : 'Select order'}
        >
          {isSelected && (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 6l3 3 5-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>
      )}

      <div className={cn(
        'bg-white border rounded-2xl overflow-hidden transition-all flex-1',
        isSelected && 'border-blue-500 ring-2 ring-blue-100',
        !isSelected && order.isUrgent === 1 && !isTerminal ? 'border-orange-300' :
        !isSelected && dueUrgent && !isTerminal ? 'border-red-200' : 'border-slate-200'
      )}>
        {/* Urgent ribbon */}
        {order.isUrgent === 1 && !isTerminal && (
          <div className="bg-orange-500 px-4 py-1">
            <p className="text-white text-[10px] font-bold uppercase tracking-wider">{t('orders.card.urgentRibbon')}</p>
          </div>
        )}

      {/* Main content */}
      <div
        className="p-4 cursor-pointer active:bg-slate-50 transition-colors"
        onClick={() => router.push(`/orders/${order.id}`)}
      >
        {/* Row 1: order number + status badge */}
        <div className="mb-2 flex min-w-0 flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="text-sm font-bold text-slate-700">
              #{String(order.orderNumber).padStart(3, '0')}
            </span>
            {gc && (
              <span className="truncate text-xs text-slate-400">
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
              'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
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
          <div className="mb-1">
            <p className="font-semibold text-slate-800">{order.customerName}</p>
            {order.orderForRelation && order.orderForRelation !== 'self' && (
              <p className="text-[11px] font-semibold text-blue-600">
                {t('orders.card.for', { recipient: recipientLabel(order.orderForRelation, order.orderForName) })}
              </p>
            )}
          </div>
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
                {balance > 0 ? t('orders.card.balance', { amount: balance.toLocaleString() }) : t('orders.card.paid')}
              </span>
            </div>
            <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full', balance === 0 ? 'bg-green-500' : 'bg-blue-500')}
                style={{ width: `${orderPaymentProgress(order)}%` }}
              />
            </div>
          </div>
        )}

        {/* Row 5: due date + actions */}
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <p className={cn('min-w-0 text-xs flex items-center gap-1', dueUrgent && !isTerminal ? 'text-red-600 font-semibold' : 'text-slate-400')}>
            <Clock size={10} />
            {dueLabel}
          </p>

          <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
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
                {order.assignedToName ? t('orders.card.reassign') : t('orders.card.assign')}
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
                {t('orders.card.notify')}
              </a>
            )}

            <ChevronRight size={14} className="text-slate-300" />
          </div>
        </div>
        {photoCount > 0 && (
          <span className="flex items-center gap-0.5 text-[10px] text-slate-400">
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image size={10} />
            {t('orders.card.photoCount', { count: photoCount })}
          </span>
        )}
      </div>
    </div>
    </div>
  )
})
