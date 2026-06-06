'use client'

import { usePlan } from '@/hooks/usePlan'
import { Calendar } from 'lucide-react'

export function SubscriptionInfo() {
  const plan = usePlan()

  if (plan.isLoading || plan.plan === 'starter') return null

  const now = new Date()
  const relevantDate = plan.isTrial ? plan.trialEndsAt : plan.expiresAt

  if (!relevantDate || relevantDate <= now) return null

  const daysLeft = Math.ceil((relevantDate.getTime() - now.getTime()) / 86400000)
  const monthsLeft = daysLeft / 30.44

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
      <h3 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-1.5">
        <Calendar size={14} className="text-blue-500" />
        Subscription Info
      </h3>
      <div className="space-y-1.5 text-xs text-slate-600">
        {plan.expiresAt && (
          <p>
            Next billing:{' '}
            <span className="font-semibold text-slate-800">
              {plan.expiresAt.toLocaleDateString('en-PK', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
            </span>
          </p>
        )}
        {daysLeft > 0 && (
          <p>
            {monthsLeft < 1
              ? `${daysLeft} ${daysLeft === 1 ? 'din' : 'din'} remaining`
              : `${monthsLeft.toFixed(1)} months remaining`}
          </p>
        )}
        {plan.billingCycle && (
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
