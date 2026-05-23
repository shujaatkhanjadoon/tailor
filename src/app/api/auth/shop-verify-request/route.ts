// src/app/api/auth/shop-verify-request/route.ts
import { NextRequest, NextResponse }           from 'next/server'
import { sendShopVerificationAlert }           from '@/lib/security/email-otp'
import { getSignupRatelimiter, checkRateLimit, getRateLimitId } from '@/lib/security/rate-limit'
import { validate, schemas }                  from '@/lib/validation/schemas'

const SB_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SB_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!
const HEADERS = {
  'Content-Type':  'application/json',
  'apikey':        SB_KEY,
  'Authorization': `Bearer ${SB_KEY}`,
}

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
  const res = await fetch(`${SB_URL}/rest/v1/shop_verification_requests`, {
    method:  'POST',
    headers: { ...HEADERS, 'Prefer': 'return=minimal' },
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
    console.error('[Shop Verify] Insert error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }

  // Send admin notification (non-blocking)
  sendShopVerificationAlert({
    shopName, ownerName, ownerPhone,
    ownerEmail: ownerEmail || 'N/A',
    city, shopId,
  }).catch(console.error)

  // Also update shop verification_status
  await fetch(`${SB_URL}/rest/v1/shops?id=eq.${shopId}`, {
    method:  'PATCH',
    headers: { ...HEADERS, 'Prefer': 'return=minimal' },
    body:    JSON.stringify({ verification_status: 'pending' }),
  })

  return NextResponse.json({ success: true })
}
