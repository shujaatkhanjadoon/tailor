// src/app/track/[code]/page.tsx
'use client'

import { use, useEffect, useState } from 'react'
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  PackageCheck,
  RefreshCw,
  Search,
  Shirt,
  StickyNote,
  UserRound,
  Wallet,
} from 'lucide-react'
import type { OrderRecord }      from '@/lib/db/schema'
import { ORDER_STATUS_CONFIG, GARMENT_LABELS } from '@/types'
import { isValidTrackingCode, normaliseCode } from '@/lib/tracking'
import { cn }                   from '@/lib/utils'
import { supabase } from '@/lib/supabase/client'
import { mapOrder } from '@/lib/supabase/records'
import Image from 'next/image'
import { recipientLabel } from '@/lib/order-recipient'

const STATUS_STEPS = ['received','cutting','stitching','finishing','ready','delivered'] as const
type Step = typeof STATUS_STEPS[number]
const STATUS_ACCENT = '#2563eb'
type Branding = {
  name: string
  color: string
  logoUrl: string
}

function formatTrackDate(date: string) {
  return new Intl.DateTimeFormat('en-PK', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Karachi',
  }).format(new Date(`${date}T00:00:00+05:00`))
}

export default function TrackPage({ params }: { params: Promise<{ code: string }> }) {
  const { code }    = use(params)
  const normCode    = normaliseCode(code)

  const [order,     setOrder]    = useState<OrderRecord | null>(null)
  const [shopName,  setShopName] = useState('')
  const [branding,  setBranding] = useState<Branding>({
    name: '',
    color: '#1d4ed8',
    logoUrl: '',
  })
  const [loading,   setLoading]  = useState(true)
  const [error,     setError]    = useState<'invalid' | 'not_found' | null>(null)

  const loadOrder = async () => {
    setLoading(true)
    setError(null)

    if (!isValidTrackingCode(normCode)) {
      setError('invalid')
      setLoading(false)
      return
    }

    try {
      const { data: remote } = await (supabase as any)
        .from('orders')
        .select('*, shops(shop_name, brand_name, brand_color, brand_logo_url)')
        .eq('tracking_code', normCode)
        .is('deleted_at', null)
        .maybeSingle()

      if (remote) {
        setOrder(mapOrder(remote))
        const shop = remote.shops
        setShopName(shop?.brand_name ?? shop?.shop_name ?? '')
        setBranding({
          name: shop?.brand_name ?? shop?.shop_name ?? 'MeraDarzi',
          color: shop?.brand_color ?? '#1d4ed8',
          logoUrl: shop?.brand_logo_url ?? '',
        })
      } else {
        setError('not_found')
      }
    } catch (e) {
      console.error('Track error:', e)
      setError('not_found')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadOrder() }, [normCode])

  useEffect(() => {
    if (!isValidTrackingCode(normCode)) return
    const channel = supabase
      .channel(`public-track-${normCode}-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `tracking_code=eq.${normCode}` }, loadOrder)
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [normCode])

 if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6">
        <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-white p-6 text-center shadow-2xl shadow-slate-950/30">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50">
            <Image src="/icon.svg" alt="MeraDarzi" width={48} height={48} />
          </div>
          <div className="mx-auto mb-4 h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          <p className="text-sm font-bold text-slate-800">Order dhoondh raha hai</p>
          <p className="mt-1 font-mono text-xs text-slate-400">{normCode}</p>
        </div>
      </div>
    )
  }

 if (error || !order) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6 text-center">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/10">
          {error === 'invalid'
            ? <Search size={28} className="text-white" />
            : <AlertCircle size={28} className="text-white" />
          }
        </div>
        <h1 className="mb-2 text-xl font-bold text-white">
          {error === 'invalid' ? 'Galat Link' : 'Order Nahi Mila'}
        </h1>
        <p className="mb-3 max-w-xs text-sm leading-relaxed text-slate-300">
          {error === 'invalid'
            ? 'Yeh tracking link sahi nahi hai. Apne darzi se dobara link maangein.'
            : 'Order mil nahi raha. Thodi der baad dobara try karein.'}
        </p>
        <code className="mb-6 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 font-mono text-xs text-slate-200">
          {normCode}
        </code>
        <button
          onClick={loadOrder}
          className="flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-bold text-slate-950 transition-transform active:scale-95"
        >
          <RefreshCw size={15} />
          Dobara Try Karein
        </button>
        <div className="mt-10 flex items-center gap-2 text-white/70">
          <Image src="/icon.svg" alt="MeraDarzi" width={24} height={24} />
          <span className="text-sm font-bold">MeraDarzi</span>
        </div>
      </div>
    )
  }

  const sc          = ORDER_STATUS_CONFIG[order.status as keyof typeof ORDER_STATUS_CONFIG]
  const gc          = GARMENT_LABELS[order.garmentType as keyof typeof GARMENT_LABELS]
  const stepIdx     = STATUS_STEPS.indexOf(order.status as Step)
  const isCancelled = order.status === 'cancelled'
  const isDelivered = order.status === 'delivered'
  const totalAmount = Number(order.totalPrice ?? 0)
  const advancePaid = Number(order.amountPaid ?? 0)
  const remainingBalance = Math.max(0, totalAmount - advancePaid)
  const orderForText = order.orderForRelation && order.orderForRelation !== 'self'
    ? recipientLabel(order.orderForRelation, order.orderForName)
    : 'Self'

  const statusDesc: Record<string, string> = {
    received:  'Aapka kapra hamare paas aa gaya hai',
    cutting:   'Kapra kaat raha hai',
    stitching: 'Silai ho rahi hai',
    finishing: 'Finishing ho rahi hai',
    ready:     'Bilkul tayyar! — Aa jaiye dukaan par',
    delivered: 'Order de diya gaya. Shukriya!',
    cancelled: 'Yeh order cancel ho gaya',
  }
  const brandColor = branding.color || STATUS_ACCENT
  const visibleSteps = STATUS_STEPS.filter(s => s !== 'delivered')
  const progressPct = isCancelled
    ? 100
    : isDelivered
      ? 100
      : Math.max(8, ((Math.max(stepIdx, 0) + 1) / visibleSteps.length) * 100)
  const paymentPct = totalAmount > 0 ? Math.min(100, Math.round((advancePaid / totalAmount) * 100)) : 0

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <section
        className="relative overflow-hidden px-5 pb-28 pt-10 text-white"
        style={{ background: `linear-gradient(140deg, ${brandColor}, #0f172a 72%)` }}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/15 ring-1 ring-white/20">
              {branding.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={branding.logoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <Image src="/icon.svg" alt="MeraDarzi" width={40} height={40} />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{branding.name || shopName || 'MeraDarzi'}</p>
              <p className="text-xs text-white/65">Order tracking</p>
            </div>
          </div>
          <code className="shrink-0 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 font-mono text-xs text-white/80">
            {order.trackingCode ?? normCode}
          </code>
        </div>

        <div className="mx-auto mt-10 grid max-w-5xl gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-900 shadow-lg shadow-slate-950/10">
              {isCancelled ? <AlertCircle size={14} /> : isDelivered ? <PackageCheck size={14} /> : <Clock3 size={14} />}
              {isCancelled ? 'Cancelled' : isDelivered ? 'Delivered' : 'In progress'}
            </div>
            <h1 className="max-w-2xl text-3xl font-black leading-tight sm:text-4xl">
              {sc?.label ?? 'Order Status'}
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/75 sm:text-base">
              {statusDesc[order.status]}
            </p>
          </div>

          <div className="rounded-3xl border border-white/15 bg-white/10 p-4 shadow-2xl shadow-slate-950/20 backdrop-blur">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white p-4 text-slate-900">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Order</p>
                <p className="mt-1 text-xl font-black">#{String(order.orderNumber).padStart(3,'0')}</p>
              </div>
              <div className="rounded-2xl bg-white p-4 text-slate-900">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Due Date</p>
                <p className="mt-1 text-sm font-black">{formatTrackDate(order.dueDate)}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto -mt-20 max-w-5xl px-4 pb-12">
        <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/70">
            <div className="border-b border-slate-100 p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Live progress</p>
                  <h2 className="mt-1 text-lg font-black text-slate-900">{statusDesc[order.status]}</h2>
                </div>
                <button
                  onClick={loadOrder}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50"
                  aria-label="Refresh status"
                >
                  <RefreshCw size={15} />
                </button>
              </div>

              {!isCancelled && (
                <div className="mt-6">
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${progressPct}%`, backgroundColor: brandColor }}
                    />
                  </div>
                  <div className="mt-5 grid grid-cols-5 gap-2">
                    {visibleSteps.map((s, i) => {
                      const cfg = ORDER_STATUS_CONFIG[s]
                      const isDone = isDelivered || stepIdx > i
                      const isCurr = !isDelivered && stepIdx === i
                      return (
                        <div key={s} className="min-w-0 text-center">
                          <div
                            className={cn(
                              'mx-auto flex h-9 w-9 items-center justify-center rounded-full border text-sm font-black',
                              isDone || isCurr
                                ? 'border-transparent text-white'
                                : 'border-slate-200 bg-slate-50 text-slate-300'
                            )}
                            style={isDone || isCurr ? { backgroundColor: brandColor } : undefined}
                          >
                            {isDone ? <CheckCircle2 size={17} /> : cfg?.emoji}
                          </div>
                          <p className={cn(
                            'mt-2 truncate text-[10px] font-bold',
                            isDone || isCurr ? 'text-slate-800' : 'text-slate-300'
                          )}>
                            {cfg?.label}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {order.status === 'ready' && (
              <div className="border-b border-emerald-100 bg-emerald-50 px-5 py-4 sm:px-6">
                <p className="flex items-center gap-2 text-sm font-black text-emerald-800">
                  <PackageCheck size={17} />
                  Tayyar hai. Dukaan mein aa kar apna kapra le jaiye.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              {[
                { icon: UserRound, label:'Order For', value: orderForText },
                { icon: Shirt, label:'Kapra', value: gc ? `${gc.emoji} ${gc.label}` : order.garmentType },
                { icon: CalendarDays, label:'Due Date', value: formatTrackDate(order.dueDate) },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="p-5">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                    <Icon size={16} />
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
                  <p className="mt-1 text-sm font-black leading-snug text-slate-800">{value}</p>
                </div>
              ))}
            </div>
          </section>

          <aside className="space-y-4">
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                  <Wallet size={15} className="text-emerald-600" />
                  Payment
                </p>
                <p className={cn(
                  'rounded-full px-3 py-1 text-xs font-black',
                  remainingBalance > 0 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
                )}>
                  {remainingBalance > 0 ? 'Balance due' : 'Paid'}
                </p>
              </div>
              <div className="space-y-3">
                {[
                  { label: 'Total', value: totalAmount, color: 'text-slate-900' },
                  { label: 'Advance', value: advancePaid, color: 'text-emerald-700' },
                  { label: 'Balance', value: remainingBalance, color: remainingBalance > 0 ? 'text-red-600' : 'text-slate-400' },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-400">{item.label}</span>
                    <span className={cn('text-sm font-black', item.color)}>Rs. {item.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={cn('h-full rounded-full', paymentPct === 100 ? 'bg-emerald-500' : 'bg-amber-500')}
                  style={{ width: `${paymentPct}%` }}
                />
              </div>
            </section>

            {order.specialInstructions && (
              <section className="rounded-3xl border border-amber-200 bg-white p-5 shadow-sm">
                <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-amber-700">
                  <StickyNote size={15} />
                  Notes
                </p>
                <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
                  {order.specialInstructions}
                </p>
              </section>
            )}
          </aside>
        </div>

        <button
          onClick={loadOrder}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-3.5 text-sm font-bold text-slate-600 shadow-sm transition-colors hover:bg-slate-50 active:scale-[0.98]"
        >
          <RefreshCw size={14} />
          Status Refresh Karein
        </button>

        <footer className="pt-8 text-center">
          <div className="mb-1 flex items-center justify-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-md bg-blue-600">
              {branding.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={branding.logoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <Image src="/icon.svg" alt="MeraDarzi" width={20} height={20} />
              )}
            </div>
            <span className="text-sm font-bold text-slate-700">{branding.name || 'MeraDarzi'}</span>
          </div>
          <p className="text-xs text-slate-400">Powered by MeraDarzi</p>
        </footer>
      </main>
    </div>
  )
}
