// src/app/api/cron/expire-subscriptions/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { sendAdminSubscriptionEventEmail } from '@/lib/security/email-otp'
import { sbGet, sbPatch } from '@/lib/supabase/service'
import { logger } from '@/lib/logger'
import { mapConcurrent } from '@/lib/concurrent'

export async function GET(req: NextRequest) {
  return POST(req)
}
export async function POST(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY not set' }, { status: 500 })
  }

  const now     = new Date()
  const nowISO = now.toISOString()
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 86400000).toISOString()
  let expiryMirrored = 0
  let cancelledToGrace = 0
  let activeExpired = 0
  let graceLapsed = 0
  let trialLapsedCount = 0

  try {
    // 0. Keep denormalized shops.plan_expires_at in sync for admin views.
    const paidWithExpiry = await sbGet(
      `subscriptions?status=in.(active,cancelled)&plan=in.(professional,business)&expires_at=not.is.null&select=shop_id,expires_at&limit=1000`
    )
    const syncErrors0 = await mapConcurrent(paidWithExpiry, async (sub) => {
      await sbPatch(`shops?id=eq.${sub.shop_id}`, {
        plan_expires_at: sub.expires_at,
        updated_at: nowISO,
      })
      expiryMirrored++
    })

    // 1. Cancelled subscriptions past their expires_at → enter 7‑day grace period
    const toGracePeriod = await sbGet(
      `subscriptions?status=eq.cancelled&expires_at=lt.${nowISO}&expires_at=not.is.null&select=id,shop_id,plan,billing_cycle,expires_at&limit=1000`
    )
    const syncErrors1 = await mapConcurrent(toGracePeriod, async (sub) => {
      await sbPatch(`subscriptions?id=eq.${sub.id}`, {
        status: 'grace',
        grace_ends_at: sevenDaysFromNow,
        updated_at: nowISO,
      })
      await sendAdminSubscriptionEventEmail({
        shopId: sub.shop_id,
        event: 'downgraded',
        previousPlan: sub.plan,
        plan: sub.plan,
        cycle: sub.billing_cycle,
        expiresAt: sevenDaysFromNow,
      }).catch(() => {})
      cancelledToGrace++
    })

    // 2. Active subscriptions past expiry → grace period (consistent with cancelled)
    const expiredPaid = await sbGet(
      `subscriptions?status=eq.active&expires_at=lt.${nowISO}&expires_at=not.is.null&select=id,shop_id,plan,billing_cycle,expires_at&limit=1000`
    )
    const syncErrors2 = await mapConcurrent(expiredPaid, async (sub) => {
      await sbPatch(`subscriptions?id=eq.${sub.id}`, {
        status: 'grace',
        grace_ends_at: sevenDaysFromNow,
        updated_at: nowISO,
      })
      await sendAdminSubscriptionEventEmail({
        shopId: sub.shop_id, event: 'downgraded',
        previousPlan: sub.plan, plan: sub.plan,
        cycle: sub.billing_cycle, expiresAt: sevenDaysFromNow,
      }).catch(() => {})
      activeExpired++
    })

    // 3. Grace lapsed
    const toLapse = await sbGet(
      `subscriptions?status=eq.grace&grace_ends_at=lt.${nowISO}&grace_ends_at=not.is.null&select=id,shop_id,plan,billing_cycle,grace_ends_at&limit=1000`
    )
    const syncErrors3 = await mapConcurrent(toLapse, async (sub) => {
      await sbPatch(`subscriptions?id=eq.${sub.id}`, {
        status: 'active', plan: 'starter', billing_cycle: null,
        expires_at: null, updated_at: nowISO,
      })
      await sbPatch(`shops?id=eq.${sub.shop_id}`, {
        plan: 'starter', plan_expires_at: null, updated_at: nowISO,
      })
      await sendAdminSubscriptionEventEmail({
        shopId: sub.shop_id, event: 'expired',
        previousPlan: sub.plan, plan: 'starter',
        cycle: sub.billing_cycle, expiresAt: sub.grace_ends_at,
      }).catch(() => {})
      graceLapsed++
    })

    // 4. Trials past end
    const trialLapsed = await sbGet(
      `subscriptions?status=eq.trialing&trial_ends_at=lt.${nowISO}&select=id,shop_id,plan,trial_ends_at&limit=1000`
    )
    const syncErrors4 = await mapConcurrent(trialLapsed, async (sub) => {
      await sbPatch(`subscriptions?id=eq.${sub.id}`, {
        status: 'active', plan: 'starter', billing_cycle: null,
        expires_at: null, updated_at: nowISO,
      })
      await sbPatch(`shops?id=eq.${sub.shop_id}`, {
        plan: 'starter', plan_expires_at: null, updated_at: nowISO,
      })
      await sendAdminSubscriptionEventEmail({
        shopId: sub.shop_id, event: 'expired',
        previousPlan: sub.plan, plan: 'starter',
        expiresAt: sub.trial_ends_at,
      }).catch(() => {})
      trialLapsedCount++
    })

    const allErrors = [...syncErrors0, ...syncErrors1, ...syncErrors2, ...syncErrors3, ...syncErrors4]

    logger.info('expire-subscriptions', 'completed', {
      expiryMirrored, cancelledToGrace, activeExpired, graceLapsed, trialLapsedCount,
    })

    return NextResponse.json({
      success: true, timestamp: nowISO,
      expiryMirrored, cancelledToGrace, activeExpired, graceLapsed, trialLapsedCount,
      errors: allErrors.length > 0 ? allErrors : undefined,
    })
  } catch (e) {
    logger.error('expire-subscriptions', 'error', e)
    return NextResponse.json({ success: false, error: 'Cron job failed' }, { status: 500 })
  }
}
