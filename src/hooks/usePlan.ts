// src/hooks/usePlan.ts
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter }  from 'next/navigation'
import { useAuth }    from '@/lib/auth/AuthContext'
import { supabase }   from '@/lib/supabase/client'
import { PLANS, PlanId, SubStatus } from '@/lib/billing/plans'

export interface PlanState {
  // Plan info
  plan:           PlanId
  status:         SubStatus
  trialEndsAt:    Date | null
  expiresAt:      Date | null
  gracEndsAt:     Date | null

  // Computed booleans
  isTrialing:     boolean
  isActive:       boolean
  isExpired:      boolean
  inGrace:        boolean
  daysLeft:       number | null
  isTrial:        boolean

  // Feature gates
  canAddKarigar:      boolean
  karigarLimit:       number
  canUseTracking:     boolean
  canUseQR:           boolean
  canUsePhotos:       boolean
  canUseAnalytics:    boolean
  canSyncCloud:       boolean
  canUseMultiDevice:  boolean

  // Usage
  ordersThisMonth:    number
  ordersLimit:        number | null
  isAtOrderLimit:     boolean
  customersTotal:     number
  customersLimit:     number | null
  isAtCustomerLimit:  boolean
  karigarCount:       number
  isAtKarigarLimit:   boolean

  // Actions
  upgrade:    (targetPlan?: PlanId) => void
  isLoading:  boolean
  refetch:    () => Promise<void>
}

// ── Strict plan validator ─────────────────────────────────────────
// Returns 'starter' for any unknown/null/undefined value
const VALID_PLANS: PlanId[]     = ['starter', 'professional', 'business']
const VALID_STATUSES: SubStatus[] = ['trialing', 'active', 'cancelled', 'expired', 'grace']

function safePlan(raw: unknown): PlanId {
  if (typeof raw === 'string' && VALID_PLANS.includes(raw as PlanId)) {
    return raw as PlanId
  }
  return 'starter'
}

function safeStatus(raw: unknown): SubStatus {
  if (typeof raw === 'string' && VALID_STATUSES.includes(raw as SubStatus)) {
    return raw as SubStatus
  }
  return 'active'
}

export function usePlan(): PlanState {
  const router              = useRouter()
  const { shopId }          = useAuth()
  const [isLoading, setIsLoading] = useState(true)
  const [subData,   setSubData]   = useState<Record<string, unknown> | null>(null)
  const [usageData, setUsageData] = useState<Record<string, unknown> | null>(null)

  // Track if component is still mounted
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const fetchPlanData = useCallback(async () => {
    if (!shopId) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)

    try {
      const [subResult, usageResult] = await Promise.all([
        (supabase as any)
          .from('subscriptions')
          .select('plan, status, billing_cycle, trial_ends_at, expires_at, grace_ends_at, amount_pkr')
          .eq('shop_id', shopId)
          .maybeSingle(),
        (supabase as any)
          .from('shop_usage')
          .select('orders_this_month, customers_total, karigar_count, storage_used_kb')
          .eq('shop_id', shopId)
          .maybeSingle(),
      ])

      if (!mountedRef.current) return

      // Log for debugging — remove in production
      if (process.env.NODE_ENV === 'development') {
        console.log('[usePlan] raw subscription:', subResult.data)
        console.log('[usePlan] raw usage:', usageResult.data)
        console.log('[usePlan] errors:', subResult.error, usageResult.error)
      }

      if (subResult.error) {
        console.error('[usePlan] subscription fetch error:', subResult.error.message)
      }

      // If no subscription row exists yet, default to starter
      setSubData(subResult.data ?? { plan: 'starter', status: 'active' })
      setUsageData(usageResult.data ?? null)

    } catch (e) {
      console.error('[usePlan] fetch error:', e)
      // Safe fallback — never show wrong plan
      if (mountedRef.current) {
        setSubData({ plan: 'starter', status: 'active' })
        setUsageData(null)
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false)
      }
    }
  }, [shopId])

  useEffect(() => {
    fetchPlanData()
  }, [fetchPlanData])

  // ── Derive values safely ──────────────────────────────────────

  const planId: PlanId    = safePlan(subData?.plan)
  const status: SubStatus = safeStatus(subData?.status)
  const planDef           = PLANS[planId]
  const limits            = planDef.limits

  const now = new Date()

  const trialEndsAt = subData?.trial_ends_at
    ? new Date(subData.trial_ends_at as string)
    : null

  const expiresAt = subData?.expires_at
    ? new Date(subData.expires_at as string)
    : null

  const graceEndsAt = subData?.grace_ends_at
    ? new Date(subData.grace_ends_at as string)
    : null

  // Computed booleans
  const isTrialing = status === 'trialing' && trialEndsAt !== null && trialEndsAt > now
  const inGrace    = status === 'grace'    && graceEndsAt !== null && graceEndsAt > now
  const isActive   = status === 'active'   || isTrialing
  const isExpired  = status === 'expired'  ||
    (status === 'cancelled' && expiresAt !== null && expiresAt < now)

  // Days left until trial/expiry
  const relevantDate = isTrialing ? trialEndsAt : expiresAt
  const daysLeft     = relevantDate
    ? Math.max(0, Math.ceil((relevantDate.getTime() - now.getTime()) / 86400000))
    : null

  // User has access if active OR in grace period
  const hasAccess = isActive || inGrace

  // Usage counters
  const ordersThisMonth = Number(usageData?.orders_this_month ?? 0)
  const customersTotal  = Number(usageData?.customers_total   ?? 0)
  const karigarCount    = Number(usageData?.karigar_count      ?? 0)

  const karigarDisplayLimit = limits.maxKarigar === 0    ? 0
    : limits.maxKarigar >= 999 ? 999   // keep 999 for internal use
    : limits.maxKarigar

  const upgrade = (targetPlan?: PlanId) => {
    const dest = targetPlan
      ? `/billing/upgrade?plan=${targetPlan}`
      : '/billing/upgrade'
    router.push(dest)
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

    // Feature gates
    canAddKarigar:      hasAccess && limits.maxKarigar > 0,
    karigarLimit:       karigarDisplayLimit,   // 0, 3, or 999
    canUseTracking:     hasAccess && limits.hasTrackingUrl,
    canUseQR:           hasAccess && limits.hasQrCode,
    canUsePhotos:       hasAccess && limits.hasPhotos,
    canUseAnalytics:    hasAccess && limits.hasAnalytics,
    canSyncCloud:       hasAccess && limits.hasCloudSync,
    canUseMultiDevice:  hasAccess && limits.hasMultiDevice,

    // Usage
    ordersThisMonth,
    ordersLimit:          limits.maxOrdersPerMonth,
    isAtOrderLimit:
      limits.maxOrdersPerMonth !== null &&
      ordersThisMonth >= limits.maxOrdersPerMonth,

    customersTotal,
    customersLimit:       limits.maxCustomers,
    isAtCustomerLimit:
      limits.maxCustomers !== null &&
      customersTotal >= limits.maxCustomers,

    karigarCount,
    isAtKarigarLimit:
      limits.maxKarigar !== 999 &&
      limits.maxKarigar > 0 &&
      karigarCount >= limits.maxKarigar,

    upgrade,
    isLoading,
    refetch: fetchPlanData,
  }
}