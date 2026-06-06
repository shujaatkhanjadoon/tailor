// src/app/billing/upgrade/page.tsx
'use client'

import { useState, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft }          from 'lucide-react'
import { usePlan }            from '@/hooks/usePlan'
import { PLANS, PlanId }      from '@/lib/billing/plans'
import { PricingCard }        from '@/components/billing/PricingCard'
import { BillingCycleToggle } from '@/components/billing/BillingCycleToggle'
import { RaastPaymentSheet }  from '@/components/billing/RaastPaymentSheet'

function UpgradeContent() {
  const router       = useRouter()
  const plan         = usePlan()

  const [cycle, setCycle]       = useState<'monthly' | 'yearly'>('monthly')
  const [selectedPlan, setSelectedPlan] = useState<PlanId | null>(null)

  const handleSelectPlan = (planId: PlanId) => {
    if (planId === 'starter') {
      router.push('/billing/cancel')
      return
    }
    setSelectedPlan(planId)
  }

  const getAmount = (planId: PlanId): number => {
    const p = PLANS[planId]
    return cycle === 'yearly' ? (p.yearlyPkr ?? 0) : (p.monthlyPkr ?? 0)
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      <header className="bg-white border-b border-slate-100 px-4 pt-12 lg:pt-6 pb-4
                         flex items-center gap-3 sticky top-0 z-10">
        <button
          aria-label="Go back"
          onClick={() => router.back()}
          className="w-11 h-11 flex items-center justify-center rounded-full bg-slate-100"
        >
          <ArrowLeft size={18} className="text-slate-600" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-slate-800">Plan Upgrade Karein</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Apni dukaan ke liye sahi plan chunein
          </p>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 pt-6 space-y-6 my-10 lg:my-10">

        {/* Trial info banner */}
        {plan.isTrial && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3 text-center">
            <p className="text-sm text-blue-700 font-medium">
              ✨ Aap Professional trial use kar rahe hain — {plan.daysLeft} din baaki.
              Upgrade kar ke trial ke baad bhi features rakhhein.
            </p>
          </div>
        )}

        {/* Billing cycle toggle */}
        <BillingCycleToggle value={cycle} onChange={setCycle} />

        {/* Plan cards */}
        <div className="grid lg:grid-cols-3 gap-4">
          {(['starter', 'professional', 'business'] as PlanId[]).map(planId => (
            <PricingCard
              key={`${planId}-${cycle}`}
              plan={PLANS[planId]}
              cycle={cycle}
              currentPlanId={plan.plan}
              currentCycle={plan.billingCycle}
              onSelect={handleSelectPlan}
            />
          ))}
        </div>

        {/* Raast payment info */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
            <span className="text-xl">⚡</span>
            Payment Method
          </h3>
          <div className="flex items-center gap-4">
            {[
              { emoji: '🏦', label: 'Raast ID'  },
              { emoji: '📱', label: 'Raast QR'  },
              { emoji: '💚', label: 'Easypaisa' },
              { emoji: '🔴', label: 'JazzCash'  },
              { emoji: '🏧', label: 'Bank Transfer' },
            ].map(m => (
              <div key={m.label} className="flex flex-col items-center gap-1">
                <span className="text-2xl">{m.emoji}</span>
                <span className="text-[10px] text-slate-500 font-medium">{m.label}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-3 leading-relaxed">
            Raast ke zariye payment karein — zero fee! Payment ke baad Transaction ID
            submit karein. Hum <strong>24 ghante</strong> mein activate kar denge.
          </p>
        </div>

        {/* FAQ */}
        <div className="space-y-3">
          {[
            {
              q: 'Kya data safe rahega downgrade par?',
              a: 'Haan, aapka sab data safe rahega. Sirf features limit ho jaengi.',
            },
            {
              q: 'Refund policy kya hai?',
              a: '7 din ke andar request karein — poora refund milega.',
            },
            {
              q: 'Kya subscription cancel kar sakte hain?',
              a: 'Haan, jab chahein. Cancel ke baad current period ke end tak access rahega.',
            },
            {
              q: 'Payment verify hone mein kitna waqt lagta hai?',
              a: 'Aam tor par 2-4 ghante, maximum 24 ghante business days mein.',
            },
          ].map(({ q, a }) => (
            <div key={q} className="bg-white border border-slate-200 rounded-2xl px-4 py-4">
              <p className="font-semibold text-slate-800 text-sm mb-1">{q}</p>
              <p className="text-slate-500 text-xs leading-relaxed">{a}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Raast Payment Sheet */}
      {selectedPlan && selectedPlan !== 'starter' && (
        <RaastPaymentSheet
          planId={selectedPlan}
          cycle={cycle}
          amountPkr={getAmount(selectedPlan)}
          onClose={() => setSelectedPlan(null)}
          onSubmitted={() => {
            setSelectedPlan(null)
            router.push('/billing?payment=submitted')
          }}
        />
      )}
    </div>
  )
}

export default function UpgradePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <UpgradeContent />
    </Suspense>
  )
}
