// src/app/api/admin/analytics/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken, ADMIN_SESSION_COOKIE } from '@/lib/admin/auth'
import { format, subMonths, startOfMonth } from 'date-fns'
import { PLANS } from '@/lib/billing/plans'
import { sbGet } from '@/lib/supabase/service'
import type { SubscriptionPaymentRow, SubscriptionRow, ShopRow } from '@/lib/supabase/types'
import { logger } from '@/lib/logger'

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
      sbGet('subscription_payments?select=amount_pkr,status,paid_at,plan,billing_cycle,shop_id&status=eq.completed') as Promise<SubscriptionPaymentRow[]>,
      sbGet('shops?select=id,created_at&order=created_at.asc') as Promise<ShopRow[]>,
      sbGet('subscriptions?select=plan,status,billing_cycle,created_at') as Promise<SubscriptionRow[]>,
    ])

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
      const plan = PLANS[s.plan as keyof typeof PLANS]
      if (!plan || !plan.monthlyPkr) return sum
      if (s.billing_cycle === 'monthly') return sum + plan.monthlyPkr
      if (s.billing_cycle === 'yearly' && plan.yearlyPkr) return sum + Math.round(plan.yearlyPkr / 12)
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
  } catch (e) {
    logger.error('admin', 'Analytics API error', e)
    return NextResponse.json(
      { error: 'Failed to fetch analytics data' },
      { status: 500 }
    )
  }
}
