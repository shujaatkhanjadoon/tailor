// src/lib/security/email-otp.ts
import { Resend }  from 'resend'
import { createHash, randomInt } from 'crypto'

const resend  = new Resend(process.env.RESEND_API_KEY)
const FROM    = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://mydarzi.vercel.app'

// ── Generate 6-digit OTP ──────────────────────────────────────────
export function generateOTP(): string {
  return String(randomInt(100000, 999999))
}

// ── Hash OTP for storage (don't store plaintext) ──────────────────
export function hashOTP(otp: string): string {
  return createHash('sha256').update(otp + process.env.ADMIN_SECRET).digest('hex')
}

// ── Send OTP email ────────────────────────────────────────────────
export async function sendOTPEmail(
  email:     string,
  otp:       string,
  purpose:   'signup' | 'login' = 'signup'
): Promise<{ success: boolean; error?: string }> {
  const subject = purpose === 'signup'
    ? 'My Darzi — Account Verify Karein'
    : 'My Darzi — Login OTP'

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,sans-serif;">
  <div style="max-width:480px;margin:40px auto;padding:20px;">

    <!-- Header -->
    <div style="background:#1d4ed8;border-radius:16px 16px 0 0;padding:24px;text-align:center;">
      <div style="display:inline-flex;align-items:center;gap:10px;">
        <span style="font-size:24px;">✂️</span>
        <span style="color:white;font-size:20px;font-weight:700;">My Darzi</span>
      </div>
    </div>

    <!-- Body -->
    <div style="background:white;border-radius:0 0 16px 16px;padding:32px;
                box-shadow:0 4px 6px rgba(0,0,0,0.05);">

      <h2 style="margin:0 0 8px;color:#1e293b;font-size:20px;">
        ${purpose === 'signup' ? 'Aapka Account Verify Karein' : 'Login OTP'}
      </h2>

      <p style="color:#64748b;margin:0 0 24px;font-size:14px;line-height:1.6;">
        ${purpose === 'signup'
          ? 'My Darzi account create karne ke liye neeche wala code use karein:'
          : 'My Darzi mein login karne ke liye yeh code use karein:'
        }
      </p>

      <!-- OTP Box -->
      <div style="background:#eff6ff;border:2px dashed #3b82f6;border-radius:12px;
                  padding:24px;text-align:center;margin:0 0 24px;">
        <div style="font-size:40px;font-weight:900;letter-spacing:10px;
                    color:#1d4ed8;font-family:monospace;">
          ${otp}
        </div>
        <p style="color:#64748b;font-size:12px;margin:10px 0 0;">
          ⏱️ Yeh code 10 minute mein expire ho jayega
        </p>
      </div>

      <div style="background:#fef3c7;border-radius:10px;padding:14px;margin:0 0 20px;">
        <p style="color:#92400e;font-size:12px;margin:0;line-height:1.5;">
          ⚠️ <strong>Kisi ke saath share mat karein.</strong>
          Agar aapne yeh request nahi ki, toh ignore karein.
        </p>
      </div>

      <p style="color:#94a3b8;font-size:11px;margin:0;line-height:1.5;">
        My Darzi — Pakistan ka pehla tailor management app<br>
        <a href="${APP_URL}" style="color:#3b82f6;">${APP_URL}</a>
      </p>
    </div>
  </div>
</body>
</html>
  `

  try {
    const { error } = await resend.emails.send({
      from:    FROM,
      to:      email,
      subject,
      html,
    })

    if (error) {
      console.error('[Email OTP] Send error:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (e) {
    console.error('[Email OTP] Unexpected error:', e)
    return { success: false, error: String(e) }
  }
}

// ── Send shop verification notification to admin ───────────────────
export async function sendShopVerificationAlert(opts: {
  shopName:   string
  ownerName:  string
  ownerPhone: string
  ownerEmail: string
  city?:      string
  shopId:     string
}): Promise<void> {
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL
  if (!adminEmail) return

  const adminUrl = `${APP_URL}/admin/dashboard/shops`
  const waLink   = `https://wa.me/${process.env.ADMIN_WHATSAPP}?text=${encodeURIComponent(
    `New shop verification request:\n\nShop: ${opts.shopName}\nOwner: ${opts.ownerName}\nPhone: ${opts.ownerPhone}\nCity: ${opts.city ?? 'N/A'}\n\nReview: ${adminUrl}`
  )}`

  try {
    await resend.emails.send({
      from:    FROM,
      to:      adminEmail,
      subject: `🔔 New Shop Verification: ${opts.shopName}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:20px;">
          <h2>New Shop Verification Request</h2>
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:8px;background:#f8fafc;font-weight:600;">Shop</td>
                <td style="padding:8px;">${opts.shopName}</td></tr>
            <tr><td style="padding:8px;background:#f8fafc;font-weight:600;">Owner</td>
                <td style="padding:8px;">${opts.ownerName}</td></tr>
            <tr><td style="padding:8px;background:#f8fafc;font-weight:600;">Phone</td>
                <td style="padding:8px;">${opts.ownerPhone}</td></tr>
            <tr><td style="padding:8px;background:#f8fafc;font-weight:600;">Email</td>
                <td style="padding:8px;">${opts.ownerEmail}</td></tr>
            <tr><td style="padding:8px;background:#f8fafc;font-weight:600;">City</td>
                <td style="padding:8px;">${opts.city ?? 'N/A'}</td></tr>
          </table>
          <div style="margin-top:20px;display:flex;gap:10px;">
            <a href="${adminUrl}" style="background:#3b82f6;color:white;padding:12px 20px;
               border-radius:8px;text-decoration:none;font-weight:600;">
              Review in Admin Panel
            </a>
          </div>
        </div>
      `,
    })
  } catch (e) {
    console.error('[Email] Admin notification failed:', e)
  }
}