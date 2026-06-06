// src/lib/billing/raast.ts
// Raast payment configuration for Meradarzi subscriptions
// No API key needed -- purely display-based manual flow

export interface RaastConfig {
  raastId:       string      // Your Raast ID (IBAN or alias)
  accountTitle:  string      // Account holder name
  bankName:      string      // Your bank
  instructions:  string[]    // Step-by-step for customer
}

// Set NEXT_PUBLIC_RAAST_* env vars in .env.local
export const RAAST_CONFIG: RaastConfig = {
  raastId:      process.env.NEXT_PUBLIC_RAAST_ID ?? '',
  accountTitle: process.env.NEXT_PUBLIC_RAAST_NAME ?? '',
  bankName:     process.env.NEXT_PUBLIC_RAAST_BANK ?? '',
  instructions: [
    'Apni bank app ya Easypaisa/JazzCash kholein',
    'Raast ya "Send Money" option chunein',
    'Raast ID daalein ya QR scan karein',
    'Exact amount daalein jo neeche likha hai',
    'Payment karein aur Transaction ID note karein',
    'Neeche Transaction ID daalein -- hum 24 ghante mein activate kar denge',
  ],
}

export interface PaymentRequest {
  planId:       string
  billingCycle: 'monthly' | 'yearly'
  amountPkr:   number
  shopId:       string
  shopName:     string
}

// Generate a unique payment reference
// Format: DM-SHOPID4CHARS-TIMESTAMP4CHARS
export function generatePaymentRef(shopId: string): string {
  const shopPart = shopId.replace(/-/g, '').slice(0, 4).toUpperCase()
  const timePart = Date.now().toString(36).slice(-4).toUpperCase()
  return `DM-${shopPart}-${timePart}`
}

// Build the UPI/Raast deep link for QR code
// Note: Raast QR format follows ISO 20022 standard
export function buildRaastQRData(config: RaastConfig, amount: number, ref: string): string {
  // Plain payment details. Custom raast:// deep links are rejected by many bank scanners.
  return [
    'MeraDarzi subscription payment',
    `Raast ID: ${config.raastId}`,
    `Account: ${config.accountTitle}`,
    `Bank: ${config.bankName}`,
    `Amount: PKR ${amount}`,
    `Reference: ${ref}`,
  ].join('\n')
}

// Format amount with note for payment description
export function buildPaymentNote(planId: string, cycle: string, ref: string): string {
  return `MeraDarzi ${planId} ${cycle} ${ref}`
}
