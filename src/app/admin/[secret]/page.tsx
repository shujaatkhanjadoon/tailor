// src/app/admin/[secret]/page.tsx
import { notFound }   from 'next/navigation'
import { AdminShell } from '@/components/admin/AdminShell'
import { StatCard }   from '@/components/admin/StatCard'
import {
  TrendingUp, Users, CreditCard,
  Clock, AlertCircle, ShoppingBag,
  CheckCircle2, Store,
} from 'lucide-react'
import { getRevenueSummary, getPendingPayments, getAllShops } from '@/lib/billing/admin'
import Link   from 'next/link'
import { format } from 'date-fns'

export default async function AdminDashboard({
  params,
}: {
  params: Promise<{ secret: string }>
}) {
  const { secret } = await params
  if (secret !== process.env.ADMIN_SECRET) notFound()

  const [summary, pending, allShops] = await Promise.all([
    getRevenueSummary(),
    getPendingPayments(),
    getAllShops(),
  ])

  // Plan distribution
  const planCounts = allShops.reduce((acc: Record<string, number>, shop: any) => {
    const plan = shop.subscriptions?.[0]?.plan ?? 'starter'
    acc[plan] = (acc[plan] || 0) + 1
    return acc
  }, {})

  // Recent shops (last 10)
  const recentShops = allShops.slice(0, 8)

  return (
    <AdminShell secret={secret}>
      <div className="space-y-8">

        {/* Page title */}
        <div>
          <h1 className="text-2xl font-bold text-white">Platform Overview</h1>
          <p className="text-slate-400 text-sm mt-1">
            Last updated: {format(new Date(), 'd MMM yyyy, h:mm a')}
          </p>
        </div>

        {/* Pending alert */}
        {pending.length > 0 && (
          <div className="bg-amber-900/30 border-2 border-amber-600 rounded-2xl
                          px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle size={22} className="text-amber-400 shrink-0" />
              <div>
                <p className="font-bold text-amber-300">
                  {pending.length} payment{pending.length > 1 ? 's' : ''} awaiting verification
                </p>
                <p className="text-amber-500 text-xs mt-0.5">
                  Shop owners are waiting for activation
                </p>
              </div>
            </div>
            <Link
              href={`/admin/${secret}/payments`}
              className="bg-amber-500 hover:bg-amber-400 text-amber-900
                         font-bold px-5 py-2.5 rounded-xl text-sm transition-colors"
            >
              Verify Now →
            </Link>
          </div>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Revenue"
            value={`Rs. ${(summary.total / 1000).toFixed(1)}k`}
            sub={`Rs. ${summary.thisMonthRevenue.toLocaleString()} this month`}
            icon={TrendingUp}
            color="green"
          />
          <StatCard
            label="Active Subscriptions"
            value={summary.activeSubscriptions}
            sub={`${summary.trialing} on trial`}
            icon={CheckCircle2}
            color="blue"
          />
          <StatCard
            label="Total Shops"
            value={allShops.length}
            sub={`${planCounts.professional ?? 0} Pro · ${planCounts.business ?? 0} Biz`}
            icon={Store}
            color="purple"
          />
          <StatCard
            label="Pending Payments"
            value={pending.length}
            sub={pending.length > 0 ? 'Action required' : 'All clear'}
            icon={CreditCard}
            color={pending.length > 0 ? 'amber' : 'slate'}
          />
        </div>

        {/* Plan distribution */}
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5">
          <h2 className="font-bold text-white mb-4">Plan Distribution</h2>
          <div className="grid grid-cols-3 gap-4">
            {[
              { plan: 'starter',      emoji: '🌱', color: 'bg-slate-700' },
              { plan: 'professional', emoji: '⭐', color: 'bg-blue-700'  },
              { plan: 'business',     emoji: '👑', color: 'bg-purple-700' },
            ].map(({ plan, emoji, color }) => {
              const count = planCounts[plan] ?? 0
              const pct   = allShops.length > 0
                ? Math.round((count / allShops.length) * 100)
                : 0
              return (
                <div key={plan} className="text-center">
                  <p className="text-2xl mb-1">{emoji}</p>
                  <p className="text-2xl font-bold text-white">{count}</p>
                  <p className="text-slate-400 text-xs capitalize">{plan}</p>
                  <div className="h-1.5 bg-slate-800 rounded-full mt-2 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full', color)}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-slate-600 text-[10px] mt-1">{pct}%</p>
                </div>
              )
            })}
          </div>
        </div>

        {/* Recent shops */}
        <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
            <h2 className="font-bold text-white">Recently Joined Shops</h2>
            <Link
              href={`/admin/${secret}/shops`}
              className="text-blue-400 text-xs font-semibold hover:text-blue-300"
            >
              View All →
            </Link>
          </div>
          <div className="divide-y divide-slate-800">
            {recentShops.map((shop: any) => {
              const sub    = shop.subscriptions?.[0]
              const status = sub?.status ?? 'none'
              return (
                <div key={shop.id}
                  className="flex items-center justify-between px-5 py-3.5">
                  <div>
                    <p className="font-semibold text-slate-200 text-sm">
                      {shop.shop_name}
                    </p>
                    <p className="text-slate-500 text-xs font-mono">
                      {shop.owner_phone}
                      {shop.city ? ` · ${shop.city}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-[10px] font-bold px-2 py-1 rounded-full',
                      status === 'active'   ? 'bg-green-900 text-green-400' :
                      status === 'trialing' ? 'bg-blue-900  text-blue-400'  :
                      status === 'expired'  ? 'bg-red-900   text-red-400'   :
                                             'bg-slate-800  text-slate-500'
                    )}>
                      {status}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {sub?.plan ?? 'starter'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </AdminShell>
  )
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}