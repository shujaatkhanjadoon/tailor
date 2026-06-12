// src/components/billing/BillingCycleToggle.tsx
'use client'

import { cn } from '@/lib/utils'
import { PLANS, type PlanId, yearlySavingPercent, yearlyMonthsFree } from '@/lib/billing/plans'

type Cycle = 'monthly' | 'yearly'

interface BillingCycleToggleProps {
  value:    Cycle
  onChange: (cycle: Cycle) => void
}

export function BillingCycleToggle({ value, onChange }: BillingCycleToggleProps) {
  const paidPlans: PlanId[] = ['professional', 'business']
  const discountInfo = paidPlans.map(id => {
    const p = PLANS[id]
    const pct = yearlySavingPercent(p)
    const free = yearlyMonthsFree(p)
    return { name: p.name, pct, free }
  })

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex bg-slate-100 rounded-2xl p-1 gap-1">
        <button
          onClick={() => onChange('monthly')}
          className={cn(
            'px-6 py-2.5 rounded-xl text-sm font-semibold transition-all',
            value === 'monthly'
              ? 'bg-white text-slate-800 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          )}
        >
          Monthly
        </button>
        <button
          onClick={() => onChange('yearly')}
          className={cn(
            'px-6 py-2.5 rounded-xl text-sm font-semibold transition-all',
            value === 'yearly'
              ? 'bg-white text-slate-800 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          )}
        >
          Yearly
        </button>
      </div>

      {value === 'yearly' && (
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-2 bg-linear-to-r from-emerald-50 to-green-50 border border-emerald-200
                          rounded-full px-4 py-1.5">
            <span className="text-emerald-700 text-xs font-bold flex items-center gap-1">
              <span>🏆</span>
              <span>Best Value — sirf 10 months ki payment, 2 months free!</span>
            </span>
          </div>
          <span className="text-[11px] text-emerald-600 font-medium">
            {discountInfo.map(d => `${d.name}: ${d.pct}% bachat`).join(' · ')}
          </span>
        </div>
      )}
    </div>
  )
}
