'use client'

import { usePlan } from '@/hooks/usePlan'
import { Calendar } from 'lucide-react'

export function SubscriptionInfo() {
  const plan = usePlan()

  if (plan.isLoading || plan.plan === 'starter') return null

  if (!plan.isTrialing && !plan.isActive) return null

  const relevantDate = plan.isTrial ? plan.trialEndsAt : plan.expiresAt
  if (!relevantDate) return null

  const daysLeft = plan.daysLeft ?? 0
  const monthsLeft = daysLeft / 30.44
  const isCancelled = plan.status === 'cancelled'

  return (
    <div className={isCancelled ? "bg-red-50 border border-red-200 rounded-2xl p-4" : "bg-slate-50 border border-slate-200 rounded-2xl p-4"}>
      <h3 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-1.5">
        <Calendar size={14} className="text-blue-500" />
        {isCancelled ? 'Cancelled Subscription' : 'Subscription Info'}
      </h3>
      <div className="space-y-1.5 text-xs text-slate-600">
        {isCancelled && (
          <p className="font-semibold text-red-600 mb-1">
            ⏸️ Cancelled — access until period end
          </p>
        )}
        {plan.expiresAt && (
          <p>
            {isCancelled ? 'Access ends:' : 'Next billing:'}{' '}
            <span className="font-semibold text-slate-800">
              {plan.expiresAt.toLocaleDateString('en-PK', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
            </span>
          </p>
        )}
        {daysLeft > 0 && !isCancelled && (
          <p>
            {monthsLeft < 1
              ? `${daysLeft} ${daysLeft === 1 ? 'din' : 'din'} remaining`
              : `${monthsLeft.toFixed(1)} months remaining`}
          </p>
        )}
        {plan.billingCycle && !isCancelled && (
          <p>
            Billing:{' '}
            <span className="font-semibold text-slate-800 capitalize">
              {plan.billingCycle}
            </span>
          </p>
        )}
      </div>
    </div>
  )
}
