// src/lib/billing/plans.ts

export type PlanId = 'starter' | 'professional' | 'business'
export type BillingCycle = 'monthly' | 'yearly' | 'lifetime'
export type SubStatus = 'trialing' | 'active' | 'cancelled' | 'expired' | 'grace'

export interface PlanLimits {
  maxOrdersPerMonth:   number | null    // null = unlimited
  maxCustomers:        number | null
  maxKarigar:          number           // 0 = none allowed
  maxStorageKB:        number | null
  hasTrackingUrl:      boolean
  hasQrCode:           boolean
  hasPhotos:           boolean
  hasCloudSync:        boolean
  hasAnalytics:        boolean
  hasMultiDevice:      boolean
  hasPrioritySupport:  boolean
  hasCustomBranding:   boolean
  hasKarigarPayReports: boolean
}

export interface PlanDefinition {
  id:          PlanId
  name:        string
  tagline:     string
  monthlyPkr:  number | null      // null = free
  yearlyPkr:   number | null
  lifetimePkr: number | null
  color:       string
  emoji:       string
  limits:      PlanLimits
  highlights:  string[]           // bullet points for pricing page
}

// ── The single source of truth for plan features ─────────────────

export const PLANS: Record<PlanId, PlanDefinition> = {
  starter: {
    id:          'starter',
    name:        'Starter',
    tagline:     'Solo tailor ke liye — bilkul free',
    monthlyPkr:  null,
    yearlyPkr:   null,
    lifetimePkr: null,
    color:       'slate',
    emoji:       '🌱',
    limits: {
      maxOrdersPerMonth:   30,
      maxCustomers:        50,
      maxKarigar:          0,
      maxStorageKB:        0,
      hasTrackingUrl:      false,
      hasQrCode:           false,
      hasPhotos:           false,
      hasCloudSync:        false,
      hasAnalytics:        false,
      hasMultiDevice:      false,
      hasPrioritySupport:  false,
      hasCustomBranding:   false,
      hasKarigarPayReports: false,
    },
    highlights: [
      '30 orders per month',
      '50 customers',
      'Measurements + payments',
      'Offline mode',
      'WhatsApp manual links',
    ],
  },

  professional: {
    id:          'professional',
    name:        'Professional',
    tagline:     'Growing shop ke liye — sab kuch',
    monthlyPkr:  999,
    yearlyPkr:   9500,
    lifetimePkr: null,
    color:       'blue',
    emoji:       '⭐',
    limits: {
      maxOrdersPerMonth:   null,
      maxCustomers:        null,
      maxKarigar:          3,
      maxStorageKB:        1_048_576,    // 1GB
      hasTrackingUrl:      true,
      hasQrCode:           true,
      hasPhotos:           true,
      hasCloudSync:        false,
      hasAnalytics:        true,
      hasMultiDevice:      false,
      hasPrioritySupport:  false,
      hasCustomBranding:   false,
      hasKarigarPayReports: false,
    },
    highlights: [
      'Unlimited orders + customers',
      'Up to 3 karigar accounts',
      'Order tracking URL + QR code',
      'Photo attachments stored on this device',
      'Reports & analytics',
      'WhatsApp auto-notifications',
    ],
  },

  business: {
    id:          'business',
    name:        'Business',
    tagline:     'Badi dukaan ya multiple branches',
    monthlyPkr:  2499,
    yearlyPkr:   23999,
    lifetimePkr: null,
    color:       'purple',
    emoji:       '👑',
    limits: {
      maxOrdersPerMonth:   null,
      maxCustomers:        null,
      maxKarigar:          999,          // effectively unlimited
      maxStorageKB:        10_485_760,   // 10GB
      hasTrackingUrl:      true,
      hasQrCode:           true,
      hasPhotos:           true,
      hasCloudSync:        true,
      hasAnalytics:        true,
      hasMultiDevice:      true,
      hasPrioritySupport:  true,
      hasCustomBranding:   true,
      hasKarigarPayReports: true,
    },
    highlights: [
      'Everything in Professional',
      'Unlimited karigar accounts',
      '10GB photo storage',
      'Karigar salary reports',
      'Priority WhatsApp support',
      'Custom shop branding',
      'Early access to features',
    ],
  },
}

// ── Feature descriptions (for upgrade prompts) ───────────────────

export const FEATURE_DESCRIPTIONS: Record<string, {
  title:       string
  description: string
  requiredPlan: PlanId
}> = {
  karigar: {
    title:        'Karigar Accounts',
    description:  'Karigar ko assign karein aur unka kaam track karein',
    requiredPlan: 'professional',
  },
  tracking: {
    title:        'Order Tracking URL',
    description:  'Gahak apna order khud track kar sake',
    requiredPlan: 'professional',
  },
  qr_code: {
    title:        'QR Code',
    description:  'Order ka QR code print ya share karein',
    requiredPlan: 'professional',
  },
  photos: {
    title:        'Photo Attachments',
    description:  'Kapre aur design ki photos attach karein',
    requiredPlan: 'professional',
  },
  analytics: {
    title:        'Reports & Analytics',
    description:  'Income, top customers, karigar performance dekhein',
    requiredPlan: 'professional',
  },
  cloud_sync: {
    title:        'Cloud Sync',
    description:  'Multiple devices par data sync karein',
    requiredPlan: 'business',
  },
  karigar_pay: {
    title:        'Karigar Pay Reports',
    description:  'Karigar ki salary automatically calculate karein',
    requiredPlan: 'business',
  },
}

// ── Helpers ──────────────────────────────────────────────────────

export function getPlan(planId: PlanId): PlanDefinition {
  return PLANS[planId]
}

export function formatPrice(pkr: number | null, cycle: BillingCycle): string {
  if (pkr === null) return 'Free'
  if (cycle === 'yearly') return `Rs. ${pkr.toLocaleString()}/year`
  if (cycle === 'lifetime') return `Rs. ${pkr.toLocaleString()} one-time`
  return `Rs. ${pkr.toLocaleString()}/month`
}

export function yearlySaving(plan: PlanDefinition): number | null {
  if (!plan.monthlyPkr || !plan.yearlyPkr) return null
  const monthlyTotal = plan.monthlyPkr * 12
  return monthlyTotal - plan.yearlyPkr
}
