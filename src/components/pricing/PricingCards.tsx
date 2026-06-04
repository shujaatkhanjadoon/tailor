'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, ArrowRight } from 'lucide-react'
import { PLANS, type PlanId, yearlySaving, yearlySavingPercent } from '@/lib/billing/plans'
import { BillingCycleToggle } from '@/components/billing/BillingCycleToggle'
import { cn } from '@/lib/utils'

type Cycle = 'monthly' | 'yearly'

export function PricingCards() {
  const [cycle, setCycle] = useState<Cycle>('monthly')

  return (
    <>
      <BillingCycleToggle value={cycle} onChange={setCycle} />

      <div className="grid lg:grid-cols-3 gap-6 mt-10">
        {(['starter', 'professional', 'business'] as PlanId[]).map(planId => {
          const p = PLANS[planId]
          const price = cycle === 'yearly' ? p.yearlyPkr : p.monthlyPkr
          const saving = yearlySaving(p)
          const savingPct = yearlySavingPercent(p)
          const isFeatured = planId === 'professional'
          const isPremium = planId === 'business'

          return (
            <div
              key={planId}
              className={cn(
                'relative rounded-3xl border-2 p-7 flex flex-col',
                isFeatured
                  ? 'border-blue-500 bg-blue-600 text-white shadow-2xl shadow-blue-200'
                  : isPremium
                  ? 'border-purple-500 bg-purple-600 text-white shadow-2xl shadow-purple-200'
                  : 'border-slate-200 bg-white'
              )}
            >
              {/* Featured badge */}
              {isFeatured && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="bg-amber-400 text-amber-900 text-xs font-bold px-5 py-1.5 rounded-full shadow-sm">
                    ⭐ Most Popular
                  </span>
                </div>
              )}

              {/* Premium badge */}
              {isPremium && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="bg-purple-400 text-purple-900 text-xs font-bold px-5 py-1.5 rounded-full shadow-sm">
                    👑 Premium
                  </span>
                </div>
              )}

              {/* Best Value badge for yearly */}
              {cycle === 'yearly' && saving && (
                <div className="absolute -top-4 right-4">
                  <span className="bg-emerald-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-full shadow-sm">
                    🏆 Best Value
                  </span>
                </div>
              )}

              <div className="mb-6">
                <p className="text-2xl mb-1">{p.emoji}</p>
                <h3 className={cn('text-xl font-bold', isFeatured || isPremium ? 'text-white' : 'text-slate-800')}>
                  {p.name}
                </h3>
                <p className={cn('text-sm mt-1', isFeatured || isPremium ? 'text-blue-200' : 'text-slate-400')}>
                  {p.tagline}
                </p>
              </div>

              <div className="mb-6">
                {price === null ? (
                  <p className={cn('text-5xl font-bold', isFeatured || isPremium ? 'text-white' : 'text-slate-800')}>
                    Free
                  </p>
                ) : (
                  <>
                    <div className="flex items-end gap-1">
                      <span className={cn('text-lg', isFeatured || isPremium ? 'text-blue-200' : 'text-slate-400')}>Rs.</span>
                      <span className={cn('text-5xl font-bold leading-none', isFeatured || isPremium ? 'text-white' : 'text-slate-800')}>
                        {price.toLocaleString()}
                      </span>
                    </div>
                    <p className={cn('text-sm mt-1', isFeatured || isPremium ? 'text-blue-200' : 'text-slate-400')}>
                      {cycle === 'yearly' ? 'per year' : 'per month'}
                    </p>
                    {cycle === 'yearly' && saving && (
                      <span className={cn(
                        'inline-block mt-2 text-xs font-bold px-3 py-1 rounded-lg',
                        isFeatured || isPremium ? 'bg-white/20 text-white' : 'bg-green-100 text-green-700'
                      )}>
                        Rs. {saving.toLocaleString()} bachat ({savingPct}% save)
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
                      isFeatured || isPremium ? 'text-blue-200' : 'text-green-500'
                    )} />
                    <span className={cn('text-sm', isFeatured || isPremium ? 'text-blue-100' : 'text-slate-600')}>
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
                  isFeatured || isPremium
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
    </>
  )
}
