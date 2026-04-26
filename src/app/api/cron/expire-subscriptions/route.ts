// src/app/api/cron/expire-subscriptions/route.ts
import { NextRequest, NextResponse } from 'next/server'

type SubscriptionToGrace = {
  id: string
  shop_id: string
  plan: string
  expires_at: string
}

type SubscriptionToLapse = {
  id: string
  shop_id: string
  plan: string
}

type TrialToExpire = {
  id: string
  shop_id: string
}

const jsonHeaders = (serviceKey: string) => ({
  'Content-Type': 'application/json',
  'apikey': serviceKey,
  'Authorization': `Bearer ${serviceKey}`,
})

async function supabaseSelect<T>(
  supabaseUrl: string,
  serviceKey: string,
  table: string,
  params: [string, string][],
): Promise<{ data: T[] | null; error: string | null }> {
  const url = new URL(`${supabaseUrl}/rest/v1/${table}`)

  for (const [key, value] of params) {
    url.searchParams.append(key, value)
  }

  const res = await fetch(url, {
    headers: jsonHeaders(serviceKey),
  })

  if (!res.ok) {
    return { data: null, error: await res.text() }
  }

  return { data: await res.json().catch(() => []), error: null }
}

async function supabaseUpdate(
  supabaseUrl: string,
  serviceKey: string,
  table: string,
  id: string,
  body: Record<string, unknown>,
): Promise<string | null> {
  const url = new URL(`${supabaseUrl}/rest/v1/${table}`)
  url.searchParams.set('id', `eq.${id}`)

  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      ...jsonHeaders(serviceKey),
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify(body),
  })

  return res.ok ? null : await res.text()
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({
      error: 'Missing env vars: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY',
    }, { status: 500 })
  }

  const now = new Date().toISOString()
  const results = {
    expired: 0,
    graceStarted: 0,
    graceLapsed: 0,
    errors: [] as string[],
  }

  try {
    const { data: toGrace, error: graceErr } = await supabaseSelect<SubscriptionToGrace>(
      supabaseUrl,
      serviceKey,
      'subscriptions',
      [
        ['select', 'id,shop_id,plan,expires_at'],
        ['status', 'eq.active'],
        ['expires_at', 'not.is.null'],
        ['expires_at', `lt.${now}`],
      ],
    )

    if (graceErr) results.errors.push(`grace query: ${graceErr}`)

    for (const sub of toGrace ?? []) {
      const graceEnd = new Date(sub.expires_at)
      graceEnd.setDate(graceEnd.getDate() + 7)

      const error = await supabaseUpdate(
        supabaseUrl,
        serviceKey,
        'subscriptions',
        sub.id,
        {
          status: 'grace',
          grace_ends_at: graceEnd.toISOString(),
          updated_at: now,
        },
      )

      if (error) {
        results.errors.push(`grace update ${sub.id}: ${error}`)
      } else {
        results.graceStarted++
        console.log(`[Cron] Grace started: ${sub.shop_id} (${sub.plan})`)
      }
    }

    const { data: toLapse, error: lapseErr } = await supabaseSelect<SubscriptionToLapse>(
      supabaseUrl,
      serviceKey,
      'subscriptions',
      [
        ['select', 'id,shop_id,plan'],
        ['status', 'eq.grace'],
        ['grace_ends_at', 'not.is.null'],
        ['grace_ends_at', `lt.${now}`],
      ],
    )

    if (lapseErr) results.errors.push(`lapse query: ${lapseErr}`)

    for (const sub of toLapse ?? []) {
      const error = await supabaseUpdate(
        supabaseUrl,
        serviceKey,
        'subscriptions',
        sub.id,
        {
          status: 'expired',
          updated_at: now,
        },
      )

      if (error) {
        results.errors.push(`expire update ${sub.id}: ${error}`)
      } else {
        const shopError = await supabaseUpdate(
          supabaseUrl,
          serviceKey,
          'shops',
          sub.shop_id,
          { plan: 'starter', updated_at: now },
        )

        if (shopError) {
          results.errors.push(`shop downgrade ${sub.shop_id}: ${shopError}`)
        }

        results.graceLapsed++
        console.log(`[Cron] Expired + downgraded: ${sub.shop_id} (${sub.plan})`)
      }
    }

    const { data: trialLapsed, error: trialErr } = await supabaseSelect<TrialToExpire>(
      supabaseUrl,
      serviceKey,
      'subscriptions',
      [
        ['select', 'id,shop_id'],
        ['status', 'eq.trialing'],
        ['trial_ends_at', `lt.${now}`],
      ],
    )

    if (trialErr) results.errors.push(`trial query: ${trialErr}`)

    for (const sub of trialLapsed ?? []) {
      const error = await supabaseUpdate(
        supabaseUrl,
        serviceKey,
        'subscriptions',
        sub.id,
        {
          status: 'expired',
          plan: 'starter',
          updated_at: now,
        },
      )

      if (error) {
        results.errors.push(`trial expire ${sub.id}: ${error}`)
      } else {
        const shopError = await supabaseUpdate(
          supabaseUrl,
          serviceKey,
          'shops',
          sub.shop_id,
          { plan: 'starter', updated_at: now },
        )

        if (shopError) {
          results.errors.push(`trial shop downgrade ${sub.shop_id}: ${shopError}`)
        }

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
      { status: 500 },
    )
  }
}
