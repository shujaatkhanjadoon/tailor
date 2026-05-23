import { NextRequest, NextResponse } from 'next/server'
import { sendAdminSubscriptionEventEmail } from '@/lib/security/email-otp'

const VALID_EVENTS = new Set([
  'upgraded',
  'downgraded',
  'renewed',
  'expired',
  'cancelled',
  'payment_submitted',
])

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { shopId, event } = body

    if (!shopId || !VALID_EVENTS.has(event)) {
      return NextResponse.json({ error: 'shopId and valid event required' }, { status: 400 })
    }

    await sendAdminSubscriptionEventEmail({
      shopId,
      event,
      plan: body.plan,
      previousPlan: body.previousPlan,
      cycle: body.cycle,
      amountPkr: body.amountPkr,
      reason: body.reason,
      paymentRef: body.paymentRef,
      transactionId: body.transactionId,
      payerName: body.payerName,
      expiresAt: body.expiresAt,
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[Billing Event] Admin email failed:', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
