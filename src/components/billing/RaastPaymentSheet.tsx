// src/components/billing/RaastPaymentSheet.tsx
'use client'

import { useState } from 'react'
import { X, Copy, Check, AlertCircle, CheckCircle2, Loader2, MessageCircle } from 'lucide-react'

import { useAuth } from '@/lib/auth/AuthContext'
import { generatePaymentRef } from '@/lib/billing/raast'
import { PLANS, PlanId } from '@/lib/billing/plans'
import { cn } from '@/lib/utils'
import Image from 'next/image'

// Read Raast config from env
// Set NEXT_PUBLIC_RAAST_* in .env.local
const RAAST_ID = process.env.NEXT_PUBLIC_RAAST_ID ?? ''
const RAAST_NAME = process.env.NEXT_PUBLIC_RAAST_NAME ?? ''
const RAAST_BANK = process.env.NEXT_PUBLIC_RAAST_BANK ?? ''
const ADMIN_WA = process.env.NEXT_PUBLIC_ADMIN_WHATSAPP ?? ''

interface RaastPaymentSheetProps {
  planId: PlanId
  cycle: 'monthly' | 'yearly'
  amountPkr: number
  couponId?: string
  couponCode?: string
  discountPct?: number
  onClose: () => void
  onSubmitted: () => void
}

type SheetStep = 'payment' | 'confirm' | 'submitted'

export function RaastPaymentSheet({
  planId, cycle, amountPkr, couponId, couponCode, discountPct, onClose, onSubmitted,
}: RaastPaymentSheetProps) {
  const finalAmount = discountPct ? Math.round(amountPkr * (1 - discountPct / 100)) : amountPkr
  const { shopId } = useAuth()
  const [step, setStep] = useState<SheetStep>('payment')
  const [txId, setTxId] = useState('')
  const [payerName, setPayerName] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState<'id' | 'amount' | null>(null)

  const [paymentRef] = useState(() => generatePaymentRef(shopId ?? 'SHOP'))
  const targetPlan = PLANS[planId]

  const adminWhatsAppLink = ADMIN_WA
    ? `https://wa.me/${ADMIN_WA}?text=${encodeURIComponent(
      `Assalam o Alaikum, subscription ${planId} ${cycle} request verify kar dein.\n\nShop ID: ${shopId ?? 'N/A'}\nAmount: Rs. ${finalAmount}\nPayment Ref: ${paymentRef}\nTransaction ID: ${txId.trim() || 'Submitted in app'}\nPayer: ${payerName.trim() || 'N/A'}`,
    )}`
    : null

  const copy = async (text: string, key: 'id' | 'amount') => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const el = document.createElement('textarea')
      el.value = text
      el.style.position = 'fixed'
      el.style.opacity = '0'
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setCopied(key)
    setTimeout(() => setCopied(null), 2500)
  }

  const handleSubmit = async () => {
    if (txId.trim().length < 4) {
      setError('Transaction ID daalein (kam se kam 4 characters)')
      return
    }
    if (payerName.trim().length < 2) {
      setError('Apna naam daalein')
      return
    }
    if (!shopId) {
      setError('Shop ID missing â€” please reload the page')
      return
    }

    setSaving(true)
    setError('')

    try {
      const res = await fetch('/api/billing/submit-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId,
          cycle,
          amountPkr: finalAmount,
          paymentRef,
          transactionId: txId.trim(),
          payerName: payerName.trim(),
          couponId: couponId || undefined,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        setError(err.error ?? 'Payment submission failed')
        setSaving(false)
        return
      }

      await fetch('/api/billing/subscription-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId,
          event: 'payment_submitted',
          plan: planId,
          cycle,
          amountPkr: finalAmount,
          paymentRef,
          transactionId: txId.trim(),
          payerName: payerName.trim(),
          couponCode: couponCode || couponId || undefined,
          discountPct: discountPct || undefined,
        }),
      }).catch((e) => console.error('[Payment] Admin email event failed:', e))

      setStep('submitted')
      setTimeout(() => {
        onSubmitted()
        onClose()
      }, 3500)

    } catch (e) {
      console.error('[Payment] Unexpected error:', e)
      setError('Kuch masla hua. Dobara try karein.')
      setSaving(false)
    }
  }

  const STEPS = [
    { label: 'Payment', key: 'payment' },
    { label: 'Confirm', key: 'confirm' },
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center lg:items-center"
      role="presentation"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Sheet */}
      <div
         className="relative w-full max-w-115 bg-white rounded-t-3xl
                    lg:rounded-2xl shadow-2xl z-10 max-h-[95vh] flex flex-col mb-16 lg:mb-0"
      >
        {/* Handle */}
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mt-3
                        shrink-0 lg:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4
                        border-b border-slate-100 shrink-0">
          <div>
            <h3 className="font-bold text-slate-800">Raast Se Payment</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {targetPlan.emoji} {targetPlan.name} · {discountPct ? <><span className="line-through text-slate-300 me-1">Rs. {amountPkr.toLocaleString()}</span><span className="text-green-600">Rs. {finalAmount.toLocaleString()}</span></> : `Rs. ${amountPkr.toLocaleString()}`} · {cycle}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100"
          >
            <X size={15} className="text-slate-500" />
          </button>
        </div>

        {/* Step indicator */}
        {step !== 'submitted' && (
          <div className="flex items-center gap-0 px-5 py-3 border-b
                          border-slate-100 shrink-0">
            {STEPS.map((s, i) => (
              <div key={s.key} className="flex items-center flex-1">
                <div className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center',
                  'text-xs font-bold shrink-0',
                  step === s.key
                    ? 'bg-blue-600 text-white'
                    : (STEPS.indexOf({ label: step === 'confirm' ? 'Confirm' : 'Payment', key: step }) > i)
                      ? 'bg-green-500 text-white'
                      : 'bg-slate-200 text-slate-500'
                )}>
                  {i + 1}
                </div>
                <span className={cn(
                  'text-xs font-medium ml-1.5 flex-1',
                  step === s.key ? 'text-blue-600' : 'text-slate-400'
                )}>
                  {s.label}
                </span>
                {i < STEPS.length - 1 && (
                  <div className="w-6 h-px bg-slate-200 mx-2" />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">

          {/* SUCCESS */}
          {step === 'submitted' && (
            <div className="flex flex-col items-center py-10 text-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center
                              justify-center mb-5">
                <CheckCircle2 size={40} className="text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">
                Shukriya! 🙏
              </h3>
              <p className="text-slate-500 text-sm leading-relaxed max-w-xs">
                Aapki payment request humein mil gayi.
                Hum <strong>24 ghante</strong> mein verify
                kar ke plan activate kar denge.
              </p>
              <div className="mt-5 bg-blue-50 border border-blue-200
                              rounded-2xl px-4 py-3 w-full max-w-xs space-y-3">
                <p className="text-xs text-blue-700 font-medium">
                  📱 Activation ka message aapko bata diya jayega
                </p>
                <p className="text-xs text-blue-700 leading-relaxed">
                  Jaldi verification ke liye admin ko WhatsApp par payment
                  reference aur transaction ID bhej dein.
                </p>
                {adminWhatsAppLink && (
                  <a
                    href={adminWhatsAppLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 rounded-xl
                               bg-green-600 px-3 py-2.5 text-xs font-bold text-white"
                  >
                    <MessageCircle size={13} />
                    Admin Ko WhatsApp Karein
                  </a>
                )}
              </div>
            </div>
          )}

          {/* STEP 1: Payment Details */}
          {step === 'payment' && (
            <div className="space-y-5">

              {/* Payment reference */}
              <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
                <p className="text-xs font-bold text-amber-700 mb-1">
                  ⚠️ Zaroor likhein — Payment Reference
                </p>
                <div className="flex items-center justify-between">
                  <code className="text-base font-bold text-amber-800 tracking-wider">
                    {paymentRef}
                  </code>
                  <button
                    onClick={() => copy(paymentRef, 'id')}
                    className="text-xs text-amber-600 font-semibold flex items-center gap-1"
                  >
                    {copied === 'id'
                      ? <><Check size={11} /> Copied!</>
                      : <><Copy size={11} /> Copy</>
                    }
                  </button>
                </div>
                <p className="text-[10px] text-amber-600 mt-1">
                  Payment description/note mein yeh reference zaroor daalein
                </p>
              </div>

              {/* Reference QR */}
              <div className="flex flex-col items-center">
                <p className="text-xs font-semibold text-slate-500 uppercase
                               tracking-wide mb-3">
                  Payment Details QR
                </p>
                <div className="bg-white border-2 border-slate-200 rounded-2xl
                                p-4 shadow-sm max-w-85">
                  {/* <QRCodeSVG
                    value={paymentDetailsQR}
                    size={180}
                    level="M"
                    includeMargin={false}
                  /> */}
                  
                  <Image
                    src="/payment/qr/meezan-qr.png"
                    alt="Meezan Payment Qr"
                    width={386}
                    height={409}
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-2 text-center">
                  Bank app mein Raast ID manually daalein. Custom QR banking apps mein invalid aa sakta hai.
                </p>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-xs text-slate-400 font-medium">
                  ya Raast ID se bhejein
                </span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>

              {/* Raast ID details */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">

                {/* Raast ID row */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-400 font-medium">Raast ID</p>
                    <p className="text-xl font-bold text-slate-800 font-mono mt-0.5">
                      {RAAST_ID}
                    </p>
                  </div>
                  <button
                    onClick={() => copy(RAAST_ID, 'id')}
                    className={cn(
                      'flex items-center gap-1.5 text-xs font-bold',
                      'px-3 py-2 rounded-xl transition-all',
                      copied === 'id'
                        ? 'bg-green-500 text-white'
                        : 'bg-white border border-slate-200 text-slate-700'
                    )}
                  >
                    {copied === 'id'
                      ? <><Check size={11} /> Copied!</>
                      : <><Copy size={11} /> Copy</>
                    }
                  </button>
                </div>

                <div className="h-px bg-slate-200" />

                {/* Account info */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-400 font-medium">Account Name</p>
                    <p className="text-sm font-semibold text-slate-800">{RAAST_NAME}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400 font-medium">Bank</p>
                    <p className="text-sm font-semibold text-slate-800">{RAAST_BANK}</p>
                  </div>
                </div>

                <div className="h-px bg-slate-200" />

                {/* Amount */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-400 font-medium">Amount</p>
                    <div>
                      <p className="text-3xl font-bold text-slate-800">
                        Rs. {finalAmount.toLocaleString()}
                      </p>
                      {discountPct && (
                        <p className="text-xs text-green-600 mt-0.5">
                          {discountPct}% off · Original: Rs. {amountPkr.toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => copy(String(amountPkr), 'amount')}
                    className={cn(
                      'flex items-center gap-1.5 text-xs font-bold',
                      'px-3 py-2 rounded-xl transition-all',
                      copied === 'amount'
                        ? 'bg-green-500 text-white'
                        : 'bg-white border border-slate-200 text-slate-700'
                    )}
                  >
                    {copied === 'amount'
                      ? <><Check size={11} /> Copied!</>
                      : <><Copy size={11} /> Copy</>
                    }
                  </button>
                </div>
              </div>

              {/* Steps */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                  Kaise bhejein:
                </p>
                {[
                  'Apni bank app ya Easypaisa/JazzCash kholein',
                  'Raast → Send Money option chunein',
                  'Raast ID daalein',
                  `Exact amount: Rs. ${finalAmount.toLocaleString()} daalein`,
                  `Payment reference daalein: ${paymentRef}`,
                  'Payment karein aur Transaction ID note karein',
                ].map((step, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <div className="w-5 h-5 bg-blue-100 text-blue-700 rounded-full
                                    flex items-center justify-center text-[10px]
                                    font-bold shrink-0 mt-0.5">
                      {i + 1}
                    </div>
                    <p className="text-sm text-slate-600 leading-snug">{step}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 2: Confirm*/}
          {step === 'confirm' && (
            <div className="space-y-5">

              <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3">
                <p className="text-sm font-bold text-green-800 mb-0.5">
                  ✓ Payment kar li? Badhiya!
                </p>
                <p className="text-xs text-green-600">
                  Ab Transaction ID daalein
                </p>
              </div>

              {/* Transaction ID */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Payment Reference
                </label>
                <input
                  type="text"
                  value={paymentRef}
                  readOnly
                  disabled
                  className="w-full px-4 py-4 bg-slate-100 border-2 border-slate-200 rounded-2xl text-sm font-mono font-bold text-slate-500"
                />
                <p className="text-xs text-slate-400 mt-1.5 ml-1">
                  Ye reference automatically generate hua hai.
                </p>
              </div>

              {/* Transaction ID */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Transaction ID / Reference Number{' '}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Jaise: TXN123456789 ya REF987654"
                  value={txId}
                  onChange={e => { setTxId(e.target.value); setError('') }}
                  autoFocus
                  className="w-full px-4 py-4 bg-slate-50 border-2 border-slate-200
                             rounded-2xl text-sm font-mono font-medium text-slate-800
                             outline-none focus:border-blue-500 focus:bg-white
                             transition-all placeholder:text-slate-400 placeholder:font-sans"
                />
                <p className="text-xs text-slate-400 mt-1.5 ml-1">
                  Bank app ki payment history mein milegi
                </p>
              </div>

              {/* Payer name */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Aapka Naam{' '}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Jaise: Ahmed Khan"
                  value={payerName}
                  onChange={e => { setPayerName(e.target.value); setError('') }}
                  className="w-full px-4 py-4 bg-slate-50 border-2 border-slate-200
                             rounded-2xl text-sm font-medium text-slate-800
                             outline-none focus:border-blue-500 focus:bg-white
                             transition-all placeholder:text-slate-400"
                />
              </div>

              {/* Ref reminder */}
              <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
                <p className="text-xs text-amber-700">
                  📋 Payment reference:{' '}
                  <strong className="font-mono">{paymentRef}</strong>
                </p>
              </div>

              {/* Error */}
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

        {/* Footer */}
        {step !== 'submitted' && (
          <div className="px-5 py-4 border-t border-slate-100 shrink-0 space-y-2 mb-14 lg:mb-0">
            {step === 'payment' ? (
              <>
                <button
                  onClick={() => setStep('confirm')}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white
                             font-bold py-4 rounded-2xl text-base transition-colors
                             active:scale-[0.98]"
                >
                  Maine Payment Kar Di ✓
                </button>
                <p className="text-xs text-slate-400 text-center">
                  Payment ke baad &quot;Maine Payment Kar Di&quot; dabayein
                </p>
              </>
            ) : (
              <>
                <button
                  onClick={handleSubmit}
                  disabled={txId.trim().length < 4 || payerName.trim().length < 2 || saving}
                  className="w-full bg-green-600 disabled:bg-slate-300 text-white
                             font-bold py-4 rounded-2xl text-base transition-all
                             active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <><Loader2 size={18} className="animate-spin" /> Submit ho raha hai...</>
                  ) : (
                    'Submit Karein →'
                  )}
                </button>
                <button
                  onClick={() => { setStep('payment'); setError('') }}
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
