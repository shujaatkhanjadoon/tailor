// src/components/billing/PricingCard.tsx
'use client'

import { Check, Zap } from 'lucide-react'
import { PlanDefinition, PlanId, yearlySaving } from '@/lib/billing/plans'
import { cn } from '@/lib/utils'

interface PricingCardProps {
  plan:          PlanDefinition
  cycle:         'monthly' | 'yearly'
  currentPlanId: PlanId
  onSelect:      (planId: PlanId) => void
  isLoading?:    boolean
}

export function PricingCard({
  plan, cycle, currentPlanId, onSelect, isLoading,
}: PricingCardProps) {
  const isCurrent   = plan.id === currentPlanId
  const isFeatured  = plan.id === 'professional'
  const price       = cycle === 'yearly' ? plan.yearlyPkr : plan.monthlyPkr
  const saving      = yearlySaving(plan)
  const isUpgrade   = (
    (currentPlanId === 'starter'       && plan.id !== 'starter') ||
    (currentPlanId === 'professional'  && plan.id === 'business')
  )
  const isDowngrade = (
    (currentPlanId === 'professional'  && plan.id === 'starter') ||
    (currentPlanId === 'business'      && plan.id !== 'business')
  )

  return (
    <div className={cn(
      'relative rounded-3xl border-2 p-6 flex flex-col transition-all',
      isFeatured && !isCurrent
        ? 'border-blue-500 bg-blue-600 text-white shadow-xl shadow-blue-200'
        : isCurrent
        ? 'border-green-500 bg-green-50'
        : 'border-slate-200 bg-white hover:border-slate-300'
    )}>
      {/* Featured badge */}
      {isFeatured && !isCurrent && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
          <span className="bg-amber-400 text-amber-900 text-[10px] font-bold
                           px-4 py-1 rounded-full shadow-sm whitespace-nowrap">
            ⭐ Most Popular
          </span>
        </div>
      )}

      {/* Current plan badge */}
      {isCurrent && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
          <span className="bg-green-500 text-white text-[10px] font-bold
                           px-4 py-1 rounded-full shadow-sm">
            ✓ Current Plan
          </span>
        </div>
      )}

      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">{plan.emoji}</span>
          <h3 className={cn(
            'text-lg font-bold',
            isFeatured && !isCurrent ? 'text-white' : 'text-slate-800'
          )}>
            {plan.name}
          </h3>
        </div>
        <p className={cn(
          'text-xs leading-relaxed',
          isFeatured && !isCurrent ? 'text-blue-200' : 'text-slate-400'
        )}>
          {plan.tagline}
        </p>
      </div>

      {/* Price */}
      <div className="mb-5">
        {price === null ? (
          <div>
            <p className={cn(
              'text-4xl font-bold',
              isFeatured && !isCurrent ? 'text-white' : 'text-slate-800'
            )}>
              Free
            </p>
            <p className={cn(
              'text-sm mt-1',
              isFeatured && !isCurrent ? 'text-blue-200' : 'text-slate-400'
            )}>
              Hamesha ke liye
            </p>
          </div>
        ) : (
          <div>
            <div className="flex items-end gap-1">
              <span className={cn(
                'text-sm font-medium',
                isFeatured && !isCurrent ? 'text-blue-200' : 'text-slate-400'
              )}>
                Rs.
              </span>
              <span className={cn(
                'text-4xl font-bold leading-none',
                isFeatured && !isCurrent ? 'text-white' : 'text-slate-800'
              )}>
                {price.toLocaleString()}
              </span>
            </div>
            <p className={cn(
              'text-sm mt-1',
              isFeatured && !isCurrent ? 'text-blue-200' : 'text-slate-400'
            )}>
              {cycle === 'yearly' ? 'per year' : 'per month'}
            </p>

            {/* Yearly savings */}
            {cycle === 'yearly' && saving && (
              <div className={cn(
                'inline-flex items-center gap-1 mt-2 text-[11px] font-bold px-2 py-1 rounded-lg',
                isFeatured && !isCurrent
                  ? 'bg-white/20 text-white'
                  : 'bg-green-100 text-green-700'
              )}>
                Rs. {saving.toLocaleString()} bachat!
              </div>
            )}
          </div>
        )}
      </div>

      {/* Features */}
      <div className="flex-1 space-y-2.5 mb-6">
        {plan.highlights.map(h => (
          <div key={h} className="flex items-start gap-2.5">
            <Check size={14} className={cn(
              'mt-0.5 shrink-0',
              isFeatured && !isCurrent ? 'text-blue-200' : 'text-green-500'
            )} />
            <span className={cn(
              'text-sm',
              isFeatured && !isCurrent ? 'text-blue-100' : 'text-slate-600'
            )}>
              {h}
            </span>
          </div>
        ))}
      </div>

      {/* CTA Button */}
      {price === null ? (
        isCurrent ? (
          <div className="w-full bg-green-100 text-green-700 font-bold py-3.5
                          rounded-2xl text-sm text-center">
            ✓ Aapka current plan
          </div>
        ) : (
          <button
            onClick={() => onSelect(plan.id)}
            className="w-full bg-slate-100 text-slate-600 font-bold py-3.5
                       rounded-2xl text-sm hover:bg-slate-200 transition-colors"
          >
            Downgrade to Free
          </button>
        )
      ) : isCurrent ? (
        <div className="w-full bg-green-100 text-green-700 font-bold py-3.5
                        rounded-2xl text-sm text-center">
          ✓ Active Plan
        </div>
      ) : (
        <button
          onClick={() => onSelect(plan.id)}
          disabled={isLoading}
          className={cn(
            'w-full font-bold py-3.5 rounded-2xl text-sm transition-all active:scale-[0.98]',
            'flex items-center justify-center gap-2',
            isLoading ? 'opacity-60 cursor-not-allowed' : '',
            isFeatured && !isCurrent
              ? 'bg-white text-blue-600 hover:bg-blue-50 shadow-md'
              : isUpgrade
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          )}
        >
          <Zap size={15} />
          {isUpgrade ? 'Upgrade Karein'
            : isDowngrade ? 'Downgrade'
            : 'Select'}
        </button>
      )}
    </div>
  )
}