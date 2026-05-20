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

// ── Shared brand colours (update once, propagate everywhere) ──────
const C = {
  navy:        '#0c1829',
  navyMid:     '#162236',
  blue:        '#2563eb',
  blueLight:   '#3b82f6',
  bluePale:    '#dbeafe',
  white:       '#ffffff',
  offWhite:    '#f8fafc',
  border:      '#e2e8f0',
  textPrimary: '#0f172a',
  textBody:    '#334155',
  textMuted:   '#64748b',
  textFaint:   '#94a3b8',
  amber:       '#fef3c7',
  amberText:   '#92400e',
  green:       '#dcfce7',
  greenText:   '#166534',
  labelBg:     '#f1f5f9',
} as const

// ── Typography helpers ────────────────────────────────────────────
const FONT_HEADING = `'Poppins', Arial, sans-serif`
const FONT_BODY    = `'Montserrat', Arial, sans-serif`

// ── Shared Google Fonts import block ─────────────────────────────
const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@600;700;800&family=Montserrat:wght@400;500;600;700&display=swap');`

// ── Shared responsive CSS ─────────────────────────────────────────
const RESPONSIVE_CSS = `
  body, table, td, a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
  table, td { mso-table-lspace:0pt; mso-table-rspace:0pt; }
  img { -ms-interpolation-mode:bicubic; border:0; outline:none; text-decoration:none; }
  body { margin:0!important; padding:0!important; width:100%!important; }
  a[x-apple-data-detectors] { color:inherit!important; text-decoration:none!important; }
  @media only screen and (max-width:600px) {
    .email-container { width:100%!important; max-width:100%!important; }
    .fluid { width:100%!important; max-width:100%!important; }
    .stack-column,
    .stack-column-center { display:block!important; width:100%!important; max-width:100%!important; direction:ltr!important; }
    .stack-column-center { text-align:center!important; }
    .center-on-narrow { text-align:center!important; display:block!important; margin:0 auto!important; }
    .hero-pad { padding:24px 18px!important; }
    .body-pad { padding:24px 18px!important; }
    .footer-pad { padding:20px 18px 24px!important; }
    .cta-btn { display:block!important; width:100%!important; text-align:center!important; box-sizing:border-box!important; padding:14px 20px!important; }
    .hide-mobile { display:none!important; max-height:0!important; overflow:hidden!important; }
    .otp-digit { font-size:34px!important; letter-spacing:6px!important; }
    .footer-row { display:block!important; width:100%!important; }
    .footer-cell { display:block!important; width:100%!important; text-align:center!important; padding-bottom:10px!important; }
    .detail-label { width:40%!important; font-size:11px!important; }
    .detail-value { font-size:12px!important; }
    h1.email-title { font-size:20px!important; }
  }
`

// ── Header gradient (using brand colour #1d35be) ──────────────────
const HEADER_GRADIENT = `linear-gradient(135deg, #1d35be 0%, #2a4fd6 40%, #1d35be 100%)`
const ACCENT_BAR      = `linear-gradient(90deg, #1d35be 0%, #3b5df5 50%, #60a5fa 100%)`

// ── Pixel-perfect detail table (email-safe) ───────────────────────
function detailTable(rows: [string, unknown][]) {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 0 8px;border-radius:12px;overflow:hidden;border:1px solid ${C.border};">
      ${rows.map(([label, value], i) => `
        <tr>
          <td class="detail-label" width="36%" style="padding:10px 12px;background:${C.labelBg};color:${C.textMuted};font-size:11px;font-family:${FONT_BODY};font-weight:700;text-transform:uppercase;letter-spacing:0.06em;border-bottom:${i === rows.length - 1 ? 'none' : `1px solid ${C.border}`};vertical-align:top;">
            ${escapeHtml(label)}
          </td>
          <td class="detail-value" style="padding:10px 14px;background:${C.white};color:${C.textPrimary};font-size:13px;font-family:${FONT_BODY};font-weight:500;border-left:1px solid ${C.border};border-bottom:${i === rows.length - 1 ? 'none' : `1px solid ${C.border}`};vertical-align:top;word-break:break-word;">
            ${escapeHtml(value)}
          </td>
        </tr>
      `).join('')}
    </table>
  `
}

// ── Shared footer HTML ────────────────────────────────────────────
function sharedFooter() {
  return `
  <tr>
    <td class="footer-pad" style="padding:24px 40px 30px;background:${C.offWhite};border-radius:0 0 20px 20px;border-top:1px solid ${C.border};">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">

        <!-- Logo + tagline row -->
        <tr>
          <td align="center" style="padding-bottom:16px;">
            <a href="${APP_URL}" style="display:inline-block;text-decoration:none;line-height:0;">
              <img src="https://app.meradarzi.pk/logo.png" width="120" height="auto" alt="MeraDarzi"
                   style="display:block;border:0;outline:none;text-decoration:none;width:120px;max-width:120px;height:auto;opacity:0.85;">
            </a>
            <p style="margin:8px 0 0;color:${C.textMuted};font-family:${FONT_BODY};font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;">
              Pakistan's #1 Tailor Management App
            </p>
          </td>
        </tr>

        <!-- Divider -->
        <tr>
          <td style="padding-bottom:16px;">
            <div style="height:1px;background:${C.border};font-size:0;line-height:0;">&nbsp;</div>
          </td>
        </tr>

        <!-- Support links row -->
        <tr>
          <td align="center">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto;">
              <tr>
                <td style="padding:0 10px;border-right:1px solid ${C.border};">
                  <a href="mailto:${SUPPORT_EMAIL}" style="color:${C.blue};font-family:${FONT_BODY};font-size:12px;font-weight:600;text-decoration:none;">${SUPPORT_EMAIL}</a>
                </td>
                <td style="padding:0 10px;border-right:1px solid ${C.border};">
                  <span style="color:${C.textMuted};font-family:${FONT_BODY};font-size:12px;font-weight:500;">${escapeHtml(SUPPORT_PHONE)}</span>
                </td>
                <td style="padding:0 10px;">
                  <a href="${APP_URL}" style="color:${C.blue};font-family:${FONT_BODY};font-size:12px;font-weight:600;text-decoration:none;">meradarzi.pk</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Divider -->
        <tr>
          <td style="padding:16px 0 12px;">
            <div style="height:1px;background:${C.border};font-size:0;line-height:0;">&nbsp;</div>
          </td>
        </tr>

        <!-- Copyright -->
        <tr>
          <td align="center">
            <p style="margin:0;color:${C.textFaint};font-family:${FONT_BODY};font-size:11px;line-height:1.7;">
              &copy; ${new Date().getFullYear()} MeraDarzi. All rights reserved.<br>
              This email was sent because you have an account with MeraDarzi.
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
  `
}

// ── Master branded template ───────────────────────────────────────
function brandedEmailTemplate(opts: {
  title:      string
  preview?:   string
  body:       string
  ctaLabel?:  string
  ctaUrl?:    string
  accentBadge?: string
}) {
  return `
<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="format-detection" content="telephone=no,date=no,address=no,email=no">
  <title>${escapeHtml(opts.title)}</title>
  <!--[if mso]>
  <noscript>
    <xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
  </noscript>
  <![endif]-->
  <style>
    ${FONT_IMPORT}
    ${RESPONSIVE_CSS}
  </style>
</head>
<body style="margin:0;padding:0;background-color:#eef2f7;font-family:${FONT_BODY};word-break:break-word;">

  <!-- Preheader -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
    ${escapeHtml(opts.preview ?? opts.title)}&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;
  </div>

  <!-- Email wrapper -->
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#eef2f7;">
    <tr>
      <td align="center" style="padding:36px 12px;">

        <!-- Email container -->
        <table role="presentation" class="email-container" cellspacing="0" cellpadding="0" border="0" width="620" style="max-width:620px;width:100%;">

          <!-- ── HEADER ── -->
          <tr>
            <td style="border-radius:20px 20px 0 0;overflow:hidden;background:${HEADER_GRADIENT};">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">

                <!-- Top accent bar -->
                <tr>
                  <td style="height:4px;background:${ACCENT_BAR};font-size:0;line-height:0;">&nbsp;</td>
                </tr>

                <!-- Logo + badge row -->
                <tr>
                  <td class="hero-pad" style="padding:32px 40px 12px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <!-- Logo -->
                        <td style="vertical-align:middle;">
                          <a href="${APP_URL}" style="display:inline-block;text-decoration:none;line-height:0;">
                            <img src="https://app.meradarzi.pk/logo.png" width="160" height="28" alt="MeraDarzi"
                                 style="display:block;border:0;outline:none;text-decoration:none;width:160px;max-width:160px;height:auto;">
                          </a>
                        </td>
                        ${opts.accentBadge ? `
                        <!-- Badge -->
                        <td align="right" style="vertical-align:middle;">
                          <span style="display:inline-block;background:rgba(255,255,255,0.15);color:#ffffff;font-family:${FONT_BODY};font-size:10px;font-weight:700;padding:5px 13px;border-radius:20px;letter-spacing:0.1em;text-transform:uppercase;border:1px solid rgba(255,255,255,0.25);">
                            ${escapeHtml(opts.accentBadge)}
                          </span>
                        </td>
                        ` : ''}
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Divider -->
                <tr>
                  <td style="padding:0 40px;">
                    <div style="height:1px;background:rgba(255,255,255,0.12);font-size:0;line-height:0;">&nbsp;</div>
                  </td>
                </tr>

                <!-- Title + preview -->
                <tr>
                  <td class="hero-pad" style="padding:20px 40px 32px;">
                    <h1 class="email-title" style="margin:0 0 8px;color:${C.white};font-family:${FONT_HEADING};font-size:24px;font-weight:700;line-height:1.3;letter-spacing:-0.3px;">
                      ${escapeHtml(opts.title)}
                    </h1>
                    ${opts.preview ? `
                    <p style="margin:0;color:rgba(255,255,255,0.72);font-family:${FONT_BODY};font-size:14px;font-weight:400;line-height:1.7;">
                      ${escapeHtml(opts.preview)}
                    </p>` : ''}
                  </td>
                </tr>

              </table>
            </td>
          </tr>

          <!-- ── BODY ── -->
          <tr>
            <td class="body-pad" style="padding:32px 40px;background:${C.white};">
              ${opts.body}

              ${opts.ctaUrl && opts.ctaLabel ? `
              <!-- CTA -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top:28px;">
                <tr>
                  <td>
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="border-radius:12px;background:${HEADER_GRADIENT};box-shadow:0 4px 14px rgba(29,53,190,0.35);">
                          <a href="${opts.ctaUrl}" class="cta-btn"
                             style="display:inline-block;padding:14px 32px;color:${C.white};font-family:${FONT_BODY};font-size:14px;font-weight:700;text-decoration:none;border-radius:12px;letter-spacing:0.02em;">
                            ${escapeHtml(opts.ctaLabel)} &rarr;
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              ` : ''}
            </td>
          </tr>

          <!-- ── FOOTER ── -->
          ${sharedFooter()}

        </table>
        <!-- /Email container -->

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

  const isSignup = purpose === 'signup'

  const html = `
<!doctype html>
<html lang="ur" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="format-detection" content="telephone=no,date=no,address=no,email=no">
  <title>${subject}</title>
  <!--[if mso]>
  <noscript>
    <xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
  </noscript>
  <![endif]-->
  <style>
    ${FONT_IMPORT}
    ${RESPONSIVE_CSS}
  </style>
</head>
<body style="margin:0;padding:0;background-color:#eef2f7;font-family:${FONT_BODY};word-break:break-word;">

  <!-- Preheader -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
    ${isSignup ? 'Aapka verification code:' : 'Login OTP:'} ${otp} — 10 minute mein expire hoga.&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;
  </div>

  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#eef2f7;">
    <tr>
      <td align="center" style="padding:36px 12px;">
        <table role="presentation" class="email-container" cellspacing="0" cellpadding="0" border="0" width="580" style="max-width:580px;width:100%;">

          <!-- ── HEADER ── -->
          <tr>
            <td style="border-radius:20px 20px 0 0;overflow:hidden;background:${HEADER_GRADIENT};">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">

                <!-- Top accent bar -->
                <tr>
                  <td style="height:4px;background:${ACCENT_BAR};font-size:0;line-height:0;">&nbsp;</td>
                </tr>

                <!-- Logo -->
                <tr>
                  <td class="hero-pad" style="padding:28px 36px 16px;">
                    <a href="${APP_URL}" style="display:inline-block;text-decoration:none;line-height:0;">
                      <img src="https://app.meradarzi.pk/logo.png" width="150" height="auto" alt="MeraDarzi"
                           style="display:block;border:0;outline:none;text-decoration:none;width:150px;max-width:150px;height:auto;">
                    </a>
                  </td>
                </tr>

                <!-- Divider -->
                <tr>
                  <td style="padding:0 36px;">
                    <div style="height:1px;background:rgba(255,255,255,0.12);font-size:0;line-height:0;">&nbsp;</div>
                  </td>
                </tr>

                <!-- Title + subtitle -->
                <tr>
                  <td class="hero-pad" style="padding:18px 36px 30px;">
                    <h1 class="email-title" style="margin:0 0 8px;color:${C.white};font-family:${FONT_HEADING};font-size:22px;font-weight:700;line-height:1.3;letter-spacing:-0.3px;">
                      ${isSignup ? 'Aapka Account Verify Karein' : 'Login Verification Code'}
                    </h1>
                    <p style="margin:0;color:rgba(255,255,255,0.72);font-family:${FONT_BODY};font-size:13px;font-weight:400;line-height:1.7;">
                      ${isSignup
                        ? 'MeraDarzi account activate karne ke liye yeh one-time code use karein.'
                        : 'Apne MeraDarzi account mein securely login karne ke liye yeh code use karein.'}
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

          <!-- ── BODY ── -->
          <tr>
            <td class="body-pad" style="padding:32px 36px;background:${C.white};">

              <!-- OTP block -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:0 0 24px;">
                <tr>
                  <td align="center" style="background:${C.bluePale};border:2px solid #bfdbfe;border-radius:16px;padding:30px 24px;">
                    <p style="margin:0 0 8px;color:${C.textMuted};font-family:${FONT_BODY};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;">
                      Your One-Time Code
                    </p>
                    <div class="otp-digit" style="font-family:'Courier New',Courier,monospace;font-size:46px;font-weight:900;letter-spacing:12px;color:#1d35be;line-height:1.1;margin:4px 0 16px;">
                      ${otp}
                    </div>
                    <!-- Expiry pill -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto;">
                      <tr>
                        <td style="background:#dbeafe;border-radius:20px;padding:6px 16px;">
                          <p style="margin:0;color:#1e40af;font-family:${FONT_BODY};font-size:12px;font-weight:600;">
                            &#9201;&nbsp; Expires in 10 minutes
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Steps -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:0 0 24px;">
                <tr>
                  <td style="background:${C.offWhite};border-radius:12px;padding:20px 22px;">
                    <p style="margin:0 0 12px;color:${C.textPrimary};font-family:${FONT_HEADING};font-size:13px;font-weight:600;">
                      How to use this code:
                    </p>
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      ${['Open the MeraDarzi app or website.', 'Enter the 6-digit code above when prompted.', 'Code works for one-time use only.'].map((step, i) => `
                      <tr>
                        <td width="28" style="vertical-align:top;padding:4px 12px 4px 0;">
                          <div style="background:${HEADER_GRADIENT};color:#fff;font-family:${FONT_BODY};font-size:11px;font-weight:700;width:22px;height:22px;border-radius:50%;text-align:center;line-height:22px;min-width:22px;">
                            ${i + 1}
                          </div>
                        </td>
                        <td style="vertical-align:top;padding:4px 0;color:${C.textBody};font-family:${FONT_BODY};font-size:13px;font-weight:400;line-height:1.6;">
                          ${step}
                        </td>
                      </tr>`).join('')}
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Security warning -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="background:${C.amber};border-left:4px solid #f59e0b;border-radius:0 10px 10px 0;padding:14px 16px;">
                    <p style="margin:0;color:${C.amberText};font-family:${FONT_BODY};font-size:12px;font-weight:500;line-height:1.65;">
                      <strong>&#9888; Security Notice:</strong> Yeh code sirf aapke liye hai. Kisi ke saath share mat karein — MeraDarzi ka koi bhi staff member kabhi yeh code nahi maangega. Agar aapne yeh request nahi ki, toh is email ko ignore karein.
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- ── FOOTER ── -->
          ${sharedFooter()}

        </table>
      </td>
    </tr>
  </table>
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
        title:       `New Shop Verification`,
        preview:     `${opts.shopName} needs admin review before going live.`,
        accentBadge: 'Action Required',
        ctaLabel:    'Review in Admin Panel',
        ctaUrl:      adminUrl,
        body: `
          <p style="margin:0 0 20px;color:${C.textBody};font-family:${FONT_BODY};font-size:14px;font-weight:400;line-height:1.7;">
            A new shop has registered on MeraDarzi and is awaiting your verification. Please review the details below and approve or reject the account from the admin panel.
          </p>
          ${detailTable([
            ['Shop Name',  opts.shopName],
            ['Owner',      opts.ownerName],
            ['Phone',      opts.ownerPhone],
            ['Email',      opts.ownerEmail],
            ['City',       opts.city ?? 'N/A'],
            ['Shop ID',    opts.shopId],
          ])}
        `,
      }),
    })
  } catch (e) {
    console.error('[Email] Admin notification failed:', e)
  }
}

export async function sendShopOwnerAccountCreated(opts: {
  shopName:   string
  ownerName:  string
  ownerEmail?: string
  ownerPhone: string
  city?:      string
}): Promise<void> {
  if (!opts.ownerEmail || opts.ownerEmail === 'N/A') return

  await sendSystemEmail({
    from:    FROM,
    to:      opts.ownerEmail,
    subject: `Welcome to MeraDarzi, ${opts.shopName}!`,
    html: brandedEmailTemplate({
      title:       'Account Created Successfully',
      preview:     'Your shop account has been created and is pending admin review.',
      accentBadge: 'Pending Review',
      ctaLabel:    'Open MeraDarzi',
      ctaUrl:      APP_URL,
      body: `
        <p style="margin:0 0 20px;color:${C.textBody};font-family:${FONT_BODY};font-size:14px;font-weight:400;line-height:1.7;">
          Assalam o Alaikum <strong style="font-weight:700;color:${C.textPrimary};">${escapeHtml(opts.ownerName)}</strong>, your MeraDarzi shop account has been successfully created. Our admin team will review your account shortly and you'll be notified once it's approved.
        </p>
        ${detailTable([
          ['Shop Name', opts.shopName],
          ['Phone',     opts.ownerPhone],
          ['City',      opts.city ?? 'N/A'],
        ])}
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top:20px;">
          <tr>
            <td style="background:${C.green};border-left:4px solid #16a34a;border-radius:0 10px 10px 0;padding:14px 16px;">
              <p style="margin:0;color:${C.greenText};font-family:${FONT_BODY};font-size:12px;font-weight:500;line-height:1.65;">
                <strong>&#10003; What happens next?</strong> Admin approval usually takes 24–48 hours. You'll receive a confirmation email once your account is live.
              </p>
            </td>
          </tr>
        </table>
      `,
    }),
  })
}

export async function sendAdminShopRegistrationEmail(opts: {
  shopName:         string
  ownerName:        string
  ownerEmail:       string
  ownerPhone:       string
  selectedPlan:     string
  registrationDate: string
  city?:            string
  shopId:           string
}): Promise<void> {
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL
  if (!adminEmail) return

  await sendSystemEmail({
    from:    FROM,
    to:      adminEmail,
    subject: `New Shop Registration: ${opts.shopName}`,
    html: brandedEmailTemplate({
      title:       'New Shop Registration',
      preview:     `${opts.shopName} signed up for the ${opts.selectedPlan} plan.`,
      accentBadge: 'New Registration',
      ctaLabel:    'Open Admin Dashboard',
      ctaUrl:      `${APP_URL}/admin/dashboard/shops`,
      body: `
        <p style="margin:0 0 20px;color:${C.textBody};font-family:${FONT_BODY};font-size:14px;font-weight:400;line-height:1.7;">
          A new shop has completed registration on MeraDarzi. Here's a summary of the account details:
        </p>
        ${detailTable([
          ['Shop Name',          opts.shopName],
          ['Owner Name',         opts.ownerName],
          ['Email',              opts.ownerEmail],
          ['Phone Number',       opts.ownerPhone],
          ['Selected Plan',      opts.selectedPlan],
          ['Registration Date',  new Date(opts.registrationDate).toLocaleString('en-PK')],
          ['City',               opts.city ?? 'N/A'],
          ['Shop ID',            opts.shopId],
        ])}
      `,
    }),
  })
}

export async function sendShopOwnerAdminActionEmail(opts: {
  shopId:   string
  action:   string
  title:    string
  message:  string
  details?: [string, unknown][]
}): Promise<void> {
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
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
    from:    FROM,
    to:      owner.email,
    subject: opts.title,
    html: brandedEmailTemplate({
      title:   opts.title,
      preview: opts.message,
      ctaLabel: 'Open Dashboard',
      ctaUrl:   APP_URL,
      body: `
        <p style="margin:0 0 20px;color:${C.textBody};font-family:${FONT_BODY};font-size:14px;font-weight:400;line-height:1.7;">
          ${escapeHtml(owner.name ?? 'Shop owner')}, ${escapeHtml(opts.message)}
        </p>
        ${detailTable([
          ['Action',  opts.action],
          ['Shop ID', opts.shopId],
          ...(opts.details ?? []),
        ])}
      `,
    }),
  })
}

export async function sendAdminSubscriptionEventEmail(opts: {
  shopId:       string
  event:        'upgraded' | 'downgraded' | 'renewed' | 'expired' | 'cancelled' | 'payment_submitted'
  plan?:        string
  previousPlan?: string
  cycle?:       string
  amountPkr?:   number
  reason?:      string
  paymentRef?:  string
  transactionId?: string
  payerName?:   string
  expiresAt?:   string | null
}): Promise<void> {
  type SubscriptionShop = {
    shop_name?:   string
    owner_phone?: string
    city?:        string
    plan?:        string
  }

  const adminEmail  = process.env.ADMIN_NOTIFICATION_EMAIL ?? process.env.ADMIN_EMAIL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
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
    upgraded:          'Subscription Upgraded',
    downgraded:        'Subscription Downgraded',
    renewed:           'Subscription Renewed',
    expired:           'Subscription Expired',
    cancelled:         'Subscription Cancelled',
    payment_submitted: 'Subscription Payment Submitted',
  }

  const eventBadge: Record<typeof opts.event, string> = {
    upgraded:          'Upgraded',
    downgraded:        'Downgraded',
    renewed:           'Renewed',
    expired:           'Expired',
    cancelled:         'Cancelled',
    payment_submitted: 'Payment Received',
  }

  await sendSystemEmail({
    from:    FROM,
    to:      adminEmail,
    subject: `${eventLabel[opts.event]}: ${shop?.shop_name ?? opts.shopId}`,
    html: brandedEmailTemplate({
      title:       eventLabel[opts.event],
      preview:     `${shop?.shop_name ?? 'A shop'} triggered a subscription event.`,
      accentBadge: eventBadge[opts.event],
      ctaLabel:    'Open Admin Dashboard',
      ctaUrl:      `${APP_URL}/admin/dashboard/shops`,
      body: `
        <p style="margin:0 0 20px;color:${C.textBody};font-family:${FONT_BODY};font-size:14px;font-weight:400;line-height:1.7;">
          A subscription event has been triggered. Review the details below in your admin panel.
        </p>
        ${detailTable([
          ['Event',          opts.event],
          ['Shop',           shop?.shop_name ?? 'N/A'],
          ['Shop ID',        opts.shopId],
          ['Owner Phone',    shop?.owner_phone ?? 'N/A'],
          ['City',           shop?.city ?? 'N/A'],
          ['Previous Plan',  opts.previousPlan ?? 'N/A'],
          ['Plan',           opts.plan ?? shop?.plan ?? 'N/A'],
          ['Cycle',          opts.cycle ?? 'N/A'],
          ['Amount',         opts.amountPkr ? `Rs. ${opts.amountPkr.toLocaleString()}` : 'N/A'],
          ['Payment Ref',    opts.paymentRef ?? 'N/A'],
          ['Transaction ID', opts.transactionId ?? 'N/A'],
          ['Payer',          opts.payerName ?? 'N/A'],
          ['Reason',         opts.reason ?? 'N/A'],
          ['Expires At',     opts.expiresAt ?? 'N/A'],
          ['Timestamp',      new Date().toLocaleString('en-PK')],
        ])}
      `,
    }),
  })
}