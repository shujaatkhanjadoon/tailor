import { Resend } from 'resend'
import { randomInt } from 'crypto'
import bcrypt from 'bcryptjs'
import { Redis } from '@upstash/redis'
import { sbGet } from '@/lib/supabase/service'
import { T, esc, APP_URL, WA_LINK } from '@/lib/email-templates/tokens'
import { detailTable } from '@/lib/email-templates/helpers'
import { brandedTemplate } from '@/lib/email-templates/branded-shell'
import { buildOtpEmailHtml } from '@/lib/email-templates/otp-email'

let _resend: Resend | null = null
function getResend(): Resend | null {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY
    if (!key) {
      console.warn('[Email] RESEND_API_KEY not set — email sending is disabled')
      return null
    }
    _resend = new Resend(key)
  }
  return _resend
}

let _redis: Redis | null = null
function getRedis(): Redis | null {
  if (!_redis) {
    const url = process.env.UPSTASH_REDIS_REST_URL
    const token = process.env.UPSTASH_REDIS_REST_TOKEN
    if (url && token) {
      _redis = new Redis({ url, token })
    }
  }
  return _redis
}

const FROM_ADDR     = process.env.RESEND_FROM_EMAIL ?? 'no-reply@meradarzi.pk'
const FROM          = `MeraDarzi <${FROM_ADDR}>`

// In-memory fallback for email rate limiting (used when Redis is unavailable)
const emailLastSentAt = new Map<string, number>()
const SYSTEM_EMAIL_INTERVAL = 60_000

async function sendSystemEmail(
  args: Parameters<Resend['emails']['send']>[0],
  key?: string
) {
  const recipients = Array.isArray(args.to) ? args.to.join(',') : String(args.to)
  const rateKey    = key ?? recipients.toLowerCase()
  const now        = Date.now()

  // Try Upstash Redis first
  const redis = getRedis()
  if (redis) {
    try {
      const lastStr = await redis.get<string>(`email:rl:${rateKey}`)
      const last = lastStr ? parseInt(lastStr, 10) : 0
      if (now - last < SYSTEM_EMAIL_INTERVAL) {
        console.warn(`[Email] Rate-limited (Redis): ${rateKey}`)
        return { data: null, error: null }
      }
      await redis.set(`email:rl:${rateKey}`, String(now), { ex: 120 })
    } catch {
      // Fall through to in-memory fallback
      const lastMem = emailLastSentAt.get(rateKey) ?? 0
      if (now - lastMem < SYSTEM_EMAIL_INTERVAL) {
        console.warn(`[Email] Rate-limited (mem-fallback): ${rateKey}`)
        return { data: null, error: null }
      }
      emailLastSentAt.set(rateKey, now)
    }
  } else {
    // In-memory fallback when Redis not configured
    const last = emailLastSentAt.get(rateKey) ?? 0
    if (now - last < SYSTEM_EMAIL_INTERVAL) {
      console.warn(`[Email] Rate-limited (mem): ${rateKey}`)
      return { data: null, error: null }
    }
    emailLastSentAt.set(rateKey, now)
  }

  const resend = getResend()
  if (!resend) return { data: null, error: null }

  return resend.emails.send(args)
}

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
  if (storedHash.startsWith('$2')) {
    return bcrypt.compareSync(otp + pepper, storedHash)
  }
  return false
}

export async function sendOTPEmail(
  email:   string,
  otp:     string,
  purpose: 'signup' | 'login' = 'signup'
): Promise<{ success: boolean; error?: string }> {
  const isSignup = purpose === 'signup'
  const subject  = isSignup
    ? 'MeraDarzi — Account Verify Karein'
    : 'MeraDarzi — Login OTP'

  const html = buildOtpEmailHtml(otp, purpose)

  const resend = getResend()
  if (!resend) {
    console.warn('[Email OTP] Resend not configured — skipping OTP email')
    return { success: false, error: 'Email service not configured' }
  }

  try {
    const { error } = await resend.emails.send({ from: FROM, to: email, subject, html })
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
  couponCode?:     string
  discountPct?:    number
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
          ...(opts.couponCode ? [
            ['Coupon Code',    opts.couponCode] as [string, unknown],
            ['Coupon Discount', `${opts.discountPct}%`] as [string, unknown],
          ] : []),
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
