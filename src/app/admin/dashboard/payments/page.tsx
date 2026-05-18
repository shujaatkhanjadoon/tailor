// src/app/admin/dashboard/payments/page.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  RefreshCw, CheckCircle2, XCircle,
  Clock, Copy, Check, MessageCircle,
  ChevronDown, ChevronUp, Inbox,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

interface Payment {
  id:            string
  shop_id:       string
  plan:          string
  billing_cycle: string
  amount_pkr:    number
  method:        string
  gateway_tx_id: string
  status:        string
  paid_at:       string
  receipt_data?: Record<string, string>
  shops?:        { shop_name: string; owner_phone: string; city?: string }
}

function PaymentCard({
  payment,
  onActivate,
  onReject,
}: {
  payment:    Payment
  onActivate: (p: Payment) => Promise<void>
  onReject:   (p: Payment, reason: string) => Promise<void>
}) {
  const [expanded,       setExpanded]       = useState(false)
  const [activating,     setActivating]     = useState(false)
  const [showReject,     setShowReject]      = useState(false)
  const [rejectReason,   setRejectReason]   = useState('')
  const [rejecting,      setRejecting]      = useState(false)
  const [copied,         setCopied]         = useState<'tx' | 'ref' | null>(null)
  const [done,           setDone]           = useState<'activated' | 'rejected' | null>(null)

  const shop = payment.shops
  const paymentRef = payment.receipt_data?.payment_ref ?? ''
  const submittedAt = payment.receipt_data?.submitted_at ?? payment.paid_at

  const copyText = (text: string, key: 'tx' | 'ref') => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const handleActivate = async () => {
    if (!confirm(`Activate: ${shop?.shop_name}?`)) return
    setActivating(true)
    try {
      await onActivate(payment)
      setDone('activated')
    } catch (e) {
      alert(`Error: ${e}`)
    } finally {
      setActivating(false)
    }
  }

  const handleReject = async () => {
    if (!rejectReason.trim()) return
    setRejecting(true)
    try {
      await onReject(payment, rejectReason.trim())
      setDone('rejected')
    } catch (e) {
      alert(`Error: ${e}`)
    } finally {
      setRejecting(false)
    }
  }

  if (done === 'activated') {
    return (
      <div className="bg-green-900/20 border border-green-700 rounded-2xl p-4
                      flex items-center gap-3">
        <CheckCircle2 size={20} className="text-green-400" />
        <div>
          <p className="font-bold text-green-300 text-sm">Activated!</p>
          <p className="text-green-400/70 text-xs">{shop?.shop_name}</p>
        </div>
        {shop?.owner_phone && (
          <a
            href={`https://wa.me/92${shop.owner_phone.replace(/^0/,'').replace(/\D/g,'')}?text=${encodeURIComponent(`Assalam o Alaikum! Aapka ${payment.plan} plan activate ho gaya. Meradarzi kholein aur use karein!`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto flex items-center gap-1.5 bg-green-800 text-green-200
                       font-bold text-xs px-3 py-2 rounded-xl"
          >
            <MessageCircle size={12} />
            Notify
          </a>
        )}
      </div>
    )
  }

  if (done === 'rejected') {
    return (
      <div className="bg-red-900/20 border border-red-700 rounded-2xl p-4
                      flex items-center gap-3">
        <XCircle size={20} className="text-red-400" />
        <p className="font-bold text-red-300 text-sm">Rejected — {shop?.shop_name}</p>
      </div>
    )
  }

  return (
    <div className="bg-slate-800 border-2 border-amber-700/50 rounded-2xl overflow-hidden">

      {/* Header */}
      <div
        className="flex items-start gap-3 p-4 cursor-pointer hover:bg-slate-700/50"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="w-9 h-9 bg-amber-900/50 rounded-xl flex items-center
                        justify-center shrink-0 mt-0.5">
          <Clock size={16} className="text-amber-400" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-bold text-slate-200 text-sm">{shop?.shop_name}</p>
          <p className="text-slate-500 text-xs font-mono mt-0.5">{shop?.owner_phone}</p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {paymentRef && (
              <span className="text-[10px] font-bold bg-amber-900 text-amber-300
                               px-2 py-0.5 rounded-full font-mono">
                Ref: {paymentRef}
              </span>
            )}
            <span className="text-[10px] font-bold bg-blue-900 text-blue-300
                             px-2 py-0.5 rounded-full">
              {payment.plan}
            </span>
            <span className="text-[10px] font-bold bg-slate-700 text-slate-300
                             px-2 py-0.5 rounded-full">
              {payment.billing_cycle}
            </span>
            <span className="text-sm font-bold text-green-400">
              Rs. {Number(payment.amount_pkr).toLocaleString()}
            </span>
          </div>
        </div>

        {expanded
          ? <ChevronUp  size={16} className="text-slate-500 shrink-0 mt-1" />
          : <ChevronDown size={16} className="text-slate-500 shrink-0 mt-1" />
        }
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-700 pt-3 space-y-3">

          {/* Matching references */}
          <div className="grid gap-2">
            {[
              { key: 'ref' as const, label: 'App Payment Reference', value: paymentRef },
              { key: 'tx' as const, label: 'Bank Transaction ID', value: payment.gateway_tx_id },
            ].map(({ key, label, value }) => (
              <div
                key={key}
                className="flex items-center justify-between bg-slate-700/50
                           rounded-xl px-3 py-2.5 gap-3"
              >
                <div className="min-w-0">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide font-bold">
                    {label}
                  </p>
                  <p className="mt-0.5 break-words font-mono text-sm font-bold text-slate-200">
                    {value || '—'}
                  </p>
                </div>
                {value && (
                  <button
                    onClick={() => copyText(value, key)}
                    className={cn(
                      'shrink-0 flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl',
                      copied === key
                        ? 'bg-green-500 text-white'
                        : 'bg-slate-600 text-slate-200 hover:bg-slate-500'
                    )}
                  >
                    {copied === key ? <Check size={11} /> : <Copy size={11} />}
                    {copied === key ? 'Copied!' : 'Copy'}
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Other details */}
          <div className="grid grid-cols-1 gap-2 text-xs min-[420px]:grid-cols-2">
            {[
              { label: 'Shop',        value: shop?.shop_name ?? '—' },
              { label: 'Phone',       value: shop?.owner_phone ?? '—' },
              { label: 'Payer',       value: payment.receipt_data?.payer_name  ?? '—' },
              { label: 'Submitted',   value: submittedAt ? format(new Date(submittedAt), 'd MMM, h:mm a') : '—' },
              { label: 'Method',      value: payment.method ?? 'raast' },
            ].map(({ label, value }) => (
              <div key={label} className="bg-slate-700/30 rounded-xl px-3 py-2">
                <p className="text-slate-500 text-[10px] font-bold uppercase">{label}</p>
                <p className="text-slate-300 font-medium mt-0.5 truncate">{value}</p>
              </div>
            ))}
          </div>

          <div className="bg-amber-950/30 border border-amber-800 rounded-xl px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-amber-400 mb-1">
              Verify Against Bank Statement
            </p>
            <p className="text-xs text-amber-200/80 leading-relaxed">
              Match amount Rs. {Number(payment.amount_pkr).toLocaleString()}, app reference{' '}
              <span className="font-mono font-bold">{paymentRef || '—'}</span>, and bank
              transaction ID <span className="font-mono font-bold">{payment.gateway_tx_id || '—'}</span>.
            </p>
          </div>

          {/* Reject form */}
          {showReject && (
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Reason (e.g. TxID not found, wrong amount)..."
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                className="w-full bg-red-950/30 border border-red-800 text-red-200
                           rounded-xl px-3 py-2.5 text-sm outline-none
                           placeholder:text-red-800"
              />
              <div className="flex flex-col gap-2 min-[420px]:flex-row">
                <button
                  onClick={handleReject}
                  disabled={!rejectReason.trim() || rejecting}
                  className="flex-1 bg-red-700 disabled:bg-slate-700 text-white
                             font-bold py-2.5 rounded-xl text-sm flex items-center
                             justify-center gap-2"
                >
                  {rejecting
                    ? <RefreshCw size={14} className="animate-spin" />
                    : <XCircle  size={14} />
                  }
                  Reject
                </button>
                <button
                  onClick={() => { setShowReject(false); setRejectReason('') }}
                  className="px-4 py-2.5 bg-slate-700 text-slate-300 font-semibold
                             rounded-xl text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Action buttons */}
          {!showReject && (
            <div className="flex flex-col gap-2 min-[420px]:flex-row">
              <button
                onClick={handleActivate}
                disabled={activating}
                className="flex-1 bg-green-700 hover:bg-green-600 disabled:bg-slate-700
                           text-white font-bold py-3 rounded-xl text-sm transition-colors
                           flex items-center justify-center gap-2"
              >
                {activating
                  ? <RefreshCw  size={15} className="animate-spin" />
                  : <CheckCircle2 size={15} />
                }
                {activating ? 'Activating...' : 'Activate ✓'}
              </button>
              <button
                onClick={() => setShowReject(true)}
                className="flex-1 bg-red-900/40 hover:bg-red-900/60 text-red-400
                           border border-red-800 font-bold py-3 rounded-xl text-sm
                           flex items-center justify-center gap-2 transition-colors"
              >
                <XCircle size={15} />
                Reject
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res  = await fetch('/api/admin/data?type=pending')
      if (res.status === 401) { window.location.href = '/admin/login'; return }
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setPayments(data.data ?? [])
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load] )

  const handleActivate = async (p: Payment) => {
    const res  = await fetch('/api/admin/action', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        action:    'activate_payment',
        paymentId: p.id,
        shopId:    p.shop_id,
        planId:    p.plan,
        cycle:     p.billing_cycle,
        amountPkr: p.amount_pkr,
      }),
    })
    const data = await res.json()
    if (!data.success) throw new Error(data.error ?? 'Activation failed')
  }

  const handleReject = async (p: Payment, reason: string) => {
    const res  = await fetch('/api/admin/action', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        action:    'reject_payment',
        paymentId: p.id,
        shopId:    p.shop_id,
        reason,
      }),
    })
    const data = await res.json()
    if (!data.success) throw new Error(data.error ?? 'Reject failed')
    setPayments(prev => prev.filter(x => x.id !== p.id))
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">

      <div className="flex flex-col gap-3 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-white">Payments</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {loading ? 'Loading...' : `${payments.length} pending verification`}
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700
                     text-slate-300 font-semibold px-3 py-2 rounded-xl text-sm"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-2xl p-4">
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-slate-800 border border-slate-700
                                    rounded-2xl h-20 animate-pulse" />
          ))}
        </div>
      )}

      {!loading && payments.length === 0 && (
        <div className="flex flex-col items-center py-16 text-center">
          <div className="w-14 h-14 bg-green-900/30 rounded-full flex items-center
                          justify-center mb-4">
            <CheckCircle2 size={28} className="text-green-500" />
          </div>
          <p className="font-bold text-white mb-1">Sab Clear!</p>
          <p className="text-slate-400 text-sm">Koi pending payment nahi</p>
        </div>
      )}

      {!loading && payments.length > 0 && (
        <div className="space-y-3">
          {payments.map(p => (
            <PaymentCard
              key={p.id}
              payment={p}
              onActivate={handleActivate}
              onReject={handleReject}
            />
          ))}
        </div>
      )}
    </div>
  )
}
