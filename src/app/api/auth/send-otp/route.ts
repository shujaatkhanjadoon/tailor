// src/app/api/auth/send-otp/route.ts
import { NextRequest, NextResponse }     from 'next/server'
import { generateOTP, hashOTP, sendOTPEmail } from '@/lib/security/email-otp'
import { getOTPRatelimiter, checkRateLimit, getRateLimitId } from '@/lib/security/rate-limit'
import { validatePakistaniPhone }        from '@/lib/security/phone'
import { validate, schemas }             from '@/lib/validation'
import { sbGet, sbPatch, sbFetch } from '@/lib/supabase/service'

export async function POST(req: NextRequest) {
  // ── Rate limit by IP + fingerprint ────────────────────────────
  const limiter = getOTPRatelimiter()
  const rl      = await checkRateLimit(limiter, `otp:${getRateLimitId(req)}`, 'sensitive')
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Bahut zyada OTP requests. 1 ghante mein dobara try karein.' },
      { status: 429 }
    )
  }

  const parsed = await validate(schemas.sendOtp, req, 1024)
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  }

  const { phone, email, purpose } = parsed.data

  // ── Validate phone ────────────────────────────────────────────
  const phoneResult = validatePakistaniPhone(phone ?? '')
  if (!phoneResult.valid) {
    return NextResponse.json({ error: phoneResult.error }, { status: 400 })
  }

  const normalizedEmail = email

  if (purpose === 'signup') {
    const emailOwners = await sbGet(
      `team_members?email=eq.${encodeURIComponent(normalizedEmail)}` +
      `&is_active=eq.true&select=id&limit=1`
    )

    if (emailOwners.length > 0) {
      return NextResponse.json(
        { error: 'Yeh email pehle se registered hai. Dusri email use karein ya login karein.' },
        { status: 409 }
      )
    }
  }

  // ── Rate limit by phone ───────────────────────────────────────
  const phoneLimiter = getOTPRatelimiter()
  const phoneRL      = await checkRateLimit(phoneLimiter, `otp:phone:${phoneResult.cleaned}`, 'sensitive')
  if (!phoneRL.allowed) {
    return NextResponse.json(
      { error: 'Is number par bahut zyada OTP bheje gaye. 1 ghante baad try karein.' },
      { status: 429 }
    )
  }

  // ── Generate OTP ──────────────────────────────────────────────
  const otp       = generateOTP()
  const otpHash   = hashOTP(otp)
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()  // 10 min

  // ── Invalidate previous OTPs for this phone ───────────────────
  await sbPatch(
    `email_verifications?phone=eq.${phoneResult.cleaned}&verified_at=is.null`,
    { expires_at: new Date(0).toISOString() }
  )

  // ── Store OTP in database ─────────────────────────────────────
  const dbRes = await sbFetch('email_verifications', {
    method:  'POST',
    headers: { 'Prefer': 'return=minimal' },
    body:    JSON.stringify({
      phone:      phoneResult.cleaned,
      email:      normalizedEmail,
      otp_hash:   otpHash,
      expires_at: expiresAt,
    }),
  })
  const dbError = dbRes.ok ? null : await dbRes.text()

  if (dbError) {
    console.error('[Send OTP] DB error:', dbError)
    return NextResponse.json({ error: 'Server error. Dobara try karein.' }, { status: 500 })
  }

  // ── Send OTP email ────────────────────────────────────────────
  const emailResult = await sendOTPEmail(normalizedEmail, otp, purpose)
  if (!emailResult.success) {
    console.error('[Send OTP] Resend error:', emailResult.error)
    return NextResponse.json(
      { error: 'Email nahi aayi. Email address check karein.' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success:    true,
    maskedEmail: `${normalizedEmail.slice(0, 2)}***@${normalizedEmail.split('@')[1]}`,
    expiresAt,
  })
}
