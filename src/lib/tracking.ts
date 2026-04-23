// src/lib/tracking.ts

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'  // no I, O, 0, 1 (confusing)

// Generates: "AH-K7M2PX" format
// prefix = first 2 letters of shop name (e.g. "Ahmed" → "AH")
// suffix = 6 random chars
export function generateTrackingCode(shopName: string): string {
  const prefix = shopName
    .replace(/[^a-zA-Z]/g, '')   // letters only
    .toUpperCase()
    .slice(0, 2)
    .padEnd(2, 'X')              // pad if shop name < 2 chars

  const suffix = Array.from({ length: 6 }, () =>
    CHARS[Math.floor(Math.random() * CHARS.length)]
  ).join('')

  return `${prefix}-${suffix}`   // e.g. "AH-K7M2PX"
}

// Validate format before lookup
export function isValidTrackingCode(code: string): boolean {
  return /^[A-Z]{2}-[A-Z0-9]{6}$/i.test(code)
}

// Normalise user input (handles lowercase, spaces)
export function normaliseCode(input: string): string {
  return input.trim().toUpperCase().replace(/\s/g, '')
}