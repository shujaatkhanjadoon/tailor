// src/components/billing/PricingCard.tsx
'use client'

import { Check, Zap } from 'lucide-react'
import { PlanDefinition, PlanId, yearlySaving, yearlySavingPercent } from '@/lib/billing/plans'
import { cn } from '@/lib/utils'

interface PricingCardProps {
  plan:          PlanDefinition
  cycle:         'monthly' | 'yearly'
  currentPlanId: PlanId
  currentCycle:  'monthly' | 'yearly' | 'lifetime'
  onSelect:      (planId: PlanId) => void
  isLoading?:    boolean
  discountPct?:  number
}

export function PricingCard({
  plan, cycle, currentPlanId, currentCycle, onSelect, isLoading, discountPct,
}: PricingCardProps) {
  const isSamePlan         = plan.id === currentPlanId
  const isLifetime         = currentCycle === 'lifetime'
  const isSameCycle        = isLifetime || cycle === currentCycle
  const isCurrent          = isSamePlan && isSameCycle
  const isSamePlanDiffCycle = isSamePlan && !isSameCycle
  const isFeatured         = plan.id === 'professional'
  const isPremium          = plan.id === 'business'
  const price              = cycle === 'yearly' ? plan.yearlyPkr : plan.monthlyPkr
  const saving             = yearlySaving(plan)
  const savingPct          = yearlySavingPercent(plan)

  const isUpgrade = (
    (currentPlanId === 'starter'       && plan.id !== 'starter') ||
    (currentPlanId === 'professional'  && plan.id === 'business')
  )
  const isDowngrade = (
    (currentPlanId === 'professional'  && plan.id === 'starter') ||
    (currentPlanId === 'business'      && plan.id !== 'business')
  )

  const cardBorder = isCurrent
    ? 'border-green-500 bg-green-50'
    : isFeatured && !isCurrent
    ? 'border-blue-500 bg-blue-600 text-white shadow-xl shadow-blue-200'
    : isPremium && !isCurrent
    ? 'border-purple-500 bg-purple-600 text-white shadow-xl shadow-purple-200'
    : 'border-slate-200 bg-white hover:border-slate-300'

  return (
    <div className={cn('relative rounded-3xl border-2 p-6 flex flex-col transition-all', cardBorder)}>
      {/* Top badge — only one at a time */}
      {isCurrent && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10">
          <span className="bg-green-500 text-white text-[10px] font-bold
                           px-4 py-1 rounded-full shadow-sm whitespace-nowrap">
            ✓ Current Plan
          </span>
        </div>
      )}

      {!isCurrent && isFeatured && !isPremium && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10">
          <span className="bg-amber-400 text-amber-900 text-[10px] font-bold
                           px-4 py-1 rounded-full shadow-sm whitespace-nowrap">
            ⭐ Most Popular
          </span>
        </div>
      )}

      {!isCurrent && isPremium && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10">
          <span className="bg-purple-400 text-purple-900 text-[10px] font-bold
                           px-4 py-1 rounded-full shadow-sm whitespace-nowrap">
            👑 Premium
          </span>
        </div>
      )}

      {cycle === 'yearly' && !isCurrent && saving && (
        <div className="absolute -top-3.5 right-4 z-10">
          <span className="bg-emerald-500 text-white text-[10px] font-bold
                           px-3 py-1 rounded-full shadow-sm whitespace-nowrap">
            🏆 Best Value
          </span>
        </div>
      )}

      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">{plan.emoji}</span>
          <h3 className={cn(
            'text-lg font-bold',
            isCurrent ? 'text-green-800' : isFeatured || isPremium ? 'text-white' : 'text-slate-800'
          )}>
            {plan.name}
          </h3>
        </div>
        <p className={cn(
          'text-xs leading-relaxed',
          isCurrent ? 'text-green-600' : isFeatured || isPremium ? 'text-blue-200' : 'text-slate-400'
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
              isCurrent ? 'text-green-800' : 'text-slate-800'
            )}>
              Free
            </p>
            <p className={cn(
              'text-sm mt-1',
              isCurrent ? 'text-green-600' : 'text-slate-400'
            )}>
              Hamesha ke liye
            </p>
          </div>
        ) : (
          <div>
            <div className="flex items-end gap-1">
              <span className={cn(
                'text-sm font-medium',
                isCurrent ? 'text-green-600' : isFeatured || isPremium ? 'text-blue-200' : 'text-slate-400'
              )}>
                Rs.
              </span>
              {discountPct ? (
                <>
                  <span className={cn(
                    'text-xl font-bold leading-none line-through',
                    isCurrent ? 'text-green-400' : isFeatured || isPremium ? 'text-blue-300' : 'text-slate-400'
                  )}>
                    {price.toLocaleString()}
                  </span>
                  <span className={cn(
                    'text-4xl font-bold leading-none ml-1',
                    isCurrent ? 'text-green-800' : isFeatured || isPremium ? 'text-white' : 'text-slate-800'
                  )}>
                    {Math.round(price * (1 - discountPct / 100)).toLocaleString()}
                  </span>
                </>
              ) : (
                <span className={cn(
                  'text-4xl font-bold leading-none',
                  isCurrent ? 'text-green-800' : isFeatured || isPremium ? 'text-white' : 'text-slate-800'
                )}>
                  {price.toLocaleString()}
                </span>
              )}
            </div>

            {discountPct && (
              <div className={cn(
                'inline-flex items-center gap-1 mt-1.5 text-[11px] font-bold px-2 py-1 rounded-lg',
                isCurrent
                  ? 'bg-green-100 text-green-700'
                  : isFeatured || isPremium
                  ? 'bg-white/20 text-white'
                  : 'bg-green-100 text-green-700'
              )}>
                {discountPct}% off coupon applied
              </div>
            )}

            <p className={cn(
              'text-sm mt-1',
              isCurrent ? 'text-green-600' : isFeatured || isPremium ? 'text-blue-200' : 'text-slate-400'
            )}>
              {cycle === 'yearly' ? 'per year' : 'per month'}
            </p>

            {/* Yearly savings */}
            {cycle === 'yearly' && saving && (
              <div className={cn(
                'inline-flex items-center gap-1 mt-2 text-[11px] font-bold px-2 py-1 rounded-lg',
                isCurrent
                  ? 'bg-green-100 text-green-700'
                  : isFeatured || isPremium
                  ? 'bg-white/20 text-white'
                  : 'bg-green-100 text-green-700'
              )}>
                Rs. {saving.toLocaleString()} bachat! {savingPct ? `(${savingPct}% save)` : ''}
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
              isCurrent ? 'text-green-500' : isFeatured || isPremium ? 'text-blue-200' : 'text-green-500'
            )} />
            <span className={cn(
              'text-sm',
              isCurrent ? 'text-green-700' : isFeatured || isPremium ? 'text-blue-100' : 'text-slate-600'
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
        ) : isSamePlanDiffCycle ? (
          <button
            onClick={() => onSelect(plan.id)}
            disabled={isLoading}
            className="w-full bg-slate-100 text-slate-700 font-bold py-3.5
                       rounded-2xl text-sm hover:bg-slate-200 transition-colors
                       flex items-center justify-center gap-2"
          >
            Switch to {cycle === 'yearly' ? 'Monthly' : 'Yearly'}
          </button>
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
                        rounded-2xl text-sm text-center flex items-center justify-center gap-2">
          <span>✓ Active Plan</span>
        </div>
      ) : isSamePlanDiffCycle ? (
        <button
          onClick={() => onSelect(plan.id)}
          disabled={isLoading}
          className={cn(
            'w-full font-bold py-3.5 rounded-2xl text-sm transition-all active:scale-[0.98]',
            'flex items-center justify-center gap-2',
            isLoading ? 'opacity-60 cursor-not-allowed' : '',
            isFeatured || isPremium
              ? 'bg-white text-blue-600 hover:bg-blue-50 shadow-md'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          )}
        >
          <Zap size={15} />
          Switch to {cycle === 'yearly' ? 'Yearly' : 'Monthly'}
        </button>
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
              : isPremium && !isCurrent
              ? 'bg-white text-purple-600 hover:bg-purple-50 shadow-md'
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
