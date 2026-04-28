// src/app/orders/[id]/page.tsx
'use client'

import { use, useState } from 'react'
import { useRouter } from 'next/navigation'
import { QuickPaymentSheet } from '@/components/payments/QuickPaymentSheet'
import { QRCodeDisplay } from '@/components/orders/QRCodeDisplay'
import {
  ArrowLeft, MessageCircle, Clock, Wallet,
  User2, QrCode, ChevronRight, Plus,
} from 'lucide-react'
import { useOrder } from '@/hooks/useOrders'
import { useAuth } from '@/lib/auth/AuthContext'
import { paymentOps } from '@/lib/db/operations'
import { ORDER_STATUS_CONFIG, GARMENT_LABELS, OrderStatus } from '@/types'
import { StatusUpdateSheet } from '@/components/orders/StatusUpdateSheet'
import { AssignSheet } from '@/components/orders/AssignSheet'
import { OrderPhotoSection } from '@/components/photos/OrderPhotoSection'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { FeatureGate } from '@/components/billing/FeatureGate'
import { usePlan } from '@/hooks/usePlan'

const PAYMENT_METHODS = [
  { key: 'cash', label: 'Cash', emoji: '💵' },
  { key: 'easypaisa', label: 'Easypaisa', emoji: '📱' },
  { key: 'jazzcash', label: 'JazzCash', emoji: '📲' },
  { key: 'bank', label: 'Bank', emoji: '🏦' },
] as const

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { isOwner, currentUser } = useAuth()
  const plan = usePlan()
  const { order, payments, history, balance } = useOrder(id)

  const [showStatusSheet, setShowStatusSheet] = useState(false)
  const [showAssignSheet, setShowAssignSheet] = useState(false)
  const [showPayForm, setShowPayForm] = useState(false)
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState<'cash' | 'easypaisa' | 'jazzcash' | 'bank'>('cash')
  const [savingPay, setSavingPay] = useState(false)
  const [showPaySheet, setShowPaySheet] = useState(false)
  const [showQR, setShowQR] = useState(false)

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const sc = ORDER_STATUS_CONFIG[order.status as OrderStatus]
  const gc = GARMENT_LABELS[order.garmentType as keyof typeof GARMENT_LABELS]
  const isTerminal = ['delivered', 'cancelled'].includes(order.status)
  const today = new Date().toISOString().split('T')[0]
  const isOverdue = order.dueDate < today && !isTerminal
  const progress = order.totalPrice > 0
    ? Math.min(100, Math.round((order.amountPaid / order.totalPrice) * 100))
    : 0

  const waLink = (() => {
    const phone = `92${order.customerPhone.replace(/^0/, '').replace(/\D/g, '')}`
    const msg = encodeURIComponent(
      `Assalam o Alaikum ${order.customerName}!\n\n` +
      `Aapka order #${String(order.orderNumber).padStart(3, '0')} tayyar ho gaya hai! ✅\n` +
      (balance > 0 ? `Baaki raqam: Rs.${balance.toLocaleString()}\n\n` : '\n') +
      `Jaldi tashreef laaein. Shukriya! 🙏`
    )
    return `https://wa.me/${phone}?text=${msg}`
  })()

  const handleAddPayment = async () => {
    const amt = parseInt(payAmount)
    if (!amt || amt <= 0 || !currentUser) return
    setSavingPay(true)
    try {
      await paymentOps.add(order.shopId, {
        orderId: order.id,
        amount: amt,
        method: payMethod,
        recordedBy: currentUser.id,
      })
      setPayAmount('')
      setShowPayForm(false)
    } finally {
      setSavingPay(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-8">

      {/* Header */}
      <div className={cn(
        'px-4 pt-12 pb-5',
        isOverdue ? 'bg-red-700' : 'bg-linear-to-br from-blue-900 to-blue-700'
      )}>
        <div className="flex items-center justify-between mb-5">
          <FeatureGate feature="qr_code" mode="inline">
          {/* QR Code button */}
          <button
            onClick={() => setShowQR(true)}
            className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30
               text-white text-sm font-semibold px-3 py-2 rounded-xl transition-colors"
          >
            <QrCode size={16} />
            QR
          </button>
          </FeatureGate>
          <button
            aria-label="Go back"
            onClick={() => router.back()}
            className="w-11 h-11 flex items-center justify-center rounded-full bg-white/20"
          >
            <ArrowLeft size={16} className="text-white" />
          </button>
          {order.status === 'ready' && (
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 bg-green-500 text-white
                         text-sm font-semibold px-4 py-2 rounded-xl"
            >
              <MessageCircle size={14} />
              Gahak Ko Batao
            </a>
          )}
        </div>

        {/* Order title */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-white/70 text-sm">
              Order #{String(order.orderNumber).padStart(3, '0')}
              {order.isUrgent === 1 && (
                <span className="ml-2 text-orange-300 font-bold">⚡ URGENT</span>
              )}
            </p>
            <h1 className="text-xl font-bold text-white mt-0.5">{order.customerName}</h1>
            <p className="text-white/60 text-sm mt-0.5">
              {gc?.emoji} {gc?.label}
            </p>
          </div>

          {/* Status badge — tappable */}
          <button
            onClick={() => !isTerminal && setShowStatusSheet(true)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-bold',
              sc.bg, sc.color, sc.border,
              !isTerminal ? 'active:scale-95 transition-transform' : ''
            )}
          >
            {sc.emoji} {sc.label}
            {!isTerminal && <span className="text-[10px] opacity-60">▾</span>}
          </button>
        </div>
      </div>

      <div className="px-4 space-y-4 pt-4">

        {/* PAYMENT CARD */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                <Wallet size={15} className="text-blue-600" />
                Payment
              </h2>
              {isOwner && !isTerminal && (
                <button
                  onClick={() => setShowPaySheet(true)}
                  className="text-xs font-semibold text-blue-600 flex items-center gap-1"
                >
                  <Plus size={12} />
                  Raqam Lo
                </button>
              )}

              {showPaySheet && (
                <QuickPaymentSheet
                  preOrder={order}
                  onClose={() => setShowPaySheet(false)}
                  onSaved={() => setShowPaySheet(false)}
                />
              )}
            </div>

            {/* Total / paid / balance row */}
            <div className="grid grid-cols-3 gap-3 mb-3">
              {[
                { label: 'Kul Qeemat', value: `Rs.${order.totalPrice.toLocaleString()}`, color: 'text-slate-800' },
                { label: 'Diya', value: `Rs.${order.amountPaid.toLocaleString()}`, color: 'text-green-700' },
                {
                  label: 'Baaki', value: balance > 0 ? `Rs.${balance.toLocaleString()}` : '—',
                  color: balance > 0 ? 'text-red-600' : 'text-slate-400'
                },
              ].map(s => (
                <div key={s.label} className="text-center bg-slate-50 rounded-xl p-2.5">
                  <p className={cn('font-bold text-sm', s.color)}>{s.value}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Progress bar */}
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all', progress === 100 ? 'bg-green-500' : 'bg-blue-500')}
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-right text-xs text-slate-400 mt-1">{progress}%</p>

            {/* Payment form */}
            {showPayForm && isOwner && (
              <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                <div className="flex items-center gap-2 bg-slate-50 border-2 border-slate-200
                                rounded-xl px-4 py-3 focus-within:border-blue-500 transition-colors">
                  <span className="text-slate-400 font-medium text-sm shrink-0">Rs.</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder={`Max: ${balance.toLocaleString()}`}
                    value={payAmount}
                    onChange={e => setPayAmount(e.target.value)}
                    className="flex-1 text-lg font-bold text-slate-800 bg-transparent outline-none"
                  />
                </div>

                {/* Quick amounts */}
                <div className="flex gap-2">
                  {[500, 1000, balance].filter(a => a > 0).slice(0, 3).map(amt => (
                    <button
                      key={amt}
                      onClick={() => setPayAmount(String(amt))}
                      className={cn(
                        'flex-1 py-2 text-xs font-semibold rounded-xl border transition-colors',
                        parseInt(payAmount) === amt
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-slate-600 border-slate-200'
                      )}
                    >
                      {amt === balance ? 'Baaki Sab' : `${amt >= 1000 ? amt / 1000 + 'k' : amt}`}
                    </button>
                  ))}
                </div>

                {/* Payment method */}
                <div className="grid grid-cols-4 gap-2">
                  {PAYMENT_METHODS.map(({ key, label, emoji }) => (
                    <button
                      key={key}
                      onClick={() => setPayMethod(key)}
                      className={cn(
                        'flex flex-col items-center gap-1 py-2.5 rounded-xl border-2 transition-colors',
                        payMethod === key ? 'border-blue-500 bg-blue-50' : 'border-slate-200'
                      )}
                    >
                      <span className="text-base">{emoji}</span>
                      <span className="text-[10px] font-semibold text-slate-600">{label}</span>
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleAddPayment}
                  disabled={!payAmount || parseInt(payAmount) <= 0 || savingPay}
                  className="w-full bg-green-600 disabled:bg-slate-300 text-white
                             font-bold py-3.5 rounded-xl transition-colors"
                >
                  {savingPay ? 'Save ho raha hai...' : `Rs.${parseInt(payAmount || '0').toLocaleString()} Record Karein ✓`}
                </button>
              </div>
            )}

            {/* Payment history */}
            {payments.length > 0 && (
              <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Payment History
                </p>
                {payments.map(p => (
                  <div key={p.id} className="flex items-center justify-between py-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-base">
                        {p.method === 'cash' ? '💵' : p.method === 'easypaisa' ? '📱' : p.method === 'jazzcash' ? '📲' : '🏦'}
                      </span>
                      <div>
                        <p className="text-xs font-semibold text-slate-700 capitalize">{p.method}</p>
                        <p className="text-[10px] text-slate-400">
                          {format(new Date(p.paidAt), 'd MMM, h:mm a')}
                        </p>
                      </div>
                    </div>
                    <p className="font-bold text-green-700 text-sm">
                      +Rs.{p.amount.toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ORDER DETAILS CARD */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
          <h2 className="font-bold text-slate-800 text-sm">Order Details</h2>

          {[
            {
              icon: Clock,
              label: 'Due Date',
              value: format(new Date(order.dueDate), 'EEEE, d MMMM yyyy'),
              valueClass: isOverdue ? 'text-red-600 font-bold' : 'text-slate-700',
            },
            {
              icon: User2,
              label: 'Assigned To',
              value: order.assignedToName || 'Kisi Ko Assign Nahi',
              valueClass: order.assignedToName ? 'text-blue-700 font-medium' : 'text-slate-400',
            },
          ].map(({ icon: Icon, label, value, valueClass }) => (
            <div key={label} className="flex items-center gap-3">
              <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center shrink-0">
                <Icon size={14} className="text-slate-500" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-slate-400">{label}</p>
                <p className={cn('text-sm', valueClass)}>{value}</p>
              </div>
            </div>
          ))}

          {/* Assign button */}
          {isOwner && !isTerminal && plan.canAddKarigar && (
            <button
              onClick={() => setShowAssignSheet(true)}
              className="w-full flex items-center justify-between bg-blue-50 border
                         border-blue-200 rounded-xl px-4 py-3 mt-1 active:scale-[0.98] transition-transform"
            >
              <span className="text-sm font-semibold text-blue-700">
                {order.assignedToName ? 'Karigar Badlein' : 'Karigar Assign Karein'}
              </span>
              <ChevronRight size={16} className="text-blue-400" />
            </button>
          )}
          {isOwner && !isTerminal && !plan.canAddKarigar && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mt-1">
              <p className="text-sm font-semibold text-blue-800">
                Karigar assignment Professional plan mein available hai.
              </p>
              <button
                onClick={() => plan.upgrade('professional')}
                className="text-xs font-bold text-blue-700 underline mt-1"
              >
                Upgrade karein
              </button>
            </div>
          )}

          {/* Special instructions */}
          {order.specialInstructions && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mt-1">
              <p className="text-xs font-semibold text-amber-700 mb-1">📝 Khaas Hidayat</p>
              <p className="text-sm text-amber-800">{order.specialInstructions}</p>
            </div>
          )}
        </div>

        {/* STATUS HISTORY */}
        {history.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <h2 className="font-bold text-slate-800 text-sm mb-3">Status History</h2>
            <div className="space-y-2">
              {history.map((h, i) => {
                const oldCfg = ORDER_STATUS_CONFIG[h.oldStatus as OrderStatus]
                const newCfg = ORDER_STATUS_CONFIG[h.newStatus as OrderStatus]
                return (
                  <div key={h.id} className="flex items-center gap-2 text-xs">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0 mt-0.5" />
                    <span className="text-slate-500">
                      {oldCfg?.emoji} {oldCfg?.label}
                    </span>
                    <span className="text-slate-300">→</span>
                    <span className={cn('font-semibold', newCfg?.color)}>
                      {newCfg?.emoji} {newCfg?.label}
                    </span>
                    <span className="text-slate-400 ml-auto shrink-0">
                      {format(new Date(h.changedAt), 'd MMM')}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

      </div>

      <OrderPhotoSection orderId={id} />

      {/* Sheets */}
      {showStatusSheet && (
        <StatusUpdateSheet
          order={order}
          onClose={() => setShowStatusSheet(false)}
          onUpdate={() => setShowStatusSheet(false)}
        />
      )}
      {showAssignSheet && (
        <AssignSheet
          orderId={order.id}
          currentAssignee={order.assignedTo}
          onClose={() => setShowAssignSheet(false)}
          onAssigned={() => setShowAssignSheet(false)}
        />
      )}

      {showQR && (
        <QRCodeDisplay
          orderNumber={order.orderNumber}
          customerName={order.customerName}
          customerPhone={order.customerPhone}
          trackingCode={order.trackingCode}
          onClose={() => setShowQR(false)}
        />
      )}
    </div>
  )
}
