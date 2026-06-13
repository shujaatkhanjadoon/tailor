'use client'

import { useState }  from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { ArrowLeft, AlertTriangle, CheckCircle2, MessageCircle, Calendar, Info } from 'lucide-react'
import { useAuth }   from '@/lib/auth/AuthContext'
import { usePlan }   from '@/hooks/usePlan'
import { PLANS }     from '@/lib/billing/plans'
import { cn }        from '@/lib/utils'

const CANCEL_REASONS = [
  'Too expensive',
  'Not using enough features',
  'Found a better solution',
  'Business closed / paused',
  'Technical issues',
  'Missing features I need',
  'Other',
]

const ADMIN_WA = process.env.NEXT_PUBLIC_ADMIN_WHATSAPP ?? ''

export default function CancelPage() {
  const router              = useRouter()
  const { shopId }          = useAuth()
  const plan                = usePlan()
  const [reason, setReason] = useState('')
  const [step, setStep]     = useState<'confirm' | 'done'>('confirm')
  const [cancelling, setCancelling] = useState(false)

  const currentPlan = PLANS[plan.plan]
  const adminWhatsAppLink = `https://wa.me/${ADMIN_WA}?text=${encodeURIComponent(
    `Assalam o Alaikum, meri subscription cancellation request submit ho gayi hai.\n\nShop ID: ${shopId ?? 'N/A'}\nCurrent plan: ${plan.plan}\nReason: ${reason || 'N/A'}`,
  )}`

  const handleCancel = async () => {
    if (!reason || !shopId) return
    setCancelling(true)

    try {
      const res = await fetch('/api/billing/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason,
          expiresAt: plan.expiresAt?.toISOString() ?? null,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        console.error('[Billing Cancel] API error:', err.error)
        toast.error(err.error || 'Cancel request failed')
        return
      }

      setStep('done')
    } finally {
      setCancelling(false)
    }
  }

  const expiryDate = plan.expiresAt
    ? plan.expiresAt.toLocaleDateString('en-PK', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  if (step === 'done') {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-5">
          <CheckCircle2 size={32} className="text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">Subscription Cancel Ho Gayi</h2>
        <p className="text-slate-500 text-sm leading-relaxed max-w-xs mb-6">
          {expiryDate ? (
            <>Aapka plan <strong>{expiryDate}</strong> tak chalta rahega. Uske baad aap Starter plan par aa jayenge.</>
          ) : (
            <>Aapka plan current period ke end tak active rahega. Data delete nahi hoga.</>
          )}
        </p>
        <div className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3 max-w-xs w-full mb-6 text-left">
          <div className="flex items-start gap-2">
            <Info size={14} className="text-blue-500 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700 leading-relaxed">
              End period ke baad 7 din ka grace period milega. Uske baad aap Starter plan par aa jayenge. Aapka data safe rahega — agar dubara upgrade karein to sab wapas mil jayega.
            </p>
          </div>
        </div>
        <a
          href={adminWhatsAppLink}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-3 inline-flex items-center gap-2 bg-green-600 text-white
                     font-bold px-6 py-3 rounded-2xl text-sm"
        >
          <MessageCircle size={15} />
          Admin Ko WhatsApp Karein
        </a>
        <button
          onClick={() => router.push('/billing')}
          className="bg-blue-600 text-white font-bold px-8 py-3.5 rounded-2xl"
        >
          Billing Page Par Jayein
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white pb-10">
      <header className="px-4 pt-12 lg:pt-6 pb-4 border-b border-slate-100 flex items-center gap-3">
        <button
          aria-label="Go back"
          onClick={() => router.back()}
          className="w-11 h-11 flex items-center justify-center rounded-full bg-slate-100">
          <ArrowLeft size={18} className="text-slate-600" />
        </button>
        <h1 className="text-lg font-bold text-slate-800">Subscription Cancel Karein</h1>
      </header>

      <div className="px-4 pt-6 space-y-5 max-w-lg mx-auto">

        {/* Warning — access until end of period */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-800 text-sm mb-2">Cancel karne se pehle yeh jaan lein:</p>
              <ul className="text-xs text-amber-700 space-y-1.5 leading-relaxed">
                <li className="flex items-start gap-1.5">
                  <Calendar size={12} className="shrink-0 mt-0.5" />
                  <span>
                    <strong>Aapka {currentPlan.name} plan {expiryDate || 'period end'} tak active rahega</strong> — cancel ke baad bhi access milega
                  </span>
                </li>
                <li>• Uske baad 7 din ka <strong>grace period</strong> milega (limited features)</li>
                <li>• Grace period ke baad <strong>Starter</strong> plan par aa jayenge (free)</li>
                <li>• <strong>Data delete nahi hoga</strong> — sirf features band ho jaengi</li>
                <li>• Kabhi bhi dubara upgrade kar sakte hain, data wapas mil jayega</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Current plan info */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <p className="font-semibold text-slate-700 text-sm mb-2">Current Subscription</p>
          <div className="space-y-1">
            <p className="text-sm text-slate-600">
              Plan: <span className="font-bold">{currentPlan.emoji} {currentPlan.name}</span>
            </p>
            {expiryDate && (
              <p className="text-sm text-slate-600">
                Expires: <span className="font-semibold">{expiryDate}</span>
              </p>
            )}
            {plan.billingCycle && (
              <p className="text-sm text-slate-600">
                Billing: <span className="font-semibold capitalize">{plan.billingCycle}</span>
              </p>
            )}
            <div className="mt-2 flex items-center gap-1.5 text-xs text-green-600 bg-green-50 rounded-xl px-3 py-2">
              <CheckCircle2 size={12} />
              Access until {expiryDate || 'period end'} — no immediate changes
            </div>
          </div>
        </div>

        {/* What you'll lose */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <p className="font-semibold text-slate-700 text-sm mb-3">Grace period ke baad yeh features band ho jaenge:</p>
          <div className="space-y-2">
            {[
              'Karigar accounts',
              'Order tracking URL + QR code',
              'Photo attachments',
              'Multi-device cloud sync',
              'Reports & analytics',
            ].map(f => (
              <div key={f} className="flex items-center gap-2 text-sm text-red-600">
                <div className="w-1.5 h-1.5 bg-red-400 rounded-full shrink-0" />
                {f}
              </div>
            ))}
          </div>
        </div>

        {/* Cancel reason */}
        <div>
          <p className="font-semibold text-slate-700 text-sm mb-3">
            Cancel karne ki wajah? (Help karo hume improve karne mein)
          </p>
          <div className="space-y-2">
            {CANCEL_REASONS.map(r => (
              <button
                key={r}
                onClick={() => setReason(r)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left text-sm transition-colors',
                  reason === r
                    ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300'
                )}
              >
                <div className={cn(
                  'w-4 h-4 rounded-full border-2 shrink-0',
                  reason === r ? 'border-blue-500 bg-blue-500' : 'border-slate-300'
                )} />
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3 pt-2">
          <button
            onClick={handleCancel}
            disabled={!reason || cancelling}
            className="w-full bg-red-600 disabled:bg-slate-300 text-white font-bold
                       py-4 rounded-2xl text-sm transition-colors active:scale-[0.98]"
          >
            {cancelling ? 'Cancel ho raha hai...' : 'Haan, Cancel Karein'}
          </button>
          <button
            onClick={() => router.push('/billing/upgrade')}
            className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl text-sm"
          >
            Rukein — Upgrade Karein →
          </button>
          <button
            onClick={() => router.back()}
            className="w-full text-slate-400 font-medium py-3 text-sm"
          >
            Wapas
          </button>
        </div>
      </div>
    </div>
  )
}
