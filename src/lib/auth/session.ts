import crypto, { createHmac, timingSafeEqual } from 'crypto'

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
const COOKIE_NAME = '__Secure-md_session'

function getSecret(): string {
  const secret = process.env.SESSION_SIGNING_SECRET
  if (!secret) throw new Error('SESSION_SIGNING_SECRET not set (required for session signing)')
  return secret
}

export function generateMemberSessionToken(memberId: string, shopId: string, nonce?: string, tokenVersion?: number): string {
  const secret = getSecret()
  const timestamp = Date.now()
  const n = nonce ?? crypto.randomUUID()
  const tv = tokenVersion ?? 1
  const payload = `${memberId}:${shopId}:${timestamp}:${n}:${tv}`
  const signature = createHmac('sha256', secret).update(payload).digest('hex')
  const raw = `${payload}:${signature}`
  return Buffer.from(raw).toString('base64url')
}

function parseToken(token: string): { memberId: string; shopId: string; timestamp: number; nonce?: string; tokenVersion?: number; signature: string } | null {
  try {
    const secret = getSecret()
    const raw = Buffer.from(token, 'base64url').toString('utf-8')
    const parts = raw.split(':')

    // New format: memberId:shopId:timestamp:nonce:tokenVersion:signature (6 parts)
    if (parts.length === 6) {
      const [memberId, shopId, tsStr, nonce, tvStr, signature] = parts
      const timestamp = parseInt(tsStr, 10)
      const tokenVersion = parseInt(tvStr, 10)
      if (isNaN(timestamp) || isNaN(tokenVersion)) return null

      const payload = `${memberId}:${shopId}:${timestamp}:${nonce}:${tokenVersion}`
      const expected = createHmac('sha256', secret).update(payload).digest('hex')

      let sigValid = false
      try {
        sigValid = timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'))
      } catch { /* fall through */ }
      if (!sigValid) return null

      return { memberId, shopId, timestamp, nonce, tokenVersion, signature }
    }

    // Legacy format: memberId:shopId:timestamp:nonce:signature (5 parts)
    if (parts.length === 5) {
      const [memberId, shopId, tsStr, nonce, signature] = parts
      const timestamp = parseInt(tsStr, 10)
      if (isNaN(timestamp)) return null

      const payload = `${memberId}:${shopId}:${timestamp}:${nonce}`
      const expected = createHmac('sha256', secret).update(payload).digest('hex')

      let sigValid = false
      try {
        sigValid = timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'))
      } catch { /* fall through */ }
      if (!sigValid) return null

      return { memberId, shopId, timestamp, nonce, tokenVersion: 1, signature }
    }

    // Legacy format: memberId:shopId:timestamp:signature (4 parts, no nonce)
    if (parts.length === 4) {
      const [memberId, shopId, tsStr, signature] = parts
      const timestamp = parseInt(tsStr, 10)
      if (isNaN(timestamp)) return null

      const payload = `${memberId}:${shopId}:${timestamp}`
      const expected = createHmac('sha256', secret).update(payload).digest('hex')

      let sigValid = false
      try {
        sigValid = timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'))
      } catch { /* fall through */ }
      if (!sigValid) return null

      return { memberId, shopId, timestamp, tokenVersion: 1, signature }
    }

    return null
  } catch {
    return null
  }
}

export interface SessionInfo {
  memberId: string
  shopId: string
  tokenVersion?: number
}

export function verifyMemberSessionToken(token: string): SessionInfo | null {
  const parsed = parseToken(token)
  if (!parsed) return null
  if (Date.now() - parsed.timestamp > SESSION_DURATION_MS) return null

  return { memberId: parsed.memberId, shopId: parsed.shopId, tokenVersion: parsed.tokenVersion }
}

export function rotateMemberSessionToken(token: string): { session: SessionInfo; newToken: string } | null {
  const parsed = parseToken(token)
  if (!parsed) return null
  if (Date.now() - parsed.timestamp > SESSION_DURATION_MS) return null

  const newToken = generateMemberSessionToken(parsed.memberId, parsed.shopId, undefined, parsed.tokenVersion)

  return { session: { memberId: parsed.memberId, shopId: parsed.shopId, tokenVersion: parsed.tokenVersion }, newToken }
}

export function getSessionCookieOptions(maxAge?: number) {
  return {
    httpOnly: true,
    secure: true,
    sameSite: 'strict' as const,
    maxAge: maxAge ?? Math.floor(SESSION_DURATION_MS / 1000),
    path: '/',
  }
}

export const MEMBER_SESSION_COOKIE = COOKIE_NAME
