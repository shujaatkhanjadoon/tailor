// src/hooks/usePlan.ts
import { useState, useEffect, useCallback } from 'react'
import { useRouter }   from 'next/navigation'
import { useAuth }     from '@/lib/auth/AuthContext'
import { supabase }    from '@/lib/supabase/client'
import { PLANS, PlanId, SubStatus } from '@/lib/billing/plans'

export interface PlanState {
  plan:          PlanId
  status:        SubStatus
  trialEndsAt:   Date | null
  expiresAt:     Date | null
  gracEndsAt:    Date | null
  isTrialing:    boolean
  isActive:      boolean
  isExpired:     boolean
  inGrace:       boolean
  daysLeft:      number | null
  isTrial:       boolean
  canAddKarigar:     boolean
  karigarLimit:      number
  canUseTracking:    boolean
  canUseQR:          boolean
  canUsePhotos:      boolean
  canUseAnalytics:   boolean
  canSyncCloud:      boolean
  canUseMultiDevice: boolean
  ordersThisMonth:   number
  ordersLimit:       number | null
  isAtOrderLimit:    boolean
  customersTotal:    number
  customersLimit:    number | null
  isAtCustomerLimit: boolean
  karigarCount:      number
  isAtKarigarLimit:  boolean
  upgrade:       (targetPlan?: PlanId) => void
  isLoading:     boolean
  refetch:       () => Promise<void>
}

export function usePlan(): PlanState {
  const router            = useRouter()
  const { shopId, isOwner } = useAuth()
  const [isLoading, setIsLoading] = useState(true)
  const [subData,   setSubData]   = useState<any>(null)
  const [usageData, setUsageData] = useState<any>(null)

  const fetchPlanData = useCallback(async () => {
    if (!shopId) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    try {
      const [{ data: sub }, { data: usage }] = await Promise.all([
        (supabase as any)
          .from('subscriptions')
          .select('*')
          .eq('shop_id', shopId)
          .maybeSingle(),
        (supabase as any)
          .from('shop_usage')
          .select('*')
          .eq('shop_id', shopId)
          .maybeSingle(),
      ])
      setSubData(sub)
      setUsageData(usage)
    } catch (e) {
      console.error('[usePlan] fetch error:', e)
    } finally {
      setIsLoading(false)
    }
  }, [shopId])

  useEffect(() => {
    fetchPlanData()
  }, [fetchPlanData])

  // ── Derive values ────────────────────────────────────────────────

  // Default to starter if no subscription found
  const rawPlan: PlanId  = (subData?.plan ?? 'starter') as PlanId
  // Validate plan is one of the 3 known plans
  const planId: PlanId   = ['starter','professional','business'].includes(rawPlan)
    ? rawPlan : 'starter'

  const status: SubStatus = (subData?.status ?? 'active') as SubStatus
  const planDef           = PLANS[planId]
  const limits            = planDef.limits

  const now           = new Date()
  const trialEndsAt   = subData?.trial_ends_at ? new Date(subData.trial_ends_at) : null
  const expiresAt     = subData?.expires_at    ? new Date(subData.expires_at)    : null
  const graceEndsAt   = subData?.grace_ends_at ? new Date(subData.grace_ends_at) : null

  const isTrialing    = status === 'trialing' && !!trialEndsAt && trialEndsAt > now
  const inGrace       = status === 'grace'    && !!graceEndsAt && graceEndsAt > now
  const isActive      = status === 'active' || isTrialing
  const isExpired     = status === 'expired'  ||
    (status === 'cancelled' && !!expiresAt && expiresAt < now)

  // Days left
  const relevantDate  = isTrialing ? trialEndsAt : expiresAt
  const daysLeft      = relevantDate
    ? Math.max(0, Math.ceil((relevantDate.getTime() - now.getTime()) / 86400000))
    : null

  // Features accessible if active or in grace
  const hasAccess = isActive || inGrace

  // Usage
  const ordersThisMonth = usageData?.orders_this_month ?? 0
  const customersTotal  = usageData?.customers_total   ?? 0
  const karigarCount    = usageData?.karigar_count      ?? 0

  const upgrade = (targetPlan?: PlanId) => {
    router.push(targetPlan ? `/billing/upgrade?plan=${targetPlan}` : '/billing/upgrade')
  }

  return {
    plan:   planId,
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

    // Feature gates — only allow if plan supports it AND user has access
    canAddKarigar:      hasAccess && limits.maxKarigar > 0,
    karigarLimit:       limits.maxKarigar,
    canUseTracking:     hasAccess && limits.hasTrackingUrl,
    canUseQR:           hasAccess && limits.hasQrCode,
    canUsePhotos:       hasAccess && limits.hasPhotos,
    canUseAnalytics:    hasAccess && limits.hasAnalytics,
    canSyncCloud:       hasAccess && limits.hasCloudSync,
    canUseMultiDevice:  hasAccess && limits.hasMultiDevice,

    // Usage
    ordersThisMonth,
    ordersLimit:          limits.maxOrdersPerMonth,
    isAtOrderLimit:       limits.maxOrdersPerMonth !== null &&
                          ordersThisMonth >= limits.maxOrdersPerMonth,
    customersTotal,
    customersLimit:       limits.maxCustomers,
    isAtCustomerLimit:    limits.maxCustomers !== null &&
                          customersTotal >= limits.maxCustomers,
    karigarCount,
    isAtKarigarLimit:     limits.maxKarigar < 999 &&
                          karigarCount >= limits.maxKarigar,

    upgrade,
    isLoading,
    refetch: fetchPlanData,
  }
}