// src/app/billing/upgrade/page.tsx
'use client'

import { useState, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Tag, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { usePlan }            from '@/hooks/usePlan'
import { PLANS, PlanId }      from '@/lib/billing/plans'
import { PricingCard }        from '@/components/billing/PricingCard'
import { BillingCycleToggle } from '@/components/billing/BillingCycleToggle'
import { RaastPaymentSheet } from '@/components/billing/RaastPaymentSheet'

function UpgradeContent() {
  const router       = useRouter()
  const plan         = usePlan()

  const [cycle, setCycle]       = useState<'monthly' | 'yearly'>('monthly')
  const [selectedPlan, setSelectedPlan] = useState<PlanId | null>(null)

  const [couponCode, setCouponCode] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState<{ id: string; code: string; discountPct: number; minAmountPkr?: number | null; appliesToPlan?: string | null } | null>(null)
  const [couponError, setCouponError] = useState('')
  const [couponLoading, setCouponLoading] = useState(false)

  const applyCoupon = async () => {
    const code = couponCode.trim().toUpperCase()
    if (!code) return
    setCouponLoading(true)
    setCouponError('')
    setAppliedCoupon(null)
    try {
      const res = await fetch(`/api/coupons/validate?code=${encodeURIComponent(code)}`)
      const d = await res.json()
      if (!d.valid) { setCouponError(d.error); return }
      setAppliedCoupon(d.coupon)
      setCouponCode(code)
    } catch { setCouponError('Failed to validate coupon') }
    finally { setCouponLoading(false) }
  }

  const removeCoupon = () => {
    setAppliedCoupon(null)
    setCouponCode('')
    setCouponError('')
  }

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

        {/* Coupon code */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <Tag size={12} /> Coupon Code
          </label>
          {appliedCoupon ? (
            <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-3 py-2.5">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-green-600" />
                <span className="text-sm font-bold text-green-700">{couponCode}</span>
                <span className="text-xs text-green-600">({appliedCoupon.discountPct}% off)</span>
              </div>
              <button onClick={removeCoupon} className="text-xs text-red-500 font-semibold hover:text-red-700">Remove</button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="SUMMER25"
                value={couponCode}
                onChange={e => { setCouponCode(e.target.value.toUpperCase()); setCouponError('') }}
                onKeyDown={e => e.key === 'Enter' && applyCoupon()}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-mono font-bold text-slate-800 outline-none focus:border-blue-500 placeholder:font-sans placeholder:font-normal"
              />
              <button
                onClick={applyCoupon}
                disabled={couponLoading || !couponCode.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors flex items-center gap-1"
              >
                {couponLoading ? <Loader2 size={12} className="animate-spin" /> : <Tag size={12} />}
                Apply
              </button>
            </div>
          )}
          {couponError && (
            <p className="flex items-center gap-1 text-xs text-red-500 mt-1.5">
              <AlertCircle size={10} /> {couponError}
            </p>
          )}
        </div>

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
              discountPct={appliedCoupon?.discountPct}
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
          couponId={appliedCoupon?.id}
          couponCode={appliedCoupon?.code}
          discountPct={appliedCoupon?.discountPct}
          onClose={() => setSelectedPlan(null)}
          onSubmitted={() => {
            setSelectedPlan(null)
            router.push(`/billing?payment=submitted&t=${Date.now()}`)
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
