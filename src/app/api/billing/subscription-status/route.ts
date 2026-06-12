import { NextRequest, NextResponse } from 'next/server'
import { verifyMemberSessionToken, MEMBER_SESSION_COOKIE } from '@/lib/auth/session'
import { sbGet } from '@/lib/supabase/service'
import { logger } from '@/lib/logger'

// Simple in-memory cache for subscription status
// TTL is short since this is used for polling after payment
const cache = new Map<string, { data: object; ts: number }>()
const CACHE_TTL = 10_000 // 10 seconds

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(MEMBER_SESSION_COOKIE)?.value
    const session = token ? verifyMemberSessionToken(token) : null
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { shopId } = session

    // Check cache
    const cached = cache.get(shopId)
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return NextResponse.json(cached.data)
    }

    const subs = await sbGet(`subscriptions?shop_id=eq.${encodeURIComponent(shopId)}&select=status,plan,expires_at&limit=1`)
    const sub = subs?.[0]

    // Fetch the latest payment for this shop
    const latestPayments = await sbGet(
      `subscription_payments?shop_id=eq.${encodeURIComponent(shopId)}&order=paid_at.desc&limit=1&select=status,paid_at`,
    )
    const latestPayment = latestPayments?.[0] ?? null

    if (!sub) {
      const data = { status: 'none', plan: 'starter', latestPayment }
      cache.set(shopId, { data, ts: Date.now() })
      return NextResponse.json(data)
    }

    const responseData = {
      status: sub.status,
      plan: sub.plan,
      expiresAt: sub.expires_at,
      latestPayment,
    }

    cache.set(shopId, { data: responseData, ts: Date.now() })

    return NextResponse.json(responseData)
  } catch (e) {
    logger.error('subscription-status', 'Error', e)
    return NextResponse.json({ error: 'Failed to fetch status' }, { status: 500 })
  }
}
