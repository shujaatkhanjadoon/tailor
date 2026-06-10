// src/app/api/cron/expire-subscriptions/route.ts
// Incremental — processes up to 50 records per phase per run
import { NextRequest, NextResponse } from 'next/server'
import { sbGet, sbPatch, sbFetch } from '@/lib/supabase/service'
import { logger } from '@/lib/logger'
import { mapConcurrent } from '@/lib/concurrent'

export const maxDuration = 300

const BATCH_SIZE = 50

async function getCursor(jobName: string): Promise<string | null> {
  try {
    const rows = await sbGet(`cron_cursors?job_name=eq.${encodeURIComponent(jobName)}&select=cursor_value&limit=1`)
    return rows?.[0]?.cursor_value ?? null
  } catch { return null }
}

async function setCursor(jobName: string, cursor: string): Promise<void> {
  try {
    await sbFetch('cron_cursors?on_conflict=job_name', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job_name: jobName,
        cursor_value: cursor,
        updated_at: new Date().toISOString(),
      }),
    })
  } catch { /* non-fatal */ }
}

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
  let stalePaymentsRejected = 0

  try {
    const { sendAdminSubscriptionEventEmail } = await import('@/lib/security/email-otp')
    // 0. Auto-reject pending payments older than 48 hours (stuck payments)
    const staleCutoff = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString()
    const stalePayments = await sbGet(
      `subscription_payments?status=eq.pending&paid_at=lt.${staleCutoff}&select=id,shop_id,receipt_data&limit=${BATCH_SIZE}`
    )
    await mapConcurrent(stalePayments, async (p) => {
      const receipt = p.receipt_data ?? {}
      await sbPatch(`subscription_payments?id=eq.${p.id}`, {
        status: 'failed',
        receipt_data: { ...receipt, rejection_reason: 'Auto-rejected: pending > 48 hours', rejected_at: nowISO },
      })
      // Notify admin of auto-rejection
      if (p.shop_id) {
        await sendAdminSubscriptionEventEmail({
          shopId: p.shop_id,
          event: 'payment_submitted',
          reason: 'Auto-rejected: pending > 48 hours without verification',
        }).catch(() => {})
      }
      stalePaymentsRejected++
    })

    // 1. Keep denormalized shops.plan_expires_at in sync for admin views.
    const paidWithExpiry = await sbGet(
      `subscriptions?status=in.(active,cancelled)&plan=in.(professional,business)&expires_at=not.is.null&select=shop_id,expires_at&limit=${BATCH_SIZE}`
    )
    const syncErrors0 = await mapConcurrent(paidWithExpiry, async (sub) => {
      await sbPatch(`shops?id=eq.${sub.shop_id}`, {
        plan_expires_at: sub.expires_at,
        updated_at: nowISO,
      })
      expiryMirrored++
    })

    // 2. Cancelled subscriptions past their expires_at → enter 7‑day grace period
    const toGracePeriod = await sbGet(
      `subscriptions?status=eq.cancelled&expires_at=lt.${nowISO}&expires_at=not.is.null&select=id,shop_id,plan,billing_cycle,expires_at&limit=${BATCH_SIZE}`
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

    // 3. Active subscriptions past expiry → grace period (consistent with cancelled)
    const expiredPaid = await sbGet(
      `subscriptions?status=eq.active&expires_at=lt.${nowISO}&expires_at=not.is.null&select=id,shop_id,plan,billing_cycle,expires_at&limit=${BATCH_SIZE}`
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

    // 4. Grace lapsed
    const toLapse = await sbGet(
      `subscriptions?status=eq.grace&grace_ends_at=lt.${nowISO}&grace_ends_at=not.is.null&select=id,shop_id,plan,billing_cycle,grace_ends_at&limit=${BATCH_SIZE}`
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

    // 5. Trials past end
    const trialLapsed = await sbGet(
      `subscriptions?status=eq.trialing&trial_ends_at=lt.${nowISO}&select=id,shop_id,plan,trial_ends_at&limit=${BATCH_SIZE}`
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
      stalePaymentsRejected,
      errorCount: allErrors.length,
    })
    for (const err of allErrors) {
      logger.error('expire-subscriptions', 'batch-error', err)
    }

    return NextResponse.json({
      success: true, timestamp: nowISO,
      expiryMirrored, cancelledToGrace, activeExpired, graceLapsed, trialLapsedCount,
      stalePaymentsRejected,
      hasMore: (stalePayments.length + paidWithExpiry.length + toGracePeriod.length + expiredPaid.length + toLapse.length + trialLapsed.length) >= BATCH_SIZE,
    })
  } catch (e) {
    logger.error('expire-subscriptions', 'error', e)
    return NextResponse.json({ success: false, error: 'Cron job failed' }, { status: 500 })
  }
}
