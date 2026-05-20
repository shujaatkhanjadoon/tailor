// src/lib/security/email-otp.ts
import { Resend }  from 'resend'
import { createHash, randomInt } from 'crypto'

const resend  = new Resend(process.env.RESEND_API_KEY)
const FROM    = process.env.RESEND_FROM_EMAIL ?? 'no-reply@meradarzi.pk'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.meradarzi.pk'
const SUPPORT_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL ?? 'darzihub9@gmail.com'
const SUPPORT_PHONE = process.env.NEXT_PUBLIC_ADMIN_WHATSAPP ??  '+92 313 5931459'
const emailLastSentAt = new Map<string, number>()
const SYSTEM_EMAIL_INTERVAL_MS = 60_000

async function sendSystemEmail(args: Parameters<typeof resend.emails.send>[0], key?: string) {
  const recipients = Array.isArray(args.to) ? args.to.join(',') : String(args.to)
  const rateKey = key ?? recipients.toLowerCase()
  const now = Date.now()
  const lastSentAt = emailLastSentAt.get(rateKey) ?? 0
  if (now - lastSentAt < SYSTEM_EMAIL_INTERVAL_MS) {
    console.warn(`[Email] Skipped rate-limited system email for ${rateKey}`)
    return { data: null, error: null }
  }
  emailLastSentAt.set(rateKey, now)
  return resend.emails.send(args)
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function brandedEmailTemplate(opts: {
  title: string
  preview?: string
  body: string
  ctaLabel?: string
  ctaUrl?: string
}) {
  return `
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;background:#f1f5f9;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;">
  <div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(opts.preview ?? opts.title)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border-radius:24px;overflow:hidden;border:1px solid #e2e8f0;">
          <tr>
            <td style="background:#0f172a;padding:24px;">
              <img src="https://app.meradarzi.pk/logo.png" width="150" height="25" alt="MeraDarzi" style="display:block;border-radius:12px;">
              <h1 style="margin:18px 0 4px;color:#ffffff;font-size:24px;line-height:1.2;">${escapeHtml(opts.title)}</h1>
              ${opts.preview ? `<p style="margin:0;color:#cbd5e1;font-size:14px;line-height:1.6;">${escapeHtml(opts.preview)}</p>` : ''}
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              ${opts.body}
              ${opts.ctaUrl && opts.ctaLabel ? `
                <div style="margin-top:24px;">
                  <a href="${opts.ctaUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:700;padding:13px 18px;border-radius:12px;">
                    ${escapeHtml(opts.ctaLabel)}
                  </a>
                </div>
              ` : ''}
            </td>
          </tr>
          <tr>
            <td style="background:#f8fafc;padding:20px 28px;border-top:1px solid #e2e8f0;">
              <p style="margin:0 0 8px;color:#475569;font-size:13px;font-weight:700;">MeraDarzi Support</p>
              <p style="margin:0;color:#64748b;font-size:12px;line-height:1.7;">
                Email: <a href="mailto:${SUPPORT_EMAIL}" style="color:#2563eb;">${SUPPORT_EMAIL}</a><br>
                Phone: ${escapeHtml(SUPPORT_PHONE)}<br>
                Website: <a href="${APP_URL}" style="color:#2563eb;">${APP_URL}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

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
    ? 'MeraDarzi — Account Verify Karein'
    : 'MeraDarzi — Login OTP'

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
        <span style="font-size:24px;"><image src="https://app.meradarzi.pk/icon.svg"/>"</span>
        <span style="color:white;font-size:20px;font-weight:700;">MeraDarzi</span>
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
          ? 'MeraDarzi account create karne ke liye neeche wala code use karein:'
          : 'MeraDarzi mein login karne ke liye yeh code use karein:'
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
        MeraDarzi — Pakistan ka pehla tailor management app<br>
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
    await sendSystemEmail({
      from:    FROM,
      to:      adminEmail,
      subject: `🔔 New Shop Verification: ${opts.shopName}`,
      html: brandedEmailTemplate({
        title: `New Shop Verification: ${opts.shopName}`,
        preview: 'A new account needs admin review.',
        ctaLabel: 'Review in Admin Panel',
        ctaUrl: adminUrl,
        body: detailTable([
          ['Shop', opts.shopName],
          ['Owner', opts.ownerName],
          ['Phone', opts.ownerPhone],
          ['Email', opts.ownerEmail],
          ['City', opts.city ?? 'N/A'],
          ['Shop ID', opts.shopId],
        ]),
      }),
    })
  } catch (e) {
    console.error('[Email] Admin notification failed:', e)
  }
}

function detailTable(rows: [string, unknown][]) {
  return `
    <table style="width:100%;border-collapse:separate;border-spacing:0 8px;">
      ${rows.map(([label, value]) => `
        <tr>
          <td style="width:38%;padding:12px;background:#f8fafc;border-radius:10px 0 0 10px;color:#475569;font-size:13px;font-weight:700;">${escapeHtml(label)}</td>
          <td style="padding:12px;background:#f8fafc;border-radius:0 10px 10px 0;color:#0f172a;font-size:13px;">${escapeHtml(value)}</td>
        </tr>
      `).join('')}
    </table>
  `
}

export async function sendShopOwnerAccountCreated(opts: {
  shopName: string
  ownerName: string
  ownerEmail?: string
  ownerPhone: string
  city?: string
}): Promise<void> {
  if (!opts.ownerEmail || opts.ownerEmail === 'N/A') return

  await sendSystemEmail({
    from: FROM,
    to: opts.ownerEmail,
    subject: `Welcome to MeraDarzi, ${opts.shopName}`,
    html: brandedEmailTemplate({
      title: 'Account Created Successfully',
      preview: 'Your shop account has been created and is pending admin review.',
      ctaLabel: 'Open MeraDarzi',
      ctaUrl: APP_URL,
      body: `
        <p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.7;">
          Assalam o Alaikum ${escapeHtml(opts.ownerName)}, your MeraDarzi shop account has been created.
          Admin review is pending; you will be notified after approval.
        </p>
        ${detailTable([
          ['Shop', opts.shopName],
          ['Phone', opts.ownerPhone],
          ['City', opts.city ?? 'N/A'],
        ])}
      `,
    }),
  })
}

export async function sendAdminShopRegistrationEmail(opts: {
  shopName: string
  ownerName: string
  ownerEmail: string
  ownerPhone: string
  selectedPlan: string
  registrationDate: string
  city?: string
  shopId: string
}): Promise<void> {
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL
  if (!adminEmail) return

  await sendSystemEmail({
    from: FROM,
    to: adminEmail,
    subject: `New Shop Registration: ${opts.shopName}`,
    html: brandedEmailTemplate({
      title: 'New Shop Registration',
      preview: `${opts.shopName} created a ${opts.selectedPlan} account.`,
      ctaLabel: 'Open Admin Dashboard',
      ctaUrl: `${APP_URL}/admin/dashboard/shops`,
      body: detailTable([
        ['Shop Name', opts.shopName],
        ['Owner Name', opts.ownerName],
        ['Email', opts.ownerEmail],
        ['Phone Number', opts.ownerPhone],
        ['Selected Plan', opts.selectedPlan],
        ['Registration Date', new Date(opts.registrationDate).toLocaleString('en-PK')],
        ['City', opts.city ?? 'N/A'],
        ['Shop ID', opts.shopId],
      ]),
    }),
  })
}

export async function sendShopOwnerAdminActionEmail(opts: {
  shopId: string
  action: string
  title: string
  message: string
  details?: [string, unknown][]
}): Promise<void> {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!serviceKey || !supabaseUrl) return

  const res = await fetch(
    `${supabaseUrl}/rest/v1/team_members?shop_id=eq.${opts.shopId}&role=eq.owner&is_active=eq.true&select=email,name&limit=1`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
  )
  if (!res.ok) return
  const [owner] = await res.json()
  if (!owner?.email) return

  await sendSystemEmail({
    from: FROM,
    to: owner.email,
    subject: opts.title,
    html: brandedEmailTemplate({
      title: opts.title,
      preview: opts.message,
      ctaLabel: 'Open Dashboard',
      ctaUrl: APP_URL,
      body: `
        <p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.7;">
          ${escapeHtml(owner.name ?? 'Shop owner')}, ${escapeHtml(opts.message)}
        </p>
        ${detailTable([
          ['Action', opts.action],
          ['Shop ID', opts.shopId],
          ...(opts.details ?? []),
        ])}
      `,
    }),
  })
}

export async function sendAdminSubscriptionEventEmail(opts: {
  shopId: string
  event: 'upgraded' | 'downgraded' | 'renewed' | 'expired' | 'cancelled' | 'payment_submitted'
  plan?: string
  previousPlan?: string
  cycle?: string
  amountPkr?: number
  reason?: string
  paymentRef?: string
  transactionId?: string
  payerName?: string
  expiresAt?: string | null
}): Promise<void> {
  type SubscriptionShop = {
    shop_name?: string
    owner_phone?: string
    city?: string
    plan?: string
  }

  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL ?? process.env.ADMIN_EMAIL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!adminEmail) return

  let shop: SubscriptionShop | null = null
  if (serviceKey && supabaseUrl) {
    try {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/shops?id=eq.${opts.shopId}&select=shop_name,owner_phone,city,plan&limit=1`,
        { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
      )
      if (res.ok) {
        const rows = await res.json() as SubscriptionShop[]
        shop = rows?.[0] ?? null
      }
    } catch (e) {
      console.error('[Email] Subscription shop lookup failed:', e)
    }
  }

  const eventLabel: Record<typeof opts.event, string> = {
    upgraded: 'Subscription Upgraded',
    downgraded: 'Subscription Downgraded',
    renewed: 'Subscription Renewed',
    expired: 'Subscription Expired',
    cancelled: 'Subscription Cancelled',
    payment_submitted: 'Subscription Payment Submitted',
  }

  await sendSystemEmail({
    from: FROM,
    to: adminEmail,
    subject: `${eventLabel[opts.event]}: ${shop?.shop_name ?? opts.shopId}`,
    html: brandedEmailTemplate({
      title: eventLabel[opts.event],
      preview: `${shop?.shop_name ?? 'A shop'} triggered a subscription event.`,
      ctaLabel: 'Open Admin Dashboard',
      ctaUrl: `${APP_URL}/admin/dashboard/shops`,
      body: detailTable([
        ['Event', opts.event],
        ['Shop', shop?.shop_name ?? 'N/A'],
        ['Shop ID', opts.shopId],
        ['Owner Phone', shop?.owner_phone ?? 'N/A'],
        ['City', shop?.city ?? 'N/A'],
        ['Previous Plan', opts.previousPlan ?? 'N/A'],
        ['Plan', opts.plan ?? shop?.plan ?? 'N/A'],
        ['Cycle', opts.cycle ?? 'N/A'],
        ['Amount', opts.amountPkr ? `Rs. ${opts.amountPkr.toLocaleString()}` : 'N/A'],
        ['Payment Ref', opts.paymentRef ?? 'N/A'],
        ['Transaction ID', opts.transactionId ?? 'N/A'],
        ['Payer', opts.payerName ?? 'N/A'],
        ['Reason', opts.reason ?? 'N/A'],
        ['Expires At', opts.expiresAt ?? 'N/A'],
        ['Time', new Date().toLocaleString('en-PK')],
      ]),
    }),
  })
}
