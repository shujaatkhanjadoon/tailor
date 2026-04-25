// src/app/pricing/page.tsx
'use client'

import { useState } from 'react'
import Link         from 'next/link'
import { Scissors, Check, X as XIcon, ArrowRight } from 'lucide-react'
import { PLANS, PlanId, yearlySaving } from '@/lib/billing/plans'
import { BillingCycleToggle }          from '@/components/billing/BillingCycleToggle'
import { cn }                          from '@/lib/utils'

const FEATURE_ROWS = [
  { label: 'Orders per month',  starter: '30',         pro: 'Unlimited',    biz: 'Unlimited'    },
  { label: 'Customers',         starter: '50',         pro: 'Unlimited',    biz: 'Unlimited'    },
  { label: 'Karigar accounts',  starter: 'None',       pro: 'Up to 3',      biz: 'Unlimited'    },
  { label: 'Order tracking URL',starter: false,        pro: true,           biz: true           },
  { label: 'QR Code',           starter: false,        pro: true,           biz: true           },
  { label: 'Photo attachments', starter: false,        pro: '1GB',          biz: '10GB'         },
  { label: 'Cloud sync',        starter: false,        pro: true,           biz: true           },
  { label: 'Multi-device login',starter: false,        pro: true,           biz: true           },
  { label: 'Reports & analytics',starter: false,       pro: true,           biz: true           },
  { label: 'WhatsApp notify',   starter: 'Manual',     pro: 'Auto',         biz: 'Auto'         },
  { label: 'Karigar pay reports',starter: false,       pro: false,          biz: true           },
  { label: 'Custom branding',   starter: false,        pro: false,          biz: true           },
  { label: 'Priority support',  starter: false,        pro: false,          biz: true           },
]

function FeatureValue({ value }: { value: boolean | string }) {
  if (value === true)  return <Check size={16} className="text-green-500 mx-auto" />
  if (value === false) return <XIcon size={16} className="text-slate-200 mx-auto" />
  return <span className="text-xs text-slate-600 font-medium">{value}</span>
}

export default function PricingPage() {
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly')

  return (
    <div className="min-h-screen bg-white">

      {/* Nav */}
      <nav className="border-b border-slate-200 px-6 py-4 flex items-center
                      justify-between max-w-7xl mx-auto">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Scissors size={16} className="text-white" />
          </div>
          <span className="font-bold text-slate-800 text-lg">Darzi Manager</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/auth" className="text-sm font-semibold text-slate-600 hover:text-slate-800">
            Sign In
          </Link>
          <Link
            href="/auth"
            className="text-sm font-semibold bg-blue-600 text-white px-4 py-2 rounded-xl"
          >
            Free Trial Shuru Karein
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 py-16 text-center">
        <h1 className="text-4xl font-bold text-slate-900 mb-3">
          Simple, Honest Pricing
        </h1>
        <p className="text-slate-500 text-lg mb-3">
          14 din ka free Professional trial — koi card nahi chahiye
        </p>
        <p className="text-sm text-slate-400 mb-10">
          Baad mein jo plan suit kare le lein. Data hamesha aapka.
        </p>

        <BillingCycleToggle value={cycle} onChange={setCycle} />
      </section>

      {/* Pricing cards */}
      <section className="max-w-5xl mx-auto px-6 pb-16">
        <div className="grid lg:grid-cols-3 gap-6 mb-16">
          {(['starter', 'professional', 'business'] as PlanId[]).map(planId => {
            const p       = PLANS[planId]
            const price   = cycle === 'yearly' ? p.yearlyPkr : p.monthlyPkr
            const saving  = yearlySaving(p)
            const isFeatured = planId === 'professional'

            return (
              <div
                key={planId}
                className={cn(
                  'relative rounded-3xl border-2 p-7 flex flex-col',
                  isFeatured
                    ? 'border-blue-500 bg-blue-600 text-white shadow-2xl shadow-blue-200'
                    : 'border-slate-200 bg-white'
                )}
              >
                {isFeatured && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="bg-amber-400 text-amber-900 text-xs font-bold
                                     px-5 py-1.5 rounded-full shadow-sm">
                      ⭐ Most Popular
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <p className="text-2xl mb-1">{p.emoji}</p>
                  <h3 className={cn('text-xl font-bold', isFeatured ? 'text-white' : 'text-slate-800')}>
                    {p.name}
                  </h3>
                  <p className={cn('text-sm mt-1', isFeatured ? 'text-blue-200' : 'text-slate-400')}>
                    {p.tagline}
                  </p>
                </div>

                <div className="mb-6">
                  {price === null ? (
                    <p className={cn('text-5xl font-bold', isFeatured ? 'text-white' : 'text-slate-800')}>
                      Free
                    </p>
                  ) : (
                    <>
                      <div className="flex items-end gap-1">
                        <span className={cn('text-lg', isFeatured ? 'text-blue-200' : 'text-slate-400')}>Rs.</span>
                        <span className={cn('text-5xl font-bold leading-none', isFeatured ? 'text-white' : 'text-slate-800')}>
                          {price.toLocaleString()}
                        </span>
                      </div>
                      <p className={cn('text-sm mt-1', isFeatured ? 'text-blue-200' : 'text-slate-400')}>
                        {cycle === 'yearly' ? 'per year' : 'per month'}
                      </p>
                      {cycle === 'yearly' && saving && (
                        <span className={cn(
                          'inline-block mt-2 text-xs font-bold px-3 py-1 rounded-lg',
                          isFeatured ? 'bg-white/20 text-white' : 'bg-green-100 text-green-700'
                        )}>
                          Rs. {saving.toLocaleString()} bachat
                        </span>
                      )}
                    </>
                  )}
                </div>

                <div className="flex-1 space-y-2.5 mb-7">
                  {p.highlights.map(h => (
                    <div key={h} className="flex items-start gap-2.5">
                      <Check size={14} className={cn(
                        'mt-0.5 shrink-0',
                        isFeatured ? 'text-blue-200' : 'text-green-500'
                      )} />
                      <span className={cn('text-sm', isFeatured ? 'text-blue-100' : 'text-slate-600')}>
                        {h}
                      </span>
                    </div>
                  ))}
                </div>

                <Link
                  href="/auth"
                  className={cn(
                    'w-full font-bold py-4 rounded-2xl text-sm text-center transition-colors',
                    'flex items-center justify-center gap-2',
                    isFeatured
                      ? 'bg-white text-blue-600 hover:bg-blue-50'
                      : planId === 'starter'
                      ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  )}
                >
                  {planId === 'starter' ? 'Free Shuru Karein' : '14 Din Free Try Karein'}
                  <ArrowRight size={15} />
                </Link>
              </div>
            )
          })}
        </div>

        {/* Feature comparison table */}
        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100">
            <h2 className="text-xl font-bold text-slate-800">Full Feature Comparison</h2>
          </div>

          {/* Header row */}
          <div className="grid grid-cols-4 gap-0 border-b border-slate-100">
            <div className="px-6 py-4" />
            {['Starter', 'Professional', 'Business'].map((name, i) => (
              <div
                key={name}
                className={cn(
                  'px-4 py-4 text-center font-bold text-sm',
                  i === 1 ? 'bg-blue-600 text-white' : 'text-slate-800'
                )}
              >
                {name}
              </div>
            ))}
          </div>

          {/* Feature rows */}
          {FEATURE_ROWS.map((row, i) => (
            <div
              key={row.label}
              className={cn(
                'grid grid-cols-4 gap-0 border-b border-slate-100 last:border-0',
                i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
              )}
            >
              <div className="px-6 py-3.5 text-sm text-slate-600 font-medium">
                {row.label}
              </div>
              {[row.starter, row.pro, row.biz].map((val, j) => (
                <div
                  key={j}
                  className={cn(
                    'px-4 py-3.5 text-center',
                    j === 1 ? 'bg-blue-50' : ''
                  )}
                >
                  <FeatureValue value={val} />
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Payment info */}
        <div className="mt-8 bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center">
          <h3 className="font-bold text-slate-800 mb-2">Pakistan Ka Apna Payment 🇵🇰</h3>
          <p className="text-slate-500 text-sm mb-4">
            Raast ID, Raast QR, Easypaisa, JazzCash ya Bank Transfer — jo aapko suit kare
          </p>
          <div className="flex justify-center gap-6 text-sm text-slate-500">
            {['⚡ Zero fee on Raast', '🔒 Secure payment', '✓ 24hr activation', '7 din refund'].map(f => (
              <span key={f} className="font-medium">{f}</span>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-8 grid md:grid-cols-2 gap-4">
          {[
            { q:'Trial mein card chahiye?',          a:'Bilkul nahi — 14 din free, koi info nahi' },
            { q:'Raast payment kab verify hogi?',    a:'2-4 ghante, maximum 24 business hours' },
            { q:'Kya data delete hoga downgrade par?', a:'Nahi — data safe, sirf features band' },
            { q:'Refund milega?',                    a:'7 din ke andar poora refund guarantee' },
          ].map(({ q, a }) => (
            <div key={q} className="bg-white border border-slate-200 rounded-2xl p-5">
              <p className="font-semibold text-slate-800 text-sm mb-1.5">{q}</p>
              <p className="text-slate-500 text-xs leading-relaxed">{a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-blue-600 py-16 text-center">
        <h2 className="text-3xl font-bold text-white mb-3">
          Aaj Hi Shuru Karein
        </h2>
        <p className="text-blue-200 mb-8">14 din ka free Professional trial — no card required</p>
        <Link
          href="/auth"
          className="inline-flex items-center gap-2 bg-white text-blue-600
                     font-bold px-10 py-4 rounded-2xl hover:bg-blue-50 transition-colors"
        >
          Free Trial Shuru Karein <ArrowRight size={18} />
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-8 text-center text-sm text-slate-400">
        © 2025 Darzi Manager · Made for Pakistan 🇵🇰
      </footer>
    </div>
  )
}