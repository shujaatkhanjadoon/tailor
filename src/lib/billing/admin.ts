// src/lib/billing/admin.ts
'use server'

import { logAdminAction } from '@/lib/admin/audit'
import { buildActivationWhatsApp, buildRejectionWhatsApp } from './whatsapp-notify'

// ── Direct REST fetch — avoids createClient DNS timeouts ──────────

const getHeaders = () => {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set in environment variables')
  return {
    'Content-Type':  'application/json',
    'apikey':        key,
    'Authorization': `Bearer ${key}`,
  }
}

const getUrl = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set in environment variables')
  return url
}

async function sbSelect(
  table:  string,
  params: string = '',
  signal?: AbortSignal
): Promise<any[]> {
  const res = await fetch(
    `${getUrl()}/rest/v1/${table}?${params}`,
    { headers: { ...getHeaders(), 'Prefer': 'return=representation' }, signal }
  )
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`GET ${table} failed (${res.status}): ${err}`)
  }
  return res.json()
}

async function sbUpdate(
  table:  string,
  filter: string,
  data:   object
): Promise<void> {
  const res = await fetch(
    `${getUrl()}/rest/v1/${table}?${filter}`,
    {
      method:  'PATCH',
      headers: { ...getHeaders(), 'Prefer': 'return=minimal' },
      body:    JSON.stringify(data),
    }
  )
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`PATCH ${table} failed (${res.status}): ${err}`)
  }
}

async function sbUpsert(
  table:          string,
  data:           object,
  onConflict:     string = 'id'
): Promise<void> {
  const res = await fetch(
    `${getUrl()}/rest/v1/${table}`,
    {
      method:  'POST',
      headers: {
        ...getHeaders(),
        'Prefer': `resolution=merge-duplicates,return=minimal`,
      },
      body: JSON.stringify(data),
    }
  )
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`UPSERT ${table} failed (${res.status}): ${err}`)
  }
}

async function sbInsert(table: string, data: object): Promise<void> {
  const res = await fetch(
    `${getUrl()}/rest/v1/${table}`,
    {
      method:  'POST',
      headers: { ...getHeaders(), 'Prefer': 'return=minimal' },
      body:    JSON.stringify(data),
    }
  )
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`INSERT ${table} failed (${res.status}): ${err}`)
  }
}

async function sbDelete(table: string, filter: string): Promise<void> {
  const res = await fetch(
    `${getUrl()}/rest/v1/${table}?${filter}`,
    {
      method:  'DELETE',
      headers: { ...getHeaders(), 'Prefer': 'return=minimal' },
    }
  )
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`DELETE ${table} failed (${res.status}): ${err}`)
  }
}

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
    sbSelect('subscription_payments',
      'status=eq.completed&select=amount_pkr,paid_at'
    ),
    sbSelect('subscriptions', 'select=status,plan'),
  ])

  const now       = new Date()
  const thisMonth = now.toISOString().slice(0, 7)

  const total = payments.reduce((s: number, p: any) => s + Number(p.amount_pkr), 0)

  const thisMonthRevenue = payments
    .filter((p: any) => p.paid_at?.startsWith(thisMonth))
    .reduce((s: number, p: any) => s + Number(p.amount_pkr), 0)

  const activeSubscriptions = subs.filter((s: any) => s.status === 'active').length
  const trialing            = subs.filter((s: any) => s.status === 'trialing').length

  return { total, thisMonthRevenue, activeSubscriptions, trialing }
}

// ── Get all shops with subscriptions and usage ────────────────────

export async function getAllShops() {
  // Fetch in parallel
  const [shops, subscriptions, usages] = await Promise.all([
    sbSelect('shops',
      'select=id,shop_name,owner_phone,city,plan,created_at,updated_at&order=created_at.desc'
    ),
    sbSelect('subscriptions',
      'select=shop_id,plan,status,billing_cycle,trial_ends_at,expires_at,grace_ends_at,amount_pkr,created_at,updated_at'
    ),
    sbSelect('shop_usage',
      'select=shop_id,orders_this_month,customers_total,karigar_count,storage_used_kb,month_year'
    ),
  ])

  // Join manually
  return shops.map((shop: any) => ({
    ...shop,
    subscriptions: subscriptions.filter((s: any) => s.shop_id === shop.id),
    shop_usage:    usages.filter((u: any) => u.shop_id === shop.id),
  }))
}

// ── Get pending payments ──────────────────────────────────────────

export async function getPendingPayments() {
  const [payments, shops] = await Promise.all([
    sbSelect('subscription_payments',
      'status=eq.pending&method=neq.reminder&order=paid_at.desc&select=*'
    ),
    sbSelect('shops', 'select=id,shop_name,owner_phone,city'),
  ])

  const shopMap = new Map(shops.map((s: any) => [s.id, s]))

  return payments.map((p: any) => ({
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
    // 1. Get shop details
    const shops = await sbSelect('shops',
      `id=eq.${shopId}&select=shop_name,owner_phone`
    )
    const shop = shops[0]

    // 2. Calculate expiry
    const expiresAt = new Date()
    if (cycle === 'monthly')  expiresAt.setMonth(expiresAt.getMonth() + 1)
    if (cycle === 'yearly')   expiresAt.setFullYear(expiresAt.getFullYear() + 1)
    if (cycle === 'lifetime') expiresAt.setFullYear(expiresAt.getFullYear() + 100)

    const expiresAtISO = cycle === 'lifetime' ? null : expiresAt.toISOString()

    // 3. Upsert subscription
    await sbUpsert('subscriptions', {
      shop_id:          shopId,
      plan:             planId,
      billing_cycle:    cycle,
      status:           'active',
      expires_at:       expiresAtISO,
      grace_ends_at:    null,
      trial_ends_at:    null,
      cancelled_at:     null,
      amount_pkr:       amountPkr,
      last_payment_at:  new Date().toISOString(),
      next_payment_at:  expiresAtISO,
      updated_at:       new Date().toISOString(),
    }, 'shop_id')

    // 4. Mark payment as completed
    await sbUpdate('subscription_payments',
      `id=eq.${paymentId}`,
      { status: 'completed', paid_at: new Date().toISOString() }
    )

    // 5. Update shop plan
    await sbUpdate('shops',
      `id=eq.${shopId}`,
      { plan: planId, updated_at: new Date().toISOString() }
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
    console.error('[Admin] activateSubscription:', e)
    return { success: false, error: String(e) }
  }
}

// ── Reject a payment ──────────────────────────────────────────────

export async function rejectPayment(
  paymentId: string,
  reason:    string,
): Promise<RejectResult> {
  try {
    const payments = await sbSelect('subscription_payments',
      `id=eq.${paymentId}&select=*,shops(owner_phone,shop_name,id)`
    )
    const payment = payments[0]

    // Supabase REST doesn't support nested selects the same way
    // Get shop separately
    const shops = payment?.shop_id
      ? await sbSelect('shops', `id=eq.${payment.shop_id}&select=owner_phone,shop_name`)
      : []
    const shop = shops[0]

    await sbUpdate('subscription_payments',
      `id=eq.${paymentId}`,
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
    console.error('[Admin] rejectPayment:', e)
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
    const expiresAt = new Date()
    if (cycle === 'monthly')  expiresAt.setMonth(expiresAt.getMonth() + 1)
    if (cycle === 'yearly')   expiresAt.setFullYear(expiresAt.getFullYear() + 1)
    if (cycle === 'lifetime') expiresAt.setFullYear(expiresAt.getFullYear() + 100)

    const expiresAtISO = (cycle === 'lifetime' || planId === 'starter')
      ? null
      : expiresAt.toISOString()

    await sbUpsert('subscriptions', {
      shop_id:       shopId,
      plan:          planId,
      billing_cycle: planId === 'starter' ? null : cycle,
      status:        'active',
      expires_at:    expiresAtISO,
      grace_ends_at: null,
      cancelled_at:  null,
      updated_at:    new Date().toISOString(),
    }, 'shop_id')

    await sbUpdate('shops',
      `id=eq.${shopId}`,
      { plan: planId, updated_at: new Date().toISOString() }
    )

    await logAdminAction(
      'manual_plan_change', 'subscription', shopId, shopId,
      { plan: planId, cycle }
    )

    return { success: true }
  } catch (e) {
    console.error('[Admin] adminSetPlan:', e)
    return { success: false, error: String(e) }
  }
}

// ── Deactivate a shop ─────────────────────────────────────────────

export async function deactivateShop(
  shopId: string,
  reason: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await sbUpsert('subscriptions', {
      shop_id:    shopId,
      status:     'expired',
      plan:       'starter',
      updated_at: new Date().toISOString(),
    }, 'shop_id')

    await sbUpdate('shops',
      `id=eq.${shopId}`,
      { plan: 'starter', updated_at: new Date().toISOString() }
    )

    await logAdminAction('shop_deactivated', 'shop', shopId, shopId, { reason })
    return { success: true }
  } catch (e) {
    console.error('[Admin] deactivateShop:', e)
    return { success: false, error: String(e) }
  }
}

// ── Reactivate a shop ─────────────────────────────────────────────

export async function reactivateShop(
  shopId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const expiresAt = new Date()
    expiresAt.setMonth(expiresAt.getMonth() + 1)

    await sbUpsert('subscriptions', {
      shop_id:    shopId,
      status:     'active',
      plan:       'professional',
      expires_at: expiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    }, 'shop_id')

    await sbUpdate('shops',
      `id=eq.${shopId}`,
      { plan: 'professional', updated_at: new Date().toISOString() }
    )

    await logAdminAction('shop_activated', 'shop', shopId, shopId)
    return { success: true }
  } catch (e) {
    console.error('[Admin] reactivateShop:', e)
    return { success: false, error: String(e) }
  }
}

// ── Get revenue analytics ─────────────────────────────────────────

export async function getRevenueAnalytics() {
  const [payments, shops, subs] = await Promise.all([
    sbSelect('subscription_payments',
      'status=eq.completed&select=amount_pkr,paid_at,plan,billing_cycle,shop_id'
    ),
    sbSelect('shops', 'select=id,created_at'),
    sbSelect('subscriptions', 'select=plan,status,billing_cycle,created_at'),
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
      .filter((p: any) => p.paid_at?.startsWith(m.key))
      .reduce((s: number, p: any) => s + Number(p.amount_pkr), 0),
    newShops: shops
      .filter((s: any) => s.created_at?.startsWith(m.key))
      .length,
  }))

  const activeSubs = subs.filter((s: any) => s.status === 'active')
  const cancelledSubs = subs.filter((s: any) => s.status === 'cancelled').length
  const totalPaidSubs = subs.filter((s: any) =>
    ['active','cancelled','expired'].includes(s.status)
  ).length

  const mrr = activeSubs.reduce((sum: number, s: any) => {
    if (s.plan === 'professional' && s.billing_cycle === 'monthly') return sum + 999
    if (s.plan === 'professional' && s.billing_cycle === 'yearly')  return sum + Math.round(9500/12)
    if (s.plan === 'business'     && s.billing_cycle === 'monthly') return sum + 2499
    if (s.plan === 'business'     && s.billing_cycle === 'yearly')  return sum + Math.round(23999/12)
    return sum
  }, 0)

  const totalRevenue = payments.reduce((s: number, p: any) => s + Number(p.amount_pkr), 0)

  const revenueByPlan = {
    professional: payments.filter((p: any) => p.plan === 'professional')
      .reduce((s: number, p: any) => s + Number(p.amount_pkr), 0),
    business: payments.filter((p: any) => p.plan === 'business')
      .reduce((s: number, p: any) => s + Number(p.amount_pkr), 0),
  }

  const revenueByCycle = {
    monthly: payments.filter((p: any) => p.billing_cycle === 'monthly')
      .reduce((s: number, p: any) => s + Number(p.amount_pkr), 0),
    yearly: payments.filter((p: any) => p.billing_cycle === 'yearly')
      .reduce((s: number, p: any) => s + Number(p.amount_pkr), 0),
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
    sbSelect('subscription_payments',
      `method=neq.reminder&order=paid_at.desc&limit=${limit}&select=*`
    ),
    sbSelect('shops', 'select=id,shop_name,owner_phone,city'),
  ])

  const shopMap = new Map(shops.map((s: any) => [s.id, s]))
  return payments.map((p: any) => ({
    ...p,
    shops: shopMap.get(p.shop_id) ?? null,
  }))
}

// ── Get single shop details ───────────────────────────────────────

export async function getShopDetails(shopId: string) {
  const [shops, subs, usage] = await Promise.all([
    sbSelect('shops', `id=eq.${shopId}&select=*`),
    sbSelect('subscriptions', `shop_id=eq.${shopId}&select=*`),
    sbSelect('shop_usage', `shop_id=eq.${shopId}&select=*`),
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
    sbSelect('admin_audit_log',
      `order=performed_at.desc&limit=${limit}&select=*`
    ),
    sbSelect('shops', 'select=id,shop_name,owner_phone'),
  ])

  const shopMap = new Map(shops.map((s: any) => [s.id, s]))
  return logs.map((log: any) => ({
    ...log,
    shops: shopMap.get(log.shop_id) ?? null,
  }))
}