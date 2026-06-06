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

// ── Session token (HMAC-signed, 15-min expiry, nonce-based rotation) ──────────────────────────
const SESSION_DURATION_MS = 15 * 60 * 1000

export function generateSessionToken(nonce?: string): string {
  const secret    = process.env.ADMIN_SECRET
  if (!secret) throw new Error('ADMIN_SECRET not set')
  const timestamp = Date.now()
  const n         = nonce ?? crypto.randomUUID()
  const payload   = `admin:${timestamp}:${n}`
  const signature = createHmac('sha256', secret).update(payload).digest('hex')
  const raw       = `${timestamp}:${n}:${signature}`
  return Buffer.from(raw).toString('base64url')
}

export function verifySessionToken(token: string): boolean {
  try {
    const secret = process.env.ADMIN_SECRET
    if (!secret || !token) return false

    const raw = Buffer.from(token, 'base64url').toString('utf-8')
    const parts = raw.split(':')

    // New format: timestamp:nonce:signature (3 parts)
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

    // Legacy format: timestamp:signature (2 parts)
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
  return generateSessionToken()
}

export const ADMIN_SESSION_COOKIE = '__Secure-admin_session'
