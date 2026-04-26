// src/lib/billing/admin.ts
'use server'

import { createClient } from '@supabase/supabase-js'
import { logAdminAction } from '@/lib/admin/audit'
import { buildActivationWhatsApp, buildRejectionWhatsApp } from './whatsapp-notify'

// Server-side Supabase client — never exposed to browser
const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// ── Types ────────────────────────────────────────────────────────

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

export interface ShopRow {
  id:           string
  shop_name:    string
  owner_phone:  string
  city?:        string
  plan:         string
  created_at:   string
  updated_at:   string
  subscriptions?: SubscriptionRow[]
  shop_usage?:    UsageRow[]
}

export interface SubscriptionRow {
  id:             string
  shop_id:        string
  plan:           string
  status:         string
  billing_cycle?: string
  started_at:     string
  trial_ends_at?: string
  expires_at?:    string
  grace_ends_at?: string
  cancelled_at?:  string
  amount_pkr?:    number
  gateway?:       string
  gateway_sub_id?: string
  last_payment_at?: string
  next_payment_at?: string
  created_at:     string
  updated_at:     string
}

export interface UsageRow {
  shop_id:           string
  orders_this_month: number
  customers_total:   number
  karigar_count:     number
  storage_used_kb:   number
  month_year:        string
}

export interface PaymentRow {
  id:              string
  shop_id:         string
  plan:            string
  billing_cycle?:  string
  amount_pkr:      number
  method?:         string
  gateway_tx_id?:  string
  status:          string
  paid_at:         string
  receipt_data?:   Record<string, unknown>
  shops?: {
    shop_name:   string
    owner_phone: string
    city?:       string
  }
}

export interface RevenueSummary {
  total:                 number
  thisMonthRevenue:      number
  activeSubscriptions:   number
  trialing:              number
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
    // 1. Get shop details for notification
    const { data: shop, error: shopErr } = await adminSupabase
      .from('shops')
      .select('shop_name, owner_phone')
      .eq('id', shopId)
      .single()

    if (shopErr) throw new Error(`Shop fetch failed: ${shopErr.message}`)

    // 2. Calculate expiry date based on billing cycle
    const expiresAt = new Date()
    if (cycle === 'monthly')  expiresAt.setMonth(expiresAt.getMonth() + 1)
    if (cycle === 'yearly')   expiresAt.setFullYear(expiresAt.getFullYear() + 1)
    if (cycle === 'lifetime') expiresAt.setFullYear(expiresAt.getFullYear() + 100)

    const expiresAtISO = cycle === 'lifetime' ? null : expiresAt.toISOString()

    // 3. Update subscription to active
    const { error: subError } = await adminSupabase
      .from('subscriptions')
      .upsert({
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
      }, { onConflict: 'shop_id' })

    if (subError) throw new Error(`Subscription update failed: ${subError.message}`)

    // 4. Mark payment as completed
    const { error: payError } = await adminSupabase
      .from('subscription_payments')
      .update({
        status:  'completed',
        paid_at: new Date().toISOString(),
      })
      .eq('id', paymentId)

    if (payError) throw new Error(`Payment update failed: ${payError.message}`)

    // 5. Update shop.plan field for quick reads
    const { error: shopUpdateErr } = await adminSupabase
      .from('shops')
      .update({
        plan:       planId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', shopId)

    if (shopUpdateErr) {
      // Non-fatal — subscription is the source of truth
      console.warn('[Admin] shop.plan update failed:', shopUpdateErr.message)
    }

    // 6. Log the action to audit trail
    await logAdminAction(
      'activate_subscription',
      'subscription',
      paymentId,
      shopId,
      {
        plan:      planId,
        cycle,
        amount:    amountPkr,
        shop_name: shop?.shop_name,
        expires_at: expiresAtISO,
      }
    )

    // 7. Build WhatsApp notification link
    const waLink = shop?.owner_phone
      ? buildActivationWhatsApp(
          shop.owner_phone,
          shop.shop_name,
          planId.charAt(0).toUpperCase() + planId.slice(1),
          cycle,
          expiresAtISO,
        )
      : undefined

    return {
      success:   true,
      shopName:  shop?.shop_name,
      shopPhone: shop?.owner_phone,
      waLink,
    }
  } catch (e) {
    console.error('[Admin] activateSubscription error:', e)
    return { success: false, error: String(e) }
  }
}

// ── Reject / mark payment as failed ──────────────────────────────

export async function rejectPayment(
  paymentId: string,
  reason:    string,
): Promise<RejectResult> {
  try {
    // 1. Get payment + shop details
    const { data: payment, error: fetchErr } = await adminSupabase
      .from('subscription_payments')
      .select('*, shops(owner_phone, shop_name, id)')
      .eq('id', paymentId)
      .single()

    if (fetchErr) throw new Error(`Payment fetch failed: ${fetchErr.message}`)

    // 2. Mark payment as failed
    const { error: updateErr } = await adminSupabase
      .from('subscription_payments')
      .update({
        status:       'failed',
        receipt_data: {
          ...(payment?.receipt_data ?? {}),
          rejection_reason: reason,
          rejected_at:      new Date().toISOString(),
        },
      })
      .eq('id', paymentId)

    if (updateErr) throw new Error(`Payment reject failed: ${updateErr.message}`)

    // 3. Log the action
    await logAdminAction(
      'reject_payment',
      'payment',
      paymentId,
      payment?.shop_id ?? payment?.shops?.id,
      {
        reason,
        shop_name: payment?.shops?.shop_name,
        amount:    payment?.amount_pkr,
      }
    )

    // 4. Build WhatsApp link
    const phone  = payment?.shops?.owner_phone
    const waLink = phone
      ? buildRejectionWhatsApp(phone, reason)
      : undefined

    return {
      success:   true,
      shopPhone: phone,
      waLink,
    }
  } catch (e) {
    console.error('[Admin] rejectPayment error:', e)
    return { success: false, error: String(e) }
  }
}

// ── Get all pending payments ──────────────────────────────────────

export async function getPendingPayments(): Promise<PaymentRow[]> {
  const { data, error } = await adminSupabase
    .from('subscription_payments')
    .select(`
      *,
      shops(shop_name, owner_phone, city)
    `)
    .eq('status', 'pending')
    .neq('method', 'reminder')   // exclude reminder log entries
    .order('paid_at', { ascending: false })

  if (error) {
    console.error('[Admin] getPendingPayments error:', error.message)
    return []
  }
  return (data ?? []) as PaymentRow[]
}

// ── Get all shops with subscription + usage ───────────────────────

export async function getAllShops(): Promise<ShopRow[]> {
  const { data, error } = await adminSupabase
    .from('shops')
    .select(`
      *,
      subscriptions(
        id, plan, status, billing_cycle,
        trial_ends_at, expires_at, grace_ends_at,
        amount_pkr, created_at, updated_at
      ),
      shop_usage(
        orders_this_month, customers_total,
        karigar_count, storage_used_kb, month_year
      )
    `)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[Admin] getAllShops error:', error.message)
    return []
  }
  return (data ?? []) as ShopRow[]
}

// ── Get revenue summary for dashboard ────────────────────────────

export async function getRevenueSummary(): Promise<RevenueSummary> {
  const now       = new Date()
  const thisMonth = now.toISOString().slice(0, 7)   // "2025-04"

  const [
    { data: payments },
    { data: subs },
  ] = await Promise.all([
    adminSupabase
      .from('subscription_payments')
      .select('amount_pkr, status, paid_at')
      .eq('status', 'completed'),
    adminSupabase
      .from('subscriptions')
      .select('status'),
  ])

  const payments_ = payments ?? []
  const subs_     = subs     ?? []

  const total          = payments_.reduce((s, p) => s + Number(p.amount_pkr), 0)
  const thisMonthRevenue = payments_
    .filter(p => p.paid_at?.startsWith(thisMonth))
    .reduce((s, p) => s + Number(p.amount_pkr), 0)

  const activeSubscriptions = subs_.filter(s => s.status === 'active').length
  const trialing            = subs_.filter(s => s.status === 'trialing').length

  return { total, thisMonthRevenue, activeSubscriptions, trialing }
}

// ── Manually set a shop's plan (admin override) ───────────────────

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

    const expiresAtISO = cycle === 'lifetime' ? null : expiresAt.toISOString()

    const { error: subErr } = await adminSupabase
      .from('subscriptions')
      .upsert({
        shop_id:       shopId,
        plan:          planId,
        billing_cycle: cycle,
        status:        planId === 'starter' ? 'active' : 'active',
        expires_at:    expiresAtISO,
        grace_ends_at: null,
        cancelled_at:  null,
        updated_at:    new Date().toISOString(),
      }, { onConflict: 'shop_id' })

    if (subErr) throw new Error(subErr.message)

    const { error: shopErr } = await adminSupabase
      .from('shops')
      .update({ plan: planId, updated_at: new Date().toISOString() })
      .eq('id', shopId)

    if (shopErr) throw new Error(shopErr.message)

    // Log the manual override
    await logAdminAction(
      'manual_plan_change',
      'subscription',
      shopId,
      shopId,
      { plan: planId, cycle, expires_at: expiresAtISO }
    )

    return { success: true }
  } catch (e) {
    console.error('[Admin] adminSetPlan error:', e)
    return { success: false, error: String(e) }
  }
}

// ── Deactivate a shop (block access without deleting data) ────────

export async function deactivateShop(
  shopId: string,
  reason: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    // Set subscription to expired
    const { error: subErr } = await adminSupabase
      .from('subscriptions')
      .update({
        status:       'expired',
        plan:         'starter',
        updated_at:   new Date().toISOString(),
      })
      .eq('shop_id', shopId)

    if (subErr) throw new Error(subErr.message)

    // Downgrade shop plan
    await adminSupabase
      .from('shops')
      .update({ plan: 'starter', updated_at: new Date().toISOString() })
      .eq('id', shopId)

    await logAdminAction(
      'shop_deactivated',
      'shop',
      shopId,
      shopId,
      { reason }
    )

    return { success: true }
  } catch (e) {
    console.error('[Admin] deactivateShop error:', e)
    return { success: false, error: String(e) }
  }
}

// ── Reactivate a deactivated shop ────────────────────────────────

export async function reactivateShop(
  shopId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const expiresAt = new Date()
    expiresAt.setMonth(expiresAt.getMonth() + 1)

    const { error } = await adminSupabase
      .from('subscriptions')
      .update({
        status:     'active',
        plan:       'professional',
        expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('shop_id', shopId)

    if (error) throw new Error(error.message)

    await adminSupabase
      .from('shops')
      .update({ plan: 'professional', updated_at: new Date().toISOString() })
      .eq('id', shopId)

    await logAdminAction('shop_activated', 'shop', shopId, shopId)

    return { success: true }
  } catch (e) {
    console.error('[Admin] reactivateShop error:', e)
    return { success: false, error: String(e) }
  }
}

// ── Delete all data for a shop (irreversible) ─────────────────────

export async function deleteShopData(
  shopId:    string,
  shopName:  string,
): Promise<{ success: boolean; error?: string }> {
  try {
    // Delete in correct FK order (children before parents)
    const tables = [
      'admin_audit_log',
      'subscription_payments',
      'subscriptions',
      'shop_usage',
      'order_status_history',
      'payments',
      'orders',
      'measurements',
      'customers',
      'team_members',
    ]

    for (const table of tables) {
      const { error } = await adminSupabase
        .from(table)
        .delete()
        .eq('shop_id', shopId)
      if (error) {
        console.warn(`[Admin] delete ${table} warning:`, error.message)
      }
    }

    // Finally delete the shop itself
    const { error: shopErr } = await adminSupabase
      .from('shops')
      .delete()
      .eq('id', shopId)

    if (shopErr) throw new Error(`Shop delete failed: ${shopErr.message}`)

    // Note: we can't log this to audit_log after deletion
    // so log before the final shop delete
    console.log(`[Admin] Shop deleted: ${shopName} (${shopId})`)

    return { success: true }
  } catch (e) {
    console.error('[Admin] deleteShopData error:', e)
    return { success: false, error: String(e) }
  }
}

// ── Get all subscription payments (history) ───────────────────────

export async function getAllPayments(limit = 100): Promise<PaymentRow[]> {
  const { data, error } = await adminSupabase
    .from('subscription_payments')
    .select(`
      *,
      shops(shop_name, owner_phone, city)
    `)
    .neq('method', 'reminder')
    .order('paid_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[Admin] getAllPayments error:', error.message)
    return []
  }
  return (data ?? []) as PaymentRow[]
}

// ── Get single shop details ───────────────────────────────────────

export async function getShopDetails(shopId: string): Promise<ShopRow | null> {
  const { data, error } = await adminSupabase
    .from('shops')
    .select(`
      *,
      subscriptions(*),
      shop_usage(*)
    `)
    .eq('id', shopId)
    .single()

  if (error) {
    console.error('[Admin] getShopDetails error:', error.message)
    return null
  }
  return data as ShopRow
}