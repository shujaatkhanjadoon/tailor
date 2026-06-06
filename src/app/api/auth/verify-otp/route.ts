// src/app/api/auth/verify-otp/route.ts
import { NextRequest, NextResponse }  from 'next/server'
import { verifyOTP }                  from '@/lib/security/email-otp'
import { getLoginRatelimiter, checkRateLimit, getRateLimitId } from '@/lib/security/rate-limit'
import { validate, schemas }          from '@/lib/validation'
import { sbFetch, sbPatch }           from '@/lib/supabase/service'
import { logger } from '@/lib/logger'

export async function POST(req: NextRequest) {
  // ── Rate limit ────────────────────────────────────────────────
  const limiter = getLoginRatelimiter()
  const rl      = await checkRateLimit(limiter, `verify:${getRateLimitId(req)}`, 'sensitive')
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Bahut zyada galat codes. 15 minute mein dobara try karein.' },
      { status: 429 }
    )
  }

  const parsed = await validate(schemas.verifyOtp, req, 1024)
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  }

  const { phone, otp } = parsed.data

  // ── Find latest valid OTP ─────────────────────────────────────
  try {
  const res = await sbFetch(
    `email_verifications` +
    `?phone=eq.${encodeURIComponent(phone)}` +
    `&verified_at=is.null` +
    `&expires_at=gt.${encodeURIComponent(new Date().toISOString())}` +
    `&order=created_at.desc&limit=1`
  )
  if (!res.ok) {
    const err = await res.text()
    logger.error('verify-otp', 'OTP lookup failed', err)
    return NextResponse.json(
      { error: 'OTP verify nahi ho saka. Dobara try karein.' },
      { status: 502 }
    )
  }
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
  await sbPatch(
    `email_verifications?id=eq.${record.id}`,
    { attempts: record.attempts + 1 }
  )

  // ── Verify OTP hash ───────────────────────────────────────────
  if (!verifyOTP(String(otp), record.otp_hash)) {
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
  await sbPatch(
    `email_verifications?id=eq.${record.id}`,
    { verified_at: new Date().toISOString() }
  )

  return NextResponse.json({
    success: true,
    email:   record.email,
    phone,
  })
  } catch (e) {
    logger.error('verify-otp', 'OTP verification error', e)
    return NextResponse.json(
      { error: 'Supabase se connect nahi ho saka. Dobara try karein.' },
      { status: 502 }
    )
  }
}
