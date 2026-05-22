// src/app/track/[code]/page.tsx
'use client'

import { use, useCallback, useEffect, useState } from 'react'
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Circle,
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
import { SpecialInstructionsSummary } from '@/components/orders/SpecialInstructionsSummary'

const STATUS_STEPS = ['received','cutting','stitching','finishing','ready','delivered'] as const
type Step = typeof STATUS_STEPS[number]
const STATUS_ACCENT = '#2563eb'
type Branding = {
  name: string
  color: string
  logoUrl: string
}
type TrackShop = {
  shop_name?: string | null
  brand_name?: string | null
  brand_color?: string | null
  brand_logo_url?: string | null
}
type TrackOrderRow = Record<string, unknown> & {
  shops?: TrackShop | null
}
type TrackOrderQuery = {
  select: (columns: string) => TrackOrderQuery
  eq: (column: string, value: string) => TrackOrderQuery
  is: (column: string, value: null) => TrackOrderQuery
  maybeSingle: () => Promise<{ data: TrackOrderRow | null; error: unknown }>
}
const TRACK_ORDER_COLUMNS = 'id,shop_id,order_number,tracking_code,customer_id,customer_name,customer_phone,order_for_relation,order_for_name,recipient_gender,measurement_id,garment_type,status,assigned_to,assigned_to_name,total_price,amount_paid,is_urgent,due_date,special_instructions,fabric_photo_url,style_photo_url,created_at,updated_at,delivered_at,deleted_at,shops(shop_name,brand_name,brand_color,brand_logo_url)'

function formatTrackDate(date: string) {
  return new Intl.DateTimeFormat('en-PK', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Karachi',
  }).format(new Date(`${date}T00:00:00+05:00`))
}

function money(value: number) {
  return `Rs. ${value.toLocaleString('en-PK')}`
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

  const loadOrder = useCallback(async () => {
    setLoading(true)
    setError(null)

    if (!isValidTrackingCode(normCode)) {
      setError('invalid')
      setLoading(false)
      return
    }

    try {
      const { data: remote } = await (supabase.from('orders') as unknown as TrackOrderQuery)
        .select(TRACK_ORDER_COLUMNS)
        .eq('tracking_code', normCode)
        .is('deleted_at', null)
        .maybeSingle()

      if (remote) {
        setOrder(mapOrder(remote))
        const shop = remote.shops as TrackShop | null | undefined
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
  }, [normCode])

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadOrder() }, 0)
    return () => window.clearTimeout(timer)
  }, [loadOrder])

  useEffect(() => {
    if (!isValidTrackingCode(normCode)) return
    const channel = supabase
      .channel(`public-track-${normCode}-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `tracking_code=eq.${normCode}` }, loadOrder)
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadOrder, normCode])

 if (loading) {
    return (
      <div className="min-h-dvh overflow-x-clip bg-slate-50">
        <div className="bg-slate-950">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10">
                <Image src="/icon.svg" alt="MeraDarzi" width={32} height={32} />
              </div>
              <div className="min-w-0">
                <div className="h-3 w-28 rounded-full bg-white/20" />
                <div className="mt-2 h-2 w-20 rounded-full bg-white/10" />
              </div>
            </div>
            <div className="h-7 w-24 rounded-full bg-white/10 sm:w-36" />
          </div>
        </div>

        <main className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
          <div className="mb-5 rounded-2xl bg-slate-900 p-5 text-white sm:p-6">
            <div className="mb-4 h-6 w-24 animate-pulse rounded-full bg-white/15" />
            <div className="h-8 w-48 max-w-full animate-pulse rounded-xl bg-white/20 sm:h-10 sm:w-72" />
            <div className="mt-4 h-3 w-full max-w-md animate-pulse rounded-full bg-white/10" />
            <div className="mt-2 h-3 w-2/3 max-w-sm animate-pulse rounded-full bg-white/10" />
          </div>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="h-4 w-28 animate-pulse rounded-full bg-slate-100" />
              <div className="mt-3 h-5 w-64 max-w-full animate-pulse rounded-full bg-slate-100" />
              <div className="mt-6 h-2 w-full animate-pulse rounded-full bg-slate-100" />
              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="h-4 w-24 animate-pulse rounded-full bg-slate-100" />
              <div className="mt-4 space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100" />
                ))}
              </div>
            </div>
          </div>
          <p className="mt-5 text-center font-mono text-xs text-slate-400">{normCode}</p>
        </main>
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
  const relationText = order.orderForRelation && order.orderForRelation !== 'self'
    ? orderForText
    : 'Self'

  const statusDesc: Record<string, string> = {
    received:  'Aapka kapra hamare paas aa gaya hai',
    cutting:   'Kapra kaat raha hai',
    stitching: 'Silai ho rahi hai',
    finishing: 'Finishing ho rahi hai',
    ready:     'Bilkul tayyar! Aa jaiye dukaan par',
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
    <div className="min-h-dvh overflow-x-clip bg-slate-50 text-slate-950">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/90 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-2 px-3 py-3 sm:gap-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/10 ring-1 ring-white/15">
              {branding.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={branding.logoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <Image src="/icon.svg" alt="MeraDarzi" width={32} height={32} />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white">{branding.name || shopName || 'MeraDarzi'}</p>
              <p className="text-xs text-white/55">Order tracking</p>
            </div>
          </div>
          <code className="min-w-0 max-w-[38vw] truncate rounded-full border border-white/15 bg-white/10 px-2.5 py-1.5 font-mono text-[10px] text-white/80 min-[380px]:max-w-[45vw] sm:max-w-none sm:px-3 sm:text-xs">
            {order.trackingCode ?? normCode}
          </code>
        </div>
      </header>

      <section
        className="relative text-white"
        style={{ background: `linear-gradient(140deg, ${brandColor}, #111827 78%)` }}
      >
        <div className="mx-auto grid w-full max-w-6xl gap-5 px-3 py-7 min-[380px]:px-4 sm:px-6 sm:py-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)] lg:px-8 lg:py-12">
          <div className="min-w-0">
            <div className="mb-4 inline-flex max-w-full items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-900 shadow-lg shadow-slate-950/10">
              {isCancelled ? <AlertCircle size={14} /> : isDelivered ? <PackageCheck size={14} /> : <Clock3 size={14} />}
              {isCancelled ? 'Cancelled' : isDelivered ? 'Delivered' : 'In progress'}
            </div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-white/55">Current status</p>
            <h1 className="max-w-2xl text-2xl font-black leading-tight min-[380px]:text-3xl sm:text-4xl lg:text-5xl">
              {sc?.label ?? 'Order Status'}
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/75 sm:text-base lg:text-lg">
              {statusDesc[order.status]}
            </p>
          </div>

          <div className="min-w-0 rounded-2xl border border-white/15 bg-white/10 p-3 shadow-xl shadow-slate-950/20 backdrop-blur">
            <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
              <div className="flex min-h-28 flex-col justify-center rounded-xl bg-white p-4 text-center text-slate-900">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Order</p>
                <p className="mt-1 break-words text-lg font-black sm:text-xl">#{String(order.orderNumber).padStart(3,'0')}</p>
              </div>
              <div className="flex min-h-28 flex-col justify-center rounded-xl bg-white p-4 text-center text-slate-900">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Due Date</p>
                <p className="mt-1 text-sm font-black">{formatTrackDate(order.dueDate)}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)] lg:items-start">
          <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-5 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Live progress</p>
                  <h2 className="mt-1 text-base font-black leading-snug text-slate-900 min-[380px]:text-lg">{statusDesc[order.status]}</h2>
                </div>
                <button
                  onClick={loadOrder}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50 sm:w-auto"
                  aria-label="Refresh status"
                >
                  <RefreshCw size={15} />
                  <span className="sm:hidden">Refresh</span>
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
                  <div className="mt-5 space-y-4 sm:hidden">
                    {visibleSteps.map((s, i) => {
                      const cfg = ORDER_STATUS_CONFIG[s]
                      const isDone = isDelivered || stepIdx > i
                      const isCurr = !isDelivered && stepIdx === i
                      const isActive = isDone || isCurr

                      return (
                        <div key={s} className="relative flex gap-3">
                          {i < visibleSteps.length - 1 && (
                            <div className="absolute left-4 top-9 h-[calc(100%+0.25rem)] w-px bg-slate-200" />
                          )}
                          <div
                            className={cn(
                              'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-white text-xs font-black',
                              isActive ? 'border-transparent text-white' : 'border-slate-200 text-slate-300'
                            )}
                            style={isActive ? { backgroundColor: brandColor } : undefined}
                          >
                            {isDone ? <CheckCircle2 size={16} /> : isCurr ? cfg?.emoji : <Circle size={12} />}
                          </div>
                          <div className="min-w-0 pb-1">
                            <p className={cn('text-sm font-black', isActive ? 'text-slate-900' : 'text-slate-400')}>
                              {cfg?.label}
                            </p>
                            {isCurr && (
                              <p className="mt-0.5 text-xs font-medium text-slate-500">Current step</p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <div className="mt-5 hidden grid-cols-5 gap-2 sm:grid">
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
                            'mt-2 text-center text-[10px] font-bold leading-tight',
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

            <div className="grid grid-cols-3 divide-x divide-slate-100 min-[520px]:grid-cols-3">
              {[
                { icon: UserRound, label:'Customer', value: `${order.customerName} - ${relationText}` },
                { icon: Shirt, label:'Kapra', value: gc ? `${gc.emoji} ${gc.label}` : order.garmentType },
                { icon: CalendarDays, label:'Due Date', value: formatTrackDate(order.dueDate) },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex min-w-0 flex-col items-center justify-center p-2.5 text-center min-[380px]:p-4 sm:p-5">
                  <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 sm:h-10 sm:w-10">
                    <Icon size={15} />
                  </div>
                  <p className="text-[9px] font-bold uppercase text-slate-400 min-[380px]:text-[10px]">{label}</p>
                  <p className="mt-1 break-words text-xs font-black leading-snug text-slate-800 min-[380px]:text-sm">{value}</p>
                </div>
              ))}
            </div>
          </section>

          <aside className="min-w-0 space-y-5">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
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
                  <div key={item.label} className="flex min-w-0 items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-400">{item.label}</span>
                    <span className={cn('min-w-0 break-words text-right text-sm font-black', item.color)}>{money(item.value)}</span>
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
              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                  <StickyNote size={15} className="text-blue-600" />
                  Notes
                </p>
                <SpecialInstructionsSummary value={order.specialInstructions} compact />
              </section>
            )}
          </aside>
        </div>

        <button
          onClick={loadOrder}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-3.5 text-sm font-bold text-slate-600 shadow-sm transition-colors hover:bg-slate-50 active:scale-[0.98]"
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
