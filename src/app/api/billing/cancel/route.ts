import { NextRequest, NextResponse } from 'next/server'
import { verifyMemberSessionToken, MEMBER_SESSION_COOKIE } from '@/lib/auth/session'
import { sbFetch } from '@/lib/supabase/service'
import { validate } from '@/lib/validation'
import { logger } from '@/lib/logger'
import { z } from 'zod'

const cancelSchema = z.object({
  reason: z.string().min(1),
  expiresAt: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(MEMBER_SESSION_COOKIE)?.value
    const session = token ? verifyMemberSessionToken(token) : null
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { shopId } = session

    const parsed = await validate(cancelSchema, req)
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }

    const { reason, expiresAt } = parsed.data

    const now = new Date().toISOString()
    const currentExpiry = expiresAt ? new Date(expiresAt).getTime() : Date.now()
    const graceEndsAt = new Date(currentExpiry + 7 * 86400000).toISOString()

    // Set status to cancelled with grace period
    const subRes = await sbFetch(
      `subscriptions?shop_id=eq.${encodeURIComponent(shopId)}&select=id,plan,status&limit=1`,
    )
    if (!subRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch subscription' }, { status: 500 })
    }
    const [sub] = await subRes.json()
    if (!sub) {
      return NextResponse.json({ error: 'No active subscription' }, { status: 404 })
    }

    await sbFetch(`subscriptions?id=eq.${sub.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({
        status: 'cancelled',
        cancelled_at: now,
        grace_ends_at: graceEndsAt,
        updated_at: now,
      }),
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    logger.error('billing-cancel', 'Cancel failed', e)
    return NextResponse.json({ error: 'Cancel failed' }, { status: 500 })
  }
}
