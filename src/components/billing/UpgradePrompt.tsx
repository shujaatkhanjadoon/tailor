// src/components/billing/UpgradePrompt.tsx
'use client'

import { X, Zap, Check } from 'lucide-react'
import { usePlan }        from '@/hooks/usePlan'
import { PLANS, FEATURE_DESCRIPTIONS, yearlySavingPercent, formatYearlyDeal } from '@/lib/billing/plans'


interface UpgradePromptProps {
  feature:  keyof typeof FEATURE_DESCRIPTIONS
  onClose:  () => void
}

export function UpgradePrompt({ feature, onClose }: UpgradePromptProps) {
  const plan        = usePlan()
  const featureDef  = FEATURE_DESCRIPTIONS[feature]
  const targetPlanId = featureDef.requiredPlan
  const targetPlan  = PLANS[targetPlanId]

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center lg:items-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      <div
        className="relative z-10 max-h-[92dvh] w-full max-w-[min(100vw,34rem)] overflow-y-auto bg-white px-5 pt-5 pb-8 shadow-2xl rounded-t-3xl lg:rounded-2xl mb-16 lg:mb-0"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-5 lg:hidden" />

        {/* Close */}
        <button
          aria-label="Close upgrade prompt"
          onClick={onClose}
          className="absolute top-4 right-4 w-11 h-11 flex items-center justify-center
                     rounded-full bg-slate-100"
        >
          <X size={15} className="text-slate-500" />
        </button>

        {/* Lock icon */}
        <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mb-4">
          <Zap size={26} className="text-blue-600" />
        </div>

        <h3 className="text-xl font-bold text-slate-800 mb-1">
          {featureDef.title} Unlock Karein
        </h3>
        <p className="text-slate-500 text-sm mb-5 leading-relaxed">
          {featureDef.description}. Yeh feature{' '}
          <strong>{targetPlan.name} plan</strong> mein available hai.
        </p>

        {/* Plan highlights */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-5">
          <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-3">
            {targetPlan.emoji} {targetPlan.name} mein milega:
          </p>
          <div className="space-y-1.5">
            {targetPlan.highlights.map(h => (
              <div key={h} className="flex items-center gap-2 text-sm text-blue-700">
                <Check size={13} className="text-blue-500 shrink-0" />
                {h}
              </div>
            ))}
          </div>
        </div>

        {/* Pricing */}
        <div className="flex gap-2 mb-5">
          <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-slate-800">
              Rs. {targetPlan.monthlyPkr?.toLocaleString()}
            </p>
            <p className="text-xs text-slate-400">per month</p>
          </div>
          <div className="flex-1 bg-blue-600 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-white">
              Rs. {targetPlan.yearlyPkr?.toLocaleString()}
            </p>
            <p className="text-xs text-blue-200">
              per year · {yearlySavingPercent(targetPlan)}% save · {formatYearlyDeal(targetPlan)}
            </p>
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={() => { plan.upgrade(targetPlanId); onClose() }}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold
                     py-4 rounded-2xl text-base transition-colors active:scale-[0.98]"
        >
          Upgrade Karein →
        </button>

        <button
          onClick={onClose}
          className="w-full text-slate-400 font-medium py-3 text-sm mt-1"
        >
          Baad Mein
        </button>
      </div>
    </div>
  )
}
