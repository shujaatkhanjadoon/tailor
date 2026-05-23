// src/app/api/admin/login/route.ts
import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse }                          from 'next/server'
import { verifyTOTP, generateSessionToken, ADMIN_SESSION_COOKIE } from '@/lib/admin/auth'
import { logAdminAction }                                     from '@/lib/admin/audit'
import { validate, schemas }                                  from '@/lib/validation'

export async function POST(req: NextRequest) {
  const parsed = await validate(schemas.login, req)
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  }

  const { secret, totpCode } = parsed.data

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
    logAdminAction('admin_login', 'admin_session', 'failed', undefined, { reason: 'invalid_secret' })
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
      logAdminAction('admin_login', 'admin_session', 'failed', undefined, { reason: 'invalid_totp' })
      return NextResponse.json(
        { error: 'Code galat hai ya expire ho gaya. Naya code try karein.' },
        { status: 401 }
      )
    }
  }

  // ── 3. Generate session ───────────────────────────────────────────
  const token = generateSessionToken()

  const res = NextResponse.json({ success: true })
  const tokenHash = token.slice(0, 12)
  res.cookies.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure:   true,
    sameSite: 'strict',
    maxAge:   15 * 60,
    path:     '/',
  })

  logAdminAction('admin_login', 'admin_session', tokenHash)

  return res
}