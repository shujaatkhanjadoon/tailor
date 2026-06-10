import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_SESSION_COOKIE, verifySessionToken } from '@/lib/admin/auth'
import { sbGet } from '@/lib/supabase/service'
import { PLANS } from '@/lib/billing/plans'
import { logger } from '@/lib/logger'
import type { SubscriptionPaymentRow, SubscriptionRow, ShopRow } from '@/lib/supabase/types'

export async function GET(req: NextRequest) {
  const token = req.cookies.get(ADMIN_SESSION_COOKIE)?.value
  if (!token || !verifySessionToken(token))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const type = req.nextUrl.searchParams.get('type') ?? 'revenue'
  const format = req.nextUrl.searchParams.get('format') ?? 'json'
  const months = parseInt(req.nextUrl.searchParams.get('months') ?? '12', 10)

  try {
    switch (type) {
      case 'revenue': {
        const payments: SubscriptionPaymentRow[] = await sbGet('subscription_payments?status=eq.completed&select=amount_pkr,paid_at,plan,billing_cycle,shop_id')
        const now = new Date()
        const monthKeys = Array.from({ length: months }, (_, i) => {
          const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1)
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        })

        const data = monthKeys.map(key => {
          const monthPayments = payments.filter(p => p.paid_at?.startsWith(key))
          return {
            month: key,
            revenue: monthPayments.reduce((s, p) => s + Number(p.amount_pkr), 0),
            count: monthPayments.length,
            byPlan: {
              professional: monthPayments.filter(p => p.plan === 'professional').reduce((s, p) => s + Number(p.amount_pkr), 0),
              business: monthPayments.filter(p => p.plan === 'business').reduce((s, p) => s + Number(p.amount_pkr), 0),
            },
          }
        })

        if (format === 'csv') {
          const header = 'Month,Revenue,Transactions,Professional Revenue,Business Revenue\n'
          const rows = data.map(r => `${r.month},${r.revenue},${r.count},${r.byPlan.professional},${r.byPlan.business}`).join('\n')
          return new NextResponse(header + rows, {
            headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="revenue-report-${new Date().toISOString().slice(0, 10)}.csv"` },
          })
        }

        return NextResponse.json({ data })
      }

      case 'subscriptions': {
        const [subsData, paymentsData] = await Promise.all([
          sbGet('subscriptions?select=*'),
          sbGet('subscription_payments?status=eq.completed&select=amount_pkr,paid_at,plan'),
        ])
        const subs = (subsData ?? []) as SubscriptionRow[]
        const payments = (paymentsData ?? []) as SubscriptionPaymentRow[]

        const active = subs.filter(s => s.status === 'active')
        const byPlan = { starter: 0, professional: 0, business: 0 }
        active.forEach(s => { byPlan[s.plan] = (byPlan[s.plan] || 0) + 1 })

        const churned = subs.filter(s => s.status === 'expired' || s.status === 'cancelled')
        const grace = subs.filter(s => s.status === 'grace')

        const data = {
          total: subs.length,
          active: active.length,
          byPlan,
          churned: churned.length,
          grace: grace.length,
          monthlyRevenue: active.reduce((sum, s) => {
            const plan = PLANS[s.plan as keyof typeof PLANS]
            if (!plan?.monthlyPkr) return sum
            return sum + (s.billing_cycle === 'yearly' && plan.yearlyPkr ? Math.round(plan.yearlyPkr / 12) : plan.monthlyPkr)
          }, 0),
        }

        return NextResponse.json({ data })
      }

      case 'shops': {
        const now = new Date()
        const monthKeys = Array.from({ length: months }, (_, i) => {
          const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1)
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        })

        const shops: ShopRow[] = await sbGet('shops?select=id,shop_name,created_at,plan,is_active,city,state_province')

        const data = monthKeys.map(key => ({
          month: key,
          newShops: shops.filter(s => s.created_at?.startsWith(key)).length,
        }))

        const cities: Record<string, number> = {}
        shops.forEach(s => { if (s.city) cities[s.city] = (cities[s.city] || 0) + 1 })

        return NextResponse.json({
          data: {
            total: shops.length,
            active: shops.filter(s => s.is_active).length,
            growth: data,
            cities: Object.entries(cities).sort((a, b) => b[1] - a[1]).slice(0, 20),
          }
        })
      }

      default:
        return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
    }
  } catch (e) {
    logger.error('admin', 'Reports API error', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
