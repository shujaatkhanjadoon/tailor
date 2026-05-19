// src/lib/admin/auth.ts
import { createHmac, createHmac as _createHmac, randomBytes, timingSafeEqual } from 'crypto'

// â”€â”€ Base32 helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function generateTOTPSecret(): string {
  const bytes = randomBytes(20)
  let result  = ''
  let buffer  = 0
  let bitsLeft = 0

  for (const byte of bytes) {
    buffer    = (buffer << 8) | byte
    bitsLeft += 8
    while (bitsLeft >= 5) {
      result  += BASE32_ALPHABET[(buffer >> (bitsLeft - 5)) & 31]
      bitsLeft -= 5
    }
  }
  if (bitsLeft > 0) {
    result += BASE32_ALPHABET[(buffer << (5 - bitsLeft)) & 31]
  }
  return result
}

function base32Decode(encoded: string): Buffer {
  const str    = encoded.toUpperCase().replace(/=+$/, '').replace(/\s/g, '')
  const bytes: number[] = []
  let buffer   = 0
  let bitsLeft = 0

  for (const char of str) {
    const idx = BASE32_ALPHABET.indexOf(char)
    if (idx === -1) continue
    buffer    = (buffer << 5) | idx
    bitsLeft += 5
    if (bitsLeft >= 8) {
      bytes.push((buffer >> (bitsLeft - 8)) & 0xff)
      bitsLeft -= 8
    }
  }
  return Buffer.from(bytes)
}

// â”€â”€ HOTP (counter-based OTP per RFC 4226) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function hotp(secretBase32: string, counter: number): string {
  const key = base32Decode(secretBase32)

  // Counter as 8-byte big-endian buffer
  const msg = Buffer.alloc(8)
  // Handle large counters safely
  const hi  = Math.floor(counter / 0x100000000)
  const lo  = counter >>> 0
  msg.writeUInt32BE(hi, 0)
  msg.writeUInt32BE(lo, 4)

  const hmac   = createHmac('sha1', key).update(msg).digest()
  const offset = hmac[hmac.length - 1] & 0x0f

  const code = (
    ((hmac[offset]     & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) <<  8) |
     (hmac[offset + 3] & 0xff)
  ) % 1_000_000

  return code.toString().padStart(6, '0')
}

// â”€â”€ TOTP (time-based OTP per RFC 6238) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const STEP_SECONDS = 30

function getTimeCounter(): number {
  return Math.floor(Date.now() / 1000 / STEP_SECONDS)
}

export function generateTOTP(secret: string): string {
  return hotp(secret, getTimeCounter())
}

// Verify with Â±1 window for clock drift
export function verifyTOTP(token: string, secret?: string): boolean {
  const s = secret ?? process.env.ADMIN_TOTP_SECRET
  if (!s) {
    console.error('[Admin Auth] ADMIN_TOTP_SECRET not set')
    return false
  }
  if (!token || token.length !== 6 || !/^\d{6}$/.test(token)) {
    return false
  }

  const counter = getTimeCounter()
  for (let delta = -1; delta <= 1; delta++) {
    const expected = hotp(s, counter + delta)
    try {
      // Timing-safe comparison
      if (timingSafeEqual(
        Buffer.from(token.padEnd(6, '0')),
        Buffer.from(expected.padEnd(6, '0'))
      )) {
        return true
      }
    } catch {
      if (token === expected) return true
    }
  }
  return false
}

// â”€â”€ TOTP URI for QR code (otpauth:// format) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function getTOTPUri(): string {
  const secret  = process.env.ADMIN_TOTP_SECRET
  if (!secret) throw new Error('ADMIN_TOTP_SECRET not set')
  const issuer  = 'MeraDarzi Admin'
  const account = 'admin'
  return (
    `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}` +
    `?secret=${secret}` +
    `&issuer=${encodeURIComponent(issuer)}` +
    `&algorithm=SHA1` +
    `&digits=6` +
    `&period=30`
  )
}

// â”€â”€ Session token (HMAC-signed, 15-min expiry) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const SESSION_DURATION_MS = 15 * 60 * 1000

export function generateSessionToken(): string {
  const secret    = process.env.ADMIN_SECRET
  if (!secret) throw new Error('ADMIN_SECRET not set')
  const timestamp = Date.now()
  const payload   = `admin:${timestamp}`
  const signature = createHmac('sha256', secret).update(payload).digest('hex')
  const raw       = `${timestamp}:${signature}`
  return Buffer.from(raw).toString('base64url')
}

export function verifySessionToken(token: string): boolean {
  try {
    const secret = process.env.ADMIN_SECRET
    if (!secret || !token) return false

    const raw   = Buffer.from(token, 'base64url').toString('utf-8')
    const colon = raw.indexOf(':')
    if (colon === -1) return false

    const tsStr     = raw.slice(0, colon)
    const signature = raw.slice(colon + 1)
    const timestamp = parseInt(tsStr, 10)

    if (isNaN(timestamp)) return false
    if (Date.now() - timestamp > SESSION_DURATION_MS) return false

    const expected = createHmac('sha256', secret)
      .update(`admin:${timestamp}`)
      .digest('hex')

    // Timing-safe comparison
    try {
      return timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expected,  'hex')
      )
    } catch {
      return false
    }
  } catch {
    return false
  }
}

export const ADMIN_SESSION_COOKIE = 'admin_session'