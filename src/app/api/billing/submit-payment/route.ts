import { NextRequest, NextResponse } from 'next/server'
import { verifyMemberSessionToken, MEMBER_SESSION_COOKIE } from '@/lib/auth/session'
import { sbFetch, sbGet } from '@/lib/supabase/service'
import { validate } from '@/lib/validation'
import { withIdempotency } from '@/lib/idempotency'
import { logger } from '@/lib/logger'
import { z } from 'zod'

const submitPaymentSchema = z.object({
  planId: z.enum(['starter', 'professional', 'business']),
  cycle: z.enum(['monthly', 'yearly']),
  amountPkr: z.number().positive(),
  paymentRef: z.string().min(1),
  transactionId: z.string().min(4),
  payerName: z.string().min(2),
  couponId: z.string().optional(),
  receiptBase64: z.string().optional(),
})

export async function POST(req: NextRequest) {
  return withIdempotency(req, async () => {
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

    const { planId, cycle, amountPkr, paymentRef, transactionId, payerName, couponId, receiptBase64 } = parsed.data

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
        ...(receiptBase64 ? { receipt_image: receiptBase64 } : {}),
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
    const [paymentRow] = await payRes.json()
    const paymentId = paymentRow?.id

    // Apply coupon redemption if coupon was used — with full server-side validation
    if (couponId && paymentId) {
      const couponRows = await sbGet(`coupons?id=eq.${encodeURIComponent(couponId)}&select=id,code,discount_pct,max_uses,used_count,max_uses_per_shop,min_amount_pkr,applies_to_plan,expires_at,is_active&limit=1`)
      const coupon = couponRows?.[0]
      if (coupon) {
        const now = new Date()
        const errors: string[] = []
        if (!coupon.is_active) errors.push('Coupon is inactive')
        if (new Date(coupon.expires_at) < now) errors.push('Coupon has expired')
        if (coupon.max_uses != null && (coupon.used_count ?? 0) >= coupon.max_uses) errors.push('Coupon usage limit reached')
        if (coupon.max_uses_per_shop != null && coupon.max_uses_per_shop > 0) {
          const shopRedemptions = await sbGet(`coupon_redemptions?coupon_id=eq.${encodeURIComponent(couponId)}&shop_id=eq.${encodeURIComponent(shopId)}&select=id`)
          if ((shopRedemptions?.length ?? 0) >= coupon.max_uses_per_shop) errors.push('Coupon already used for this shop')
        }
        if (coupon.applies_to_plan && coupon.applies_to_plan !== planId) errors.push(`Coupon only applies to ${coupon.applies_to_plan} plan`)
        if (coupon.min_amount_pkr != null && amountPkr < coupon.min_amount_pkr) errors.push(`Minimum amount PKR ${coupon.min_amount_pkr} required for this coupon`)

        if (errors.length > 0) {
          logger.warn('submit-payment', 'Coupon validation failed', { couponId, errors })
        } else {
          // Atomic increment via RPC
          const rpcRes = await sbFetch('/rpc/increment_coupon_used_count', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
            body: JSON.stringify({ p_coupon_id: couponId }),
          })
          const incremented = rpcRes.ok ? await rpcRes.json() : false
          if (incremented) {
            const pct = coupon.discount_pct ?? 0
            const originalAmount = amountPkr
            const discountedAmount = Math.round(originalAmount * (1 - pct / 100))
            await sbFetch('coupon_redemptions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
              body: JSON.stringify({
                coupon_id: couponId,
                shop_id: shopId,
                subscription_payment_id: paymentId,
                discount_pct: pct,
                original_amount: originalAmount,
                discounted_amount: discountedAmount,
                redeemed_at: new Date().toISOString(),
              }),
            })
            const existingReceipt = typeof paymentPayload.receipt_data === 'object' && paymentPayload.receipt_data ? paymentPayload.receipt_data as Record<string, unknown> : {}
            await sbFetch(`subscription_payments?id=eq.${encodeURIComponent(paymentId)}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
              body: JSON.stringify({
                receipt_data: {
                  ...existingReceipt,
                  coupon_code: coupon.code,
                  coupon_id: couponId,
                  discount_pct: pct,
                  original_amount: originalAmount,
                  discounted_amount: discountedAmount,
                },
              }),
            })
          } else {
            logger.warn('submit-payment', 'Atomic increment failed (race condition hit)', { couponId })
          }
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    logger.error('submit-payment', 'Unexpected error', e)
    return NextResponse.json({ error: 'Payment submission failed' }, { status: 500 })
  }
  })
}
