// src/components/billing/RaastPaymentSheet.tsx
'use client'

import { useState, useEffect } from 'react'
import { X, Copy, Check, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth/AuthContext'
import { usePlan } from '@/hooks/usePlan'
import {
  RAAST_CONFIG, generatePaymentRef,
  buildRaastQRData, buildPaymentNote,
} from '@/lib/billing/raast'
import { PLANS, PlanId } from '@/lib/billing/plans'
import { cn } from '@/lib/utils'

interface RaastPaymentSheetProps {
  planId: PlanId
  cycle: 'monthly' | 'yearly'
  amountPkr: number
  onClose: () => void
  onSubmitted: () => void
}

type SheetStep = 'payment' | 'confirm' | 'submitted'

export function RaastPaymentSheet({
  planId, cycle, amountPkr, onClose, onSubmitted,
}: RaastPaymentSheetProps) {
  const { shopId } = useAuth()
  const plan = usePlan()
  const [step, setStep] = useState<SheetStep>('payment')
  const [payerName, setPayerName] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [copied, setCopied] = useState<'id' | 'amount' | null>(null)

  const [paymentRef] = useState(() => generatePaymentRef(shopId ?? 'SHOP'))
  const targetPlan = PLANS[planId]
  const qrData = buildRaastQRData(RAAST_CONFIG, amountPkr, paymentRef)
  const paymentNote = buildPaymentNote(planId, cycle, paymentRef)
  const [txIdMode, setTxIdMode] = useState<'ref' | 'bank'>('ref')
  const [txId, setTxId] = useState(paymentRef) 

  const copyToClipboard = async (text: string, key: 'id' | 'amount') => {
    await navigator.clipboard.writeText(text).catch(() => { })
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const handleSubmit = async () => {
    if (txId.trim().length < 4) {
      setError('Transaction ID daalein')
      return
    }
    if (!shopId) {
      setError('Shop ID missing — please refresh')
      return
    }

    setError('')
    setSubmitting(true)

    try {
      // First ensure subscription row exists (starter plan)
      await (supabase as any)
        .from('subscriptions')
        .upsert({
          shop_id: shopId,
          plan: 'starter',
          status: 'active',
          trial_ends_at: null,
          expires_at: null,
          billing_cycle: null,
          amount_pkr: null,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'shop_id',
          ignoreDuplicates: true,
        })

      // Insert payment record
      const { error: payErr } = await (supabase as any)
        .from('subscription_payments')
        .insert({
          shop_id: shopId,
          plan: planId,
          billing_cycle: cycle,
          amount_pkr: amountPkr,
          method: 'raast',
          gateway_tx_id: txId.trim(),
          status: 'pending',
          receipt_data: {
            payment_ref: paymentRef,
            payer_name: payerName.trim() || null,
            raast_id: RAAST_CONFIG.raastId,
            submitted_at: new Date().toISOString(),
          },
        })

      if (payErr) {
        console.error('[Payment] Insert error:', payErr)
        setError(`Error: ${payErr.message}`)
        return
      }

      setStep('submitted')
      setTimeout(() => {
        onSubmitted()
        onClose()
      }, 2500)

    } catch (e) {
      console.error('[Payment] Submit error:', e)
      setError(`Submit fail: ${String(e)}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center lg:items-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        className="relative w-full max-w-115 bg-white rounded-t-3xl lg:rounded-2xl
                   shadow-2xl z-10 max-h-[92vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mt-3 shrink-0 lg:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4
                        border-b border-slate-100 shrink-0">
          <div>
            <h3 className="font-bold text-slate-800">
              {step === 'submitted' ? 'Payment Submit Ho Gaya!' : 'Raast Se Payment Karein'}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {targetPlan.emoji} {targetPlan.name} · Rs. {amountPkr.toLocaleString()} · {cycle}
            </p>
          </div>
          <button
            aria-label="Close payment sheet"
            onClick={onClose}
            className="w-11 h-11 flex items-center justify-center rounded-full bg-slate-100"
          >
            <X size={15} className="text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-5">

          {/* ── SUBMITTED SUCCESS ── */}
          {step === 'submitted' && (
            <div className="flex flex-col items-center py-8 text-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center
                              justify-center mb-5">
                <CheckCircle2 size={40} className="text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">
                Shukriya! 🙏
              </h3>
              <p className="text-slate-500 text-sm leading-relaxed max-w-xs">
                Aapki payment request humein mil gayi hai. Hum{' '}
                <strong>24 ghante</strong> mein verify kar ke aapka plan activate kar denge.
              </p>
              <div className="mt-5 bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3 w-full">
                <p className="text-xs text-blue-700 font-medium">
                  📱 Confirmation WhatsApp par bhi bheja jayega
                </p>
              </div>
            </div>
          )}

          {/* ── PAYMENT STEP ── */}
          {step === 'payment' && (
            <div className="space-y-5">

              {/* Payment reference */}
              <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
                <p className="text-xs font-bold text-amber-700 mb-1">
                  ⚠️ Payment Reference (zaroor daalein)
                </p>
                <div className="flex items-center justify-between">
                  <code className="text-base font-bold text-amber-800 tracking-wider">
                    {paymentRef}
                  </code>
                  <button
                    onClick={() => copyToClipboard(paymentRef, 'id')}
                    className="text-xs text-amber-600 font-semibold flex items-center gap-1"
                  >
                    {copied === 'id' ? <Check size={12} /> : <Copy size={12} />}
                    {copied === 'id' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <p className="text-[10px] text-amber-600 mt-1">
                  Payment description mein yeh reference daalein taake hum verify kar sakein
                </p>
              </div>

              {/* QR Code */}
              <div className="flex flex-col items-center">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                  Raast QR Scan Karein
                </p>
                <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 shadow-sm">
                  <QRCodeSVG
                    value={qrData}
                    size={180}
                    level="M"
                    includeMargin={false}
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-2 text-center">
                  Bank app → Raast → Scan QR
                </p>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-xs text-slate-400 font-medium">ya Raast ID se</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>

              {/* Raast ID */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-400 font-medium">Raast ID</p>
                    <p className="text-lg font-bold text-slate-800 font-mono">
                      {RAAST_CONFIG.raastId}
                    </p>
                  </div>
                  <button
                    onClick={() => copyToClipboard(RAAST_CONFIG.raastId, 'id')}
                    className={cn(
                      'flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl transition-all',
                      copied === 'id'
                        ? 'bg-green-500 text-white'
                        : 'bg-white border border-slate-200 text-slate-700'
                    )}
                  >
                    {copied === 'id' ? <Check size={12} /> : <Copy size={12} />}
                    {copied === 'id' ? 'Copied!' : 'Copy'}
                  </button>
                </div>

                <div className="h-px bg-slate-200" />

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-400 font-medium">Account Name</p>
                    <p className="text-sm font-semibold text-slate-800">
                      {RAAST_CONFIG.accountTitle}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400 font-medium">Bank</p>
                    <p className="text-sm font-semibold text-slate-800">
                      {RAAST_CONFIG.bankName}
                    </p>
                  </div>
                </div>

                <div className="h-px bg-slate-200" />

                {/* Amount */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-400 font-medium">Amount</p>
                    <p className="text-2xl font-bold text-slate-800">
                      Rs. {amountPkr.toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={() => copyToClipboard(String(amountPkr), 'amount')}
                    className={cn(
                      'flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl transition-all',
                      copied === 'amount'
                        ? 'bg-green-500 text-white'
                        : 'bg-white border border-slate-200 text-slate-700'
                    )}
                  >
                    {copied === 'amount' ? <Check size={12} /> : <Copy size={12} />}
                    {copied === 'amount' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              {/* Step-by-step instructions */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                  Kaise karein:
                </p>
                {RAAST_CONFIG.instructions.map((instruction, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <div className="w-5 h-5 bg-blue-100 text-blue-700 rounded-full
                                    flex items-center justify-center text-[10px] font-bold
                                    shrink-0 mt-0.5">
                      {i + 1}
                    </div>
                    <p className="text-sm text-slate-600 leading-snug">{instruction}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 'confirm' && (
            <div className="space-y-4">

              <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3">
                <p className="text-sm font-bold text-green-800 mb-0.5">
                  ✓ Payment kar li? Bilkul sahi!
                </p>
                <p className="text-xs text-green-600">
                  Ab neeche confirm karein.
                </p>
              </div>

              {/* Reference mode toggle */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Transaction Confirm Karein
                </label>
                <div className="flex bg-slate-100 rounded-xl p-1 mb-3">
                  <button
                    onClick={() => { setTxIdMode('ref'); setTxId(paymentRef) }}
                    className={cn(
                      'flex-1 py-2 rounded-lg text-xs font-semibold transition-all',
                      txIdMode === 'ref'
                        ? 'bg-white text-slate-800 shadow-sm'
                        : 'text-slate-500'
                    )}
                  >
                    Reference Number Use Karein
                  </button>
                  <button
                    onClick={() => { setTxIdMode('bank'); setTxId('') }}
                    className={cn(
                      'flex-1 py-2 rounded-lg text-xs font-semibold transition-all',
                      txIdMode === 'bank'
                        ? 'bg-white text-slate-800 shadow-sm'
                        : 'text-slate-500'
                    )}
                  >
                    Bank TxID Daalein
                  </button>
                </div>

                {txIdMode === 'ref' ? (
                  // Auto-populated with payment ref — read-only
                  <div className="bg-slate-100 border-2 border-slate-200 rounded-2xl px-4 py-4">
                    <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">
                      Payment Reference (Auto)
                    </p>
                    <p className="font-mono font-bold text-slate-800 text-lg tracking-wider">
                      {paymentRef}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      ✓ Yeh reference automatic save ho jayega
                    </p>
                  </div>
                ) : (
                  // Manual bank TX ID entry
                  <input
                    type="text"
                    placeholder="Bank app ka Transaction ID (e.g. TXN123456)"
                    value={txId}
                    onChange={e => { setTxId(e.target.value); setError('') }}
                    autoFocus
                    className="w-full px-4 py-4 bg-slate-50 border-2 border-slate-200
                       rounded-2xl text-sm font-mono font-medium text-slate-800
                       outline-none focus:border-blue-500 focus:bg-white
                       transition-all placeholder:text-slate-400 placeholder:font-sans"
                  />
                )}
              </div>

              {/* Optional payer name */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Aapka Naam (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Jaise: Ahmed Khan"
                  value={payerName}
                  onChange={e => setPayerName(e.target.value)}
                  className="w-full px-4 py-3.5 bg-slate-50 border-2 border-slate-200
                     rounded-2xl text-sm text-slate-800 outline-none
                     focus:border-blue-500 focus:bg-white transition-all
                     placeholder:text-slate-400"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200
                        rounded-xl px-3 py-3">
                  <AlertCircle size={14} className="text-red-500 shrink-0" />
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer buttons */}
        {step !== 'submitted' && (
          <div className="px-5 py-4 border-t border-slate-100 shrink-0 space-y-2">
            {step === 'payment' ? (
              <>
                <button
                  onClick={() => setStep('confirm')}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold
                             py-4 rounded-2xl text-base transition-colors active:scale-[0.98]"
                >
                  Maine Payment Kar Di ✓
                </button>
                <p className="text-xs text-slate-400 text-center">
                  Payment karne ke baad "Maine Payment Kar Di" dabayein
                </p>
              </>
            ) : (
              <>
                <button
                  onClick={handleSubmit}
                  disabled={txId.trim().length < 6 || submitting}
                  className="w-full bg-green-600 disabled:bg-slate-300 text-white font-bold
                             py-4 rounded-2xl text-base transition-all active:scale-[0.98]
                             flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <><Loader2 size={18} className="animate-spin" /> Submit ho raha hai...</>
                  ) : (
                    'Submit Karein →'
                  )}
                </button>
                <button
                  onClick={() => setStep('payment')}
                  className="w-full text-slate-500 font-medium py-2 text-sm"
                >
                  ← Wapas
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
