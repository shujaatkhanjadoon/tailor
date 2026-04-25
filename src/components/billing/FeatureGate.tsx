// src/components/billing/FeatureGate.tsx
'use client'

import { ReactNode } from 'react'
import { Lock }      from 'lucide-react'
import { usePlan }   from '@/hooks/usePlan'
import { FEATURE_DESCRIPTIONS, PlanId, PLANS } from '@/lib/billing/plans'
import { cn }        from '@/lib/utils'

interface FeatureGateProps {
  feature:   keyof typeof FEATURE_DESCRIPTIONS
  children:  ReactNode
  // How to show the locked state:
  mode?:     'hide'    // completely hide (default)
           | 'blur'    // blur + overlay
           | 'banner'  // show children + banner below
           | 'inline'  // inline lock badge
}

export function FeatureGate({
  feature,
  children,
  mode = 'hide',
}: FeatureGateProps) {
  const plan           = usePlan()
  const featureDef     = FEATURE_DESCRIPTIONS[feature]
  const requiredPlan   = PLANS[featureDef.requiredPlan]

  // Check if user has access to this feature
  const hasAccess = (() => {
    switch (feature) {
      case 'karigar':    return plan.canAddKarigar
      case 'tracking':   return plan.canUseTracking
      case 'qr_code':    return plan.canUseQR
      case 'photos':     return plan.canUsePhotos
      case 'analytics':  return plan.canUseAnalytics
      case 'cloud_sync': return plan.canSyncCloud
      case 'karigar_pay': return PLANS[plan.plan].limits.hasKarigarPayReports && plan.isActive
      default:           return true
    }
  })()

  if (hasAccess) return <>{children}</>

  if (mode === 'hide') return null

  if (mode === 'blur') {
    return (
      <div className="relative">
        <div className="blur-sm pointer-events-none select-none opacity-60">
          {children}
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <UpgradeChip featureDef={featureDef} plan={plan} requiredPlan={featureDef.requiredPlan} />
        </div>
      </div>
    )
  }

  if (mode === 'banner') {
    return (
      <div>
        {children}
        <div className="mt-2">
          <UpgradeBanner featureDef={featureDef} plan={plan} requiredPlan={featureDef.requiredPlan} />
        </div>
      </div>
    )
  }

  if (mode === 'inline') {
    return (
      <div className="flex items-center gap-2 opacity-50 cursor-not-allowed">
        {children}
        <Lock size={12} className="text-slate-400 shrink-0" />
      </div>
    )
  }

  return null
}

// ── Sub-components ────────────────────────────────────────────────

function UpgradeChip({
  featureDef, plan, requiredPlan,
}: {
  featureDef: typeof FEATURE_DESCRIPTIONS[string]
  plan: ReturnType<typeof usePlan>
  requiredPlan: PlanId
}) {
  return (
    <button
      onClick={() => plan.upgrade(requiredPlan)}
      className="flex items-center gap-2 bg-blue-600 text-white text-xs font-bold
                 px-4 py-2.5 rounded-full shadow-lg active:scale-95 transition-transform"
    >
      <Lock size={12} />
      {PLANS[requiredPlan].name} plan mein unlock hoga
    </button>
  )
}

function UpgradeBanner({
  featureDef, plan, requiredPlan,
}: {
  featureDef: typeof FEATURE_DESCRIPTIONS[string]
  plan: ReturnType<typeof usePlan>
  requiredPlan: PlanId
}) {
  const reqPlan = PLANS[requiredPlan]
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
          <Lock size={14} className="text-blue-600" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-blue-800">{featureDef.title}</p>
          <p className="text-xs text-blue-600 mt-0.5">{featureDef.description}</p>
          <button
            onClick={() => plan.upgrade(requiredPlan)}
            className="mt-2 text-xs font-bold text-blue-700 underline"
          >
            {reqPlan.name} plan pe upgrade karein →
          </button>
        </div>
      </div>
    </div>
  )
}