// src/app/api/auth/shop-verify-request/route.ts
import { NextRequest, NextResponse }           from 'next/server'
import { getSignupRatelimiter, checkRateLimit, getRateLimitId } from '@/lib/security/rate-limit'
import { validate, schemas }                  from '@/lib/validation/schemas'
import { sbFetch, sbPatch }                   from '@/lib/supabase/service'
import { logger } from '@/lib/logger'

export async function POST(req: NextRequest) {
  const limiter = getSignupRatelimiter()
  const rl      = await checkRateLimit(limiter, `signup:${getRateLimitId(req)}`, 'sensitive')

  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Bahut zyada accounts banane ki koshish. 24 ghante baad try karein.' },
      { status: 429 }
    )
  }

  const parsed = await validate(schemas.shopVerifyRequest, req, 2048)
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  }

  const { shopId, shopName, ownerName, ownerPhone, ownerEmail, city } = parsed.data

  // Insert verification request
  const res = await sbFetch('shop_verification_requests', {
    method:  'POST',
    headers: { 'Prefer': 'return=minimal' },
    body:    JSON.stringify({
      shop_id:      shopId,
      owner_name:   ownerName,
      owner_phone:  ownerPhone,
      owner_email:  ownerEmail || null,
      city:         city || null,
      status:       'pending',
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    logger.error('shop-verify', 'Insert error', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }

  // Send admin notification (non-blocking, lazy-loaded)
  import('@/lib/security/email-otp').then(m => m.sendShopVerificationAlert({
    shopName, ownerName, ownerPhone,
    ownerEmail: ownerEmail || 'N/A',
    city, shopId,
  })).catch(err => logger.error('shop-verify', 'Verification alert notification failed', err))

  // Also update shop verification_status
  await sbPatch(
    `shops?id=eq.${shopId}`,
    { verification_status: 'pending' }
  )

  return NextResponse.json({ success: true })
}
