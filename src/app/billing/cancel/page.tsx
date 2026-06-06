// src/app/billing/cancel/page.tsx
'use client'

import { useState }  from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, AlertTriangle, CheckCircle2, MessageCircle } from 'lucide-react'
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
    `Assalam o Alaikum, meri subscription downgrade/cancel request submit ho gayi hai.\n\nShop ID: ${shopId ?? 'N/A'}\nCurrent plan: ${plan.plan}\nReason: ${reason || 'N/A'}`,
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
        return
      }

      await fetch('/api/billing/subscription-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId,
          event: 'downgraded',
          previousPlan: plan.plan,
          plan: 'starter',
          reason,
          expiresAt: plan.expiresAt?.toISOString() ?? null,
        }),
      }).catch((e) => console.error('[Billing Cancel] Admin email event failed:', e))

      setStep('done')
    } finally {
      setCancelling(false)
    }
  }

  if (step === 'done') {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-5">
          <CheckCircle2 size={32} className="text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">Subscription Cancel Ho Gayi</h2>
        <p className="text-slate-500 text-sm leading-relaxed max-w-xs mb-6">
          Aapka plan {plan.expiresAt
            ? plan.expiresAt.toLocaleDateString('en-PK', { day: 'numeric', month: 'long' })
            : 'end of period'
          } tak active rahega. Data delete nahi hoga.
        </p>
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

        {/* Warning */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-800 text-sm mb-1">Cancel karne se pehle:</p>
              <ul className="text-xs text-amber-700 space-y-1 leading-relaxed">
                <li>• Aapka {currentPlan.name} plan {plan.expiresAt
                  ? plan.expiresAt.toLocaleDateString('en-PK', { day:'numeric', month:'long' })
                  : 'period end'
                } tak chalega</li>
                <li>• Uske baad Starter plan par aa jayenge</li>
                <li>• Data delete nahi hoga — sirf features band ho jaengi</li>
                <li>• 7 din grace period milegi features ke liye</li>
              </ul>
            </div>
          </div>
        </div>

        {/* What you'll lose */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <p className="font-semibold text-slate-700 text-sm mb-3">Cancel ke baad kya band hoga:</p>
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
