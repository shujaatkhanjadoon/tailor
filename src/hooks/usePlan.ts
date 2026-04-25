// src/hooks/usePlan.ts
import { useState, useEffect, useCallback } from 'react'
import { useRouter }   from 'next/navigation'
import { useAuth }     from '@/lib/auth/AuthContext'
import { supabase }    from '@/lib/supabase/client'
import { PLANS, PlanId, SubStatus, PlanLimits } from '@/lib/billing/plans'

export interface PlanState {
  // Current plan info
  plan:          PlanId
  status:        SubStatus
  trialEndsAt:   Date | null
  expiresAt:     Date | null
  gracEndsAt:    Date | null

  // Computed
  isTrialing:    boolean
  isActive:      boolean       // trialing OR active
  isExpired:     boolean
  inGrace:       boolean       // expired but grace period still open
  daysLeft:      number | null // days until trial/subscription expires
  isTrial:       boolean

  // Feature gates (easy boolean checks)
  canAddKarigar:    boolean
  karigarLimit:     number
  canUseTracking:   boolean
  canUseQR:         boolean
  canUsePhotos:     boolean
  canUseAnalytics:  boolean
  canSyncCloud:     boolean
  canUseMultiDevice: boolean

  // Usage
  ordersThisMonth:  number
  ordersLimit:      number | null
  isAtOrderLimit:   boolean
  customersTotal:   number
  customersLimit:   number | null
  isAtCustomerLimit: boolean
  karigarCount:     number
  isAtKarigarLimit: boolean

  // Actions
  upgrade:      (targetPlan?: PlanId) => void
  isLoading:    boolean
  refetch:      () => Promise<void>
}

export function usePlan(): PlanState {
  const router            = useRouter()
  const { shopId }        = useAuth()
  const [isLoading, setIsLoading] = useState(true)
  const [subData, setSubData]     = useState<any>(null)
  const [usageData, setUsageData] = useState<any>(null)

  const fetchPlanData = useCallback(async () => {
    if (!shopId) return
    setIsLoading(true)
    try {
      const [{ data: sub }, { data: usage }] = await Promise.all([
        (supabase as any)
          .from('subscriptions')
          .select('*, plan_limits(*)')
          .eq('shop_id', shopId)
          .single(),
        (supabase as any)
          .from('shop_usage')
          .select('*')
          .eq('shop_id', shopId)
          .single(),
      ])
      setSubData(sub)
      setUsageData(usage)
    } catch (e) {
      console.error('[usePlan] fetch failed:', e)
    } finally {
      setIsLoading(false)
    }
  }, [shopId])

  useEffect(() => {
    fetchPlanData()
  }, [fetchPlanData])

  // ── Derive state ─────────────────────────────────────────────
  const planId: PlanId   = (subData?.plan ?? 'starter') as PlanId
  const status: SubStatus = (subData?.status ?? 'active') as SubStatus
  const planDef           = PLANS[planId]
  const limits            = planDef.limits

  const now            = new Date()
  const trialEndsAt    = subData?.trial_ends_at ? new Date(subData.trial_ends_at) : null
  const expiresAt      = subData?.expires_at    ? new Date(subData.expires_at)    : null
  const graceEndsAt    = subData?.grace_ends_at ? new Date(subData.grace_ends_at) : null

  const isTrialing     = status === 'trialing' && !!trialEndsAt && trialEndsAt > now
  const isActive       = status === 'active' || isTrialing
  const isExpired      = status === 'expired' || (status === 'cancelled' && !!expiresAt && expiresAt < now)
  const inGrace        = status === 'grace' && !!graceEndsAt && graceEndsAt > now

  // Days left calculation
  const relevantDate   = isTrialing ? trialEndsAt : expiresAt
  const daysLeft       = relevantDate
    ? Math.max(0, Math.ceil((relevantDate.getTime() - now.getTime()) / 86400000))
    : null

  // Feature gates — expired users lose paid features (with grace exception)
  const hasAccess      = isActive || inGrace

  // Usage
  const ordersThisMonth  = usageData?.orders_this_month  ?? 0
  const customersTotal   = usageData?.customers_total    ?? 0
  const karigarCount     = usageData?.karigar_count      ?? 0

  const upgrade = (targetPlan?: PlanId) => {
    router.push(targetPlan
      ? `/billing/upgrade?plan=${targetPlan}`
      : '/billing/upgrade'
    )
  }

  return {
    plan:     planId,
    status,
    trialEndsAt,
    expiresAt,
    gracEndsAt: graceEndsAt,

    isTrialing,
    isActive,
    isExpired,
    inGrace,
    daysLeft,
    isTrial: isTrialing,

    // Feature gates
    canAddKarigar:     hasAccess && limits.maxKarigar > 0,
    karigarLimit:      limits.maxKarigar,
    canUseTracking:    hasAccess && limits.hasTrackingUrl,
    canUseQR:          hasAccess && limits.hasQrCode,
    canUsePhotos:      hasAccess && limits.hasPhotos,
    canUseAnalytics:   hasAccess && limits.hasAnalytics,
    canSyncCloud:      hasAccess && limits.hasCloudSync,
    canUseMultiDevice: hasAccess && limits.hasMultiDevice,

    // Usage
    ordersThisMonth,
    ordersLimit:          limits.maxOrdersPerMonth,
    isAtOrderLimit:       limits.maxOrdersPerMonth !== null && ordersThisMonth >= limits.maxOrdersPerMonth,
    customersTotal,
    customersLimit:       limits.maxCustomers,
    isAtCustomerLimit:    limits.maxCustomers !== null && customersTotal >= limits.maxCustomers,
    karigarCount,
    isAtKarigarLimit:     limits.maxKarigar !== null && karigarCount >= limits.maxKarigar,

    upgrade,
    isLoading,
    refetch: fetchPlanData,
  }
}