// src/app/track/[code]/page.tsx
'use client'

import { use, useEffect, useState } from 'react'
import { RefreshCw, AlertCircle, Search, StickyNote, Wallet, UserRound, CalendarDays, Shirt } from 'lucide-react'
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
type Branding = {
  name: string
  color: string
  logoUrl: string
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="flex items-center
                          justify-center mx-auto mb-4">
            <Image src="/icon.svg" alt="MeraDarzi" width={56} height={56} />
          </div>
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent
                          rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500">Order dhoondh raha hai...</p>
          <p className="text-xs text-slate-400 mt-1 font-mono">{normCode}</p>
        </div>
      </div>
    )
  }

 if (error || !order) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center
                      justify-center px-6 text-center">
        <div className="w-16 h-16 bg-slate-200 rounded-2xl flex items-center
                        justify-center mb-5">
          {error === 'invalid'
            ? <Search size={28} className="text-slate-400" />
            : <AlertCircle size={28} className="text-slate-400" />
          }
        </div>
        <h1 className="text-xl font-bold text-slate-800 mb-2">
          {error === 'invalid' ? 'Galat Link' : 'Order Nahi Mila'}
        </h1>
        <p className="text-slate-500 text-sm max-w-xs leading-relaxed mb-2">
          {error === 'invalid'
            ? 'Yeh tracking link sahi nahi hai. Apne darzi se dobara link maangein.'
            : 'Order mil nahi raha. Thodi der baad dobara try karein.'}
        </p>
        <code className="text-xs bg-slate-200 text-slate-600 px-3 py-1.5
                         rounded-lg font-mono mb-6">
          {normCode}
        </code>
        <button
          onClick={loadOrder}
          className="flex items-center gap-2 bg-blue-600 text-white font-semibold
                     px-6 py-3 rounded-xl text-sm active:scale-95 transition-transform"
        >
          <RefreshCw size={15} />
          Dobara Try Karein
        </button>
        <div className="flex items-center gap-2 mt-10">
          <div className="w-6 h-6 flex items-center justify-center">
            <Image
              src="/icon.svg"
              alt="MeraDarzi"
              width={24}
              height={24}
            />
          </div>
          <span className="text-sm font-bold text-slate-600">MeraDarzi</span>
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

  return (
    <div className="min-h-screen bg-linear-to-b from-slate-50 to-white">

      {/* Header */}
      <div
        className="px-5 pt-12 pb-10 text-center"
        style={{ background: `linear-gradient(135deg, ${branding.color}, #0f172a)` }}
      >
        <div className="w-14 h-14 bg-white/15 rounded-2xl flex items-center justify-center
                        mx-auto mb-4 border border-white/20 shadow-lg overflow-hidden">
          {branding.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={branding.logoUrl} alt="" className="w-full h-full object-cover" />
          ) : (
             <Image
              src="/icon.svg"
              alt="MeraDarzi"
              width={56}
              height={56}
            />
          )}
        </div>
        <h1 className="text-lg font-bold text-white mb-0.5">{branding.name || shopName}</h1>
        <p className="text-blue-200 text-sm">Order Tracking</p>
        <code className="inline-block mt-2 bg-white/15 text-blue-100 text-xs
                         font-mono px-3 py-1 rounded-full border border-white/20">
          {order.trackingCode ?? normCode}
        </code>
      </div>

      <div className="mx-auto max-w-3xl gap-4 px-4 pb-12 lg:-mt-5">

        {/* Status card */}
        <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-lg shadow-slate-200/50 mb-4 ">

          {/* Big status display */}
          <div className="border-b border-slate-100 px-6 py-7 text-center mx-auto">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-50 text-5xl ring-1 ring-slate-100">
              <span>{sc?.emoji}</span>
            </div>
            <h2 className={cn('text-2xl font-bold mb-2', sc?.color)}>
              {sc?.label}
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              {statusDesc[order.status]}
            </p>
          </div>

          {/* Progress stepper */}
          {!isCancelled && (
            <div className="px-5 py-6">
              <div className="flex items-start">
                {STATUS_STEPS
                  .filter(s => s !== 'delivered')
                  .map((s, i, arr) => {
                    const cfg    = ORDER_STATUS_CONFIG[s]
                    const isDone = isDelivered || stepIdx > i
                    const isCurr = !isDelivered && stepIdx === i
                    const isLast = i === arr.length - 1

                    return (
                      <div key={s} className="flex items-center flex-1 min-w-0">
                        <div className="flex flex-col items-center shrink-0">
                          <div className={cn(
                            'w-9 h-9 rounded-full flex items-center justify-center',
                            'text-sm font-bold border-2 transition-all',
                            isDone
                              ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-200'
                              : isCurr
                              ? 'bg-white border-blue-600 text-blue-600 ring-4 ring-blue-100'
                              : 'bg-white border-slate-200 text-slate-300'
                          )}>
                            {isDone ? '✓' : cfg?.emoji}
                          </div>
                          <p className={cn(
                            'text-[9px] mt-1.5 font-medium text-center w-12 leading-tight',
                            isCurr  ? 'text-blue-700 font-bold' :
                            isDone  ? 'text-slate-600' : 'text-slate-300'
                          )}>
                            {cfg?.label}
                          </p>
                        </div>
                        {!isLast && (
                          <div className={cn(
                            'flex-1 h-0.5 mb-5 mx-0.5 rounded-full transition-all',
                            isDone ? 'bg-blue-600' : 'bg-slate-200'
                          )} />
                        )}
                      </div>
                    )
                  })}
              </div>

              {isDelivered && (
                <div className="mt-4 text-center">
                  <div className="inline-flex items-center gap-2 bg-green-100 text-green-700
                                  font-bold px-5 py-2.5 rounded-full text-sm">
                    📦 De Diya Gaya — Shukriya!
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-4">
        {/* Order For */}
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50 px-5 py-4">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
              <UserRound size={14} className="text-blue-600" />
              Order For
            </p>
          </div>
          <div className="px-5 py-4">
            <p className="text-lg font-black capitalize text-slate-900">{orderForText}</p>
            <p className="mt-1 text-sm text-slate-500">
              {order.orderForRelation && order.orderForRelation !== 'self'
                ? 'Yeh order customer ke kisi aur family member ke liye hai.'
                : 'Yeh order customer ke apne liye hai.'}
            </p>
          </div>
        </div>

        {/* Order details */}
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50 px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Order Details
            </p>
          </div>
          <div className="grid grid-cols-1 divide-y divide-slate-100 min-[420px]:grid-cols-3 min-[420px]:divide-x min-[420px]:divide-y-0">
            {[
              { icon: Search, label:'Order #', value: `#${String(order.orderNumber).padStart(3,'0')}` },
              { icon: Shirt, label:'Kapra', value: gc ? `${gc.emoji} ${gc.label}` : order.garmentType },
              { icon: CalendarDays, label:'Due Date', value: new Date(order.dueDate).toLocaleDateString('en-PK', {
                  weekday:'short', day:'numeric', month:'long' }) },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="px-5 py-4">
                <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                  <Icon size={15} />
                </div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p>
                <p className="mt-1 text-sm font-bold leading-snug text-slate-800">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Payment details */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
            <p className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
              <Wallet size={14} className="text-emerald-600" />
              Payment Details
            </p>
          </div>
          <div className="grid grid-cols-3 divide-x divide-slate-100">
            {[
              { label: 'Total', value: totalAmount },
              { label: 'Advance', value: advancePaid },
              { label: 'Balance', value: remainingBalance },
            ].map(item => (
              <div key={item.label} className="px-3 py-4 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{item.label}</p>
                <p className={cn(
                  'mt-1 text-sm font-black',
                  item.label === 'Balance' && item.value > 0 ? 'text-red-600' : 'text-slate-800'
                )}>
                  Rs. {item.value.toLocaleString()}
                </p>
              </div>
            ))}
          </div>
          <div className={cn(
            'mx-4 mb-4 rounded-xl px-4 py-3 text-center text-xs font-bold',
            remainingBalance > 0
              ? 'bg-amber-50 text-amber-700'
              : 'bg-emerald-50 text-emerald-700'
          )}>
            {remainingBalance > 0 ? `Rs. ${remainingBalance.toLocaleString()} abhi baaki hai` : 'Payment complete'}
          </div>
        </div>

        {/* Notes */}
        {order.specialInstructions && (
          <div className="bg-white rounded-2xl border border-amber-200 overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-amber-100 bg-amber-50">
              <p className="flex items-center gap-2 text-xs font-bold text-amber-700 uppercase tracking-wider">
                <StickyNote size={14} />
                Notes
              </p>
            </div>
            <p className="whitespace-pre-line px-5 py-4 text-sm leading-relaxed text-slate-700">
              {order.specialInstructions}
            </p>
          </div>
        )}

        {/* Ready celebration */}
        {order.status === 'ready' && (
          <div className="bg-linear-to-r from-green-50 to-emerald-50
                          border-2 border-green-300 rounded-2xl px-5 py-6 text-center
                          shadow-sm">
            <p className="text-4xl mb-3">🎉</p>
            <p className="font-bold text-green-800 text-lg mb-1">Tayyar Hai!</p>
            <p className="text-green-600 text-sm">Dukaan mein aa kar apna kapra le jaiye</p>
          </div>
        )}
        </div>

        {/* Refresh */}
        <button
          onClick={loadOrder}
          className="my-4 flex w-full items-center justify-center gap-2 bg-white
                     border border-slate-200 text-slate-500 font-medium py-3.5
                     rounded-2xl text-sm transition-colors hover:bg-slate-50
                     active:scale-[0.98] lg:col-span-2"
        >
          <RefreshCw size={14} />
          Status Refresh Karein
        </button>

        {/* Footer */}
        <div className="pt-2 pb-4 text-center lg:col-span-2">
          <div className="flex items-center justify-center gap-2 mb-1">
            <div className="w-5 h-5 bg-blue-600 rounded-md flex items-center justify-center">
              {branding.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={branding.logoUrl} alt="" className="w-full h-full object-cover rounded-md" />
              ) : (
                 <Image
              src="/icon.svg"
              alt="MeraDarzi"
              width={20}
              height={20}
            />
              )}
            </div>
            <span className="text-sm font-bold text-slate-700">{branding.name || 'MeraDarzi'}</span>
          </div>
          <p className="text-xs text-slate-400">Powered by MeraDarzi · Pakistan 🇵🇰</p>
        </div>
      </div>
    </div>
  )
}
