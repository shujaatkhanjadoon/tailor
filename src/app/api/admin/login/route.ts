// src/app/api/admin/login/route.ts
import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse }                          from 'next/server'
import { verifyTOTP, generateSessionToken, ADMIN_SESSION_COOKIE } from '@/lib/admin/auth'

export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { secret, totpCode } = body

  // ── 1. Verify admin secret ────────────────────────────────────────
  const adminSecret = process.env.ADMIN_SECRET
  if (!adminSecret) {
    console.error('[Admin Login] ADMIN_SECRET not configured')
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  const secretBuf = Buffer.from(secret?.trim() ?? '', 'utf-8')
  const adminBuf  = Buffer.from(adminSecret, 'utf-8')
  const secretMatch = secretBuf.length === adminBuf.length && timingSafeEqual(secretBuf, adminBuf)
  if (!secret || !secretMatch) {
    // Delay response to slow brute force
    await new Promise(r => setTimeout(r, 500))
    return NextResponse.json({ error: 'Secret galat hai' }, { status: 401 })
  }

  // ── 2. Verify TOTP if configured ─────────────────────────────────
  const totpSecret = process.env.ADMIN_TOTP_SECRET
  if (totpSecret) {
    if (!totpCode) {
      return NextResponse.json(
        { error: 'Google Authenticator code chahiye', requiresTOTP: true },
        { status: 401 }
      )
    }

    const isValid = verifyTOTP(String(totpCode).trim(), totpSecret)
    if (!isValid) {
      await new Promise(r => setTimeout(r, 300))
      return NextResponse.json(
        { error: 'Code galat hai ya expire ho gaya. Naya code try karein.' },
        { status: 401 }
      )
    }
  }

  // ── 3. Generate session ───────────────────────────────────────────
  const token = generateSessionToken()

  const res = NextResponse.json({ success: true })
  res.cookies.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge:   15 * 60,   // 15 minutes
    path:     '/',
  })

  return res
}