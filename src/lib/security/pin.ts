// src/lib/security/pin.ts
import bcrypt from 'bcryptjs'

const SALT_ROUNDS = 10
const PIN_LENGTH  = 8

// ── Weak PINs to reject ───────────────────────────────────────────
const WEAK_PINS = [
  '00000000','11111111','22222222','33333333','44444444',
  '55555555','66666666','77777777','88888888','99999999',
  '12345678','87654321','11223344','12121212','11112222',
  '00001111','99998888','12341234','11111111','00000000',
  '10101010','01010101','12121212','11221122','00110011',
]

export interface PINValidationResult {
  valid:  boolean
  error?: string
}

export function validatePIN(pin: string): PINValidationResult {
  if (!pin) return { valid: false, error: 'PIN daalein' }

  // Must be exactly 8 digits
  if (!/^\d{8}$/.test(pin)) {
    return {
      valid: false,
      error: 'PIN bilkul 8 numbers ka hona chahiye',
    }
  }

  // Reject all same digits
  if (/^(\d)\1{7}$/.test(pin)) {
    return {
      valid: false,
      error: 'Sab ek jaise numbers use mat karein (jaise: 11111111)',
    }
  }

  // Reject sequential
  const sequential = '0123456789012345678'
  const revSequential = '9876543210987654321'
  if (sequential.includes(pin) || revSequential.includes(pin)) {
    return {
      valid: false,
      error: 'Ascending ya descending numbers use mat karein',
    }
  }

  // Reject known weak PINs
  if (WEAK_PINS.includes(pin)) {
    return {
      valid: false,
      error: 'Yeh PIN bahut common hai. Koi unique PIN chunein.',
    }
  }

  // Must have at least 2 different digits
  const uniqueDigits = new Set(pin.split('')).size
  if (uniqueDigits < 3) {
    return {
      valid: false,
      error: 'PIN mein kam se kam 3 alag alag numbers hone chahiye',
    }
  }

  return { valid: true }
}

export async function hashPIN(pin: string): Promise<string> {
  return bcrypt.hash(pin, SALT_ROUNDS)
}

export async function verifyPIN(pin: string, hash: string): Promise<boolean> {
  // Handle legacy plaintext PINs (migration path)
  if (!hash.startsWith('$2')) {
    return pin === hash
  }
  return bcrypt.compare(pin, hash)
}

export function getPINStrength(pin: string): {
  score: number
  label: string
  color: string
} {
  if (pin.length < 8) return { score: 0, label: '', color: '' }

  const uniqueDigits   = new Set(pin.split('')).size
  const validation     = validatePIN(pin)

  if (!validation.valid) return { score: 1, label: 'Kamzor', color: 'bg-red-500' }
  if (uniqueDigits >= 6) return { score: 4, label: 'Mazboot', color: 'bg-green-500' }
  if (uniqueDigits >= 4) return { score: 3, label: 'Theek Hai', color: 'bg-amber-500' }
  return { score: 2, label: 'Thodi Kamzor', color: 'bg-orange-400' }
}