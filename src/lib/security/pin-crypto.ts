// src/lib/security/pin-crypto.ts
// Server-only: encrypt/decrypt PINs with AES-256-GCM.
// NEVER import this from a client component — the encryption key must stay server-side.

import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16

function getKey(): Buffer {
  const hex = process.env.PIN_ENCRYPTION_KEY
  if (!hex || hex.length !== 64) {
    throw new Error('PIN_ENCRYPTION_KEY must be a 64-char hex string (32 bytes)')
  }
  return Buffer.from(hex, 'hex')
}

/**
 * Encrypt a plaintext PIN. Returns base64-encoded ciphertext with IV + auth tag prepended.
 */
export function encryptPIN(plaintext: string): string {
  const key = getKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag()

  // Format: iv (12 bytes) + authTag (16 bytes) + ciphertext
  const combined = Buffer.concat([iv, authTag, Buffer.from(encrypted, 'hex')])
  return combined.toString('base64')
}

/**
 * Decrypt a base64-encoded ciphertext. Returns the original plaintext PIN.
 * Returns null if decryption fails (wrong key, corrupted data).
 */
export function decryptPIN(encoded: string): string | null {
  try {
    const key = getKey()
    const combined = Buffer.from(encoded, 'base64')

    const iv = combined.subarray(0, IV_LENGTH)
    const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
    const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH)

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)

    let decrypted = decipher.update(ciphertext.toString('hex'), 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  } catch {
    return null
  }
}
