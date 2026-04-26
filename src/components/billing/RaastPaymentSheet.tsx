// src/components/billing/RaastPaymentSheet.tsx
'use client'

import { useState, useEffect } from 'react'
import { X, Copy, Check, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { QRCodeSVG }    from 'qrcode.react'
import { supabase }     from '@/lib/supabase/client'
import { useAuth }      from '@/lib/auth/AuthContext'
import { usePlan }      from '@/hooks/usePlan'
import {
  RAAST_CONFIG, generatePaymentRef,
  buildRaastQRData, buildPaymentNote,
} from '@/lib/billing/raast'
import { PLANS, PlanId } from '@/lib/billing/plans'
import { cn }            from '@/lib/utils'

interface RaastPaymentSheetProps {
  planId:       PlanId
  cycle:        'monthly' | 'yearly'
  amountPkr:    number
  onClose:      () => void
  onSubmitted:  () => void
}

type SheetStep = 'payment' | 'confirm' | 'submitted'

export function RaastPaymentSheet({
  planId, cycle, amountPkr, onClose, onSubmitted,
}: RaastPaymentSheetProps) {
  const { shopId }        = useAuth()
  const plan              = usePlan()
  const [step, setStep]   = useState<SheetStep>('payment')
  const [txId,  setTxId]  = useState('')
  const [payerName, setPayerName] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [copied, setCopied] = useState<'id' | 'amount' | null>(null)

  const [paymentRef] = useState(() => generatePaymentRef(shopId ?? 'SHOP'))
  const targetPlan   = PLANS[planId]
  const qrData       = buildRaastQRData(RAAST_CONFIG, amountPkr, paymentRef)
  const paymentNote  = buildPaymentNote(planId, cycle, paymentRef)

  const copyToClipboard = async (text: string, key: 'id' | 'amount') => {
    await navigator.clipboard.writeText(text).catch(() => {})
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const handleSubmit = async () => {
    if (txId.trim().length < 6) {
      setError('Transaction ID kam se kam 6 characters ka hona chahiye')
      return
    }
    if (!shopId) return

    setError('')
    setSubmitting(true)

    try {
      // Save payment request to Supabase for manual verification
      const { error: dbError } = await (supabase as any)
        .from('subscription_payments')
        .insert({
          shop_id:       shopId,
          plan:          planId,
          billing_cycle: cycle,
          amount_pkr:    amountPkr,
          method:        'raast',
          gateway_tx_id: txId.trim(),
          status:        'pending',
          receipt_data:  {
            payment_ref:  paymentRef,
            payer_name:   payerName.trim(),
            raast_id:     RAAST_CONFIG.raastId,
            submitted_at: new Date().toISOString(),
          },
        })

      if (dbError) throw dbError

      // Also create/update subscription to 'pending' status
      // (will be activated by admin after verification)
      await (supabase as any)
        .from('subscriptions')
        .upsert({
          shop_id:       shopId,
          plan:          planId,
          billing_cycle: cycle,
          status:        'trialing',  // keep trialing until verified
          amount_pkr:    amountPkr,
          gateway:       'raast',
          gateway_sub_id: paymentRef,
          updated_at:    new Date().toISOString(),
        }, { onConflict: 'shop_id' })

      setStep('submitted')
      setTimeout(() => {
        onSubmitted()
        onClose()
      }, 3000)

    } catch (e) {
      console.error('[Raast] Submit error:', e)
      setError('Submit nahi hua. Dobara try karein.')
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

          {/* ── CONFIRMATION STEP ── */}
          {step === 'confirm' && (
            <div className="space-y-5">
              <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3">
                <p className="text-sm font-bold text-green-800 mb-0.5">
                  ✓ Payment kar li? Acha hai!
                </p>
                <p className="text-xs text-green-600">
                  Ab apni Transaction ID daalein taake hum verify kar sakein.
                </p>
              </div>

              {/* Transaction ID input */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Transaction ID / Reference Number *
                </label>
                <input
                  type="text"
                  placeholder="Jaise: TXN123456789"
                  value={txId}
                  onChange={e => { setTxId(e.target.value); setError('') }}
                  autoFocus
                  className="w-full px-4 py-4 bg-slate-50 border-2 border-slate-200
                             rounded-2xl text-sm font-mono font-medium text-slate-800
                             outline-none focus:border-blue-500 focus:bg-white
                             transition-all placeholder:text-slate-400 placeholder:font-sans"
                />
                <p className="text-xs text-slate-400 mt-1.5 ml-1">
                  Yeh ID aapki bank app ki payment history mein milegi
                </p>
              </div>

              {/* Payer name (optional but helpful) */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Aapka Naam (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Jaise: Ahmed Khan"
                  value={payerName}
                  onChange={e => setPayerName(e.target.value)}
                  className="w-full px-4 py-4 bg-slate-50 border-2 border-slate-200
                             rounded-2xl text-sm font-medium text-slate-800
                             outline-none focus:border-blue-500 focus:bg-white
                             transition-all placeholder:text-slate-400"
                />
              </div>

              {/* Payment ref reminder */}
              <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
                <p className="text-xs text-amber-700">
                  📋 Aapka payment reference:{' '}
                  <strong className="font-mono">{paymentRef}</strong>
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200
                                rounded-xl px-4 py-3">
                  <AlertCircle size={15} className="text-red-500 shrink-0" />
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
