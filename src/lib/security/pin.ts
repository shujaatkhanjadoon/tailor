// src/lib/security/pin.ts
import bcrypt from 'bcryptjs'

export const SALT_ROUNDS = 12
export const SHOP_PIN_LENGTH = 6
export const KARIGAR_PIN_LENGTH = 6

// ── Weak PINs to reject ───────────────────────────────────────────
const WEAK_PINS = [
  '000000','111111','222222','333333','444444','555555','666666','777777','888888','999999',
  '123456','654321','112233','121212','111222','000111','999888','123123','101010','010101',
  '0000','1111','2222','3333','4444','5555','6666','7777','8888','9999','1234','4321','1212',
]

export interface PINValidationResult {
  valid:  boolean
  error?: string
}

export function validatePIN(pin: string, length = SHOP_PIN_LENGTH): PINValidationResult {
  if (!pin) return { valid: false, error: 'PIN daalein' }

  if (!new RegExp(`^\\d{${length}}$`).test(pin)) {
    return {
      valid: false,
      error: `PIN bilkul ${length} numbers ka hona chahiye`,
    }
  }

  // Reject all same digits
  if (/^(\d)\1+$/.test(pin)) {
    return {
      valid: false,
      error: `Sab ek jaise numbers use mat karein (jaise: ${'1'.repeat(length)})`,
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
  const minUnique = length <= KARIGAR_PIN_LENGTH ? 2 : 3
  if (uniqueDigits < minUnique) {
    return {
      valid: false,
      error: `PIN mein kam se kam ${minUnique} alag alag numbers hone chahiye`,
    }
  }

  return { valid: true }
}

export const validateShopPIN = (pin: string) => validatePIN(pin, SHOP_PIN_LENGTH)
export const validateKarigarPIN = (pin: string) => validatePIN(pin, KARIGAR_PIN_LENGTH)

export async function hashPIN(pin: string): Promise<string> {
  return bcrypt.hash(pin, SALT_ROUNDS)
}

export async function verifyPIN(pin: string, hash: string): Promise<boolean> {
  if (!hash.startsWith('$2')) {
    return false
  }
  return bcrypt.compare(pin, hash)
}

export function getPINStrength(pin: string): {
  score: number
  label: string
  color: string
} {
  if (pin.length < KARIGAR_PIN_LENGTH) return { score: 0, label: '', color: '' }

  const uniqueDigits   = new Set(pin.split('')).size
  const validation     = validatePIN(pin, pin.length <= KARIGAR_PIN_LENGTH ? KARIGAR_PIN_LENGTH : SHOP_PIN_LENGTH)

  if (!validation.valid) return { score: 1, label: 'Kamzor', color: 'bg-red-500' }
  if (uniqueDigits >= 6) return { score: 4, label: 'Mazboot', color: 'bg-green-500' }
  if (uniqueDigits >= 4) return { score: 3, label: 'Theek Hai', color: 'bg-amber-500' }
  return { score: 2, label: 'Thodi Kamzor', color: 'bg-orange-400' }
}
