// src/app/api/auth/verify-otp/route.ts
import { NextRequest, NextResponse }  from 'next/server'
import { hashOTP }                    from '@/lib/security/email-otp'
import { getLoginRatelimiter, checkRateLimit, getClientIP } from '@/lib/security/rate-limit'

const SB_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SB_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!
const HEADERS = {
  'Content-Type':  'application/json',
  'apikey':        SB_KEY,
  'Authorization': `Bearer ${SB_KEY}`,
}

export async function POST(req: NextRequest) {
  const ip = getClientIP(req)

  // ── Rate limit ────────────────────────────────────────────────
  const limiter = getLoginRatelimiter()
  const rl      = await checkRateLimit(limiter, `verify:${ip}`)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Bahut zyada galat codes. 15 minute mein dobara try karein.' },
      { status: 429 }
    )
  }

  const { phone, otp } = await req.json()

  if (!phone || !otp || otp.length !== 6) {
    return NextResponse.json({ error: 'Phone aur 6-digit code required hai' }, { status: 400 })
  }

  // ── Find latest valid OTP ─────────────────────────────────────
  const res = await fetch(
    `${SB_URL}/rest/v1/email_verifications` +
    `?phone=eq.${encodeURIComponent(phone)}` +
    `&verified_at=is.null` +
    `&expires_at=gt.${new Date().toISOString()}` +
    `&order=created_at.desc&limit=1`,
    { headers: HEADERS }
  )
  const rows: any[] = await res.json()
  const record = rows?.[0]

  if (!record) {
    return NextResponse.json(
      { error: 'Code expire ho gaya ya valid nahi. Naya code mangwayein.' },
      { status: 400 }
    )
  }

  // ── Check attempts ────────────────────────────────────────────
  if (record.attempts >= 5) {
    return NextResponse.json(
      { error: '5 baar galat code dala. Naya OTP mangwayein.' },
      { status: 400 }
    )
  }

  // ── Increment attempt count ───────────────────────────────────
  await fetch(
    `${SB_URL}/rest/v1/email_verifications?id=eq.${record.id}`,
    {
      method:  'PATCH',
      headers: { ...HEADERS, 'Prefer': 'return=minimal' },
      body:    JSON.stringify({ attempts: record.attempts + 1 }),
    }
  )

  // ── Verify OTP hash ───────────────────────────────────────────
  const expectedHash = hashOTP(String(otp))
  if (expectedHash !== record.otp_hash) {
    const remaining = 4 - record.attempts
    return NextResponse.json(
      {
        error:     `Code galat hai. ${remaining} aur mauqa baaki hai.`,
        remaining,
      },
      { status: 400 }
    )
  }

  // ── Mark as verified ──────────────────────────────────────────
  await fetch(
    `${SB_URL}/rest/v1/email_verifications?id=eq.${record.id}`,
    {
      method:  'PATCH',
      headers: { ...HEADERS, 'Prefer': 'return=minimal' },
      body:    JSON.stringify({ verified_at: new Date().toISOString() }),
    }
  )

  return NextResponse.json({
    success: true,
    email:   record.email,
    phone,
  })
}