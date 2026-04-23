// src/components/payments/PaymentCard.tsx
'use client'

import { useRouter } from 'next/navigation'
import { ChevronRight, AlertCircle } from 'lucide-react'
import { PaymentWithOrder } from '@/hooks/usePayments'
import { GARMENT_LABELS } from '@/types'
import { cn } from '@/lib/utils'
import { format, isToday, isYesterday } from 'date-fns'

const METHOD_CONFIG = {
  cash:      { label: 'Cash',      emoji: '💵', bg: 'bg-green-100',  color: 'text-green-700'  },
  easypaisa: { label: 'Easypaisa', emoji: '📱', bg: 'bg-teal-100',   color: 'text-teal-700'   },
  jazzcash:  { label: 'JazzCash',  emoji: '📲', bg: 'bg-red-100',    color: 'text-red-700'    },
  bank:      { label: 'Bank',      emoji: '🏦', bg: 'bg-blue-100',   color: 'text-blue-700'   },
  other:     { label: 'Aur',       emoji: '💳', bg: 'bg-slate-100',  color: 'text-slate-600'  },
}

function formatPaymentDate(isoStr: string): string {
  const d = new Date(isoStr)
  if (isToday(d))     return `Aaj, ${format(d, 'h:mm a')}`
  if (isYesterday(d)) return `Kal, ${format(d, 'h:mm a')}`
  return format(d, 'd MMM yyyy, h:mm a')
}

interface PaymentCardProps {
  payment: PaymentWithOrder
}

export function PaymentCard({ payment }: PaymentCardProps) {
  const router = useRouter()
  const method = METHOD_CONFIG[payment.method as keyof typeof METHOD_CONFIG]
    ?? METHOD_CONFIG.other
  const gc     = GARMENT_LABELS[payment.garmentType as keyof typeof GARMENT_LABELS]
  const isPaid = payment.orderBalance === 0

  return (
    <button
      onClick={() => router.push(`/orders/${payment.orderId}`)}
      className="w-full bg-white border border-slate-200 rounded-2xl p-4
                 text-left transition-all active:scale-[0.98] hover:border-slate-300"
    >
      <div className="flex items-start gap-3">

        {/* Method badge */}
        <div className={cn(
          'w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0',
          method.bg
        )}>
          <span className="text-xl">{method.emoji}</span>
        </div>

        {/* Centre info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="font-semibold text-slate-800 truncate">
              {payment.customerName}
            </p>
            <span className={cn(
              'text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0',
              method.bg, method.color
            )}>
              {method.label}
            </span>
          </div>

          <p className="text-xs text-slate-400">
            #{String(payment.orderNumber).padStart(3, '0')}
            {gc && ` · ${gc.emoji} ${gc.label}`}
          </p>

          <p className="text-xs text-slate-400 mt-0.5">
            {formatPaymentDate(payment.paidAt)}
          </p>

          {/* Balance remaining */}
          {!isPaid && (
            <div className="flex items-center gap-1 mt-1.5">
              <AlertCircle size={10} className="text-amber-500" />
              <span className="text-[10px] text-amber-600 font-medium">
                Rs. {payment.orderBalance.toLocaleString()} abhi baaki
              </span>
            </div>
          )}
        </div>

        {/* Amount */}
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <p className="text-lg font-bold text-green-700">
            +{payment.amount.toLocaleString()}
          </p>
          <p className="text-[10px] text-slate-400">Rs.</p>
          <ChevronRight size={13} className="text-slate-300" />
        </div>
      </div>

      {/* Progress bar: how much of order total is paid */}
      {payment.orderTotal > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <div className="flex justify-between text-[10px] text-slate-400 mb-1">
            <span>
              Rs. {(payment.orderTotal - payment.orderBalance).toLocaleString()} diya
            </span>
            <span className={isPaid ? 'text-green-600 font-semibold' : ''}>
              {isPaid
                ? 'Poora ✓'
                : `Rs. ${payment.orderBalance.toLocaleString()} baaki`}
            </span>
          </div>
          <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                isPaid ? 'bg-green-500' : 'bg-blue-500'
              )}
              style={{
                width: `${Math.min(100, Math.round(
                  ((payment.orderTotal - payment.orderBalance) / payment.orderTotal) * 100
                ))}%`
              }}
            />
          </div>
        </div>
      )}
    </button>
  )
}