// src/app/api/admin/analytics/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken, ADMIN_SESSION_COOKIE } from '@/lib/admin/auth'
import { format, subMonths, startOfMonth } from 'date-fns'
import { PLANS } from '@/lib/billing/plans'
import { sbGet } from '@/lib/supabase/service'

export async function GET(req: NextRequest) {
  const token = req.cookies.get(ADMIN_SESSION_COOKIE)?.value
  if (!token || !verifySessionToken(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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

  try {
    const [allPayments, allShops, allSubs] = await Promise.all([
      sbGet('subscription_payments?select=amount_pkr,status,paid_at,plan,billing_cycle,shop_id&status=eq.completed'),
      sbGet('shops?select=id,created_at&order=created_at.asc'),
      sbGet('subscriptions?select=plan,status,billing_cycle,created_at'),
    ])

    const payments = allPayments ?? []
    const shops    = allShops    ?? []
    const subs     = allSubs     ?? []

    const monthlyRevenue = months.map(m => ({
      label:   m.label,
      revenue: payments
        .filter(p => p.paid_at?.startsWith(m.key))
        .reduce((s: number, p: any) => s + Number(p.amount_pkr), 0),
      newShops: shops
        .filter((s: any) => s.created_at?.startsWith(m.key))
        .length,
    }))

    const cancelledSubs = subs.filter((s: any) => s.status === 'cancelled').length
    const totalPaid     = subs.filter((s: any) => ['active','cancelled','expired'].includes(s.status)).length
    const churnRate     = totalPaid > 0 ? Math.round((cancelledSubs / totalPaid) * 100) : 0

    const activeSubs    = subs.filter((s: any) => s.status === 'active')
    const mrr           = activeSubs.reduce((sum: number, s: any) => {
      const plan = PLANS[s.plan as keyof typeof PLANS]
      if (!plan || !plan.monthlyPkr) return sum
      if (s.billing_cycle === 'monthly') return sum + plan.monthlyPkr
      if (s.billing_cycle === 'yearly' && plan.yearlyPkr) return sum + Math.round(plan.yearlyPkr / 12)
      return sum
    }, 0)

    const revenueByPlan = {
      professional: payments.filter((p: any) => p.plan === 'professional').reduce((s: number, p: any) => s + Number(p.amount_pkr), 0),
      business:     payments.filter((p: any) => p.plan === 'business').reduce((s: number, p: any) => s + Number(p.amount_pkr), 0),
    }

    const revenueByCycle = {
      monthly: payments.filter((p: any) => p.billing_cycle === 'monthly').reduce((s: number, p: any) => s + Number(p.amount_pkr), 0),
      yearly:  payments.filter((p: any) => p.billing_cycle === 'yearly').reduce((s: number, p: any) => s + Number(p.amount_pkr), 0),
    }

    return NextResponse.json({
      monthlyRevenue,
      churnRate,
      mrr,
      revenueByPlan,
      revenueByCycle,
      totalRevenue: payments.reduce((s: number, p: any) => s + Number(p.amount_pkr), 0),
      totalShops:   shops.length,
      activeSubs:   activeSubs.length,
    })
  } catch (e) {
    console.error('[Analytics API] error:', e)
    return NextResponse.json(
      { error: 'Failed to fetch analytics data', detail: String(e) },
      { status: 500 }
    )
  }
}
