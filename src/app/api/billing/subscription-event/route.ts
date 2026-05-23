import { NextRequest, NextResponse } from 'next/server'
import { sendAdminSubscriptionEventEmail } from '@/lib/security/email-otp'
import { verifyMemberSessionToken, MEMBER_SESSION_COOKIE } from '@/lib/auth/session'

const VALID_EVENTS = new Set([
  'upgraded',
  'downgraded',
  'renewed',
  'expired',
  'cancelled',
  'payment_submitted',
])

const EVENT_SCHEMA = {
  shopId: 'string',
  event: 'string',
  plan: true,
  previousPlan: true,
  cycle: true,
  amountPkr: true,
  reason: true,
  paymentRef: true,
  transactionId: true,
  payerName: true,
  expiresAt: true,
}

function isValidBody(body: Record<string, unknown>): boolean {
  if (typeof body.shopId !== 'string' || !body.shopId) return false
  if (typeof body.event !== 'string' || !VALID_EVENTS.has(body.event)) return false
  return true
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(MEMBER_SESSION_COOKIE)?.value
    if (!token || !verifyMemberSessionToken(token)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    if (!isValidBody(body)) {
      return NextResponse.json({ error: 'shopId and valid event required' }, { status: 400 })
    }

    await sendAdminSubscriptionEventEmail({
      shopId: body.shopId as string,
      event: body.event as 'upgraded' | 'downgraded' | 'renewed' | 'expired' | 'cancelled' | 'payment_submitted',
      plan: body.plan as string | undefined,
      previousPlan: body.previousPlan as string | undefined,
      cycle: body.cycle as string | undefined,
      amountPkr: body.amountPkr as number | undefined,
      reason: body.reason as string | undefined,
      paymentRef: body.paymentRef as string | undefined,
      transactionId: body.transactionId as string | undefined,
      payerName: body.payerName as string | undefined,
      expiresAt: body.expiresAt as string | undefined,
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[Billing Event] Admin email failed:', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
