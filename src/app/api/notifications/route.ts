import { NextRequest, NextResponse } from 'next/server'
import { verifyMemberSessionToken, MEMBER_SESSION_COOKIE } from '@/lib/auth/session'
import { sbFetch } from '@/lib/supabase/service'
import { logger } from '@/lib/logger'
import { z } from 'zod'

const uuidSchema = z.string().uuid()

async function cleanupExpired() {
  await sbFetch(`admin_notifications?expires_at=lt.${encodeURIComponent(new Date().toISOString())}`, {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' },
  })
}

export async function GET(req: NextRequest) {
  const shopId = req.nextUrl.searchParams.get('shopId')
  const uuidResult = uuidSchema.safeParse(shopId)
  if (!uuidResult.success) return NextResponse.json({ error: 'Invalid shopId' }, { status: 400 })

  const token = req.cookies.get(MEMBER_SESSION_COOKIE)?.value
  const session = token ? verifyMemberSessionToken(token) : null
  if (!session || session.shopId !== shopId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await cleanupExpired()

    const subRes = await sbFetch(`subscriptions?shop_id=eq.${encodeURIComponent(shopId)}&select=plan,status&limit=1`)
    if (!subRes.ok) throw new Error(await subRes.text())
    const [sub] = await subRes.json()
    const plan = sub?.plan ?? 'starter'
    const now = encodeURIComponent(new Date().toISOString())
    const notificationRes = await sbFetch(
      `admin_notifications` +
      `?or=(target_plan.eq.all,target_plan.eq.${encodeURIComponent(plan)})` +
      `&expires_at=gt.${now}` +
      `&order=created_at.desc&select=*`
    )
    if (!notificationRes.ok) throw new Error(await notificationRes.text())
    return NextResponse.json({ data: await notificationRes.json() })
  } catch (e) {
    logger.error('Notifications', 'Fetch notifications failed', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
