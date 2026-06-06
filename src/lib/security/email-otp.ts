// src/lib/security/email-otp.ts
import { Resend } from 'resend'
import { randomInt } from 'crypto'
import bcrypt from 'bcryptjs'
import { sbGet } from '@/lib/supabase/service'

let _resend: Resend | null = null
function getResend(): Resend {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY
    if (!key) throw new Error('RESEND_API_KEY is required')
    _resend = new Resend(key)
  }
  return _resend
}

// ── Sender: display name shows "MeraDarzi" in inbox ──────────────
const FROM_ADDR     = process.env.RESEND_FROM_EMAIL ?? 'no-reply@meradarzi.pk'
const FROM          = `MeraDarzi <${FROM_ADDR}>`

const APP_URL       = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.meradarzi.pk'
const SUPPORT_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL ?? 'darzihub9@gmail.com'
const WA_DISPLAY    = '031356344667'
const WA_LINK       = '923135634667'

const emailLastSentAt       = new Map<string, number>()
const SYSTEM_EMAIL_INTERVAL = 60_000

// ── Rate-limited system mailer ────────────────────────────────────
async function sendSystemEmail(
  args: Parameters<Resend['emails']['send']>[0],
  key?: string
) {
  const recipients = Array.isArray(args.to) ? args.to.join(',') : String(args.to)
  const rateKey    = key ?? recipients.toLowerCase()
  const now        = Date.now()
  const last       = emailLastSentAt.get(rateKey) ?? 0
  if (now - last < SYSTEM_EMAIL_INTERVAL) {
    console.warn(`[Email] Rate-limited: ${rateKey}`)
    return { data: null, error: null }
  }
  emailLastSentAt.set(rateKey, now)
  return getResend().emails.send(args)
}

// ── HTML escape ───────────────────────────────────────────────────
function esc(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

// ─────────────────────────────────────────────────────────────────
//  DESIGN TOKENS
// ─────────────────────────────────────────────────────────────────
const T = {
  // ── Header
  headerBg:     '#0F172B',
  accentBar:    'linear-gradient(90deg,#3b82f6 0%,#60a5fa 55%,#93c5fd 100%)',

  // ── Blues
  blue:         '#3b82f6',
  blueDark:     '#2563eb',
  bluePale:     '#eff6ff',
  blueBorder:   '#bfdbfe',
  blueDeep:     '#1e40af',

  // ── Neutrals
  white:        '#ffffff',
  bgPage:       '#f0f4f8',
  bgCard:       '#ffffff',
  bgSection:    '#f8fafc',
  border:       '#e2e8f0',

  // ── Text
  textHeading:  '#0f172a',
  textBody:     '#475569',
  textMuted:    '#64748b',
  textFaint:    '#94a3b8',

  // ── Status — amber
  amberBg:      '#fffbeb',
  amberBorder:  '#fde68a',
  amberLeft:    '#f59e0b',
  amberText:    '#78350f',

  // ── Status — green
  greenBg:      '#f0fdf4',
  greenBorder:  '#bbf7d0',
  greenLeft:    '#16a34a',
  greenText:    '#14532d',

  // ── Typography
  fontSans:     `'Inter','Segoe UI',Helvetica,Arial,sans-serif`,
  fontMono:     `'Courier New',Courier,monospace`,
  fontImport:   `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');`,
} as const

// ─────────────────────────────────────────────────────────────────
//  RESPONSIVE CSS  (single source of truth)
// ─────────────────────────────────────────────────────────────────
const CSS = `
  /* ── Reset ── */
  body,table,td,a { -webkit-text-size-adjust:100%;-ms-text-size-adjust:100%; }
  table,td        { mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse; }
  img             { -ms-interpolation-mode:bicubic;border:0;outline:none;text-decoration:none;display:block; }
  body            { margin:0!important;padding:0!important;width:100%!important;background-color:${T.bgPage}; }
  a[x-apple-data-detectors] { color:inherit!important;text-decoration:none!important; }

  /* ── Base element styles ── */
  .email-shell  { background-color:${T.bgPage}; }
  .email-wrap   { width:95%;max-width:640px;margin:0 auto; }

  /* ── Mobile — ≤ 600px ── */
  @media only screen and (max-width:600px) {

    /* Fluid container */
    .email-wrap   { width:100%!important;max-width:100%!important; }

    /* Header padding */
    .hdr-pad      { padding:22px 18px 10px!important; }
    .hdr-title    { padding:16px 18px 28px!important; }

    /* Body / footer */
    .body-pad     { padding:26px 18px!important; }
    .footer-pad   { padding:22px 18px 28px!important; }

    /* Logo + badge: stack vertically */
    .logo-cell    { display:block!important;width:100%!important;padding-bottom:10px!important; }
    .badge-cell   { display:block!important;width:100%!important;text-align:left!important; }

    /* CTA: full width */
    .cta-td       { width:100%!important;display:block!important; }
    .cta-btn      {
      display:block!important;
      width:100%!important;
      box-sizing:border-box!important;
      text-align:center!important;
      padding:15px 18px!important;
    }

    /* OTP digit */
    .otp-code     { font-size:40px!important;letter-spacing:10px!important; }

    /* Detail table */
    .dl-label     { width:36%!important;font-size:11px!important; }
    .dl-value     { font-size:12px!important; }

    /* Headings */
    .email-title  { font-size:20px!important;line-height:1.35!important; }

    /* Footer links: stack */
    .f-link-cell  {
      display:block!important;
      width:100%!important;
      text-align:center!important;
      border-right:none!important;
      padding:7px 0!important;
    }
  }

  /* ── Tablet — 601 – 768px ── */
  @media only screen and (min-width:601px) and (max-width:768px) {
    .email-wrap   { width:96%!important; }
    .email-title  { font-size:22px!important; }
    .otp-code     { font-size:44px!important; }
  }
`

// ─────────────────────────────────────────────────────────────────
//  SHARED BUILDING BLOCKS
// ─────────────────────────────────────────────────────────────────

/** Key–value detail table (email-safe) */
function detailTable(rows: [string, unknown][]): string {
  return /* html */`
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
         style="border-collapse:collapse;border-radius:10px;overflow:hidden;
                border:1px solid ${T.border};margin:0 0 4px;">
    ${rows.map(([label, val], i) => {
      const last = i === rows.length - 1
      const borderBottom = last ? 'none' : `1px solid ${T.border}`
      return /* html */`
      <tr>
        <td class="dl-label" width="32%"
            style="padding:11px 14px;background:${T.bgSection};color:${T.textMuted};
                   font-family:${T.fontSans};font-size:11px;font-weight:600;
                   text-transform:uppercase;letter-spacing:0.07em;vertical-align:top;
                   border-bottom:${borderBottom};">
          ${esc(label)}
        </td>
        <td class="dl-value"
            style="padding:11px 14px;background:${T.white};color:${T.textHeading};
                   font-family:${T.fontSans};font-size:13px;font-weight:500;
                   border-left:1px solid ${T.border};border-bottom:${borderBottom};
                   vertical-align:top;word-break:break-word;">
          ${esc(val)}
        </td>
      </tr>`
    }).join('')}
  </table>`
}

/** VML + HTML CTA button — renders in Outlook AND mobile */
function ctaButton(label: string, url: string): string {
  return /* html */`
  <table role="presentation" cellspacing="0" cellpadding="0" border="0"
         style="margin-top:28px;">
    <tr>
      <td class="cta-td" align="left">
        <!--[if mso]>
        <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml"
                     xmlns:w="urn:schemas-microsoft-com:office:word"
                     href="${url}"
                     style="height:48px;v-text-anchor:middle;width:240px;"
                     arcsize="20%" stroke="f" fillcolor="${T.blue}">
          <w:anchorlock/>
          <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;">
            ${esc(label)} &#8594;
          </center>
        </v:roundrect>
        <![endif]-->
        <!--[if !mso]><!-->
        <a href="${url}" class="cta-btn"
           style="display:inline-block;padding:14px 34px;
                  background-color:${T.blue};color:${T.white};
                  font-family:${T.fontSans};font-size:14px;font-weight:700;
                  text-decoration:none;border-radius:10px;letter-spacing:0.02em;
                  box-shadow:0 4px 16px rgba(59,130,246,0.32);mso-hide:all;">
          ${esc(label)} &#8594;
        </a>
        <!--<![endif]-->
      </td>
    </tr>
  </table>`
}

/** Shared footer */
function footer(): string {
  return /* html */`
  <tr>
    <td class="footer-pad"
        style="padding:26px 36px 32px;background:${T.bgSection};
               border-radius:0 0 14px 14px;border-top:1px solid ${T.border};">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">

        <!-- Logo -->
        <tr>
          <td align="center" style="padding-bottom:14px;">
            <a href="${APP_URL}" style="display:inline-block;text-decoration:none;line-height:0;">
              <img src="https://app.meradarzi.pk/logo.png" width="108" height="auto" alt="MeraDarzi"
                   style="width:108px;max-width:108px;height:auto;opacity:0.75;">
            </a>
            <p style="margin:8px 0 0;color:${T.textFaint};font-family:${T.fontSans};
                      font-size:10px;font-weight:600;letter-spacing:0.09em;
                      text-transform:uppercase;">
              Pakistan&rsquo;s #1 Tailor Management App
            </p>
          </td>
        </tr>

        <!-- Divider -->
        <tr>
          <td style="padding-bottom:16px;">
            <div style="height:1px;background:${T.border};font-size:0;line-height:0;">&nbsp;</div>
          </td>
        </tr>

        <!-- Links row -->
        <tr>
          <td align="center">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0"
                   style="margin:0 auto;">
              <tr>
                <td class="f-link-cell"
                    style="padding:0 14px;border-right:1px solid ${T.border};">
                  <a href="mailto:${SUPPORT_EMAIL}"
                     style="color:${T.blue};font-family:${T.fontSans};font-size:12px;
                            font-weight:500;text-decoration:none;">${SUPPORT_EMAIL}</a>
                </td>
                <td class="f-link-cell"
                    style="padding:0 14px;border-right:1px solid ${T.border};">
                  <a href="https://wa.me/${WA_LINK}"
                     style="color:${T.textBody};font-family:${T.fontSans};font-size:12px;
                            font-weight:500;text-decoration:none;">${WA_DISPLAY}</a>
                </td>
                <td class="f-link-cell" style="padding:0 14px;">
                  <a href="${APP_URL}"
                     style="color:${T.blue};font-family:${T.fontSans};font-size:12px;
                            font-weight:500;text-decoration:none;">meradarzi.pk</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Divider -->
        <tr>
          <td style="padding:16px 0 13px;">
            <div style="height:1px;background:${T.border};font-size:0;line-height:0;">&nbsp;</div>
          </td>
        </tr>

        <!-- Copyright -->
        <tr>
          <td align="center">
            <p style="margin:0;color:${T.textFaint};font-family:${T.fontSans};
                      font-size:11px;line-height:1.85;">
              &copy; ${new Date().getFullYear()} MeraDarzi. All rights reserved.<br>
              This email was sent because you have an account with MeraDarzi.
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>`
}

// ─────────────────────────────────────────────────────────────────
//  MASTER BRANDED TEMPLATE
// ─────────────────────────────────────────────────────────────────
function brandedTemplate(opts: {
  title:        string
  preview?:     string
  body:         string
  ctaLabel?:    string
  ctaUrl?:      string
  accentBadge?: string
}): string {
  return /* html */`
<!doctype html>
<html lang="en"
      xmlns="http://www.w3.org/1999/xhtml"
      xmlns:v="urn:schemas-microsoft-com:vml"
      xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="format-detection" content="telephone=no,date=no,address=no,email=no">
  <title>${esc(opts.title)}</title>
  <!--[if mso]><noscript><xml>
    <o:OfficeDocumentSettings>
      <o:AllowPNG/>
      <o:PixelsPerInch>96</o:PixelsPerInch>
    </o:OfficeDocumentSettings>
  </xml></noscript><![endif]-->
  <style>${T.fontImport}${CSS}</style>
</head>

<body class="email-shell"
      style="margin:0;padding:0;background-color:${T.bgPage};
             font-family:${T.fontSans};word-break:break-word;">

  <!-- Preheader (hidden) -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
    ${esc(opts.preview ?? opts.title)}&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;
  </div>

  <!-- Outer wrapper -->
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
         style="background-color:${T.bgPage};">
    <tr>
      <td align="center" style="padding:36px 0 48px;">

        <!-- ╔══════════════════════ EMAIL CARD ══════════════════════╗ -->
        <table role="presentation" class="email-wrap" cellspacing="0" cellpadding="0" border="0"
               style="width:95%;max-width:640px;border-radius:14px;
                      box-shadow:0 8px 40px rgba(15,23,43,0.13);">

          <!-- ══ HEADER ══════════════════════════════════════════ -->
          <tr>
            <td style="border-radius:14px 14px 0 0;background:${T.headerBg};overflow:hidden;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">

                <!-- Accent stripe -->
                <tr>
                  <td style="height:3px;background:${T.accentBar};font-size:0;line-height:0;">&nbsp;</td>
                </tr>

                <!-- Logo + badge row -->
                <tr>
                  <td class="hdr-pad" style="padding:28px 36px 12px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <!-- Logo -->
                        <td class="logo-cell" style="vertical-align:middle;">
                          <a href="${APP_URL}" style="display:inline-block;text-decoration:none;line-height:0;">
                            <img src="https://app.meradarzi.pk/logo.png"
                                 width="144" height="auto" alt="MeraDarzi"
                                 style="display:block;width:144px;max-width:144px;height:auto;">
                          </a>
                        </td>
                        ${opts.accentBadge ? /* html */`
                        <!-- Badge -->
                        <td class="badge-cell" align="right" style="vertical-align:middle;">
                          <span style="display:inline-block;
                                       background:rgba(59,130,246,0.15);
                                       color:#93c5fd;
                                       font-family:${T.fontSans};font-size:10px;font-weight:700;
                                       padding:5px 14px;border-radius:20px;
                                       letter-spacing:0.1em;text-transform:uppercase;
                                       border:1px solid rgba(96,165,250,0.30);">
                            ${esc(opts.accentBadge)}
                          </span>
                        </td>` : ''}
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Subtle rule -->
                <tr>
                  <td style="padding:0 36px;">
                    <div style="height:1px;background:rgba(255,255,255,0.07);
                                font-size:0;line-height:0;">&nbsp;</div>
                  </td>
                </tr>

                <!-- Title block -->
                <tr>
                  <td class="hdr-title" style="padding:20px 36px 32px;">
                    <h1 class="email-title"
                        style="margin:0 0 10px;color:#f1f5f9;
                               font-family:${T.fontSans};font-size:24px;font-weight:700;
                               line-height:1.3;letter-spacing:-0.4px;">
                      ${esc(opts.title)}
                    </h1>
                    ${opts.preview ? /* html */`
                    <p style="margin:0;color:rgba(241,245,249,0.58);
                               font-family:${T.fontSans};font-size:14px;
                               font-weight:400;line-height:1.75;">
                      ${esc(opts.preview)}
                    </p>` : ''}
                  </td>
                </tr>

              </table>
            </td>
          </tr>

          <!-- ══ BODY ════════════════════════════════════════════ -->
          <tr>
            <td class="body-pad" style="padding:36px;background:${T.bgCard};">
              ${opts.body}
              ${opts.ctaUrl && opts.ctaLabel ? ctaButton(opts.ctaLabel, opts.ctaUrl) : ''}
            </td>
          </tr>

          <!-- ══ FOOTER ══════════════════════════════════════════ -->
          ${footer()}

        </table>
        <!-- ╚═══════════════════════════════════════════════════╝ -->

      </td>
    </tr>
  </table>
</body>
</html>`
}

// ─────────────────────────────────────────────────────────────────
//  PUBLIC HELPERS
// ─────────────────────────────────────────────────────────────────
export function generateOTP(): string {
  return String(randomInt(100000, 999999))
}

export function hashOTP(otp: string): string {
  const pepper = process.env.OTP_PEPPER_SECRET
  if (!pepper) throw new Error('OTP_PEPPER_SECRET is required for OTP hashing')
  return bcrypt.hashSync(otp + pepper, 10)
}

export function verifyOTP(otp: string, storedHash: string): boolean {
  const pepper = process.env.OTP_PEPPER_SECRET
  if (!pepper) throw new Error('OTP_PEPPER_SECRET is required for OTP verification')
  // bcrypt hash
  if (storedHash.startsWith('$2')) {
    return bcrypt.compareSync(otp + pepper, storedHash)
  }
  return false
}

// ─────────────────────────────────────────────────────────────────
//  OTP EMAIL  (standalone template — keeps OTP-specific layout)
// ─────────────────────────────────────────────────────────────────
export async function sendOTPEmail(
  email:   string,
  otp:     string,
  purpose: 'signup' | 'login' = 'signup'
): Promise<{ success: boolean; error?: string }> {
  const isSignup = purpose === 'signup'
  const subject  = isSignup
    ? 'MeraDarzi — Account Verify Karein'
    : 'MeraDarzi — Login OTP'

  const html = /* html */`
<!doctype html>
<html lang="ur"
      xmlns="http://www.w3.org/1999/xhtml"
      xmlns:v="urn:schemas-microsoft-com:vml"
      xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="format-detection" content="telephone=no,date=no,address=no,email=no">
  <title>${subject}</title>
  <!--[if mso]><noscript><xml>
    <o:OfficeDocumentSettings>
      <o:AllowPNG/>
      <o:PixelsPerInch>96</o:PixelsPerInch>
    </o:OfficeDocumentSettings>
  </xml></noscript><![endif]-->
  <style>${T.fontImport}${CSS}</style>
</head>

<body class="email-shell"
      style="margin:0;padding:0;background-color:${T.bgPage};
             font-family:${T.fontSans};word-break:break-word;">

  <!-- Preheader (no OTP value — security: prevent preview leak) -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
    ${isSignup ? 'Aapka verification code aa gaya hai' : 'Aapka login code aa gaya hai'}
    — 10 minute mein expire hoga.&#847;&#847;&#847;&#847;&#847;
  </div>

  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
         style="background:${T.bgPage};">
    <tr>
      <td align="center" style="padding:36px 0 48px;">

        <table role="presentation" class="email-wrap" cellspacing="0" cellpadding="0" border="0"
               style="width:95%;max-width:600px;border-radius:14px;
                      box-shadow:0 8px 40px rgba(15,23,43,0.13);">

          <!-- ══ HEADER ══ -->
          <tr>
            <td style="border-radius:14px 14px 0 0;background:${T.headerBg};overflow:hidden;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">

                <!-- Accent stripe -->
                <tr>
                  <td style="height:3px;background:${T.accentBar};font-size:0;line-height:0;">&nbsp;</td>
                </tr>

                <!-- Logo -->
                <tr>
                  <td class="hdr-pad" style="padding:26px 34px 14px;">
                    <a href="${APP_URL}" style="display:inline-block;text-decoration:none;line-height:0;">
                      <img src="https://app.meradarzi.pk/logo.png"
                           width="136" height="auto" alt="MeraDarzi"
                           style="display:block;width:136px;max-width:136px;height:auto;">
                    </a>
                  </td>
                </tr>

                <!-- Rule -->
                <tr>
                  <td style="padding:0 34px;">
                    <div style="height:1px;background:rgba(255,255,255,0.07);
                                font-size:0;line-height:0;">&nbsp;</div>
                  </td>
                </tr>

                <!-- Title -->
                <tr>
                  <td class="hdr-title" style="padding:18px 34px 30px;">
                    <h1 class="email-title"
                        style="margin:0 0 9px;color:#f1f5f9;
                               font-family:${T.fontSans};font-size:22px;font-weight:700;
                               line-height:1.3;letter-spacing:-0.3px;">
                      ${isSignup ? 'Aapka Account Verify Karein' : 'Login Verification Code'}
                    </h1>
                    <p style="margin:0;color:rgba(241,245,249,0.58);
                               font-family:${T.fontSans};font-size:13px;
                               font-weight:400;line-height:1.75;">
                      ${isSignup
                        ? 'MeraDarzi account activate karne ke liye yeh one-time code use karein.'
                        : 'Apne MeraDarzi account mein securely login karne ke liye yeh code use karein.'}
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

          <!-- ══ BODY ══ -->
          <tr>
            <td class="body-pad" style="padding:34px;background:${T.bgCard};">

              <!-- ── OTP card ── -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
                     style="margin:0 0 22px;">
                <tr>
                  <td align="center"
                      style="background:${T.bluePale};border:1.5px solid ${T.blueBorder};
                             border-radius:12px;padding:30px 20px;">

                    <!-- Label -->
                    <p style="margin:0 0 8px;color:${T.textMuted};
                               font-family:${T.fontSans};font-size:11px;font-weight:600;
                               text-transform:uppercase;letter-spacing:0.12em;">
                      Your One-Time Code
                    </p>

                    <!-- Digits -->
                    <div class="otp-code"
                         style="font-family:${T.fontMono};font-size:50px;font-weight:900;
                                letter-spacing:14px;color:${T.headerBg};line-height:1.1;
                                margin:4px 0 18px;padding-left:14px;">
                      ${otp}
                    </div>

                    <!-- Expiry pill -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0"
                           style="margin:0 auto;">
                      <tr>
                        <td style="background:#dbeafe;border-radius:20px;padding:6px 16px;">
                          <p style="margin:0;color:${T.blueDeep};font-family:${T.fontSans};
                                    font-size:12px;font-weight:600;">
                            &#9201;&nbsp; Expires in 10 minutes
                          </p>
                        </td>
                      </tr>
                    </table>

                  </td>
                </tr>
              </table>

              <!-- ── How to use ── -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
                     style="margin:0 0 20px;">
                <tr>
                  <td style="background:${T.bgSection};border-radius:10px;padding:18px 20px;">
                    <p style="margin:0 0 13px;color:${T.textHeading};
                               font-family:${T.fontSans};font-size:13px;font-weight:600;">
                      How to use this code:
                    </p>
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      ${['Open the MeraDarzi app or website.',
                         'Enter the 6-digit code above when prompted.',
                         'Code is valid for one-time use only.'].map((step, i) => /* html */`
                      <tr>
                        <td width="30" style="vertical-align:top;padding:4px 12px 4px 0;">
                          <div style="background:${T.headerBg};color:#93c5fd;
                                      font-family:${T.fontSans};font-size:11px;font-weight:700;
                                      width:22px;height:22px;min-width:22px;
                                      border-radius:50%;text-align:center;line-height:22px;">
                            ${i + 1}
                          </div>
                        </td>
                        <td style="vertical-align:top;padding:4px 0;
                                   color:${T.textBody};font-family:${T.fontSans};
                                   font-size:13px;font-weight:400;line-height:1.65;">
                          ${step}
                        </td>
                      </tr>`).join('')}
                    </table>
                  </td>
                </tr>
              </table>

              <!-- ── Security notice ── -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="background:${T.amberBg};border:1px solid ${T.amberBorder};
                             border-left:4px solid ${T.amberLeft};
                             border-radius:0 10px 10px 0;padding:14px 16px;">
                    <p style="margin:0;color:${T.amberText};font-family:${T.fontSans};
                               font-size:12px;font-weight:500;line-height:1.7;">
                      <strong>&#9888; Security Notice:</strong> Yeh code sirf aapke liye hai.
                      Kisi ke saath share mat karein — MeraDarzi ka koi bhi staff member kabhi
                      yeh code nahi maangega. Agar aapne yeh request nahi ki, toh is email ko
                      ignore karein.
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- ══ FOOTER ══ -->
          ${footer()}

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  try {
    const { error } = await getResend().emails.send({ from: FROM, to: email, subject, html })
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

// ─────────────────────────────────────────────────────────────────
//  ADMIN — new shop verification alert
// ─────────────────────────────────────────────────────────────────
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
  const waText   = encodeURIComponent(
    `New shop verification request:\n\nShop: ${opts.shopName}\nOwner: ${opts.ownerName}\nPhone: ${opts.ownerPhone}\nCity: ${opts.city ?? 'N/A'}\n\nReview: ${adminUrl}`
  )
  const waLink   = `https://wa.me/${WA_LINK}?text=${waText}`

  try {
    await sendSystemEmail({
      from:    FROM,
      to:      adminEmail,
      subject: `New Shop Verification: ${opts.shopName}`,
      html: brandedTemplate({
        title:       'New Shop Verification',
        preview:     `${opts.shopName} needs admin review before going live.`,
        accentBadge: 'Action Required',
        ctaLabel:    'Review in Admin Panel',
        ctaUrl:      adminUrl,
        body: /* html */`
          <p style="margin:0 0 20px;color:${T.textBody};font-family:${T.fontSans};
                    font-size:14px;font-weight:400;line-height:1.75;">
            A new shop has registered on MeraDarzi and is awaiting your verification.
            Please review the details below and approve or reject the account from the admin panel.
          </p>
          ${detailTable([
            ['Shop Name', opts.shopName],
            ['Owner',     opts.ownerName],
            ['Phone',     opts.ownerPhone],
            ['Email',     opts.ownerEmail],
            ['City',      opts.city ?? 'N/A'],
            ['Shop ID',   opts.shopId],
          ])}
          <p style="margin:18px 0 0;color:${T.textMuted};font-family:${T.fontSans};
                    font-size:12px;line-height:1.7;">
            Quick review via WhatsApp:&nbsp;
            <a href="${waLink}"
               style="color:${T.blue};font-weight:600;text-decoration:none;">
              Open WhatsApp &#8594;
            </a>
          </p>
        `,
      }),
    })
  } catch (e) {
    console.error('[Email] Admin shop verification alert failed:', e)
  }
}

// ─────────────────────────────────────────────────────────────────
//  SHOP OWNER — account created confirmation
// ─────────────────────────────────────────────────────────────────
export async function sendShopOwnerAccountCreated(opts: {
  shopName:    string
  ownerName:   string
  ownerEmail?: string
  ownerPhone:  string
  city?:       string
}): Promise<void> {
  if (!opts.ownerEmail || opts.ownerEmail === 'N/A') return

  await sendSystemEmail({
    from:    FROM,
    to:      opts.ownerEmail,
    subject: `Welcome to MeraDarzi, ${opts.shopName}!`,
    html: brandedTemplate({
      title:       'Account Created Successfully',
      preview:     'Your shop account has been created and is pending admin review.',
      accentBadge: 'Pending Review',
      ctaLabel:    'Open MeraDarzi',
      ctaUrl:      APP_URL,
      body: /* html */`
        <p style="margin:0 0 20px;color:${T.textBody};font-family:${T.fontSans};
                  font-size:14px;font-weight:400;line-height:1.75;">
          Assalam o Alaikum
          <strong style="color:${T.textHeading};font-weight:700;">${esc(opts.ownerName)}</strong>,
          your MeraDarzi shop account has been successfully created. Our admin team will review
          your account shortly and you&rsquo;ll be notified once it&rsquo;s approved.
        </p>
        ${detailTable([
          ['Shop Name', opts.shopName],
          ['Phone',     opts.ownerPhone],
          ['City',      opts.city ?? 'N/A'],
        ])}
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
               style="margin-top:20px;">
          <tr>
            <td style="background:${T.greenBg};border:1px solid ${T.greenBorder};
                       border-left:4px solid ${T.greenLeft};
                       border-radius:0 10px 10px 0;padding:14px 16px;">
              <p style="margin:0;color:${T.greenText};font-family:${T.fontSans};
                         font-size:12px;font-weight:500;line-height:1.7;">
                <strong>&#10003; What happens next?</strong>&nbsp;
                Admin approval usually takes 24&ndash;48 hours. You&rsquo;ll receive a
                confirmation email once your account is live.
              </p>
            </td>
          </tr>
        </table>
      `,
    }),
  })
}

// ─────────────────────────────────────────────────────────────────
//  ADMIN — new shop registration summary
// ─────────────────────────────────────────────────────────────────
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
    html: brandedTemplate({
      title:       'New Shop Registration',
      preview:     `${opts.shopName} signed up for the ${opts.selectedPlan} plan.`,
      accentBadge: 'New Registration',
      ctaLabel:    'Open Admin Dashboard',
      ctaUrl:      `${APP_URL}/admin/dashboard/shops`,
      body: /* html */`
        <p style="margin:0 0 20px;color:${T.textBody};font-family:${T.fontSans};
                  font-size:14px;font-weight:400;line-height:1.75;">
          A new shop has completed registration on MeraDarzi.
          Here&rsquo;s a summary of the account details:
        </p>
        ${detailTable([
          ['Shop Name',         opts.shopName],
          ['Owner Name',        opts.ownerName],
          ['Email',             opts.ownerEmail],
          ['Phone Number',      opts.ownerPhone],
          ['Selected Plan',     opts.selectedPlan],
          ['Registration Date', new Date(opts.registrationDate).toLocaleString('en-PK')],
          ['City',              opts.city ?? 'N/A'],
          ['Shop ID',           opts.shopId],
        ])}
      `,
    }),
  })
}

// ─────────────────────────────────────────────────────────────────
//  SHOP OWNER — admin action notification
// ─────────────────────────────────────────────────────────────────
export async function sendShopOwnerAdminActionEmail(opts: {
  shopId:   string
  action:   string
  title:    string
  message:  string
  details?: [string, unknown][]
}): Promise<void> {
  const ownerRows = await sbGet(
    `team_members?shop_id=eq.${opts.shopId}&role=eq.owner&is_active=eq.true&select=email,name&limit=1`
  ).catch(() => [])
  const owner = ownerRows?.[0]
  if (!owner?.email) return

  await sendSystemEmail({
    from:    FROM,
    to:      owner.email,
    subject: opts.title,
    html: brandedTemplate({
      title:    opts.title,
      preview:  opts.message,
      ctaLabel: 'Open Dashboard',
      ctaUrl:   APP_URL,
      body: /* html */`
        <p style="margin:0 0 20px;color:${T.textBody};font-family:${T.fontSans};
                  font-size:14px;font-weight:400;line-height:1.75;">
          ${esc(owner.name ?? 'Shop owner')}, ${esc(opts.message)}
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

// ─────────────────────────────────────────────────────────────────
//  ADMIN — subscription event
// ─────────────────────────────────────────────────────────────────
export async function sendAdminSubscriptionEventEmail(opts: {
  shopId:          string
  event:           'upgraded' | 'downgraded' | 'renewed' | 'expired' | 'cancelled' | 'payment_submitted'
  plan?:           string
  previousPlan?:   string
  cycle?:          string
  amountPkr?:      number
  reason?:         string
  paymentRef?:     string
  transactionId?:  string
  payerName?:      string
  expiresAt?:      string | null
}): Promise<void> {
  type ShopRow = { shop_name?: string; owner_phone?: string; city?: string; plan?: string }

  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL ?? process.env.ADMIN_EMAIL
  if (!adminEmail) return

  let shop: ShopRow | null = null
  try {
    const rows = await sbGet(
      `shops?id=eq.${opts.shopId}&select=shop_name,owner_phone,city,plan&limit=1`
    )
    shop = (rows as ShopRow[])?.[0] ?? null
  } catch (e) {
    console.error('[Email] Shop lookup failed:', e)
  }

  const LABEL: Record<typeof opts.event, string> = {
    upgraded:          'Subscription Upgraded',
    downgraded:        'Subscription Downgraded',
    renewed:           'Subscription Renewed',
    expired:           'Subscription Expired',
    cancelled:         'Subscription Cancelled',
    payment_submitted: 'Payment Submitted',
  }
  const BADGE: Record<typeof opts.event, string> = {
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
    subject: `${LABEL[opts.event]}: ${shop?.shop_name ?? opts.shopId}`,
    html: brandedTemplate({
      title:       LABEL[opts.event],
      preview:     `${shop?.shop_name ?? 'A shop'} triggered a subscription event.`,
      accentBadge: BADGE[opts.event],
      ctaLabel:    'Open Admin Dashboard',
      ctaUrl:      `${APP_URL}/admin/dashboard/shops`,
      body: /* html */`
        <p style="margin:0 0 20px;color:${T.textBody};font-family:${T.fontSans};
                  font-size:14px;font-weight:400;line-height:1.75;">
          A subscription event has been triggered for the shop below.
          Review the details in your admin panel.
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
