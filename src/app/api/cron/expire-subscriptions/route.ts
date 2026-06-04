// src/app/api/cron/expire-subscriptions/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { sendAdminSubscriptionEventEmail } from '@/lib/security/email-otp'
import { sbGet, sbPatch } from '@/lib/supabase/service'

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY not set' }, { status: 500 })
  }

  const now     = new Date().toISOString()
  const results = { expiryMirrored: 0, graceStarted: 0, graceLapsed: 0, expired: 0, errors: [] as string[] }

  try {
    // 0. Keep denormalized shops.plan_expires_at in sync for admin views.
    const paidWithExpiry = await sbGet(
      `subscriptions?status=eq.active&plan=in.(professional,business)&expires_at=not.is.null&select=shop_id,expires_at`
    )
    for (const sub of paidWithExpiry) {
      try {
        await sbPatch(`shops?id=eq.${sub.shop_id}`, {
          plan_expires_at: sub.expires_at,
          updated_at: now,
        })
        results.expiryMirrored++
      } catch (e) { results.errors.push(String(e)) }
    }

    // 1. Paid subscriptions past expiry, including cancelled access-through-expiry plans → Starter immediately
    const expiredPaid = await sbGet(
      `subscriptions?status=in.(active,cancelled)&expires_at=lt.${now}&expires_at=not.is.null&select=id,shop_id,plan,billing_cycle,expires_at`
    )
    for (const sub of expiredPaid) {
      try {
        await sbPatch(`subscriptions?id=eq.${sub.id}`, {
          status: 'active',
          plan: 'starter',
          billing_cycle: null,
          expires_at: null,
          grace_ends_at: null,
          updated_at: now,
        })
        await sbPatch(`shops?id=eq.${sub.shop_id}`, {
          plan: 'starter', plan_expires_at: null, updated_at: now,
        })
        await sendAdminSubscriptionEventEmail({
          shopId: sub.shop_id,
          event: 'expired',
          previousPlan: sub.plan,
          plan: 'starter',
          cycle: sub.billing_cycle,
          expiresAt: sub.expires_at,
        }).catch((e) => console.error('[Cron] admin expired email failed:', e))
        results.expired++
      } catch (e) { results.errors.push(String(e)) }
    }

    // 2. Grace lapsed → expired
    const toLapse = await sbGet(
      `subscriptions?status=eq.grace&grace_ends_at=lt.${now}&grace_ends_at=not.is.null&select=id,shop_id,plan,billing_cycle,grace_ends_at`
    )
    for (const sub of toLapse) {
      try {
        await sbPatch(`subscriptions?id=eq.${sub.id}`, {
          status: 'active', plan: 'starter', billing_cycle: null, expires_at: null, updated_at: now,
        })
        await sbPatch(`shops?id=eq.${sub.shop_id}`, {
          plan: 'starter', plan_expires_at: null, updated_at: now,
        })
        await sendAdminSubscriptionEventEmail({
          shopId: sub.shop_id,
          event: 'expired',
          previousPlan: sub.plan,
          plan: 'starter',
          cycle: sub.billing_cycle,
          expiresAt: sub.grace_ends_at,
        }).catch((e) => console.error('[Cron] admin grace email failed:', e))
        results.graceLapsed++
      } catch (e) { results.errors.push(String(e)) }
    }

    // 3. Trials past end → expired
    const trialLapsed = await sbGet(
      `subscriptions?status=eq.trialing&trial_ends_at=lt.${now}&select=id,shop_id,plan,trial_ends_at`
    )
    for (const sub of trialLapsed) {
      try {
        await sbPatch(`subscriptions?id=eq.${sub.id}`, {
          status: 'active', plan: 'starter', billing_cycle: null, expires_at: null, updated_at: now,
        })
        await sbPatch(`shops?id=eq.${sub.shop_id}`, {
          plan: 'starter', plan_expires_at: null, updated_at: now,
        })
        await sendAdminSubscriptionEventEmail({
          shopId: sub.shop_id,
          event: 'expired',
          previousPlan: sub.plan,
          plan: 'starter',
          expiresAt: sub.trial_ends_at,
        }).catch((e) => console.error('[Cron] admin trial email failed:', e))
        results.expired++
      } catch (e) { results.errors.push(String(e)) }
    }

    return NextResponse.json({ success: true, timestamp: now, ...results })
  } catch (e) {
    console.error('[Cron] expire-subscriptions error:', e)
    return NextResponse.json({ success: false, error: 'Cron job failed' }, { status: 500 })
  }
}
