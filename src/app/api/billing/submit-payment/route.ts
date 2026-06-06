import { NextRequest, NextResponse } from 'next/server'
import { verifyMemberSessionToken, MEMBER_SESSION_COOKIE } from '@/lib/auth/session'
import { sbFetch } from '@/lib/supabase/service'
import { validate } from '@/lib/validation'
import { logger } from '@/lib/logger'
import { z } from 'zod'

const submitPaymentSchema = z.object({
  planId: z.enum(['starter', 'professional', 'business']),
  cycle: z.enum(['monthly', 'yearly']),
  amountPkr: z.number().positive(),
  paymentRef: z.string().min(1),
  transactionId: z.string().min(4),
  payerName: z.string().min(2),
})

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(MEMBER_SESSION_COOKIE)?.value
    const session = token ? verifyMemberSessionToken(token) : null
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { shopId } = session

    const parsed = await validate(submitPaymentSchema, req)
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }

    const { planId, cycle, amountPkr, paymentRef, transactionId, payerName } = parsed.data

    const now = new Date().toISOString()

    // Dedup: reject duplicate transactionId
    const dupCheck = await sbFetch(
      `subscription_payments?gateway_tx_id=eq.${encodeURIComponent(transactionId)}&select=id&limit=1`
    )
    if (dupCheck.ok) {
      const existing = await dupCheck.json()
      if (existing?.length) {
        return NextResponse.json({ error: 'Duplicate transaction ID. Payment already submitted.' }, { status: 409 })
      }
    }
    // Fetch existing subscription ID (for payment FK) — do NOT change subscription status;
    // admin must manually verify payment and activate via /api/admin/action
    const subRes = await sbFetch(`subscriptions?shop_id=eq.${encodeURIComponent(shopId)}&select=id&limit=1`)
    if (!subRes.ok) throw new Error('Failed to fetch subscription')
    const [subRow] = await subRes.json()
    const subscriptionId = subRow?.id ?? null

    // Insert payment record (status: pending — admin verifies manually)
    const paymentPayload: Record<string, unknown> = {
      shop_id: shopId,
      plan: planId,
      billing_cycle: cycle,
      amount_pkr: amountPkr,
      method: 'raast',
      gateway_tx_id: transactionId,
      status: 'pending',
      paid_at: now,
      receipt_data: {
        payment_ref: paymentRef,
        payer_name: payerName,
        raast_id: process.env.NEXT_PUBLIC_RAAST_ID ?? '',
        submitted_at: now,
      },
    }
    if (subscriptionId) {
      paymentPayload.subscription_id = subscriptionId
    }

    const payRes = await sbFetch('subscription_payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(paymentPayload),
    })
    if (!payRes.ok) {
      const errText = await payRes.text()
      logger.error('submit-payment', 'Insert payment failed', errText)
      return NextResponse.json({ error: 'Payment record failed' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    logger.error('submit-payment', 'Unexpected error', e)
    return NextResponse.json({ error: 'Payment submission failed' }, { status: 500 })
  }
}
