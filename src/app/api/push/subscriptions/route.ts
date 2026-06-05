import { NextRequest, NextResponse } from 'next/server'
import { sbFetch } from '@/lib/supabase/service'
import { validate, schemas } from '@/lib/validation'

async function validateMember(memberId: string, shopId: string): Promise<boolean> {
  try {
    const res = await sbFetch(
      `team_members?id=eq.${memberId}&shop_id=eq.${shopId}&is_active=eq.true&deleted_at=is.null&select=id&limit=1`
    )
    if (!res.ok) return false
    const rows = await res.json()
    return rows?.length > 0
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY missing' }, { status: 500 })
  }

  const parsed = await validate(schemas.pushSubscribe, req)
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const { shopId, memberId, subscription } = parsed.data

  const valid = await validateMember(memberId, shopId)
  if (!valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Dedup: ensure endpoint not already registered to a different shop ──
  try {
    const dup = await sbFetch(
      `push_subscriptions?endpoint=eq.${encodeURIComponent(subscription.endpoint)}&shop_id=neq.${shopId}&select=id,shop_id&limit=1`
    )
    if (dup.ok) {
      const rows = await dup.json()
      if (rows?.length > 0) {
        return NextResponse.json({ error: 'Subscription already registered under a different shop' }, { status: 409 })
      }
    }
  } catch (e) {
    console.warn('[push-subscriptions] Dedup check failed (proceeding):', e)
  }

  const res = await sbFetch('push_subscriptions?on_conflict=endpoint', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      shop_id: shopId,
      member_id: memberId ?? null,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      user_agent: req.headers.get('user-agent'),
      last_seen_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    }),
  })

  if (!res.ok) {
    return NextResponse.json({ error: 'Failed to save push subscription' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const parsed = await validate(schemas.pushUnsubscribe, req)
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const { endpoint, memberId, shopId } = parsed.data

  const valid = await validateMember(memberId, shopId)
  if (!valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const res = await sbFetch(`push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`, {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' },
  })

  if (!res.ok) return NextResponse.json({ error: 'Failed to remove push subscription' }, { status: 500 })
  return NextResponse.json({ success: true })
}
