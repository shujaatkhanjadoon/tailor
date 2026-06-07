import z from 'zod'
import { parseBody } from '@/lib/security/body'

const phone = z.string().regex(/^\d{10,13}$/, 'Invalid phone number')
const uuid = z.string().uuid('Invalid UUID')
const pinStr = z.string().min(1, 'PIN required')

export const schemas = {
  createShop: z.object({
    shopName: z.string().min(2).max(100).trim(),
    phone,
    pin: pinStr,
    ownerName: z.string().min(2).max(100).trim(),
    email: z.string().email('Invalid email').transform(v => v.toLowerCase().trim()),
    city: z.string().max(100).trim().optional().default(''),
    stateProvince: z.string().max(100).trim().optional().default(''),
  }),

  login: z.object({
    secret: z.string().min(1, 'Secret or password required'),
    totpCode: z.preprocess(
      v => (v === '' || v === undefined || v === null) ? undefined : v,
      z.string().regex(/^\d{6}$/).optional()
    ),
    rememberMe: z.boolean().optional().default(false),
    username: z.string().optional(),
  }),

  sendOtp: z.object({
    phone,
    email: z.string().email('Invalid email').transform(v => v.toLowerCase().trim()),
    purpose: z.enum(['signup', 'login']).optional().default('signup'),
  }),

  verifyOtp: z.object({
    phone,
    otp: z.string().regex(/^\d{6}$/, 'OTP must be 6 digits'),
  }),

  updatePin: z.object({
    memberId: uuid,
    shopId: uuid,
    pinHash: z.string().min(1, 'pinHash required'),
  }),

  deletePhoto: z.object({
    publicId: z.string().min(1, 'publicId required'),
    shopId: uuid,
    memberId: uuid,
  }),

  deleteShop: z.object({
    shopId: uuid,
    memberId: uuid,
    confirm: z.literal('DELETE'),
  }),

  encryptPin: z.object({
    pin: pinStr,
    memberId: uuid,
    shopId: uuid,
  }),

  adminAction: z.object({
    action: z.enum(['delete_shop', 'deactivate_shop', 'activate_shop', 'set_plan', 'reject_payment', 'send_notification', 'activate_payment', 'verify_shop', 'refund_payment', 'extend_expiry', 'set_custom_expiry', 'update_subscription_amount', 'bulk_set_plan', 'bulk_extend_expiry', 'bulk_send_notification', 'block_ip', 'unblock_ip', 'reset_admin_totp', 'force_logout_sessions', 'create_admin', 'deactivate_admin', 'activate_admin', 'reset_owner_pin']),
    targetId: z.string().optional(),
    shopId: z.string().optional(),
    planId: z.string().optional(),
    cycle: z.string().optional(),
    reason: z.string().optional(),
    note: z.string().optional(),
    status: z.string().optional(),
    paymentId: z.string().optional(),
    amountPkr: z.number().optional(),
    plan: z.string().optional(),
    totpCode: z.string().regex(/^\d{6}$/).optional(),
    shopIds: z.array(z.string()).optional(),
    ip: z.string().optional(),
    username: z.string().optional(),
    role: z.enum(['super_admin', 'finance', 'support']).optional(),
    password: z.string().optional(),
    days: z.number().optional(),
  }),

  adminNotificationPost: z.object({
    title: z.string().min(1).max(200).trim(),
    message: z.string().min(1).max(2000).trim(),
    type: z.enum(['info', 'success', 'warning', 'urgent']).optional().default('info'),
    targetPlan: z.enum(['all', 'starter', 'professional', 'business']),
    expiresAt: z.string().min(1, 'expiresAt required'),
  }),

  shopVerifyRequest: z.object({
    shopId: z.string().uuid('Invalid shopId'),
    shopName: z.string().min(2).max(200).trim(),
    ownerName: z.string().min(2).max(200).trim(),
    ownerPhone: z.string().regex(/^\d{10,13}$/, 'Invalid phone number'),
    ownerEmail: z.string().email('Invalid email').optional().or(z.literal('')),
    city: z.string().max(100).trim().optional().default(''),
  }),

  adminNotificationPatch: z.object({
    id: z.string().min(1, 'id required'),
    title: z.string().min(1).max(200).trim(),
    message: z.string().min(1).max(2000).trim(),
    type: z.enum(['info', 'success', 'warning', 'urgent']).optional().default('info'),
    targetPlan: z.enum(['all', 'starter', 'professional', 'business']),
    expiresAt: z.string().min(1, 'expiresAt required'),
  }),

  sessionCreate: z.object({
    memberId: uuid,
    shopId: uuid,
    pinHash: z.string().min(1, 'pinHash required'),
  }),

  subscriptionEvent: z.object({
    shopId: uuid,
    event: z.enum(['upgraded', 'downgraded', 'renewed', 'expired', 'cancelled', 'payment_submitted']),
    plan: z.string().optional(),
    previousPlan: z.string().optional(),
    cycle: z.string().optional(),
    amountPkr: z.number().positive().optional(),
    reason: z.string().optional(),
    paymentRef: z.string().optional(),
    transactionId: z.string().optional(),
    payerName: z.string().optional(),
    expiresAt: z.string().optional(),
    couponCode: z.string().optional(),
    discountPct: z.number().optional(),
  }),

  pushSubscribe: z.object({
    shopId: uuid,
    memberId: uuid,
    subscription: z.object({
      endpoint: z.string().url('endpoint must be a valid URL'),
      keys: z.object({
        p256dh: z.string().min(1, 'p256dh required'),
        auth: z.string().min(1, 'auth required'),
      }),
    }),
  }),

  pushUnsubscribe: z.object({
    endpoint: z.string().url('endpoint must be a valid URL'),
    memberId: uuid,
    shopId: uuid,
  }),
} as const

export async function validate<T extends z.ZodType>(
  schema: T,
  req: Request,
  maxBytes = 1024 * 100,
): Promise<{ ok: true; data: z.infer<T> } | { ok: false; error: string; status: number }> {
  const parsed = await parseBody<Record<string, unknown>>(req, maxBytes)
  if (!parsed.ok) return parsed

  const result = schema.safeParse(parsed.data)
  if (!result.success) {
    const flat = result.error.flatten().fieldErrors as Record<string, string[] | undefined>
    const key = Object.keys(flat)[0]
    return { ok: false, error: flat[key]?.[0] ?? 'Validation failed', status: 400 }
  }

  return { ok: true, data: result.data }
}
