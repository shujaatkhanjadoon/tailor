import { NextRequest, NextResponse } from 'next/server'
import { verifyMemberSessionToken, MEMBER_SESSION_COOKIE } from '@/lib/auth/session'
import { sbGet } from '@/lib/supabase/service'
import { logger } from '@/lib/logger'

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(MEMBER_SESSION_COOKIE)?.value
    const session = token ? verifyMemberSessionToken(token) : null
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { shopId } = session

    const subs = await sbGet(`subscriptions?shop_id=eq.${encodeURIComponent(shopId)}&select=status,plan,expires_at&limit=1`)
    const sub = subs?.[0]

    if (!sub) {
      return NextResponse.json({ status: 'none', plan: 'starter' })
    }

    return NextResponse.json({
      status: sub.status,
      plan: sub.plan,
      expiresAt: sub.expires_at,
    })
  } catch (e) {
    logger.error('subscription-status', 'Error', e)
    return NextResponse.json({ error: 'Failed to fetch status' }, { status: 500 })
  }
}
