import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { sbFetch } from '@/lib/supabase/service'
import { generateMemberSessionToken, MEMBER_SESSION_COOKIE, getSessionCookieOptions } from '@/lib/auth/session'
import { getLoginRatelimiter, checkRateLimit, getRateLimitId, getClientIP } from '@/lib/security/rate-limit'
import { badRequest, serverError, tooMany } from '@/lib/api-response'
import { logger } from '@/lib/logger'
import { SALT_ROUNDS } from '@/lib/security/pin'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const rawPhone = String(body?.phone ?? '')
    const rawPin = String(body?.pin ?? '')

    const cleanedPhone = rawPhone.replace(/\D/g, '')
    if (cleanedPhone.length < 10 || !rawPin) {
      return badRequest('Phone and PIN required')
    }

    const limiter = getLoginRatelimiter()
    const rl = await checkRateLimit(limiter, `login:${cleanedPhone}:${getRateLimitId(req)}`, 'sensitive')
    if (!rl.allowed) {
      return tooMany(rl.error ?? 'Too many attempts. Try later.')
    }

    const memberRes = await sbFetch(
      `team_members` +
      `?phone=eq.${encodeURIComponent(cleanedPhone)}` +
      `&is_active=eq.true` +
      `&deleted_at=is.null` +
      `&select=id,shop_id,name,role,pin_hash,locked_until,failed_attempts` +
      `&limit=1`
    )

    if (!memberRes.ok) {
      return serverError('Database error')
    }

    const members = await memberRes.json()
    const member = members?.[0]

    if (!member) {
      return NextResponse.json({ success: false, error: 'Account not found' })
    }

    if (member.locked_until && new Date(member.locked_until) > new Date()) {
      return NextResponse.json({ success: false, error: 'Account locked', lockedUntil: member.locked_until })
    }

    const storedHash = String(member.pin_hash ?? '')
    // Re-compute what the client-side hash would be, then compare against stored double-hash
    const clientSideHash = bcrypt.hashSync(rawPin, SALT_ROUNDS)
    const isValid = storedHash.startsWith('$2') && await bcrypt.compare(clientSideHash, storedHash)

    if (!isValid) {
      const newFailed = (member.failed_attempts ?? 0) + 1
      const shouldLock = newFailed >= 5
      const lockUntil = shouldLock ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null

      const patchData: Record<string, unknown> = { failed_attempts: newFailed }
      if (lockUntil) patchData.locked_until = lockUntil

      await sbFetch(
        `team_members?id=eq.${encodeURIComponent(member.id)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
          body: JSON.stringify(patchData),
        }
      ).catch(() => {})

      const ip = getClientIP(req)
      const ua = req.headers.get('user-agent') ?? ''
      sbFetch('login_attempts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify({
          phone: cleanedPhone,
          ip_address: ip,
          user_agent: ua.slice(0, 500),
          success: false,
          failure_reason: `Wrong PIN (attempt ${newFailed})`,
        }),
      }).catch(() => {})

      if (shouldLock) {
        return NextResponse.json({
          success: false,
          error: 'Account locked for 15 minutes',
          lockedUntil: lockUntil,
        })
      }

      return NextResponse.json({
        success: false,
        error: `Wrong PIN. ${5 - newFailed} attempts remaining.`,
        remainingAttempts: 5 - newFailed,
      })
    }

    await sbFetch(
      `team_members?id=eq.${encodeURIComponent(member.id)}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify({
          failed_attempts: 0,
          locked_until: null,
          last_login_at: new Date().toISOString(),
        }),
      }
    ).catch(() => {})

    const ip = getClientIP(req)
    const ua = req.headers.get('user-agent') ?? ''
    sbFetch('login_attempts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        phone: cleanedPhone,
        ip_address: ip,
        user_agent: ua.slice(0, 500),
        success: true,
      }),
    }).catch(() => {})

    const token = generateMemberSessionToken(member.id, member.shop_id)
    const res = NextResponse.json({ success: true, role: member.role })
    res.cookies.set(MEMBER_SESSION_COOKIE, token, getSessionCookieOptions())

    return res
  } catch (e) {
    logger.error('login', 'POST error', e)
    return serverError('Login failed')
  }
}
