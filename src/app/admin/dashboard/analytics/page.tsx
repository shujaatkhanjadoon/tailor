// src/app/admin/dashboard/analytics/page.tsx
import { cookies } from 'next/headers'
import { StatCard }   from '@/components/admin/StatCard'
import { formatRupees } from '@/lib/format/currency'
import {
  TrendingUp, Users, CreditCard,
  Package, BarChart2, Calendar,
} from 'lucide-react'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'

type AnalyticsData = {
  monthlyRevenue: { label: string; revenue: number; newShops: number }[]
  churnRate: number
  mrr: number
  revenueByPlan: { professional: number; business: number }
  revenueByCycle: { monthly: number; yearly: number }
  totalRevenue: number
  totalShops: number
  activeSubs: number
}

async function getAnalytics(): Promise<AnalyticsData> {
  const cookieStore = await cookies()
  const res = await fetch(`${BASE_URL}/api/admin/analytics`, {
    headers: { Cookie: cookieStore.toString() },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error('Failed to fetch analytics')
  return res.json() as Promise<AnalyticsData>
}

export default async function AnalyticsPage() {
  const data = await getAnalytics()
  const maxRevenue = Math.max(...data.monthlyRevenue.map(m => m.revenue), 1)

  return (
      <div className="space-y-6 sm:space-y-8">

        <div>
          <h1 className="text-2xl font-bold text-white">Analytics</h1>
          <p className="text-slate-400 text-sm mt-1">Revenue, growth, and subscription health</p>
        </div>

        {/* Key metrics */}
        <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:gap-4 xl:grid-cols-4">
          <StatCard
            label="Total Revenue"
            value={formatRupees(data.totalRevenue)}
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
        <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 p-4 sm:p-6">
          <h2 className="font-bold text-white mb-6 flex items-center gap-2">
            <BarChart2 size={18} className="text-blue-400" />
            Monthly Revenue (Last 6 Months)
          </h2>
          <div className="flex h-48 items-end gap-2 overflow-x-auto pb-1 sm:gap-3">
            {data.monthlyRevenue.map(m => {
              const pct = Math.round((m.revenue / maxRevenue) * 100)
              return (
                <div key={m.label} className="flex min-w-12 flex-1 flex-col items-center gap-2">
                  <p className="text-xs font-bold text-slate-300">
                    {m.revenue > 0 ? formatRupees(m.revenue) : '—'}
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
        <div className="grid gap-4 lg:grid-cols-2">

          {/* By plan */}
          <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4 sm:p-5">
            <h3 className="font-bold text-white mb-4">Revenue by Plan</h3>
            {[
              { label: 'Professional', value: data.revenueByPlan.professional, color: 'bg-blue-600' },
              { label: 'Business',     value: data.revenueByPlan.business,     color: 'bg-purple-600' },
            ].map(item => {
              const pct = data.totalRevenue > 0
                ? Math.round((item.value / data.totalRevenue) * 100) : 0
              return (
                <div key={item.label} className="mb-4 last:mb-0">
                  <div className="mb-1.5 flex flex-col gap-1 text-sm min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
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
          <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4 sm:p-5">
            <h3 className="font-bold text-white mb-4">Revenue by Billing Cycle</h3>
            {[
              { label: 'Monthly', value: data.revenueByCycle.monthly, color: 'bg-green-600'  },
              { label: 'Yearly',  value: data.revenueByCycle.yearly,  color: 'bg-amber-600'  },
            ].map(item => {
              const pct = data.totalRevenue > 0
                ? Math.round((item.value / data.totalRevenue) * 100) : 0
              return (
                <div key={item.label} className="mb-4 last:mb-0">
                  <div className="mb-1.5 flex flex-col gap-1 text-sm min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
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
