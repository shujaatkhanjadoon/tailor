// src/lib/admin/auth.ts
import { createHmac, timingSafeEqual } from 'crypto'
import { authenticator } from 'otplib'

authenticator.options = { window: 1 }  // ±1 step drift tolerance

export function generateTOTPSecret(): string {
  return authenticator.generateSecret()
}

// RFC 4648 Base32 alphabet
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function hexToBase32(hex: string): string {
  const bytes = Buffer.from(hex, 'hex')
  let bits = ''
  for (const b of bytes) {
    bits += b.toString(2).padStart(8, '0')
  }
  // Pad to multiple of 5 bits
  while (bits.length % 5 !== 0) bits += '0'
  let result = ''
  for (let i = 0; i < bits.length; i += 5) {
    result += BASE32_ALPHABET[parseInt(bits.slice(i, i + 5), 2)]
  }
  return result
}

export function normalizeTOTPSecret(secret: string): string {
  const cleaned = secret.replace(/\s/g, '')
  // Detect hex (40+ chars, only 0-9 a-f A-F) vs Base32 (A-Z 2-7)
  const isHex = cleaned.length >= 32 && /^[0-9a-fA-F]+$/.test(cleaned)
  if (isHex) {
    return hexToBase32(cleaned)
  }
  return cleaned.toUpperCase().replace(/=+$/, '')
}

export function generateTOTP(secret: string): string {
  return authenticator.generate(normalizeTOTPSecret(secret))
}

export function verifyTOTP(token: string, secret?: string): boolean {
  const raw = secret ?? process.env.ADMIN_TOTP_SECRET
  if (!raw) {
    console.error('[Admin Auth] ADMIN_TOTP_SECRET not set')
    return false
  }
  if (!token || token.length !== 6 || !/^\d{6}$/.test(token)) {
    return false
  }
  try {
    return authenticator.check(token, normalizeTOTPSecret(raw))
  } catch {
    return false
  }
}

export function getTOTPUri(): string {
  const raw = process.env.ADMIN_TOTP_SECRET
  if (!raw) throw new Error('ADMIN_TOTP_SECRET not set')
  const secret  = normalizeTOTPSecret(raw)
  const issuer  = 'MeraDarzi Admin'
  const account = 'admin'
  return authenticator.keyuri(account, issuer, secret)
}

// ── Session token (HMAC-signed, nonce-based rotation) ─────────────────────────────────
const SESSION_DURATION_MS    = 15 * 60 * 1000
const REMEMBER_DURATION_MS = 7 * 24 * 60 * 60 * 1000

export function generateSessionToken(nonce?: string, rememberMe?: boolean, role?: string, username?: string): string {
  const secret    = process.env.ADMIN_SECRET
  if (!secret) throw new Error('ADMIN_SECRET not set')
  const timestamp = Date.now()
  const n         = nonce ?? crypto.randomUUID()
  const mode      = rememberMe ? '1' : '0'
  const r         = role ?? 'super_admin'
  const u         = username ?? 'master'
  const payload   = `admin:${timestamp}:${n}:${mode}:${r}:${u}`
  const signature = createHmac('sha256', secret).update(payload).digest('hex')
  const raw       = `${timestamp}:${n}:${mode}:${r}:${u}:${signature}`
  return Buffer.from(raw).toString('base64url')
}

function getTokenDuration(token: string): number {
  const raw = Buffer.from(token, 'base64url').toString('utf-8')
  const parts = raw.split(':')
  if (parts.length >= 4 && parts[2] === '1') return REMEMBER_DURATION_MS
  return SESSION_DURATION_MS
}

export function verifySessionToken(token: string): boolean {
  try {
    const secret = process.env.ADMIN_SECRET
    if (!secret || !token) return false

    const raw = Buffer.from(token, 'base64url').toString('utf-8')
    const parts = raw.split(':')

    // 6-part: timestamp:nonce:mode:role:username:signature
    if (parts.length === 6) {
      const [tsStr, , mode, role, username, signature] = parts
      const timestamp = parseInt(tsStr, 10)
      if (isNaN(timestamp)) return false
      const duration = mode === '1' ? REMEMBER_DURATION_MS : SESSION_DURATION_MS
      if (Date.now() - timestamp > duration) return false

      const expected = createHmac('sha256', secret)
        .update(`admin:${timestamp}:${parts[1]}:${mode}:${role}:${username}`)
        .digest('hex')

      try {
        return timingSafeEqual(
          Buffer.from(signature, 'hex'),
          Buffer.from(expected, 'hex')
        )
      } catch {
        return false
      }
    }

    // @deprecated 4-part: timestamp:nonce:mode:signature — legacy format, kept for session migration
    if (parts.length === 4) {
      const [tsStr, , mode, signature] = parts
      const timestamp = parseInt(tsStr, 10)
      if (isNaN(timestamp)) return false
      const duration = mode === '1' ? REMEMBER_DURATION_MS : SESSION_DURATION_MS
      if (Date.now() - timestamp > duration) return false

      const expected = createHmac('sha256', secret)
        .update(`admin:${timestamp}:${parts[1]}:${mode}`)
        .digest('hex')

      try {
        return timingSafeEqual(
          Buffer.from(signature, 'hex'),
          Buffer.from(expected, 'hex')
        )
      } catch {
        return false
      }
    }

    // @deprecated timestamp:nonce:signature (3 parts) — legacy format, kept for session migration
    if (parts.length === 3) {
      const [tsStr, , signature] = parts
      const timestamp = parseInt(tsStr, 10)
      if (isNaN(timestamp)) return false
      if (Date.now() - timestamp > SESSION_DURATION_MS) return false

      const expected = createHmac('sha256', secret)
        .update(`admin:${timestamp}:${parts[1]}`)
        .digest('hex')

      try {
        return timingSafeEqual(
          Buffer.from(signature, 'hex'),
          Buffer.from(expected, 'hex')
        )
      } catch {
        return false
      }
    }

    // @deprecated Legacy format: timestamp:signature (2 parts) — kept for session migration
    if (parts.length === 2) {
      const [tsStr, signature] = parts
      const timestamp = parseInt(tsStr, 10)
      if (isNaN(timestamp)) return false
      if (Date.now() - timestamp > SESSION_DURATION_MS) return false

      const expected = createHmac('sha256', secret)
        .update(`admin:${timestamp}`)
        .digest('hex')

      try {
        return timingSafeEqual(
          Buffer.from(signature, 'hex'),
          Buffer.from(expected, 'hex')
        )
      } catch {
        return false
      }
    }

    return false
  } catch {
    return false
  }
}

export function rotateSessionToken(token: string): string | null {
  if (!verifySessionToken(token)) return null
  const rememberMe = getTokenDuration(token) === REMEMBER_DURATION_MS
  const session = getAdminSession(token)
  const role = session?.role
  const username = session?.username
  return generateSessionToken(undefined, rememberMe, role, username)
}

export interface AdminSession {
  role: string
  username: string
}

export function getAdminSession(token: string): AdminSession | null {
  try {
    const secret = process.env.ADMIN_SECRET
    if (!secret || !token) return null

    const raw = Buffer.from(token, 'base64url').toString('utf-8')
    const parts = raw.split(':')

    // New format: timestamp:nonce:mode:role:username:signature (6 parts)
    if (parts.length === 6) {
      const [tsStr, , mode, role, username, signature] = parts
      const timestamp = parseInt(tsStr, 10)
      if (isNaN(timestamp)) return null
      const duration = mode === '1' ? REMEMBER_DURATION_MS : SESSION_DURATION_MS
      if (Date.now() - timestamp > duration) return null

      const expected = createHmac('sha256', secret)
        .update(`admin:${timestamp}:${parts[1]}:${mode}:${role}:${username}`)
        .digest('hex')

      try {
        if (!timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'))) return null
      } catch { return null }

      return { role, username }
    }

    // @deprecated Legacy 4-part tokens: assume super_admin — kept for session migration
    if (verifySessionToken(token)) {
      return { role: 'super_admin', username: 'master' }
    }

    return null
  } catch {
    return null
  }
}

export function getSessionMaxAge(token: string): number {
  const duration = getTokenDuration(token)
  return Math.floor(duration / 1000)
}

export const ADMIN_SESSION_COOKIE = '__Secure-admin_session'
