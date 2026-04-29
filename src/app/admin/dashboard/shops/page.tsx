// src/app/admin/dashboard/shops/page.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Search, RefreshCw, Store, ChevronDown, CheckCircle2, XCircle,
  AlertCircle, Clock, MessageCircle, Power,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const PLAN_OPTIONS = [
  { value: 'starter|monthly',      label: 'Starter (Free)' },
  { value: 'professional|monthly', label: 'Professional Monthly (Rs.999)' },
  { value: 'professional|yearly',  label: 'Professional Yearly (Rs.9,500)' },
  { value: 'business|monthly',     label: 'Business Monthly' },
  { value: 'business|yearly',      label: 'Business Yearly' },
]

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: LucideIcon }> = {
  active:    { label: 'Active',    color: 'bg-green-900 text-green-400', icon: CheckCircle2 },
  trialing:  { label: 'Trial',     color: 'bg-blue-900 text-blue-400',   icon: Clock },
  expired:   { label: 'Expired',   color: 'bg-red-900 text-red-400',     icon: XCircle },
  grace:     { label: 'Grace',     color: 'bg-amber-900 text-amber-400', icon: AlertCircle },
  cancelled: { label: 'Cancelled', color: 'bg-slate-800 text-slate-500', icon: XCircle },
}

interface Shop {
  id: string
  shop_name: string
  owner_phone: string
  city?: string
  plan: string
  is_active?: boolean
  created_at: string
  subscriptions?: {
    plan: string
    status: string
    billing_cycle?: string | null
    expires_at?: string | null
    trial_ends_at?: string | null
  }[]
  shop_usage?: { orders_this_month: number; customers_total: number; karigar_count: number }[]
}

function formatDate(value?: string | null) {
  if (!value) return 'No expiry'
  return new Date(value).toLocaleDateString('en-PK', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatCycle(value?: string | null) {
  if (!value) return 'Free'
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function ShopCard({
  shop,
  onPlanChange,
  onToggleActive,
}: {
  shop: Shop
  onPlanChange: (shopId: string, planId: string, cycle: string) => Promise<void>
  onToggleActive: (shop: Shop) => Promise<void>
}) {
  const sub = shop.subscriptions?.[0]
  const usage = shop.shop_usage?.[0]
  const status = sub?.status ?? 'active'
  const plan = sub?.plan ?? shop.plan ?? 'starter'
  const isActiveShop = shop.is_active !== false
  const billingCycle = sub?.billing_cycle ?? (plan === 'starter' ? null : 'monthly')
  const expiryDate = sub?.expires_at || sub?.trial_ends_at
  const [now] = useState(() => Date.now())
  const daysLeft = expiryDate
    ? Math.max(0, Math.ceil((new Date(expiryDate).getTime() - now) / 86400000))
    : null
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.active
  const Icon = isActiveShop ? cfg.icon : XCircle

  const [changing, setChanging] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState(false)

  const waLink = `https://wa.me/92${shop.owner_phone.replace(/^0/,'').replace(/\D/g,'')}`

  const handlePlanSelect = async (value: string) => {
    if (!value) return
    const [planId, cycle] = value.split('|')
    const ok = confirm(
      `Change ${shop.shop_name} from ${plan} to ${planId} (${cycle})?\n\n` +
      'This will immediately update their subscription access.'
    )
    if (!ok) return

    setChanging(true)
    setError('')
    setSuccess(false)
    try {
      await onPlanChange(shop.id, planId, cycle)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (e) {
      setError(String(e))
      setTimeout(() => setError(''), 5000)
    } finally {
      setChanging(false)
    }
  }

  return (
    <div className={cn(
      'bg-slate-800 border rounded-2xl overflow-hidden transition-all',
      success ? 'border-green-600' : 'border-slate-700'
    )}>
      <div
        className="flex items-start gap-3 p-4 cursor-pointer hover:bg-slate-700/50"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="w-9 h-9 bg-slate-700 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
          <Store size={16} className="text-slate-400" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-slate-200 text-sm">{shop.shop_name}</p>

            <span className={cn(
              'flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full',
              isActiveShop ? cfg.color : 'bg-red-900 text-red-300'
            )}>
              <Icon size={9} />
              {isActiveShop ? cfg.label : 'Inactive'}
              {daysLeft !== null && ` - ${daysLeft}d`}
            </span>

            <span className={cn(
              'text-[10px] font-bold px-2 py-0.5 rounded-full',
              plan === 'professional' ? 'bg-blue-900 text-blue-300' :
              plan === 'business' ? 'bg-purple-900 text-purple-300' :
              'bg-slate-700 text-slate-400'
            )}>
              {plan}
            </span>

            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
              {formatCycle(billingCycle)}
            </span>
          </div>

          <p className="text-slate-500 text-xs font-mono mt-0.5">{shop.owner_phone}</p>
          <p className="text-slate-500 text-[11px] mt-1">
            Renewal/expiry: <span className="text-slate-300">{formatDate(expiryDate)}</span>
          </p>

          {usage && (
            <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-600">
              <span>{usage.orders_this_month}/mo orders</span>
              <span>{usage.customers_total} customers</span>
              <span>{usage.karigar_count} karigar</span>
            </div>
          )}
        </div>

        <ChevronDown
          size={16}
          className={cn('text-slate-500 shrink-0 transition-transform mt-1', expanded && 'rotate-180')}
        />
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-0 border-t border-slate-700 space-y-3">
          {success && (
            <div className="flex items-center gap-2 bg-green-900/30 border border-green-700 rounded-xl px-3 py-2.5">
              <CheckCircle2 size={14} className="text-green-400" />
              <p className="text-green-300 text-xs font-semibold">Update saved successfully.</p>
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 bg-red-900/30 border border-red-700 rounded-xl px-3 py-2.5">
              <AlertCircle size={14} className="text-red-400" />
              <p className="text-red-300 text-xs">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
              Change Plan
            </label>
            <div className="flex gap-2">
              <select
                disabled={changing}
                defaultValue=""
                onChange={e => handlePlanSelect(e.target.value)}
                className="flex-1 bg-slate-700 text-slate-200 text-sm border border-slate-600 rounded-xl px-3 py-2.5 outline-none focus:border-blue-500 cursor-pointer disabled:opacity-50"
              >
                <option value="">Select new plan...</option>
                {PLAN_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {changing && (
                <div className="w-10 h-10 flex items-center justify-center">
                  <RefreshCw size={16} className="text-blue-400 animate-spin" />
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 bg-green-900/40 border border-green-800 text-green-400 text-xs font-semibold px-3 py-2 rounded-xl hover:bg-green-900/60 transition-colors"
            >
              <MessageCircle size={12} />
              WhatsApp
            </a>
            <button
              type="button"
              disabled={changing}
              onClick={() => onToggleActive(shop)}
              className={cn(
                'flex items-center gap-1.5 border text-xs font-semibold px-3 py-2 rounded-xl transition-colors disabled:opacity-50',
                isActiveShop
                  ? 'bg-red-900/30 border-red-800 text-red-300 hover:bg-red-900/50'
                  : 'bg-green-900/30 border-green-800 text-green-300 hover:bg-green-900/50'
              )}
            >
              <Power size={12} />
              {isActiveShop ? 'Deactivate' : 'Activate'}
            </button>
            <span className="flex items-center text-[10px] text-slate-600 ml-auto">
              ID: {shop.id.slice(0, 8)}...
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AdminShopsPage() {
  const [shops, setShops] = useState<Shop[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/data?type=shops&limit=100')
      if (res.status === 401) { window.location.href = '/admin/login'; return }
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setShops(data.data ?? [])
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handlePlanChange = async (shopId: string, planId: string, cycle: string) => {
    const res = await fetch('/api/admin/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'set_plan', shopId, planId, cycle }),
    })
    const data = await res.json()
    if (!data.success) throw new Error(data.error ?? 'Plan change failed')

    setShops(prev => prev.map(s => {
      if (s.id !== shopId) return s
      return {
        ...s,
        plan: planId,
        subscriptions: [{
          ...s.subscriptions?.[0],
          plan: planId,
          status: 'active',
          billing_cycle: planId === 'starter' ? null : cycle,
        }],
      }
    }))
  }

  const handleToggleActive = async (shop: Shop) => {
    const active = shop.is_active !== false
    const action = active ? 'deactivate_shop' : 'activate_shop'
    const ok = confirm(
      `${active ? 'Deactivate' : 'Activate'} ${shop.shop_name}?\n\n` +
      'This controls account login access only. It will not change the subscription plan or billing status.'
    )
    if (!ok) return

    const res = await fetch('/api/admin/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, shopId: shop.id, reason: 'Manual admin toggle' }),
    })
    const data = await res.json()
    if (!data.success) throw new Error(data.error ?? 'Shop status update failed')

    setShops(prev => prev.map(s => {
      if (s.id !== shop.id) return s
      const nextActive = !active
      return {
        ...s,
        is_active: nextActive,
      }
    }))
  }

  const filtered = shops.filter(s =>
    !query.trim() ||
    s.shop_name.toLowerCase().includes(query.toLowerCase()) ||
    s.owner_phone.includes(query)
  )

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-white">All Shops</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {loading ? 'Loading...' : `${shops.length} total shops`}
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold px-3 py-2 rounded-xl text-sm disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      <div className="relative">
        <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          placeholder="Shop name ya phone..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm outline-none focus:border-blue-500 placeholder:text-slate-600"
        />
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-2xl p-4">
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-slate-800 border border-slate-700 rounded-2xl p-4 animate-pulse h-20" />
          ))}
        </div>
      )}

      {!loading && !error && (
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="text-center py-12">
              <Store size={32} className="text-slate-700 mx-auto mb-3" />
              <p className="text-slate-500">Koi shop nahi mila</p>
            </div>
          ) : (
            filtered.map(shop => (
              <ShopCard
                key={shop.id}
                shop={shop}
                onPlanChange={handlePlanChange}
                onToggleActive={handleToggleActive}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}
