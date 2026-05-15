// src/app/customers/[id]/page.tsx
'use client'

import { use, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Phone, MessageCircle, Ruler,
  ShoppingBag, Wallet, Edit3, Trash2,
  Clock, CheckCircle2,
} from 'lucide-react'
import { useCustomer } from '@/hooks/useCustomers'
import { useAuth } from '@/lib/auth/AuthContext'
import { ORDER_STATUS_CONFIG, GARMENT_LABELS } from '@/types'
import { customerOps } from '@/lib/db/operations'
import { cn } from '@/lib/utils'
import { format, formatDistanceToNow } from 'date-fns'
import { QuickPaymentSheet } from '@/components/payments/QuickPaymentSheet'
import { orderBalance, orderPaymentProgress } from '@/lib/payments/calculations'

export default function CustomerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id }   = use(params)
  const router   = useRouter()
  const { isOwner} = useAuth()
  const { customer, orders, measurements, totalSpent, pendingBalance } = useCustomer(id)
  const [paymentOrderId, setPaymentOrderId] = useState<string | null>(null)

  if (!customer) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const initials  = customer.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const waPhone   = `92${(customer.whatsapp || customer.phone).replace(/^0/, '').replace(/\D/g, '')}`
  const activeOrders  = orders.filter(o => !['delivered', 'cancelled'].includes(o.status))
  const pastOrders    = orders.filter(o =>  ['delivered', 'cancelled'].includes(o.status))
  const today         = new Date().toISOString().split('T')[0]

  const handleDelete = async () => {
    if (!confirm(`${customer.name} ko delete karna chahte hain? Yeh wapas nahi aayega.`)) return
    await customerOps.softDelete(id)
    router.push('/customers')
  }

  const buildOrderWhatsApp = (orderNum: number, balance: number) => {
    const msg = encodeURIComponent(
      `Assalam o Alaikum ${customer.name}!\n\n` +
      `Aapka order #${String(orderNum).padStart(3,'0')} tayyar ho gaya hai! ✅\n` +
      (balance > 0 ? `Baaki raqam: Rs. ${balance.toLocaleString()}\n\n` : '\n') +
      `Jaldi tashreef laaein. Shukriya! 🙏`
    )
    return `https://wa.me/${waPhone}?text=${msg}`
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-8 mb-16 lg:mb-0">

      {/* ── TOP HEADER ── */}
      <div className="bg-linear-to-br from-blue-900 to-blue-700 px-4 pt-12 pb-6">
        <div className="flex items-center justify-between mb-6">
          <button
            aria-label="Go back"
            onClick={() => router.back()}
            className="w-11 h-11 flex items-center justify-center rounded-full bg-white/20"
          >
            <ArrowLeft size={16} className="text-white" />
          </button>
          {isOwner && (
            <div className="flex gap-2">
              <button
                aria-label="Edit customer"
                onClick={() => router.push(`/customers/${id}/edit`)}
                className="w-11 h-11 flex items-center justify-center rounded-full bg-white/20"
              >
                <Edit3 size={15} className="text-white" />
              </button>
              <button
                aria-label="Delete customer"
                onClick={handleDelete}
                className="w-11 h-11 flex items-center justify-center rounded-full bg-red-500/40"
              >
                <Trash2 size={15} className="text-white" />
              </button>
            </div>
          )}
        </div>

        {/* Avatar + name */}
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center
                          text-white font-bold text-xl border-2 border-white/30">
            {initials}
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">{customer.name}</h1>
            <p className="text-blue-200 text-sm mt-0.5 flex items-center gap-1.5">
              <Phone size={11} />
              {customer.phone}
            </p>
            <p className="text-blue-300 text-xs mt-0.5 capitalize">
              {customer.gender === 'male' ? '👨 Mard' : customer.gender === 'female' ? '👩 Aurat' : '👦 Bachcha'}
            </p>
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-3 mt-5">
          {[
            { label: 'Total Orders', value: orders.length },
            { label: 'Total Diya',   value: `Rs.${(totalSpent/1000).toFixed(1)}k` },
            { label: 'Baaki',        value: pendingBalance > 0 ? `Rs.${(pendingBalance/1000).toFixed(1)}k` : '—',
              danger: pendingBalance > 0 },
          ].map(s => (
            <div key={s.label} className="bg-white/15 rounded-xl px-3 py-2.5 text-center">
              <p className={cn('font-bold text-base', s.danger ? 'text-red-300' : 'text-white')}>
                {s.value}
              </p>
              <p className="text-blue-300 text-[10px] mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── QUICK ACTIONS ── */}
      <div className="px-4 -mt-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-3">
          <div className="grid grid-cols-3 gap-2">
            <a
              href={`tel:${customer.phone}`}
              className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors"
            >
              <Phone size={18} className="text-slate-600" />
              <span className="text-[11px] font-medium text-slate-600">Call</span>
            </a>
            <a
              href={`https://wa.me/${waPhone}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-green-50 hover:bg-green-100 transition-colors"
            >
              <MessageCircle size={18} className="text-green-600" />
              <span className="text-[11px] font-medium text-green-700">WhatsApp</span>
            </a>
            <button
              onClick={() => router.push(`/customers/${id}/measurements`)}
              className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-purple-50 hover:bg-purple-100 transition-colors"
            >
              <Ruler size={18} className="text-purple-600" />
              <span className="text-[11px] font-medium text-purple-700">
                Nap ({measurements.length})
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* ── ACTIVE ORDERS ── */}
      <div className="px-4 mt-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <ShoppingBag size={16} className="text-blue-600" />
            Active Orders ({activeOrders.length})
          </h2>
          {isOwner && (
            <button
              onClick={() => router.push(`/orders/new?customerId=${id}`)}
              className="text-xs font-semibold text-blue-600"
            >
              + Naya Order
            </button>
          )}
        </div>

        {activeOrders.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center">
            <CheckCircle2 size={28} className="text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400">Koi active order nahi</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeOrders.map(order => {
              const sc      = ORDER_STATUS_CONFIG[order.status]
              const gc      = GARMENT_LABELS[order.garmentType as keyof typeof GARMENT_LABELS]
              const balance = orderBalance(order)
              const isLate  = order.dueDate < today

              return (
                <div
                  key={order.id}
                  onClick={() => router.push(`/orders/${order.id}`)}
                  className={cn(
                    'bg-white border rounded-2xl p-4 cursor-pointer active:scale-[0.98] transition-transform',
                    isLate ? 'border-red-200 bg-red-50/30' : 'border-slate-200'
                  )}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-700">
                        #{String(order.orderNumber).padStart(3, '0')}
                      </span>
                      {order.isUrgent === 1 && (
                        <span className="text-[10px] font-bold bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full">
                          URGENT
                        </span>
                      )}
                    </div>
                    <span className={cn(
                      'text-xs font-semibold px-2.5 py-1 rounded-full border flex items-center gap-1',
                      sc.bg, sc.color, sc.border
                    )}>
                      {sc.emoji} {sc.label}
                    </span>
                  </div>

                  <p className="text-sm text-slate-500 mb-2">
                    {gc?.emoji} {gc?.label}
                    {order.assignedToName && (
                      <span className="ml-2 text-blue-600">· {order.assignedToName}</span>
                    )}
                  </p>

                  {/* Payment progress */}
                  <div className="mb-2">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-500">Rs. {order.amountPaid.toLocaleString()} diya</span>
                      <span className={cn('font-semibold', balance > 0 ? 'text-red-600' : 'text-green-600')}>
                        {balance > 0 ? `Rs. ${balance.toLocaleString()} baaki` : 'Poora ✓'}
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full', balance === 0 ? 'bg-green-500' : 'bg-blue-500')}
                        style={{ width: `${orderPaymentProgress(order)}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <p className={cn('text-xs flex items-center gap-1', isLate ? 'text-red-600 font-semibold' : 'text-slate-400')}>
                      <Clock size={10} />
                      {isLate
                        ? `${formatDistanceToNow(new Date(order.dueDate))} late`
                        : format(new Date(order.dueDate), 'd MMM')}
                    </p>
                    <div className="flex items-center gap-2">
                    {isOwner && balance > 0 && (
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          setPaymentOrderId(order.id)
                        }}
                        className="flex items-center gap-1 bg-blue-50 text-blue-700 text-xs
                                   font-semibold px-3 py-1.5 rounded-full"
                      >
                        <Wallet size={11} />
                        Payment
                      </button>
                    )}
                    {order.status === 'ready' && (
                      <a
                        href={buildOrderWhatsApp(order.orderNumber, balance)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="flex items-center gap-1 bg-green-500 text-white text-xs
                                   font-semibold px-3 py-1.5 rounded-full"
                      >
                        <MessageCircle size={11} />
                        Bata Do
                      </a>
                    )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── PAST ORDERS ── */}
      {pastOrders.length > 0 && (
        <div className="px-4 mt-5">
          <h2 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
            <Wallet size={16} className="text-slate-500" />
            Purane Orders ({pastOrders.length})
          </h2>
          <div className="space-y-2">
            {pastOrders.slice(0, 5).map(order => {
              const gc = GARMENT_LABELS[order.garmentType as keyof typeof GARMENT_LABELS]
              return (
                <div
                  key={order.id}
                  onClick={() => router.push(`/orders/${order.id}`)}
                  className="bg-white border border-slate-200 rounded-xl px-4 py-3
                             flex items-center gap-3 cursor-pointer active:scale-[0.98] transition-transform"
                >
                  <span className="text-lg">{gc?.emoji || '📋'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700">
                      #{String(order.orderNumber).padStart(3,'0')} — {gc?.label}
                    </p>
                    <p className="text-xs text-slate-400">
                      {format(new Date(order.createdAt), 'd MMM yyyy')} · Rs. {order.totalPrice.toLocaleString()}
                    </p>
                  </div>
                  <span className={cn(
                    'text-xs font-medium px-2 py-1 rounded-full',
                    order.status === 'delivered' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                  )}>
                    {order.status === 'delivered' ? '✓ De Diya' : 'Cancel'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Notes */}
      {customer.notes && (
        <div className="px-4 mt-5">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <p className="text-xs font-semibold text-amber-700 mb-1">📝 Note</p>
            <p className="text-sm text-amber-800">{customer.notes}</p>
          </div>
        </div>
      )}
      {paymentOrderId && (
        <QuickPaymentSheet
          preOrder={orders.find(o => o.id === paymentOrderId)}
          onClose={() => setPaymentOrderId(null)}
          onSaved={() => setPaymentOrderId(null)}
        />
      )}
    </div>
  )
}
