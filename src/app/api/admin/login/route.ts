// src/app/api/admin/login/route.ts
import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse }                          from 'next/server'
import { verifyTOTP, generateSessionToken, ADMIN_SESSION_COOKIE } from '@/lib/admin/auth'
import { logAdminAction }                                     from '@/lib/admin/audit'
import { validate, schemas }                                  from '@/lib/validation'
import { sbGet }                                              from '@/lib/supabase/service'
import { logger } from '@/lib/logger'
import bcrypt from 'bcryptjs'
import { getLoginRatelimiter, checkRateLimit, getRateLimitId } from '@/lib/security/rate-limit'

export async function POST(req: NextRequest) {
  const parsed = await validate(schemas.adminLogin, req)
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  }

  const { secret, totpCode, rememberMe, username } = parsed.data

  // ── 0. Rate limit admin login attempts ──────────────────────────
  const limiter = getLoginRatelimiter()
  const rl = await checkRateLimit(limiter, `admin-login:${getRateLimitId(req)}`, 'sensitive')
  if (!rl.allowed) {
    await new Promise(r => setTimeout(r, 500))
    return NextResponse.json({ error: 'Bahut zyada attempts. 15 minute mein dobara try karein.' }, { status: 429 })
  }

  // ── 1. Authenticate: ADMIN_SECRET env var OR admin_accounts table ──
  let adminRole = 'super_admin'

  // Try master ADMIN_SECRET first
  const adminSecret = process.env.ADMIN_SECRET
  if (!adminSecret) {
    logger.error('admin', 'ADMIN_SECRET not configured')
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  const secretBuf = Buffer.from(secret?.trim() ?? '', 'utf-8')
  const adminBuf  = Buffer.from(adminSecret, 'utf-8')
  let secretMatch = secretBuf.length === adminBuf.length && timingSafeEqual(secretBuf, adminBuf)

  // If master secret doesn't match, try sub-admin login
  if (!secretMatch && username) {
    const accounts: { id: string; secret_hash: string; role: string }[] = await sbGet(`admin_accounts?username=eq.${username}&is_active=eq.true&select=id,secret_hash,role`)
    const account = accounts?.[0]
    if (account) {
      secretMatch = bcrypt.compareSync(secret.trim(), account.secret_hash)
      if (secretMatch) adminRole = account.role
    }
  }

  if (!secret || !secretMatch) {
    await new Promise(r => setTimeout(r, 500))
    logAdminAction('admin_login', 'system', 'failed', undefined, { reason: 'invalid_secret' })
    return NextResponse.json({ error: 'Secret galat hai' }, { status: 401 })
  }

  // ── 2. Verify TOTP (required — fail closed) ──────────────────────
  const totpSecret = process.env.ADMIN_TOTP_SECRET
  if (!totpSecret) {
    logger.error('admin', 'ADMIN_TOTP_SECRET not configured')
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }
  if (!totpCode) {
    return NextResponse.json(
      { error: 'Google Authenticator code chahiye', requiresTOTP: true },
      { status: 401 }
    )
  }

  const isValid = verifyTOTP(String(totpCode).trim(), totpSecret)
  if (!isValid) {
    await new Promise(r => setTimeout(r, 300))
    logAdminAction('admin_login', 'system', 'failed', undefined, { reason: 'invalid_totp' })
    return NextResponse.json(
      { error: 'Code galat hai ya expire ho gaya. Naya code try karein.' },
      { status: 401 }
    )
  }

  // ── 3. Generate session ───────────────────────────────────────────
  const token = generateSessionToken(undefined, rememberMe, adminRole, username ?? 'master')

  const res = NextResponse.json({ success: true, role: adminRole })
  const tokenHash = token.slice(0, 12)
  res.cookies.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure:   true,
    sameSite: 'strict',
    maxAge:   rememberMe ? 7 * 24 * 60 * 60 : 15 * 60,
    path:     '/',
  })

  logAdminAction('admin_login', 'system', tokenHash)

  return res
}