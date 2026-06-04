// src/components/billing/PaymentVerificationCard.tsx
'use client'

import { useState }   from 'react'
import {
  CheckCircle2, XCircle, MessageCircle,
  Copy, Check, ChevronDown, ChevronUp,
  Loader2, Clock, AlertCircle,
} from 'lucide-react'
import { activateSubscription, rejectPayment } from '@/lib/billing/admin'
import { buildActivationWhatsApp, buildRejectionWhatsApp } from '@/lib/billing/whatsapp-notify'
import { PLANS, PlanId } from '@/lib/billing/plans'
import { subscriptionExpiresAt } from '@/lib/billing/cycles'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

interface PaymentVerificationCardProps {
  payment:   any
  onUpdated: () => void
}

export function PaymentVerificationCard({ payment, onUpdated }: PaymentVerificationCardProps) {
  const [expanded,       setExpanded]       = useState(false)
  const [activating,     setActivating]     = useState(false)
  const [rejecting,      setRejecting]      = useState(false)
  const [rejectReason,   setRejectReason]   = useState('')
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [result,         setResult]         = useState<'activated' | 'rejected' | null>(null)
  const [copied,         setCopied]         = useState(false)

  const shop     = payment.shops
  const planDef  = PLANS[payment.plan as PlanId]

  const copyTxId = async () => {
    await navigator.clipboard.writeText(payment.gateway_tx_id ?? '').catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleActivate = async () => {
    if (!confirm(`Activate karein: ${shop?.shop_name}?`)) return
    setActivating(true)

    const res = await activateSubscription(
      payment.id,
      payment.plan,
      payment.billing_cycle,
      payment.amount_pkr,
      payment.shop_id,
    )

    setActivating(false)

    if (res.success) {
      setResult('activated')
      // Open WhatsApp in new tab to notify shop owner
      if (res.shopPhone) {
        const expiresAt = subscriptionExpiresAt(payment.billing_cycle)
        const waLink = buildActivationWhatsApp(
          res.shopPhone,
          res.shopName ?? 'Shop',
          planDef?.name ?? payment.plan,
          payment.billing_cycle,
          expiresAt,
        )
        window.open(waLink, '_blank')
      }
      setTimeout(onUpdated, 1500)
    }
  }

  const handleReject = async () => {
    if (!rejectReason.trim()) return
    setRejecting(true)

    const res = await rejectPayment(payment.id, rejectReason.trim())
    setRejecting(false)

    if (res.success) {
      setResult('rejected')
      if (res.shopPhone) {
        const waLink = buildRejectionWhatsApp(res.shopPhone, rejectReason.trim())
        window.open(waLink, '_blank')
      }
      setTimeout(onUpdated, 1500)
    }
  }

  if (result === 'activated') {
    return (
      <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3">
        <CheckCircle2 size={20} className="text-green-600" />
        <p className="text-green-700 font-semibold text-sm">
          ✓ {shop?.shop_name} — Activated! WhatsApp khul gaya.
        </p>
      </div>
    )
  }

  if (result === 'rejected') {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3">
        <XCircle size={20} className="text-red-500" />
        <p className="text-red-700 font-semibold text-sm">
          ✗ {shop?.shop_name} — Rejected. WhatsApp khul gaya.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white border-2 border-amber-200 rounded-2xl overflow-hidden">

      {/* Header */}
      <div className="flex items-start justify-between px-5 py-4 bg-amber-50">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center
                          justify-center shrink-0 mt-0.5">
            <Clock size={18} className="text-amber-600" />
          </div>
          <div>
            <p className="font-bold text-slate-800">{shop?.shop_name ?? 'Unknown Shop'}</p>
            <p className="text-xs text-slate-500 mt-0.5 font-mono">
              {shop?.owner_phone} · {shop?.city ?? 'N/A'}
            </p>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                {planDef?.emoji} {planDef?.name ?? payment.plan}
              </span>
              <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                {payment.billing_cycle}
              </span>
              <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                Rs. {Number(payment.amount_pkr).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={() => setExpanded(v => !v)}
          className="text-slate-400 hover:text-slate-600 transition-colors mt-1"
        >
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
      </div>

      {/* Transaction details */}
      <div className="px-5 py-4 border-t border-amber-100 space-y-3">

        {/* TX ID */}
        <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
          <div>
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">
              Transaction ID
            </p>
            <p className="font-mono font-bold text-slate-800 text-sm mt-0.5">
              {payment.gateway_tx_id ?? '—'}
            </p>
          </div>
          <button
            onClick={copyTxId}
            className={cn(
              'flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl transition-all',
              copied ? 'bg-green-500 text-white' : 'bg-white border border-slate-200 text-slate-700'
            )}
          >
            {copied ? <Check size={11} /> : <Copy size={11} />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>

        {/* Payment reference */}
        {payment.receipt_data?.payment_ref && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">Payment Ref</p>
            <p className="font-mono text-xs font-bold text-slate-700">
              {payment.receipt_data.payment_ref}
            </p>
          </div>
        )}

        {/* Payer name */}
        {payment.receipt_data?.payer_name && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">Payer Name</p>
            <p className="text-xs font-semibold text-slate-700">
              {payment.receipt_data.payer_name}
            </p>
          </div>
        )}

        {/* Submitted at */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">Submitted</p>
          <p className="text-xs font-semibold text-slate-700">
            {format(new Date(payment.paid_at), 'd MMM yyyy, h:mm a')}
          </p>
        </div>

        {/* Expanded: more details */}
        {expanded && (
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500">Shop ID</p>
              <p className="font-mono text-[10px] text-slate-400">{payment.shop_id}</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500">Payment ID</p>
              <p className="font-mono text-[10px] text-slate-400">{payment.id}</p>
            </div>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="px-5 py-4 border-t border-amber-100 space-y-3">

        {/* Reject form */}
        {showRejectForm && (
          <div className="space-y-2">
            <input
              type="text"
              placeholder="Rejection reason (e.g. TxID not found, wrong amount)"
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              className="w-full px-4 py-3 bg-red-50 border border-red-200 rounded-xl
                         text-sm outline-none focus:border-red-400"
            />
            <div className="flex gap-2">
              <button
                onClick={handleReject}
                disabled={!rejectReason.trim() || rejecting}
                className="flex-1 bg-red-600 disabled:bg-slate-300 text-white font-bold
                           py-3 rounded-xl text-sm flex items-center justify-center gap-2"
              >
                {rejecting ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                Reject + WhatsApp
              </button>
              <button
                onClick={() => setShowRejectForm(false)}
                className="px-4 py-3 bg-slate-100 text-slate-600 font-semibold rounded-xl text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {!showRejectForm && (
          <div className="flex gap-2">
            {/* Activate */}
            <button
              onClick={handleActivate}
              disabled={activating}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-slate-300
                         text-white font-bold py-3.5 rounded-xl text-sm
                         flex items-center justify-center gap-2 transition-colors active:scale-[0.98]"
            >
              {activating ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <CheckCircle2 size={15} />
              )}
              {activating ? 'Activating...' : 'Activate + Notify'}
            </button>

            {/* Reject */}
            <button
              onClick={() => setShowRejectForm(true)}
              className="flex-1 bg-red-50 hover:bg-red-100 text-red-700 font-bold
                         py-3.5 rounded-xl text-sm flex items-center justify-center gap-2
                         border border-red-200 transition-colors"
            >
              <XCircle size={15} />
              Reject
            </button>
          </div>
        )}

        {/* Quick WhatsApp link */}
        {shop?.owner_phone && (
          <a
            href={`https://wa.me/92${shop.owner_phone.replace(/^0/, '').replace(/\D/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 bg-green-50
                       border border-green-200 text-green-700 font-semibold py-2.5
                       rounded-xl text-xs hover:bg-green-100 transition-colors"
          >
            <MessageCircle size={13} />
            {shop?.shop_name} ko WhatsApp karein
          </a>
        )}
      </div>
    </div>
  )
}
