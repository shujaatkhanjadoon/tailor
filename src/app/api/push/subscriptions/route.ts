import { NextRequest, NextResponse } from 'next/server'

const SB_URL = () => process.env.NEXT_PUBLIC_SUPABASE_URL!
const SB_KEY = () => process.env.SUPABASE_SERVICE_ROLE_KEY!

const headers = () => ({
  'Content-Type': 'application/json',
  apikey: SB_KEY(),
  Authorization: `Bearer ${SB_KEY()}`,
  Prefer: 'resolution=merge-duplicates,return=minimal',
})

export async function POST(req: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY missing' }, { status: 500 })
  }

  const { shopId, memberId, subscription } = await req.json()
  if (!shopId || !subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return NextResponse.json({ error: 'Invalid push subscription' }, { status: 400 })
  }

  const res = await fetch(`${SB_URL()}/rest/v1/push_subscriptions?on_conflict=endpoint`, {
    method: 'POST',
    headers: headers(),
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
    return NextResponse.json({ error: await res.text() }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const { endpoint } = await req.json()
  if (!endpoint) return NextResponse.json({ error: 'endpoint required' }, { status: 400 })

  const res = await fetch(`${SB_URL()}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`, {
    method: 'DELETE',
    headers: { ...headers(), Prefer: 'return=minimal' },
  })

  if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: 500 })
  return NextResponse.json({ success: true })
}
