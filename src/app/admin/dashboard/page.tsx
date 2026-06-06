// src/app/admin/dashboard/page.tsx
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter }           from 'next/navigation'
import {
  TrendingUp, CreditCard,
  AlertCircle, Store, CheckCircle2,
  RefreshCw, ArrowRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatRupees } from '@/lib/format/currency'
import { DashboardSkeleton } from '@/components/ui/Skeleton'

interface Summary {
  total:                number
  thisMonthRevenue:     number
  activeSubscriptions:  number
  trialing:             number
}

interface PendingPayment {
  id:       string
  shop_id:  string
  plan:     string
  amount_pkr: number
  paid_at:  string
  shops:    { shop_name: string; owner_phone: string } | null
}

interface PendingVerification {
  id: string
  shop_id: string
  owner_name: string
  owner_phone: string
  shop_name?: string
  requested_at: string
}

interface Shop {
  id:         string
  shop_name:  string
  owner_phone: string
  plan:       string
  is_active?: boolean
  verification_status?: string
  created_at: string
  subscriptions: { plan: string; status: string }[]
}

function StatCard({
  label, value, sub, icon: Icon, color = 'slate',
}: {
  label: string
  value: string | number
  sub?:  string
  icon:  React.ElementType
  color?: 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'slate'
}) {
  const colors = {
    blue:   { bg: 'bg-blue-950',   iconBg: 'bg-blue-900',   iconCol: 'text-blue-400',   val: 'text-blue-100'   },
    green:  { bg: 'bg-green-950',  iconBg: 'bg-green-900',  iconCol: 'text-green-400',  val: 'text-green-100'  },
    amber:  { bg: 'bg-amber-950',  iconBg: 'bg-amber-900',  iconCol: 'text-amber-400',  val: 'text-amber-100'  },
    red:    { bg: 'bg-red-950',    iconBg: 'bg-red-900',    iconCol: 'text-red-400',    val: 'text-red-100'    },
    purple: { bg: 'bg-purple-950', iconBg: 'bg-purple-900', iconCol: 'text-purple-400', val: 'text-purple-100' },
    slate:  { bg: 'bg-slate-900',  iconBg: 'bg-slate-800',  iconCol: 'text-slate-400',  val: 'text-slate-100'  },
  }
  const c = colors[color]

  return (
    <div className={cn('rounded-2xl border border-slate-800 p-4 lg:p-5', c.bg)}>
      <div className={cn(
        'w-9 h-9 lg:w-10 lg:h-10 rounded-xl flex items-center justify-center mb-3 lg:mb-4',
        c.iconBg
      )}>
        <Icon size={17} className={c.iconCol} />
      </div>
      <p className={cn('text-xl lg:text-2xl font-bold mb-0.5', c.val)}>{value}</p>
      <p className="text-slate-500 text-xs font-medium">{label}</p>
      {sub && <p className="text-slate-600 text-[10px] mt-1">{sub}</p>}
    </div>
  )
}

export default function AdminDashboardPage() {
  const router  = useRouter()
  const [summary,  setSummary]  = useState<Summary | null>(null)
  const [pending,  setPending]  = useState<PendingPayment[]>([])
  const [pendingVerifications, setPendingVerifications] = useState<PendingVerification[]>([])
  const [shops,    setShops]    = useState<Shop[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')

  const cancelledRef = useRef(false)
  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [sumRes, pendRes, shopRes, verifyRes] = await Promise.all([
        fetch('/api/admin/data?type=summary'),
        fetch('/api/admin/data?type=pending'),
        fetch('/api/admin/data?type=shops&limit=8'),
        fetch('/api/admin/data?type=pending_verifications'),
      ])

      if (cancelledRef.current) return

      if (sumRes.status === 401) {
        window.location.href = '/admin/login'
        return
      }

      const [sumData, pendData, shopData, verifyData] = await Promise.all([
        sumRes.json(), pendRes.json(), shopRes.json(), verifyRes.json(),
      ])

      if (!cancelledRef.current) {
        setSummary(sumData.data ?? { total: 0, thisMonthRevenue: 0, activeSubscriptions: 0, trialing: 0 })
        setPending(pendData.data ?? [])
        setPendingVerifications(verifyData.data ?? [])
        setShops(shopData.data ?? [])
      }
    } catch {
      if (!cancelledRef.current) setError('Data load nahi ho saka. Page refresh karein.')
    } finally {
      if (!cancelledRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    return () => { cancelledRef.current = true }
  }, [load])

  if (loading) {
    return <DashboardSkeleton />
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="bg-red-900/30 border border-red-700 rounded-2xl p-6 max-w-md text-center">
          <AlertCircle size={32} className="text-red-400 mx-auto mb-3" />
          <p className="text-red-300 font-semibold mb-2">Error</p>
          <p className="text-red-400/70 text-sm mb-4">{error}</p>
          <button
            onClick={load}
            className="bg-red-700 text-red-200 font-semibold px-5 py-2.5 rounded-xl text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 sm:space-y-6">

      {/* Title */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-white">Platform Overview</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {new Date().toLocaleDateString('en-PK', {
              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
            })}
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700
                     text-slate-300 font-semibold px-3 py-2 rounded-xl text-sm transition-colors"
        >
          <RefreshCw size={14} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* Pending alert */}
      {pending.length > 0 && (
        <div className="bg-amber-900/30 border-2 border-amber-600 rounded-2xl
                        p-4 flex flex-col sm:flex-row items-start sm:items-center
                        justify-between gap-3">
          <div className="flex items-center gap-3">
            <AlertCircle size={20} className="text-amber-400 shrink-0" />
            <div>
              <p className="font-bold text-amber-300 text-sm">
                {pending.length} payment{pending.length > 1 ? 's' : ''} pending
              </p>
              <p className="text-amber-500/70 text-xs">
                Shop owners are waiting
              </p>
            </div>
          </div>
          <button
            onClick={() => router.push('/admin/dashboard/payments')}
            className="w-full sm:w-auto bg-amber-500 hover:bg-amber-400 text-amber-900
                       font-bold px-4 py-2.5 rounded-xl text-sm transition-colors"
          >
            Verify Now →
          </button>
        </div>
      )}

      {/* Pending shop verification alert */}
      {pendingVerifications.length > 0 && (
        <div className="bg-amber-900/30 border-2 border-amber-600 rounded-2xl
                        p-4 flex flex-col sm:flex-row items-start sm:items-center
                        justify-between gap-3">
          <div className="flex items-center gap-3">
            <AlertCircle size={20} className="text-amber-400 shrink-0" />
            <div>
              <p className="font-bold text-amber-300 text-sm">
                {pendingVerifications.length} new shop verification
                {pendingVerifications.length > 1 ? 's' : ''} pending
              </p>
              <p className="text-amber-500/70 text-xs">
                Naye account owners approve/reject karne ke liye
              </p>
            </div>
          </div>
          <button
            onClick={() => router.push('/admin/dashboard/shops')}
            className="w-full sm:w-auto bg-amber-500 hover:bg-amber-400 text-amber-900
                       font-bold px-4 py-2.5 rounded-xl text-sm transition-colors"
          >
            Review Shops →
          </button>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-1 min-[420px]:grid-cols-2 xl:grid-cols-4 gap-3 lg:gap-4">
        <StatCard
          label="Total Revenue"
          value={formatRupees(summary?.total ?? 0)}
          sub={`${formatRupees(summary?.thisMonthRevenue ?? 0)} this month`}
          icon={TrendingUp}
          color="green"
        />
        <StatCard
          label="Active Subs"
          value={summary?.activeSubscriptions ?? 0}
          sub={`${summary?.trialing ?? 0} on trial`}
          icon={CheckCircle2}
          color="blue"
        />
        <StatCard
          label="Total Shops"
          value={shops.length}
          icon={Store}
          color="purple"
        />
        <StatCard
          label="Pending"
          value={pending.length + pendingVerifications.length}
          sub={pending.length + pendingVerifications.length > 0 ? 'Needs review' : 'All clear'}
          icon={CreditCard}
          color={pending.length + pendingVerifications.length > 0 ? 'amber' : 'slate'}
        />
      </div>

      {/* Recent shops */}
      <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 lg:px-5 py-4
                        border-b border-slate-800">
          <h2 className="font-bold text-white text-sm lg:text-base">Recent Shops</h2>
          <button
            onClick={() => router.push('/admin/dashboard/shops')}
            className="flex items-center gap-1.5 text-blue-400 text-xs font-semibold
                       hover:text-blue-300 transition-colors"
          >
            View All <ArrowRight size={12} />
          </button>
        </div>

        {/* Mobile: card view, Desktop: table-like rows */}
        <div className="divide-y divide-slate-800">
          {shops.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-8">
              Koi shop nahi mila
            </p>
          ) : shops.map(shop => {
            const sub    = shop.subscriptions?.[0]
            const plan   = sub?.plan   ?? 'starter'
            const verif  = shop.verification_status ?? 'pending'
            const active = shop.is_active !== false && verif === 'approved'
            const status = !active
              ? verif === 'rejected' ? 'rejected' : 'unverified'
              : sub?.status ?? 'active'

            return (
              <div
                key={shop.id}
                className="flex flex-col gap-3 px-4 py-3.5 transition-colors hover:bg-slate-800/50 min-[520px]:flex-row min-[520px]:items-center min-[520px]:justify-between lg:px-5"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-200 text-sm truncate">
                    {shop.shop_name}
                  </p>
                  <p className="text-slate-500 text-xs font-mono truncate">
                    {shop.owner_phone}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2 min-[520px]:ml-3 min-[520px]:justify-end">
                  <span className={cn(
                    'text-[10px] font-bold px-2 py-1 rounded-full hidden sm:block',
                    plan === 'professional' ? 'bg-blue-900 text-blue-300' :
                    plan === 'business'     ? 'bg-purple-900 text-purple-300' :
                                             'bg-slate-800 text-slate-400'
                  )}>
                    {plan}
                  </span>
                  <span className={cn(
                    'text-[10px] font-bold px-2 py-1 rounded-full',
                    status === 'active'   ? 'bg-green-900 text-green-400' :
                    status === 'trialing' ? 'bg-blue-900  text-blue-400'  :
                    status === 'expired'  ? 'bg-red-900   text-red-400'   :
                    status === 'rejected' ? 'bg-red-900   text-red-400'   :
                    status === 'unverified' ? 'bg-amber-900 text-amber-400' :
                                           'bg-slate-800  text-slate-500'
                  )}>
                    {status}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
