// src/app/api/auth/send-otp/route.ts
import { NextRequest, NextResponse }     from 'next/server'
import { generateOTP, hashOTP, sendOTPEmail } from '@/lib/security/email-otp'
import { getOTPRatelimiter, checkRateLimit, getClientIP } from '@/lib/security/rate-limit'
import { validatePakistaniPhone }        from '@/lib/security/phone'

const SB_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SB_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!
const HEADERS = {
  'Content-Type':  'application/json',
  'apikey':        SB_KEY,
  'Authorization': `Bearer ${SB_KEY}`,
}

export async function POST(req: NextRequest) {
  const ip = getClientIP(req)

  // ── Rate limit by IP ──────────────────────────────────────────
  const limiter = getOTPRatelimiter()
  const rl      = await checkRateLimit(limiter, `otp:${ip}`)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Bahut zyada OTP requests. 1 ghante mein dobara try karein.' },
      { status: 429 }
    )
  }

  const { phone, email, purpose = 'signup' } = await req.json()

  // ── Validate phone ────────────────────────────────────────────
  const phoneResult = validatePakistaniPhone(phone ?? '')
  if (!phoneResult.valid) {
    return NextResponse.json({ error: phoneResult.error }, { status: 400 })
  }

  // ── Validate email ────────────────────────────────────────────
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!email || !emailRegex.test(email)) {
    return NextResponse.json(
      { error: 'Sahi email address daalein' },
      { status: 400 }
    )
  }

  // ── Rate limit by phone ───────────────────────────────────────
  const phoneLimiter = getOTPRatelimiter()
  const phoneRL      = await checkRateLimit(phoneLimiter, `otp:phone:${phoneResult.cleaned}`)
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
  await fetch(
    `${SB_URL}/rest/v1/email_verifications?phone=eq.${phoneResult.cleaned}&verified_at=is.null`,
    {
      method:  'PATCH',
      headers: { ...HEADERS, 'Prefer': 'return=minimal' },
      body:    JSON.stringify({ expires_at: new Date(0).toISOString() }),
    }
  )

  // ── Store OTP in database ─────────────────────────────────────
  const { error: dbError } = await fetch(
    `${SB_URL}/rest/v1/email_verifications`,
    {
      method:  'POST',
      headers: { ...HEADERS, 'Prefer': 'return=minimal' },
      body:    JSON.stringify({
        phone:      phoneResult.cleaned,
        email:      email.toLowerCase().trim(),
        otp_hash:   otpHash,
        expires_at: expiresAt,
      }),
    }
  ).then(r => r.ok ? { error: null } : r.json().then(d => ({ error: d })))

  if (dbError) {
    console.error('[Send OTP] DB error:', dbError)
    return NextResponse.json({ error: 'Server error. Dobara try karein.' }, { status: 500 })
  }

  // ── Send OTP email ────────────────────────────────────────────
  const emailResult = await sendOTPEmail(email.toLowerCase().trim(), otp, purpose)
  if (!emailResult.success) {
    return NextResponse.json(
      { error: 'Email nahi aayi. Email address check karein.' },
      { status: 500 }
    )
  }

  console.log(`[Send OTP] Sent to ${email} for phone ${phoneResult.cleaned}`)

  return NextResponse.json({
    success:    true,
    maskedEmail: `${email.slice(0, 2)}***@${email.split('@')[1]}`,
    expiresAt,
  })
}