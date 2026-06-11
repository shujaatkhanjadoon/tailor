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

    const { reason } = parsed.data

    const now = new Date().toISOString()

    // Fetch current subscription
    const subRes = await sbFetch(
      `subscriptions?shop_id=eq.${encodeURIComponent(shopId)}&select=id,plan,status,expires_at&limit=1`,
    )
    if (!subRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch subscription' }, { status: 500 })
    }
    const [sub] = await subRes.json()
    if (!sub) {
      return NextResponse.json({ error: 'No active subscription' }, { status: 404 })
    }

    // Prevent duplicate cancellation
    if (sub.status === 'cancelled') {
      return NextResponse.json({ error: 'Subscription is already cancelled' }, { status: 409 })
    }

    // Mark subscription as cancelled — keep expires_at unchanged so the user
    // retains access until the end of the current billing period.
    // The cron job will transition cancelled→grace→starter when expiry passes.
    await sbFetch(`subscriptions?id=eq.${sub.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({
        status: 'cancelled',
        cancelled_at: now,
        updated_at: now,
      }),
    })

    // Audit log
    await sbFetch('admin_audit_log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({
        action: 'subscription_cancelled',
        target_type: 'subscription',
        target_id: sub.id,
        shop_id: shopId,
        details: { reason, plan: sub.plan, expires_at: sub.expires_at, cancelled_at: now },
        performed_at: now,
      }),
    }).catch((e) => logger.error('billing-cancel', 'Audit log failed (non-fatal)', e))

    // Notify admin
    try {
      const { sendAdminSubscriptionEventEmail } = await import('@/lib/security/email-otp')
      await sendAdminSubscriptionEventEmail({
        shopId,
        event: 'cancelled',
        previousPlan: sub.plan,
        plan: sub.plan,
        reason,
        expiresAt: sub.expires_at,
      })
    } catch (e) {
      logger.error('billing-cancel', 'Admin notification failed (non-fatal)', e)
    }

    return NextResponse.json({ success: true, expiresAt: sub.expires_at })
  } catch (e) {
    logger.error('billing-cancel', 'Cancel failed', e)
    return NextResponse.json({ error: 'Cancel failed' }, { status: 500 })
  }
}
