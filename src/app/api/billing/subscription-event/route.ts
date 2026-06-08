import { NextRequest, NextResponse } from 'next/server'
import { verifyMemberSessionToken, MEMBER_SESSION_COOKIE } from '@/lib/auth/session'
import { validate, schemas } from '@/lib/validation'
import { logger } from '@/lib/logger'

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(MEMBER_SESSION_COOKIE)?.value
    if (!token || !verifyMemberSessionToken(token)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const parsed = await validate(schemas.subscriptionEvent, req)
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }

    const { shopId, event, plan, previousPlan, cycle, amountPkr, reason, paymentRef, transactionId, payerName, expiresAt, couponCode, discountPct } = parsed.data

    const { sendAdminSubscriptionEventEmail } = await import('@/lib/security/email-otp')
    await sendAdminSubscriptionEventEmail({
      shopId,
      event,
      plan,
      previousPlan,
      cycle,
      amountPkr,
      reason,
      paymentRef,
      transactionId,
      payerName,
      expiresAt,
      couponCode,
      discountPct,
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    logger.error('BillingEvent', 'Admin email failed', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
