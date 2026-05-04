// src/lib/security/phone.ts
// Pakistani phone number validation

const VALID_PREFIXES = [
  '0300','0301','0302','0303','0304','0305','0306','0307','0308','0309', // Jazz
  '0310','0311','0312','0313','0314','0315','0316','0317','0318','0319', // Mobilink
  '0320','0321','0322','0323','0324','0325','0326','0327','0328','0329', // Telenor
  '0330','0331','0332','0333','0334','0335','0336','0337','0338','0339', // Ufone
  '0340','0341','0342','0343','0344','0345','0346','0347','0348','0349', // Zong
  '0350','0351',                                                          // Warid
]

export interface PhoneValidationResult {
  valid:   boolean
  cleaned: string
  error?:  string
}

export function validatePakistaniPhone(input: string): PhoneValidationResult {
  if (!input) return { valid: false, cleaned: '', error: 'Phone number daalein' }

  // Remove all non-digits
  let cleaned = input.replace(/\D/g, '')

  // Handle +92 prefix
  if (cleaned.startsWith('92') && cleaned.length === 12) {
    cleaned = '0' + cleaned.slice(2)
  }

  // Must be exactly 11 digits
  if (cleaned.length !== 11) {
    return {
      valid:   false,
      cleaned,
      error:   'Phone number 11 digits ka hona chahiye (jaise: 03001234567)',
    }
  }

  // Must start with 0
  if (!cleaned.startsWith('0')) {
    return {
      valid:   false,
      cleaned,
      error:   'Pakistani mobile number 0 se shuru hona chahiye',
    }
  }

  // Check valid prefix (first 4 digits)
  const prefix = cleaned.slice(0, 4)
  if (!VALID_PREFIXES.includes(prefix)) {
    return {
      valid:   false,
      cleaned,
      error:   'Yeh Pakistani mobile number nahi lagta',
    }
  }

  return { valid: true, cleaned }
}

export function formatPhoneDisplay(phone: string): string {
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 11) {
    return `${cleaned.slice(0,4)}-${cleaned.slice(4,7)}-${cleaned.slice(7)}`
  }
  return phone
}