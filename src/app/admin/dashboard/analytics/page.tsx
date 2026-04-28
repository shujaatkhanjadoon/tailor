// src/app/admin/dashboard/analytics/page.tsx
import { createClient } from '@supabase/supabase-js'
import { StatCard }   from '@/components/admin/StatCard'
import {
  TrendingUp, Users, CreditCard,
  Package, BarChart2, Calendar,
} from 'lucide-react'
import { format, subMonths, startOfMonth } from 'date-fns'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function getAnalytics() {
  const now = new Date()

  // Last 6 months revenue
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

  // Monthly revenue breakdown
  const monthlyRevenue = months.map(m => ({
    label:   m.label,
    revenue: payments
      .filter(p => p.paid_at?.startsWith(m.key))
      .reduce((s, p) => s + Number(p.amount_pkr), 0),
    newShops: shops
      .filter(s => s.created_at?.startsWith(m.key))
      .length,
  }))

  // Churn analysis
  const cancelledSubs = subs.filter(s => s.status === 'cancelled').length
  const totalPaid     = subs.filter(s => ['active','cancelled','expired'].includes(s.status)).length
  const churnRate     = totalPaid > 0 ? Math.round((cancelledSubs / totalPaid) * 100) : 0

  // MRR (Monthly Recurring Revenue)
  const activeSubs    = subs.filter(s => s.status === 'active')
  const mrr           = activeSubs.reduce((sum, s) => {
    if (s.plan === 'professional' && s.billing_cycle === 'monthly') return sum + 999
    if (s.plan === 'professional' && s.billing_cycle === 'yearly')  return sum + Math.round(9500/12)
    if (s.plan === 'business'     && s.billing_cycle === 'monthly') return sum + 2499
    if (s.plan === 'business'     && s.billing_cycle === 'yearly')  return sum + Math.round(23999/12)
    return sum
  }, 0)

  // Revenue by plan
  const revenueByPlan = {
    professional: payments.filter(p => p.plan === 'professional').reduce((s, p) => s + Number(p.amount_pkr), 0),
    business:     payments.filter(p => p.plan === 'business').reduce((s, p) => s + Number(p.amount_pkr), 0),
  }

  // Revenue by cycle
  const revenueByCycle = {
    monthly: payments.filter(p => p.billing_cycle === 'monthly').reduce((s, p) => s + Number(p.amount_pkr), 0),
    yearly:  payments.filter(p => p.billing_cycle === 'yearly').reduce((s, p) => s + Number(p.amount_pkr), 0),
  }

  return {
    monthlyRevenue,
    churnRate,
    mrr,
    revenueByPlan,
    revenueByCycle,
    totalRevenue: payments.reduce((s, p) => s + Number(p.amount_pkr), 0),
    totalShops:   shops.length,
    activeSubs:   activeSubs.length,
  }
}

export default async function AnalyticsPage() {
  const data = await getAnalytics()
  const maxRevenue = Math.max(...data.monthlyRevenue.map(m => m.revenue), 1)

  return (
      <div className="space-y-8">

        <div>
          <h1 className="text-2xl font-bold text-white">Analytics</h1>
          <p className="text-slate-400 text-sm mt-1">Revenue, growth, and subscription health</p>
        </div>

        {/* Key metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Revenue"
            value={`Rs. ${(data.totalRevenue / 1000).toFixed(1)}k`}
            icon={TrendingUp}
            color="green"
          />
          <StatCard
            label="MRR"
            value={`Rs. ${data.mrr.toLocaleString()}`}
            sub="Monthly recurring"
            icon={CreditCard}
            color="blue"
          />
          <StatCard
            label="Active Subscriptions"
            value={data.activeSubs}
            sub={`${data.churnRate}% churn rate`}
            icon={Users}
            color="purple"
          />
          <StatCard
            label="Total Shops"
            value={data.totalShops}
            icon={Package}
            color="slate"
          />
        </div>

        {/* Monthly revenue bar chart */}
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6">
          <h2 className="font-bold text-white mb-6 flex items-center gap-2">
            <BarChart2 size={18} className="text-blue-400" />
            Monthly Revenue (Last 6 Months)
          </h2>
          <div className="flex items-end gap-3 h-48">
            {data.monthlyRevenue.map(m => {
              const pct = Math.round((m.revenue / maxRevenue) * 100)
              return (
                <div key={m.label} className="flex-1 flex flex-col items-center gap-2">
                  <p className="text-xs font-bold text-slate-300">
                    {m.revenue > 0 ? `${(m.revenue/1000).toFixed(1)}k` : '—'}
                  </p>
                  <div className="w-full flex items-end" style={{ height: '140px' }}>
                    <div
                      className="w-full bg-blue-600 rounded-t-lg transition-all hover:bg-blue-500"
                      style={{ height: `${Math.max(pct, m.revenue > 0 ? 4 : 0)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 font-medium">{m.label}</p>
                  {m.newShops > 0 && (
                    <p className="text-[9px] text-green-500">+{m.newShops} shops</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Revenue breakdown */}
        <div className="grid lg:grid-cols-2 gap-4">

          {/* By plan */}
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5">
            <h3 className="font-bold text-white mb-4">Revenue by Plan</h3>
            {[
              { label: '⭐ Professional', value: data.revenueByPlan.professional, color: 'bg-blue-600' },
              { label: '👑 Business',     value: data.revenueByPlan.business,     color: 'bg-purple-600' },
            ].map(item => {
              const pct = data.totalRevenue > 0
                ? Math.round((item.value / data.totalRevenue) * 100) : 0
              return (
                <div key={item.label} className="mb-4 last:mb-0">
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-slate-300 font-medium">{item.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 text-xs">{pct}%</span>
                      <span className="font-bold text-white">
                        Rs. {item.value.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full ${item.color} rounded-full`}
                      style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>

          {/* By cycle */}
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5">
            <h3 className="font-bold text-white mb-4">Revenue by Billing Cycle</h3>
            {[
              { label: '📅 Monthly', value: data.revenueByCycle.monthly, color: 'bg-green-600'  },
              { label: '🗓️ Yearly',  value: data.revenueByCycle.yearly,  color: 'bg-amber-600'  },
            ].map(item => {
              const pct = data.totalRevenue > 0
                ? Math.round((item.value / data.totalRevenue) * 100) : 0
              return (
                <div key={item.label} className="mb-4 last:mb-0">
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-slate-300 font-medium">{item.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 text-xs">{pct}%</span>
                      <span className="font-bold text-white">
                        Rs. {item.value.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full ${item.color} rounded-full`}
                      style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
  )
}
