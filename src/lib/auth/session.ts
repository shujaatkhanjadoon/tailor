import { createHmac, timingSafeEqual } from 'crypto'

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
const COOKIE_NAME = 'md_session'

function getSecret(): string {
  const secret = process.env.ADMIN_SECRET
  if (!secret) throw new Error('ADMIN_SECRET not set (required for session signing)')
  return secret
}

export function generateMemberSessionToken(memberId: string, shopId: string): string {
  const secret = getSecret()
  const timestamp = Date.now()
  const payload = `${memberId}:${shopId}:${timestamp}`
  const signature = createHmac('sha256', secret).update(payload).digest('hex')
  const raw = `${payload}:${signature}`
  return Buffer.from(raw).toString('base64url')
}

export function verifyMemberSessionToken(token: string): { memberId: string; shopId: string } | null {
  try {
    const secret = getSecret()
    const raw = Buffer.from(token, 'base64url').toString('utf-8')
    const parts = raw.split(':')
    if (parts.length !== 4) return null

    const [memberId, shopId, tsStr, signature] = parts
    const timestamp = parseInt(tsStr, 10)
    if (isNaN(timestamp)) return null
    if (Date.now() - timestamp > SESSION_DURATION_MS) return null

    const payload = `${memberId}:${shopId}:${timestamp}`
    const expected = createHmac('sha256', secret).update(payload).digest('hex')

    try {
      return timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'))
        ? { memberId, shopId }
        : null
    } catch {
      return signature === expected ? { memberId, shopId } : null
    }
  } catch {
    return null
  }
}

export function getSessionCookieOptions(maxAge?: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: maxAge ?? Math.floor(SESSION_DURATION_MS / 1000),
    path: '/',
  }
}

export const MEMBER_SESSION_COOKIE = COOKIE_NAME
