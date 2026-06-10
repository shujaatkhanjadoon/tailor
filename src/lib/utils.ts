import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a Pakistan phone number to WhatsApp international format.
 * Cleans non-digit characters, removes leading 0, and prepends 92.
 * @example formatWhatsAppPhone("0300-1234567") → "923001234567"
 */
export function formatWhatsAppPhone(phone: string): string {
  return `92${phone.replace(/^0/, '').replace(/\D/g, '')}`
}

/**
 * Build a WhatsApp deep link URL with pre-filled message.
 * @example buildWhatsAppLink("03001234567", "Hello!") → "https://wa.me/923001234567?text=Hello%21"
 */
export function buildWhatsAppLink(phone: string, message: string): string {
  const cleanPhone = formatWhatsAppPhone(phone)
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
}
