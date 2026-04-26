// src/lib/billing/admin.ts
'use server'

import { createClient } from '@supabase/supabase-js'
import { buildActivationWhatsApp, buildRejectionWhatsApp } from './whatsapp-notify'

// Server-side Supabase client with service role
// Never expose this to the browser
const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,   // add this to .env.local
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export interface ActivateResult {
  success:  boolean
  error?:   string
  shopName?: string
  shopPhone?: string
}

// ── Activate a pending payment ────────────────────────────────────
export async function activateSubscription(
  paymentId:    string,
  planId:       string,
  cycle:        string,
  amountPkr:   number,
  shopId:       string,
): Promise<ActivateResult> {
  try {
    // 1. Get shop details for notification
    const { data: shop } = await adminSupabase
      .from('shops')
      .select('shop_name, owner_phone')
      .eq('id', shopId)
      .single()

    // 2. Calculate expiry date
    const expiresAt = new Date()
    if (cycle === 'monthly')  expiresAt.setMonth(expiresAt.getMonth() + 1)
    if (cycle === 'yearly')   expiresAt.setFullYear(expiresAt.getFullYear() + 1)
    if (cycle === 'lifetime') expiresAt.setFullYear(expiresAt.getFullYear() + 100)

    // 3. Update subscription to active
    const { error: subError } = await adminSupabase
      .from('subscriptions')
      .upsert({
        shop_id:         shopId,
        plan:            planId,
        billing_cycle:   cycle,
        status:          'active',
        expires_at:      cycle === 'lifetime' ? null : expiresAt.toISOString(),
        grace_ends_at:   null,
        amount_pkr:      amountPkr,
        last_payment_at: new Date().toISOString(),
        next_payment_at: cycle === 'lifetime' ? null : expiresAt.toISOString(),
        updated_at:      new Date().toISOString(),
      }, { onConflict: 'shop_id' })

    if (subError) throw new Error(subError.message)

    // 4. Mark payment as completed
    const { error: payError } = await adminSupabase
      .from('subscription_payments')
      .update({
        status:    'completed',
        paid_at:   new Date().toISOString(),
      })
      .eq('id', paymentId)

    if (payError) throw new Error(payError.message)

    // 5. Update shop plan field
    await adminSupabase
      .from('shops')
      .update({ plan: planId, updated_at: new Date().toISOString() })
      .eq('id', shopId)

    return {
      success:   true,
      shopName:  shop?.shop_name,
      shopPhone: shop?.owner_phone,
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
): Promise<{ success: boolean; error?: string; shopPhone?: string }> {
  try {
    const { data: payment } = await adminSupabase
      .from('subscription_payments')
      .select('*, shops(owner_phone, shop_name)')
      .eq('id', paymentId)
      .single()

    await adminSupabase
      .from('subscription_payments')
      .update({
        status: 'failed',
        receipt_data: {
          ...(payment?.receipt_data ?? {}),
          rejection_reason: reason,
          rejected_at: new Date().toISOString(),
        },
      })
      .eq('id', paymentId)

    return {
      success:   true,
      shopPhone: payment?.shops?.owner_phone,
    }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

// ── Get all pending payments ──────────────────────────────────────
export async function getPendingPayments() {
  const { data, error } = await adminSupabase
    .from('subscription_payments')
    .select(`
      *,
      shops(shop_name, owner_phone, city)
    `)
    .eq('status', 'pending')
    .order('paid_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data ?? []
}

// ── Get all shops with subscription status ────────────────────────
export async function getAllShops() {
  const { data, error } = await adminSupabase
    .from('shops')
    .select(`
      *,
      subscriptions(plan, status, trial_ends_at, expires_at, billing_cycle, amount_pkr),
      shop_usage(orders_this_month, customers_total, karigar_count)
    `)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data ?? []
}

// ── Get revenue summary ───────────────────────────────────────────
export async function getRevenueSummary() {
  const { data: payments } = await adminSupabase
    .from('subscription_payments')
    .select('amount_pkr, status, paid_at, plan, billing_cycle')
    .eq('status', 'completed')

  const payments_ = payments ?? []

  const now      = new Date()
  const thisMonth = now.toISOString().slice(0, 7)   // "2025-04"

  const total      = payments_.reduce((s, p) => s + Number(p.amount_pkr), 0)
  const thisMonthR = payments_
    .filter(p => p.paid_at?.startsWith(thisMonth))
    .reduce((s, p) => s + Number(p.amount_pkr), 0)

  const { data: subs } = await adminSupabase
    .from('subscriptions')
    .select('plan, status')

  const subs_ = subs ?? []
  const active = subs_.filter(s => s.status === 'active').length
  const trial  = subs_.filter(s => s.status === 'trialing').length

  return { total, thisMonthRevenue: thisMonthR, activeSubscriptions: active, trialing: trial }
}

// ── Manually upgrade/downgrade a shop ────────────────────────────
export async function adminSetPlan(
  shopId: string,
  planId: string,
  cycle:  string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const expiresAt = new Date()
    if (cycle === 'monthly')  expiresAt.setMonth(expiresAt.getMonth() + 1)
    if (cycle === 'yearly')   expiresAt.setFullYear(expiresAt.getFullYear() + 1)

    await adminSupabase
      .from('subscriptions')
      .upsert({
        shop_id:       shopId,
        plan:          planId,
        billing_cycle: cycle,
        status:        'active',
        expires_at:    cycle === 'lifetime' ? null : expiresAt.toISOString(),
        updated_at:    new Date().toISOString(),
      }, { onConflict: 'shop_id' })

    await adminSupabase
      .from('shops')
      .update({ plan: planId })
      .eq('id', shopId)

    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}