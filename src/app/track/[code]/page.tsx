// src/app/track/[code]/page.tsx
'use client'

import { use, useEffect, useState } from 'react'
import { Scissors, RefreshCw, AlertCircle, Search } from 'lucide-react'
import type { OrderRecord }      from '@/lib/db/schema'
import { ORDER_STATUS_CONFIG, GARMENT_LABELS } from '@/types'
import { isValidTrackingCode, normaliseCode } from '@/lib/tracking'
import { cn }                   from '@/lib/utils'
import { supabase } from '@/lib/supabase/client'
import { mapOrder } from '@/lib/supabase/records'
import Image from 'next/image'

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

  // â”€â”€ Loading â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center
                          justify-center mx-auto mb-4 shadow-lg shadow-blue-200">
            <Scissors size={26} className="text-white" />
          </div>
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent
                          rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500">Order dhoondh raha hai...</p>
          <p className="text-xs text-slate-400 mt-1 font-mono">{normCode}</p>
        </div>
      </div>
    )
  }

  // â”€â”€ Invalid / Not found â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

      <div className="max-w-md mx-auto px-4 -mt-5 pb-12 space-y-4">

        {/* Status card */}
        <div className="bg-white rounded-3xl shadow-lg shadow-slate-200/50
                        border border-slate-100 overflow-hidden">

          {/* Big status display */}
          <div className="px-6 py-8 text-center border-b border-slate-100">
            <div className="text-6xl mb-4 animate-bounce"
                 style={{ animationDuration: '2s' }}>
              {sc?.emoji}
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

        {/* Order details */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Order Details
            </p>
          </div>
          <div className="divide-y divide-slate-100">
            {[
              { label:'Order #',   value: `#${String(order.orderNumber).padStart(3,'0')}` },
              { label:'Kapra',     value: gc ? `${gc.emoji} ${gc.label}` : order.garmentType },
              { label:'Due Date',  value: new Date(order.dueDate).toLocaleDateString('en-PK',{
                  weekday:'long', day:'numeric', month:'long' }) },
              ...(order.specialInstructions
                ? [{ label:'Note', value: order.specialInstructions }]
                : []),
            ].map(row => (
              <div key={row.label} className="flex items-start justify-between px-5 py-3.5 gap-4">
                <p className="text-sm text-slate-400 font-medium shrink-0">{row.label}</p>
                <p className="text-sm text-slate-800 font-semibold text-right leading-snug">
                  {row.value}
                </p>
              </div>
            ))}
          </div>
        </div>

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

        {/* Refresh */}
        <button
          onClick={loadOrder}
          className="w-full flex items-center justify-center gap-2 bg-white
                     border border-slate-200 text-slate-500 font-medium py-3.5
                     rounded-2xl text-sm transition-colors hover:bg-slate-50
                     active:scale-[0.98]"
        >
          <RefreshCw size={14} />
          Status Refresh Karein
        </button>

        {/* Footer */}
        <div className="text-center pt-2 pb-4">
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
