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
    secret: z.string().min(1, 'Secret required'),
    totpCode: z.preprocess(
      v => (v === '' || v === undefined || v === null) ? undefined : v,
      z.string().regex(/^\d{6}$/).optional()
    ),
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
    action: z.enum(['delete_shop', 'deactivate_shop', 'activate_shop', 'set_plan', 'reject_payment', 'send_notification', 'activate_payment', 'verify_shop']),
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
  }),

  adminNotificationPost: z.object({
    title: z.string().min(1).max(200).trim(),
    message: z.string().min(1).max(2000).trim(),
    type: z.enum(['info', 'success', 'warning', 'urgent']).optional().default('info'),
    targetPlan: z.enum(['all', 'starter', 'professional', 'business']),
    expiresAt: z.string().min(1, 'expiresAt required'),
  }),

  adminNotificationPatch: z.object({
    id: z.string().min(1, 'id required'),
    title: z.string().min(1).max(200).trim(),
    message: z.string().min(1).max(2000).trim(),
    type: z.enum(['info', 'success', 'warning', 'urgent']).optional().default('info'),
    targetPlan: z.enum(['all', 'starter', 'professional', 'business']),
    expiresAt: z.string().min(1, 'expiresAt required'),
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
