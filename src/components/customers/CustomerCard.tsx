// src/components/customers/CustomerCard.tsx
'use client'

import { useRouter } from 'next/navigation'
import { Phone, MessageCircle, ChevronRight, ShoppingBag } from 'lucide-react'
import { CustomerRecord } from '@/lib/db/schema'
import { formatDistanceToNow } from 'date-fns'
import { memo } from 'react'

const GENDER_CONFIG = {
  male:   { emoji: '👨', label: 'Mard',    color: 'bg-blue-100   text-blue-700'   },
  female: { emoji: '👩', label: 'Aurat',   color: 'bg-pink-100   text-pink-700'   },
  child:  { emoji: '👦', label: 'Bachcha', color: 'bg-purple-100 text-purple-700' },
}

interface CustomerCardProps {
  customer: CustomerRecord
  orderCount?: number
  pendingBalance?: number
}

export const CustomerCard = memo(function CustomerCard({ customer, orderCount = 0, pendingBalance = 0 }: CustomerCardProps) {
  const router  = useRouter()
  const gender  = GENDER_CONFIG[customer.gender]
  const initials = customer.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  const whatsappHref = customer.whatsapp
    ? `https://wa.me/92${customer.whatsapp.replace(/^0/, '').replace(/\D/g, '')}`
    : null

  return (
    <div
      className="bg-white border border-slate-200 rounded-2xl p-4
                 transition-transform active:scale-[0.98] cursor-pointer"
      onClick={() => router.push(`/customers/${customer.id}`)}
    >
      <div className="flex items-center gap-3">

        {/* Avatar */}
        <div className="relative shrink-0">
          <div className="w-12 h-12 bg-linear-to-br from-blue-500 to-blue-700
                          rounded-full flex items-center justify-center
                          text-white font-bold text-base">
            {initials}
          </div>
          {/* Gender dot */}
          <span className="absolute -bottom-0.5 -right-0.5 text-xs">{gender.emoji}</span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-slate-800 truncate">{customer.name}</p>
            {pendingBalance > 0 && (
              <span className="text-[10px] font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full shrink-0">
                Baaki
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 mt-0.5">
            <p className="text-xs text-slate-400 flex items-center gap-1">
              <Phone size={10} />
              {customer.phone}
            </p>
            {orderCount > 0 && (
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <ShoppingBag size={10} />
                {orderCount} orders
              </p>
            )}
          </div>

          {/* Last order */}
          {customer.lastOrderAt && (
            <p className="text-[10px] text-slate-400 mt-0.5">
              Last: {formatDistanceToNow(new Date(customer.lastOrderAt), { addSuffix: true })}
            </p>
          )}
        </div>

        {/* Right side */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          {/* WhatsApp quick button */}
          {whatsappHref && (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center
                         transition-colors active:bg-green-600"
            >
              <MessageCircle size={14} className="text-white" />
            </a>
          )}
          <ChevronRight size={16} className="text-slate-300" />
        </div>
      </div>

      {/* Pending balance strip */}
      {pendingBalance > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
          <span className="text-xs text-slate-500">Baaki raqam</span>
          <span className="text-sm font-bold text-red-600">
            Rs. {pendingBalance.toLocaleString()}
          </span>
        </div>
      )}
    </div>
  )
})