// src/app/api/auth/verify-otp/route.ts
import { NextRequest, NextResponse }  from 'next/server'
import { verifyOTP }                  from '@/lib/security/email-otp'
import { getLoginRatelimiter, checkRateLimit, getRateLimitId } from '@/lib/security/rate-limit'

const SB_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SB_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!
const HEADERS = {
  'Content-Type':  'application/json',
  'apikey':        SB_KEY,
  'Authorization': `Bearer ${SB_KEY}`,
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

function isRetryableFetchError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  const cause = (error as { cause?: { code?: string } })?.cause
  return (
    message.includes('fetch failed') ||
    message.includes('Connect Timeout') ||
    cause?.code === 'UND_ERR_CONNECT_TIMEOUT'
  )
}

async function sbFetch(path: string, init: RequestInit = {}): Promise<Response> {
  let lastError: unknown

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
        ...init,
        signal: AbortSignal.timeout(30000),
      })

      if (res.status >= 500 && attempt < 3) {
        await sleep(500 * attempt)
        continue
      }

      return res
    } catch (error) {
      lastError = error
      if (attempt >= 3 || !isRetryableFetchError(error)) break
      await sleep(700 * attempt)
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Supabase request failed')
}

export async function POST(req: NextRequest) {
  // ── Rate limit ────────────────────────────────────────────────
  const limiter = getLoginRatelimiter()
  const rl      = await checkRateLimit(limiter, `verify:${getRateLimitId(req)}`)
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
  try {
  const res = await sbFetch(
    `email_verifications` +
    `?phone=eq.${encodeURIComponent(phone)}` +
    `&verified_at=is.null` +
    `&expires_at=gt.${encodeURIComponent(new Date().toISOString())}` +
    `&order=created_at.desc&limit=1`,
    { headers: HEADERS }
  )
  if (!res.ok) {
    const err = await res.text()
    console.error('[verify-otp] lookup failed:', err)
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
  await sbFetch(
    `email_verifications?id=eq.${record.id}`,
    {
      method:  'PATCH',
      headers: { ...HEADERS, 'Prefer': 'return=minimal' },
      body:    JSON.stringify({ attempts: record.attempts + 1 }),
    }
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
  await sbFetch(
    `email_verifications?id=eq.${record.id}`,
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
  } catch (e) {
    console.error('[verify-otp] error:', e)
    return NextResponse.json(
      { error: 'Supabase se connect nahi ho saka. Dobara try karein.' },
      { status: 502 }
    )
  }
}
