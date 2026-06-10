// src/lib/billing/admin.ts
'use server'

import { logAdminAction } from '@/lib/admin/audit'
import { buildActivationWhatsApp, buildRejectionWhatsApp } from './whatsapp-notify'
import { sbGet, sbFetch, sbPatch, sbUpsertByShopId, type Row } from '@/lib/supabase/service'
import { logger } from '@/lib/logger'
import { PLANS } from './plans'
import { subscriptionExpiresAt } from './cycles'

// ── Types ─────────────────────────────────────────────────────────

export interface ActivateResult {
  success:    boolean
  error?:     string
  shopName?:  string
  shopPhone?: string
  waLink?:    string
}

export interface RejectResult {
  success:    boolean
  error?:     string
  shopPhone?: string
  waLink?:    string
}

// ── Get revenue summary ───────────────────────────────────────────

export async function getRevenueSummary() {
  const [payments, subs] = await Promise.all([
    sbGet('subscription_payments?status=eq.completed&select=amount_pkr,paid_at'),
    sbGet('subscriptions?select=status,plan'),
  ])

  const now       = new Date()
  const thisMonth = now.toISOString().slice(0, 7)

  const total = payments.reduce((s: number, p: Row) => s + Number(p.amount_pkr), 0)

  const thisMonthRevenue = payments
    .filter((p: Row) => p.paid_at?.startsWith(thisMonth))
    .reduce((s: number, p: Row) => s + Number(p.amount_pkr), 0)

  const activeSubscriptions = subs.filter((s: Row) => s.status === 'active').length
  const trialing            = subs.filter((s: Row) => s.status === 'trialing').length

  return { total, thisMonthRevenue, activeSubscriptions, trialing }
}

// ── Pagination helper ─────────────────────────────────────────────

export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  perPage: number
  totalPages: number
}

// ── Get all shops with subscriptions and usage ────────────────────

export async function getAllShops(page = 1, perPage = 50) {
  const offset = (page - 1) * perPage
  const [shops, subscriptions, usages] = await Promise.all([
    sbGet(`shops?select=id,shop_name,owner_phone,city,plan,is_active,created_at,updated_at&order=created_at.desc&limit=${perPage}&offset=${offset}`),
    // Only fetch subscriptions and usage for the shops in the current page
    sbGet(`subscriptions?select=shop_id,plan,status,billing_cycle,trial_ends_at,expires_at,grace_ends_at,amount_pkr,created_at,updated_at&limit=2000`),
    sbGet(`shop_usage?select=shop_id,orders_this_month,customers_total,karigar_count,storage_used_kb,month_year&limit=2000`),
  ])

  const shopIds = new Set(shops.map((s: Row) => s.id))

  // Join manually — only attach matching rows
  return shops.map((shop: Row) => ({
    ...shop,
    subscriptions: subscriptions.filter((s: Row) => s.shop_id === shop.id),
    shop_usage:    usages.filter((u: Row) => u.shop_id === shop.id),
  }))
}

export async function getAllShopsCount(): Promise<number> {
  const res = await sbFetch('shops?select=id&limit=0', { method: 'GET' })
  // Supabase returns count in content-range header
  const range = res.headers.get('content-range')
  if (range) {
    const parts = range.split('/')
    return parseInt(parts[parts.length - 1], 10) || 0
  }
  return 0
}

// ── Get pending payments ──────────────────────────────────────────

export async function getPendingPayments() {
  const [payments, shops] = await Promise.all([
    sbGet('subscription_payments?status=eq.pending&method=neq.reminder&order=paid_at.desc&select=*'),
    sbGet('shops?select=id,shop_name,owner_phone,city'),
  ])

  const shopMap = new Map(shops.map((s: Row) => [s.id, s]))

  return payments.map((p: Row) => ({
    ...p,
    shops: shopMap.get(p.shop_id) ?? null,
  }))
}

// ── Activate a pending payment ────────────────────────────────────

export async function activateSubscription(
  paymentId:  string,
  planId:     string,
  cycle:      string,
  amountPkr:  number,
  shopId:     string,
): Promise<ActivateResult> {
  try {
    // 1. Get shop details + existing subscription
    const [shops, existingSubs] = await Promise.all([
      sbGet(`shops?id=eq.${shopId}&select=shop_name,owner_phone`),
      sbGet(`subscriptions?shop_id=eq.${shopId}&select=expires_at&limit=1`),
    ])
    const shop = shops[0]
    const existingSub = existingSubs?.[0]

    // 2. Calculate expiry — extend from existing expiry so users don't lose paid time
    const oldExpiry = existingSub?.expires_at ? new Date(existingSub.expires_at) : null
    const baseDate = (oldExpiry && oldExpiry > new Date()) ? oldExpiry : new Date()
    const expiresAtISO = subscriptionExpiresAt(cycle, baseDate)

    // 3. Upsert subscription
    await sbUpsertByShopId('subscriptions', {
      shop_id:          shopId,
      plan:             planId,
      billing_cycle:    cycle,
      status:           'active',
      expires_at:       expiresAtISO,
      grace_ends_at:    null,
      trial_ends_at:    null,
      cancelled_at:     null,
      amount_pkr:       amountPkr,
      updated_at:       new Date().toISOString(),
    })

    // 4. Mark payment as completed
    await sbPatch(`subscription_payments?id=eq.${paymentId}`,
      { status: 'completed', paid_at: new Date().toISOString() }
    )

    // 5. Update shop plan
    await sbPatch(`shops?id=eq.${shopId}`,
      { plan: planId, plan_expires_at: expiresAtISO, updated_at: new Date().toISOString() }
    )

    // 6. Audit log
    await logAdminAction(
      'activate_subscription', 'subscription', paymentId, shopId,
      { plan: planId, cycle, amount: amountPkr, shop_name: shop?.shop_name }
    )

    // 7. Build WhatsApp link
    const waLink = shop?.owner_phone
      ? buildActivationWhatsApp(
          shop.owner_phone,
          shop.shop_name,
          planId.charAt(0).toUpperCase() + planId.slice(1),
          cycle,
          expiresAtISO,
        )
      : undefined

    return { success: true, shopName: shop?.shop_name, shopPhone: shop?.owner_phone, waLink }

  } catch (e) {
    logger.error('billing-admin', 'activateSubscription:', e)
    return { success: false, error: String(e) }
  }
}

// ── Reject a payment ──────────────────────────────────────────────

export async function rejectPayment(
  paymentId: string,
  reason:    string,
): Promise<RejectResult> {
  try {
    const payments = await sbGet(`subscription_payments?id=eq.${paymentId}&select=*,shops(owner_phone,shop_name,id)`)
    const payment = payments[0]

    // Supabase REST doesn't support nested selects the same way
    // Get shop separately
    const shops = payment?.shop_id
      ? await sbGet(`shops?id=eq.${payment.shop_id}&select=owner_phone,shop_name`)
      : []
    const shop = shops[0]

    await sbPatch(`subscription_payments?id=eq.${paymentId}`,
      {
        status: 'failed',
        receipt_data: {
          ...(payment?.receipt_data ?? {}),
          rejection_reason: reason,
          rejected_at:      new Date().toISOString(),
        },
      }
    )

    await logAdminAction(
      'reject_payment', 'payment', paymentId,
      payment?.shop_id,
      { reason, shop_name: shop?.shop_name, amount: payment?.amount_pkr }
    )

    const waLink = shop?.owner_phone
      ? buildRejectionWhatsApp(shop.owner_phone, reason)
      : undefined

    return { success: true, shopPhone: shop?.owner_phone, waLink }

  } catch (e) {
    logger.error('billing-admin', 'rejectPayment:', e)
    return { success: false, error: String(e) }
  }
}

// ── Manually set shop plan ────────────────────────────────────────

export async function adminSetPlan(
  shopId:  string,
  planId:  string,
  cycle:   string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const existingSubs = (planId !== 'starter' && cycle !== 'lifetime')
      ? await sbGet(`subscriptions?shop_id=eq.${shopId}&select=expires_at&limit=1`).catch(() => [])
      : []
    const existingSub = existingSubs?.[0]
    const oldExpiry = existingSub?.expires_at ? new Date(existingSub.expires_at) : null
    const baseDate = (oldExpiry && oldExpiry > new Date()) ? oldExpiry : new Date()
    const expiresAtISO = (cycle === 'lifetime' || planId === 'starter')
      ? null
      : subscriptionExpiresAt(cycle, baseDate)

    await sbUpsertByShopId('subscriptions', {
      shop_id:       shopId,
      plan:          planId,
      billing_cycle: planId === 'starter' ? null : cycle,
      status:        'active',
      expires_at:    expiresAtISO,
      grace_ends_at: null,
      cancelled_at:  null,
      updated_at:    new Date().toISOString(),
    })

    await sbPatch(`shops?id=eq.${shopId}`,
      { plan: planId, plan_expires_at: expiresAtISO, updated_at: new Date().toISOString() }
    )

    await logAdminAction(
      'manual_plan_change', 'subscription', shopId, shopId,
      { plan: planId, cycle }
    )

    return { success: true }
  } catch (e) {
    logger.error('billing-admin', 'adminSetPlan:', e)
    return { success: false, error: String(e) }
  }
}

// ── Deactivate a shop ─────────────────────────────────────────────

export async function deactivateShop(
  shopId: string,
  reason: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await sbUpsertByShopId('subscriptions', {
      shop_id:    shopId,
      status:     'expired',
      plan:       'starter',
      updated_at: new Date().toISOString(),
    })

    await sbPatch(`shops?id=eq.${shopId}`,
      { plan: 'starter', plan_expires_at: null, updated_at: new Date().toISOString() }
    )

    await logAdminAction('shop_deactivated', 'shop', shopId, shopId, { reason })
    return { success: true }
  } catch (e) {
    logger.error('billing-admin', 'deactivateShop:', e)
    return { success: false, error: String(e) }
  }
}

// ── Reactivate a shop ─────────────────────────────────────────────

export async function reactivateShop(
  shopId: string,
  planId: string = 'professional',
  cycle: string = 'monthly',
): Promise<{ success: boolean; error?: string }> {
  try {
    const existingSubs = await sbGet(
      `subscriptions?shop_id=eq.${shopId}&select=expires_at&limit=1`
    ).catch(() => [])
    const existingSub = existingSubs?.[0]
    const oldExpiry = existingSub?.expires_at ? new Date(existingSub.expires_at) : null
    const baseDate = (oldExpiry && oldExpiry > new Date()) ? oldExpiry : new Date()
    const expiresAt = subscriptionExpiresAt(cycle, baseDate)

    await sbUpsertByShopId('subscriptions', {
      shop_id:    shopId,
      status:     'active',
      plan:       planId,
      expires_at: expiresAt,
      grace_ends_at: null,
      cancelled_at:  null,
      updated_at: new Date().toISOString(),
    })

    await sbPatch(`shops?id=eq.${shopId}`,
      { plan: planId, plan_expires_at: expiresAt, updated_at: new Date().toISOString() }
    )

    await logAdminAction('shop_activated', 'shop', shopId, shopId)
    return { success: true }
  } catch (e) {
    logger.error('billing-admin', 'reactivateShop:', e)
    return { success: false, error: String(e) }
  }
}

// ── Get revenue analytics ─────────────────────────────────────────

export async function getRevenueAnalytics() {
  const [payments, shops, subs] = await Promise.all([
    sbGet('subscription_payments?status=eq.completed&select=amount_pkr,paid_at,plan,billing_cycle,shop_id'),
    sbGet('shops?select=id,created_at'),
    sbGet('subscriptions?select=plan,status,billing_cycle,created_at'),
  ])

  const now = new Date()

  // Last 6 months
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    return {
      key:   `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}`,
      label: d.toLocaleDateString('en-PK', { month: 'short', year: '2-digit' }),
    }
  })

  const monthlyRevenue = months.map(m => ({
    label:    m.label,
    revenue:  payments
      .filter((p: Row) => p.paid_at?.startsWith(m.key))
      .reduce((s: number, p: Row) => s + Number(p.amount_pkr), 0),
      newShops: shops
      .filter((s: Row) => s.created_at?.startsWith(m.key))
      .length,
  }))

  const activeSubs = subs.filter((s: Row) => s.status === 'active')
  const cancelledSubs = subs.filter((s: Row) => s.status === 'cancelled').length
  const totalPaidSubs = subs.filter((s: Row) =>
    ['active','cancelled','expired'].includes(s.status)
  ).length

  const mrr = activeSubs.reduce((sum: number, s: Row) => {
    const plan = PLANS[s.plan as keyof typeof PLANS]
    if (!plan || !plan.monthlyPkr) return sum
    if (s.billing_cycle === 'monthly') return sum + plan.monthlyPkr
    if (s.billing_cycle === 'yearly' && plan.yearlyPkr) return sum + Math.round(plan.yearlyPkr / 12)
    return sum
  }, 0)

  const totalRevenue = payments.reduce((s: number, p: Row) => s + Number(p.amount_pkr), 0)

  const revenueByPlan = {
    professional: payments.filter((p: Row) => p.plan === 'professional')
      .reduce((s: number, p: Row) => s + Number(p.amount_pkr), 0),
    business: payments.filter((p: Row) => p.plan === 'business')
      .reduce((s: number, p: Row) => s + Number(p.amount_pkr), 0),
  }

  const revenueByCycle = {
    monthly: payments.filter((p: Row) => p.billing_cycle === 'monthly')
      .reduce((s: number, p: Row) => s + Number(p.amount_pkr), 0),
    yearly: payments.filter((p: Row) => p.billing_cycle === 'yearly')
      .reduce((s: number, p: Row) => s + Number(p.amount_pkr), 0),
  }

  return {
    monthlyRevenue,
    mrr,
    totalRevenue,
    totalShops:  shops.length,
    activeSubs:  activeSubs.length,
    churnRate:   totalPaidSubs > 0
      ? Math.round((cancelledSubs / totalPaidSubs) * 100) : 0,
    revenueByPlan,
    revenueByCycle,
  }
}

// ── Get all payments (history) ────────────────────────────────────

export async function getAllPayments(limit = 100) {
  const [payments, shops] = await Promise.all([
    sbGet(`subscription_payments?method=neq.reminder&order=paid_at.desc&limit=${limit}&select=*`),
    sbGet('shops?select=id,shop_name,owner_phone,city'),
  ])

  const shopMap = new Map(shops.map((s: Row) => [s.id, s]))
  return payments.map((p: Row) => ({
    ...p,
    shops: shopMap.get(p.shop_id) ?? null,
  }))
}

// ── Get single shop details ───────────────────────────────────────

export async function getShopDetails(shopId: string) {
  const [shops, subs, usage] = await Promise.all([
    sbGet(`shops?id=eq.${shopId}&select=*`),
    sbGet(`subscriptions?shop_id=eq.${shopId}&select=*`),
    sbGet(`shop_usage?shop_id=eq.${shopId}&select=*`),
  ])

  const shop = shops[0]
  if (!shop) return null

  return {
    ...shop,
    subscriptions: subs,
    shop_usage:    usage,
  }
}

// ── Get audit log ─────────────────────────────────────────────────

export async function getAuditLogForAdmin(limit = 200) {
  const [logs, shops] = await Promise.all([
    sbGet(`admin_audit_log?order=performed_at.desc&limit=${limit}&select=*`),
    sbGet('shops?select=id,shop_name,owner_phone'),
  ])

  const shopMap = new Map(shops.map((s: Row) => [s.id, s]))
  return logs.map((log: Row) => ({
    ...log,
    shops: shopMap.get(log.shop_id) ?? null,
  }))
}
