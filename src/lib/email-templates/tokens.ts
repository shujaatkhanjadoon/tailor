export const APP_URL       = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.meradarzi.pk'
export const SUPPORT_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL ?? 'darzihub9@gmail.com'
export const WA_DISPLAY    = '031356344667'
export const WA_LINK       = '923135634667'

export const T = {
  headerBg:     '#0F172B',
  accentBar:    'linear-gradient(90deg,#3b82f6 0%,#60a5fa 55%,#93c5fd 100%)',
  blue:         '#3b82f6',
  blueDark:     '#2563eb',
  bluePale:     '#eff6ff',
  blueBorder:   '#bfdbfe',
  blueDeep:     '#1e40af',
  white:        '#ffffff',
  bgPage:       '#f0f4f8',
  bgCard:       '#ffffff',
  bgSection:    '#f8fafc',
  border:       '#e2e8f0',
  textHeading:  '#0f172a',
  textBody:     '#475569',
  textMuted:    '#64748b',
  textFaint:    '#94a3b8',
  amberBg:      '#fffbeb',
  amberBorder:  '#fde68a',
  amberLeft:    '#f59e0b',
  amberText:    '#78350f',
  greenBg:      '#f0fdf4',
  greenBorder:  '#bbf7d0',
  greenLeft:    '#16a34a',
  greenText:    '#14532d',
  fontSans:     `'Inter','Segoe UI',Helvetica,Arial,sans-serif`,
  fontMono:     `'Courier New',Courier,monospace`,
  fontImport:   `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');`,
} as const

export const CSS = `
  body,table,td,a { -webkit-text-size-adjust:100%;-ms-text-size-adjust:100%; }
  table,td        { mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse; }
  img             { -ms-interpolation-mode:bicubic;border:0;outline:none;text-decoration:none;display:block; }
  body            { margin:0!important;padding:0!important;width:100%!important;background-color:${T.bgPage}; }
  a[x-apple-data-detectors] { color:inherit!important;text-decoration:none!important; }
  .email-shell  { background-color:${T.bgPage}; }
  .email-wrap   { width:95%;max-width:640px;margin:0 auto; }
  @media only screen and (max-width:600px) {
    .email-wrap   { width:100%!important;max-width:100%!important; }
    .hdr-pad      { padding:22px 18px 10px!important; }
    .hdr-title    { padding:16px 18px 28px!important; }
    .body-pad     { padding:26px 18px!important; }
    .footer-pad   { padding:22px 18px 28px!important; }
    .logo-cell    { display:block!important;width:100%!important;padding-bottom:10px!important; }
    .badge-cell   { display:block!important;width:100%!important;text-align:left!important; }
    .cta-td       { width:100%!important;display:block!important; }
    .cta-btn      { display:block!important;width:100%!important;box-sizing:border-box!important;text-align:center!important;padding:15px 18px!important; }
    .otp-code     { font-size:40px!important;letter-spacing:10px!important; }
    .dl-label     { width:36%!important;font-size:11px!important; }
    .dl-value     { font-size:12px!important; }
    .email-title  { font-size:20px!important;line-height:1.35!important; }
    .f-link-cell  { display:block!important;width:100%!important;text-align:center!important;border-right:none!important;padding:7px 0!important; }
  }
  @media only screen and (min-width:601px) and (max-width:768px) {
    .email-wrap   { width:96%!important; }
    .email-title  { font-size:22px!important; }
    .otp-code     { font-size:44px!important; }
  }
`

export function esc(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}
