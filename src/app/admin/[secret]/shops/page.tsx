// src/app/admin/[secret]/shops/page.tsx
'use client'

import { use, useEffect, useState, useCallback } from 'react'
import { useRouter }  from 'next/navigation'
import {
  ArrowLeft, Search, RefreshCw,
  CheckCircle2, Clock, XCircle, AlertCircle,
} from 'lucide-react'
import { getAllShops, adminSetPlan } from '@/lib/billing/admin'
import { PLANS, PlanId }            from '@/lib/billing/plans'
import { buildExpiryReminderWhatsApp } from '@/lib/billing/whatsapp-notify'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

const STATUS_CONFIG = {
  trialing: { label: 'Trial',    color: 'bg-blue-100 text-blue-700',   icon: Clock         },
  active:   { label: 'Active',   color: 'bg-green-100 text-green-700', icon: CheckCircle2  },
  cancelled:{ label: 'Cancelled',color: 'bg-slate-100 text-slate-500', icon: XCircle       },
  expired:  { label: 'Expired',  color: 'bg-red-100 text-red-700',     icon: XCircle       },
  grace:    { label: 'Grace',    color: 'bg-amber-100 text-amber-700', icon: AlertCircle   },
}

export default function AdminShopsPage({
  params,
}: {
  params: Promise<{ secret: string }>
}) {
  const { secret } = use(params)
  const router     = useRouter()

  const [shops,   setShops]   = useState<any[]>([])
  const [query,   setQuery]   = useState('')
  const [loading, setLoading] = useState(true)
  const [settingPlan, setSettingPlan] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getAllShops()
      setShops(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = shops.filter(s =>
    !query.trim() ||
    s.shop_name?.toLowerCase().includes(query.toLowerCase()) ||
    s.owner_phone?.includes(query)
  )

  const handleSetPlan = async (shopId: string, planId: PlanId, cycle: string) => {
    if (!confirm(`Set ${planId} (${cycle}) for this shop?`)) return
    setSettingPlan(shopId)
    await adminSetPlan(shopId, planId, cycle)
    setSettingPlan(null)
    await load()
  }

  return (
    <div className="min-h-screen bg-slate-900">
      <header className="border-b border-slate-700 px-6 py-4 flex items-center gap-3 sticky top-0 bg-slate-900 z-10">
        <button
          onClick={() => router.push(`/admin/${secret}`)}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-800"
        >
          <ArrowLeft size={16} className="text-slate-400" />
        </button>
        <div className="flex-1">
          <h1 className="font-bold text-white">All Shops</h1>
          <p className="text-slate-400 text-xs">{shops.length} total</p>
        </div>
        <button onClick={load} disabled={loading}
          className="bg-slate-800 text-slate-300 px-4 py-2 rounded-xl text-sm font-semibold">
          <RefreshCw size={14} className={cn('inline mr-1', loading && 'animate-spin')} />
          Refresh
        </button>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* Search */}
        <div className="relative mb-6">
          <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Shop name ya phone number..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700
                       rounded-xl text-white text-sm outline-none focus:border-blue-500
                       placeholder:text-slate-500"
          />
        </div>

        {/* Shops table */}
        <div className="space-y-3">
          {filtered.map(shop => {
            const sub       = shop.subscriptions?.[0]
            const usage     = shop.shop_usage?.[0]
            const planDef   = PLANS[(sub?.plan ?? 'starter') as PlanId]
            const statusCfg = STATUS_CONFIG[(sub?.status ?? 'active') as keyof typeof STATUS_CONFIG]
            const StatusIcon = statusCfg.icon
            const trialEnd  = sub?.trial_ends_at ? new Date(sub.trial_ends_at) : null
            const expiresAt = sub?.expires_at    ? new Date(sub.expires_at)    : null
            const daysLeft  = trialEnd
              ? Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / 86400000))
              : expiresAt
              ? Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 86400000))
              : null

            return (
              <div
                key={shop.id}
                className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden"
              >
                {/* Main row */}
                <div className="flex items-start gap-4 px-5 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-white">{shop.shop_name}</p>
                      <span className={cn(
                        'flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full',
                        statusCfg.color
                      )}>
                        <StatusIcon size={10} />
                        {statusCfg.label}
                        {daysLeft !== null && ` · ${daysLeft}d`}
                      </span>
                      <span className="text-[10px] font-bold bg-blue-900 text-blue-300
                                       px-2 py-0.5 rounded-full">
                        {planDef.emoji} {planDef.name}
                      </span>
                    </div>
                    <p className="text-slate-400 text-xs mt-1 font-mono">{shop.owner_phone}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-500">
                      <span>📋 {usage?.orders_this_month ?? 0} orders/mo</span>
                      <span>👥 {usage?.customers_total ?? 0} customers</span>
                      <span>✂️ {usage?.karigar_count ?? 0} karigar</span>
                      {sub?.amount_pkr > 0 && (
                        <span>💰 Rs. {Number(sub.amount_pkr).toLocaleString()}</span>
                      )}
                    </div>
                  </div>

                  {/* Quick actions */}
                  <div className="flex flex-col gap-1.5 shrink-0">
                    {/* WhatsApp */}
                    {shop.owner_phone && (
                      <a
                        href={buildExpiryReminderWhatsApp(
                          shop.owner_phone,
                          shop.shop_name,
                          planDef.name,
                          daysLeft ?? 0,
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] font-bold bg-green-900/50 text-green-400
                                   border border-green-700 px-2 py-1 rounded-lg hover:bg-green-900 transition-colors"
                      >
                        💬 WA
                      </a>
                    )}

                    {/* Manual plan set */}
                    <select
                      onChange={e => {
                        const [p, c] = e.target.value.split('|')
                        if (p && c) handleSetPlan(shop.id, p as PlanId, c)
                        e.target.value = ''
                      }}
                      disabled={settingPlan === shop.id}
                      className="text-[10px] bg-slate-700 text-slate-300 border border-slate-600
                                 rounded-lg px-2 py-1 outline-none cursor-pointer"
                    >
                      <option value="">Set Plan...</option>
                      <option value="starter|monthly">Starter (Free)</option>
                      <option value="professional|monthly">Pro Monthly</option>
                      <option value="professional|yearly">Pro Yearly</option>
                      <option value="business|monthly">Business Monthly</option>
                      <option value="business|yearly">Business Yearly</option>
                    </select>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}