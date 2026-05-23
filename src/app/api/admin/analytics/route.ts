import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySessionToken, ADMIN_SESSION_COOKIE } from '@/lib/admin/auth'
import { format, subMonths, startOfMonth } from 'date-fns'

export async function GET(req: NextRequest) {
  const token = req.cookies.get(ADMIN_SESSION_COOKIE)?.value
  if (!token || !verifySessionToken(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const adminSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const now = new Date()

  const months = Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(now, 5 - i)
    return {
      key:   format(d, 'yyyy-MM'),
      label: format(d, 'MMM yy'),
      start: startOfMonth(d).toISOString(),
      end:   startOfMonth(subMonths(d, -1)).toISOString(),
    }
  })

  const { data: allPayments } = await adminSupabase
    .from('subscription_payments')
    .select('amount_pkr, status, paid_at, plan, billing_cycle, shop_id')
    .eq('status', 'completed')

  const { data: allShops } = await adminSupabase
    .from('shops')
    .select('id, created_at')
    .order('created_at')

  const { data: allSubs } = await adminSupabase
    .from('subscriptions')
    .select('plan, status, billing_cycle, created_at')

  const payments = allPayments ?? []
  const shops    = allShops    ?? []
  const subs     = allSubs     ?? []

  const monthlyRevenue = months.map(m => ({
    label:   m.label,
    revenue: payments
      .filter(p => p.paid_at?.startsWith(m.key))
      .reduce((s, p) => s + Number(p.amount_pkr), 0),
    newShops: shops
      .filter(s => s.created_at?.startsWith(m.key))
      .length,
  }))

  const cancelledSubs = subs.filter(s => s.status === 'cancelled').length
  const totalPaid     = subs.filter(s => ['active','cancelled','expired'].includes(s.status)).length
  const churnRate     = totalPaid > 0 ? Math.round((cancelledSubs / totalPaid) * 100) : 0

  const activeSubs    = subs.filter(s => s.status === 'active')
  const mrr           = activeSubs.reduce((sum, s) => {
    if (s.plan === 'professional' && s.billing_cycle === 'monthly') return sum + 999
    if (s.plan === 'professional' && s.billing_cycle === 'yearly')  return sum + Math.round(9500/12)
    if (s.plan === 'business'     && s.billing_cycle === 'monthly') return sum + 2499
    if (s.plan === 'business'     && s.billing_cycle === 'yearly')  return sum + Math.round(23999/12)
    return sum
  }, 0)

  const revenueByPlan = {
    professional: payments.filter(p => p.plan === 'professional').reduce((s, p) => s + Number(p.amount_pkr), 0),
    business:     payments.filter(p => p.plan === 'business').reduce((s, p) => s + Number(p.amount_pkr), 0),
  }

  const revenueByCycle = {
    monthly: payments.filter(p => p.billing_cycle === 'monthly').reduce((s, p) => s + Number(p.amount_pkr), 0),
    yearly:  payments.filter(p => p.billing_cycle === 'yearly').reduce((s, p) => s + Number(p.amount_pkr), 0),
  }

  return NextResponse.json({
    monthlyRevenue,
    churnRate,
    mrr,
    revenueByPlan,
    revenueByCycle,
    totalRevenue: payments.reduce((s, p) => s + Number(p.amount_pkr), 0),
    totalShops:   shops.length,
    activeSubs:   activeSubs.length,
  })
}
