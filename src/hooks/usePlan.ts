// src/hooks/usePlan.ts
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter }  from 'next/navigation'
import { useAuth }    from '@/lib/auth/AuthContext'
import { supabase }   from '@/lib/supabase/client'
import { PLANS, PlanId, SubStatus, BillingCycle } from '@/lib/billing/plans'

// Module-level cache to prevent duplicate fetches across components
// TTL is short — plan changes are infrequent, but we don't want stale data
const CACHE_TTL = 30_000 // 30 seconds
interface PlanCacheEntry {
  subData: Record<string, unknown> | null
  usageData: Record<string, unknown> | null
  ts: number
}
const planCache = new Map<string, PlanCacheEntry>()

export interface PlanState {
  // Plan info
  plan:           PlanId
  billingCycle:   BillingCycle
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
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => { setNow(new Date()) }, [])

  // Track if component is still mounted
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const fetchPlanData = useCallback(async (forceRefresh = false) => {
    if (!shopId) {
      setIsLoading(false)
      return
    }

    // Check module-level cache first (skip if force refresh)
    if (!forceRefresh) {
      const cached = planCache.get(shopId)
      if (cached && Date.now() - cached.ts < CACHE_TTL) {
        setSubData(cached.subData)
        setUsageData(cached.usageData)
        setIsLoading(false)
        return
      }
    }

    setIsLoading(true)

    try {
      const [subResult, usageResult] = await Promise.all([
        supabase
          .from('subscriptions')
          .select('plan, status, billing_cycle, trial_ends_at, expires_at, grace_ends_at, amount_pkr')
          .eq('shop_id', shopId)
          .maybeSingle(),
        supabase
          .from('shop_usage')
          .select('orders_this_month, customers_total, karigar_count, storage_used_kb')
          .eq('shop_id', shopId)
          .maybeSingle(),
      ])

      if (mountedRef.current) {
        if (subResult.error) {
          console.error('[usePlan] subscription fetch error:', subResult.error.message)
        }

        // If no subscription row exists yet, default to starter
        const sub = subResult.data ?? { plan: 'starter', status: 'active' }
        const usage = usageResult.data ?? null

        // Update cache
        planCache.set(shopId, { subData: sub, usageData: usage, ts: Date.now() })
        // Cleanup old cache entries (keep under 50 entries)
        if (planCache.size > 50) {
          const cutoff = Date.now() - CACHE_TTL * 2
          for (const [key, entry] of planCache) {
            if (entry.ts < cutoff) planCache.delete(key)
          }
        }

        setSubData(sub)
        setUsageData(usage)
      }

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

  const rawPlanId: PlanId       = safePlan(subData?.plan)
  const rawStatus: SubStatus    = safeStatus(subData?.status)
  const billingCycle: BillingCycle = (subData?.billing_cycle as BillingCycle) ?? 'monthly'
  const rawExpiresAt = subData?.expires_at
    ? new Date(subData.expires_at as string)
    : null
  const isPaidPlanExpired = rawPlanId !== 'starter' &&
    rawExpiresAt !== null &&
    now !== null && rawExpiresAt < now &&
    rawStatus !== 'trialing'
  const planId: PlanId    = isPaidPlanExpired ? 'starter' : rawPlanId
  const status: SubStatus = isPaidPlanExpired ? 'active' : rawStatus
  const planDef           = PLANS[planId]
  const limits            = planDef.limits

  const trialEndsAt = subData?.trial_ends_at
    ? new Date(subData.trial_ends_at as string)
    : null

  const expiresAt = isPaidPlanExpired ? null : rawExpiresAt

  const graceEndsAt = subData?.grace_ends_at
    ? new Date(subData.grace_ends_at as string)
    : null

  // Computed booleans
  const isTrialing = status === 'trialing' && trialEndsAt !== null && now !== null && trialEndsAt > now
  const inGrace    = status === 'grace'    && graceEndsAt !== null && now !== null && graceEndsAt > now

  // A cancelled subscription with future expires_at still has active access until period end
  const isCancelledWithAccess = status === 'cancelled' && expiresAt !== null && now !== null && expiresAt > now
  const isActive   = status === 'active'   || isTrialing || isCancelledWithAccess
  const isExpired  = status === 'expired'  ||
    (status === 'cancelled' && expiresAt !== null && now !== null && expiresAt < now)

  // Days left until trial/expiry
  const relevantDate = isTrialing ? trialEndsAt : expiresAt
  const daysLeft     = relevantDate && now
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
    billingCycle,
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
    refetch: () => fetchPlanData(true),
  }
}
