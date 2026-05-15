// src/lib/billing/whatsapp-notify.ts
// Builds WhatsApp click-to-chat links for admin to send manually
// or programmatically via WhatsApp Business API in future

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://mydarzi.vercel.app'

export function buildActivationWhatsApp(
  phone:     string,
  shopName:  string,
  planName:  string,
  cycle:     string,
  expiresAt: string | null,
): string {
  const cleanPhone = `92${phone.replace(/^0/, '').replace(/\D/g, '')}`

  const expiryText = expiresAt
    ? `\n📅 Expiry: ${new Date(expiresAt).toLocaleDateString('en-PK', {
        day: 'numeric', month: 'long', year: 'numeric',
      })}`
    : '\n🌟 Lifetime plan — koi expiry nahi'

  const message = encodeURIComponent(
    `Assalam o Alaikum! 🎉\n\n` +
    `*DarziHub — Payment Confirm!*\n\n` +
    `Aapki payment successfully verify ho gayi.\n\n` +
    `✅ Plan: *${planName}*\n` +
    `🔄 Billing: ${cycle}${expiryText}\n\n` +
    `Aapke sab features ab unlock hain. App khol ke dekhein:\n` +
    `${APP_URL}/\n\n` +
    `Shukriya! Koi masla ho to reply karein. 🙏`
  )

  return `https://wa.me/${cleanPhone}?text=${message}`
}

export function buildRejectionWhatsApp(
  phone:  string,
  reason: string,
): string {
  const cleanPhone = `92${phone.replace(/^0/, '').replace(/\D/g, '')}`

  const message = encodeURIComponent(
    `Assalam o Alaikum,\n\n` +
    `*DarziHub — Payment Verification*\n\n` +
    `Aapki payment verify nahi ho saki.\n\n` +
    `❌ Reason: ${reason}\n\n` +
    `Kripaya dobara try karein ya support se contact karein:\n` +
    `${APP_URL}/billing/upgrade\n\n` +
    `Maafi chahte hain inconvenience ke liye. Shukriya! 🙏`
  )

  return `https://wa.me/${cleanPhone}?text=${message}`
}

export function buildExpiryReminderWhatsApp(
  phone:     string,
  shopName:  string,
  planName:  string,
  daysLeft:  number,
): string {
  const cleanPhone = `92${phone.replace(/^0/, '').replace(/\D/g, '')}`

  const message = encodeURIComponent(
    `Assalam o Alaikum ${shopName}! ⏰\n\n` +
    `*DarziHub — Plan Reminder*\n\n` +
    `Aapka *${planName}* plan ${daysLeft} din mein expire ho raha hai.\n\n` +
    `Renew karne ke liye:\n` +
    `${APP_URL}/billing/upgrade\n\n` +
    `Raast ID se payment karein — zero fee!\n\n` +
    `Shukriya! 🙏`
  )

  return `https://wa.me/${cleanPhone}?text=${message}`
}
