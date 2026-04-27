// src/app/api/cron/expire-subscriptions/route.ts
import { NextRequest, NextResponse } from 'next/server'

const jsonHeaders = (serviceKey: string) => ({
  'Content-Type': 'application/json',
  'apikey': serviceKey,
  'Authorization': `Bearer ${serviceKey}`,
})

const getHeaders = () => ({
  'Content-Type':  'application/json',
  'apikey':        process.env.SUPABASE_SERVICE_ROLE_KEY!,
  'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
})

const BASE = () => `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1`

async function sbGet(path: string) {
  const res = await fetch(`${BASE()}/${path}`, { headers: getHeaders() })
  if (!res.ok) throw new Error(`GET ${path}: ${await res.text()}`)
  return res.json()
}

async function sbPatch(path: string, data: object) {
  const res = await fetch(`${BASE()}/${path}`, {
    method:  'PATCH',
    headers: { ...getHeaders(), 'Prefer': 'return=minimal' },
    body:    JSON.stringify(data),
  })
  if (!res.ok) throw new Error(`PATCH ${path}: ${await res.text()}`)
}

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY not set' }, { status: 500 })
  }

  const now     = new Date().toISOString()
  const results = { graceStarted: 0, graceLapsed: 0, expired: 0, errors: [] as string[] }

  try {
    // 1. Active past expiry → grace period
    const toGrace = await sbGet(
      `subscriptions?status=eq.active&expires_at=lt.${now}&expires_at=not.is.null&select=id,shop_id,expires_at`
    )
    for (const sub of toGrace) {
      try {
        const graceEnd = new Date(sub.expires_at)
        graceEnd.setDate(graceEnd.getDate() + 7)
        await sbPatch(`subscriptions?id=eq.${sub.id}`, {
          status: 'grace', grace_ends_at: graceEnd.toISOString(), updated_at: now,
        })
        results.graceStarted++
      } catch (e) { results.errors.push(String(e)) }
    }

    // 2. Grace lapsed → expired
    const toLapse = await sbGet(
      `subscriptions?status=eq.grace&grace_ends_at=lt.${now}&grace_ends_at=not.is.null&select=id,shop_id`
    )
    for (const sub of toLapse) {
      try {
        await sbPatch(`subscriptions?id=eq.${sub.id}`, {
          status: 'expired', updated_at: now,
        })
        await sbPatch(`shops?id=eq.${sub.shop_id}`, {
          plan: 'starter', updated_at: now,
        })
        results.graceLapsed++
      } catch (e) { results.errors.push(String(e)) }
    }

    // 3. Trials past end → expired
    const trialLapsed = await sbGet(
      `subscriptions?status=eq.trialing&trial_ends_at=lt.${now}&select=id,shop_id`
    )
    for (const sub of trialLapsed) {
      try {
        await sbPatch(`subscriptions?id=eq.${sub.id}`, {
          status: 'expired', plan: 'starter', updated_at: now,
        })
        await sbPatch(`shops?id=eq.${sub.shop_id}`, {
          plan: 'starter', updated_at: now,
        })
        results.expired++
      } catch (e) { results.errors.push(String(e)) }
    }

    return NextResponse.json({ success: true, timestamp: now, ...results })
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 })
  }
}
