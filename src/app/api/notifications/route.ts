import { NextRequest, NextResponse } from 'next/server'

const SB_URL = () => process.env.NEXT_PUBLIC_SUPABASE_URL!
const SB_KEY = () => process.env.SUPABASE_SERVICE_ROLE_KEY!
const headers = () => ({
  'Content-Type': 'application/json',
  apikey: SB_KEY(),
  Authorization: `Bearer ${SB_KEY()}`,
})

async function cleanupExpired() {
  await fetch(`${SB_URL()}/rest/v1/admin_notifications?expires_at=lt.${encodeURIComponent(new Date().toISOString())}`, {
    method: 'DELETE',
    headers: { ...headers(), Prefer: 'return=minimal' },
  })
}

export async function GET(req: NextRequest) {
  const shopId = req.nextUrl.searchParams.get('shopId')
  if (!shopId) return NextResponse.json({ error: 'shopId required' }, { status: 400 })

  try {
    await cleanupExpired()

    const subRes = await fetch(`${SB_URL()}/rest/v1/subscriptions?shop_id=eq.${encodeURIComponent(shopId)}&select=plan,status&limit=1`, {
      headers: headers(),
      cache: 'no-store',
    })
    if (!subRes.ok) throw new Error(await subRes.text())
    const [sub] = await subRes.json()
    const plan = sub?.plan ?? 'starter'
    const now = encodeURIComponent(new Date().toISOString())
    const notificationRes = await fetch(
      `${SB_URL()}/rest/v1/admin_notifications` +
      `?or=(target_plan.eq.all,target_plan.eq.${encodeURIComponent(plan)})` +
      `&expires_at=gt.${now}` +
      `&order=created_at.desc&select=*`,
      { headers: headers(), cache: 'no-store' }
    )
    if (!notificationRes.ok) throw new Error(await notificationRes.text())
    return NextResponse.json({ data: await notificationRes.json() })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
