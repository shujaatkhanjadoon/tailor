// src/app/api/cron/expire-subscriptions/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@supabase/supabase-js'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function GET(req: NextRequest) {
  // Verify this is a legitimate cron call
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now    = new Date().toISOString()
  const results = {
    expired:      0,
    graceStarted: 0,
    graceLapsed:  0,
    errors:       [] as string[],
  }

  try {
    // ── 1. Active subscriptions past expiry → grace period ────────
    // Give 7 days grace before fully expiring
    const { data: toGrace, error: graceErr } = await adminSupabase
      .from('subscriptions')
      .select('id, shop_id, plan, expires_at')
      .eq('status', 'active')
      .not('expires_at', 'is', null)
      .lt('expires_at', now)

    if (graceErr) results.errors.push(`grace query: ${graceErr.message}`)

    for (const sub of (toGrace ?? [])) {
      const graceEnd = new Date(sub.expires_at)
      graceEnd.setDate(graceEnd.getDate() + 7)

      const { error } = await adminSupabase
        .from('subscriptions')
        .update({
          status:       'grace',
          grace_ends_at: graceEnd.toISOString(),
          updated_at:   now,
        })
        .eq('id', sub.id)

      if (error) {
        results.errors.push(`grace update ${sub.id}: ${error.message}`)
      } else {
        results.graceStarted++
        console.log(`[Cron] Grace started: ${sub.shop_id} (${sub.plan})`)
      }
    }

    // ── 2. Grace period lapsed → expired ─────────────────────────
    const { data: toLapse, error: lapseErr } = await adminSupabase
      .from('subscriptions')
      .select('id, shop_id, plan')
      .eq('status', 'grace')
      .not('grace_ends_at', 'is', null)
      .lt('grace_ends_at', now)

    if (lapseErr) results.errors.push(`lapse query: ${lapseErr.message}`)

    for (const sub of (toLapse ?? [])) {
      const { error } = await adminSupabase
        .from('subscriptions')
        .update({
          status:     'expired',
          updated_at: now,
        })
        .eq('id', sub.id)

      if (error) {
        results.errors.push(`expire update ${sub.id}: ${error.message}`)
      } else {
        // Downgrade shop plan to starter
        await adminSupabase
          .from('shops')
          .update({ plan: 'starter', updated_at: now })
          .eq('id', sub.shop_id)

        results.graceLapsed++
        console.log(`[Cron] Expired + downgraded: ${sub.shop_id}`)
      }
    }

    // ── 3. Trials past end date → starter ────────────────────────
    const { data: trialLapsed, error: trialErr } = await adminSupabase
      .from('subscriptions')
      .select('id, shop_id')
      .eq('status', 'trialing')
      .lt('trial_ends_at', now)

    if (trialErr) results.errors.push(`trial query: ${trialErr.message}`)

    for (const sub of (trialLapsed ?? [])) {
      const { error } = await adminSupabase
        .from('subscriptions')
        .update({
          status:     'expired',
          plan:       'starter',
          updated_at: now,
        })
        .eq('id', sub.id)

      if (error) {
        results.errors.push(`trial expire ${sub.id}: ${error.message}`)
      } else {
        await adminSupabase
          .from('shops')
          .update({ plan: 'starter', updated_at: now })
          .eq('id', sub.shop_id)

        results.expired++
        console.log(`[Cron] Trial expired: ${sub.shop_id}`)
      }
    }

    console.log('[Cron] expire-subscriptions complete:', results)

    return NextResponse.json({
      success: true,
      timestamp: now,
      ...results,
    })

  } catch (e) {
    console.error('[Cron] expire-subscriptions error:', e)
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    )
  }
}