// src/components/billing/PlanBadge.tsx
'use client'

import { usePlan }   from '@/hooks/usePlan'
import { useRouter } from 'next/navigation'
import { cn }        from '@/lib/utils'

export function PlanBadge() {
  const plan   = usePlan()
  const router = useRouter()

  if (plan.isLoading) return null

  // Trial warning
  if (plan.isTrial && plan.daysLeft !== null && plan.daysLeft <= 5) {
    return (
      <button
        onClick={() => router.push('/billing/upgrade')}
        className="flex items-center gap-1.5 bg-amber-100 border border-amber-300
                   text-amber-800 text-xs font-bold px-3 py-1.5 rounded-full
                   hover:bg-amber-200 transition-colors"
      >
        ⏰ Trial: {plan.daysLeft} din baaki
      </button>
    )
  }

  // Expired
  if (plan.isExpired) {
    return (
      <button
        onClick={() => router.push('/billing/upgrade')}
        className="flex items-center gap-1.5 bg-red-100 border border-red-300
                   text-red-700 text-xs font-bold px-3 py-1.5 rounded-full
                   hover:bg-red-200 transition-colors"
      >
        🔴 Plan Expire Ho Gaya
      </button>
    )
  }

  // Grace period
  if (plan.inGrace) {
    return (
      <button
        onClick={() => router.push('/billing/upgrade')}
        className="flex items-center gap-1.5 bg-orange-100 border border-orange-300
                   text-orange-700 text-xs font-bold px-3 py-1.5 rounded-full"
      >
        ⚠️ Grace: {plan.gracEndsAt
          ? Math.max(0, Math.ceil((plan.gracEndsAt.getTime() - Date.now()) / 86400000))
          : 0} din
      </button>
    )
  }

  // Trial (plenty of time)
  if (plan.isTrial) {
    return (
      <button
        onClick={() => router.push('/billing')}
        className="flex items-center gap-1.5 bg-blue-100 border border-blue-200
                   text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-full"
      >
        ✨ Trial
      </button>
    )
  }

  // Active paid plan
  return (
    <button
      onClick={() => router.push('/billing')}
      className={cn(
        'flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border',
        plan.plan === 'business'
          ? 'bg-purple-100 border-purple-200 text-purple-700'
          : 'bg-blue-100 border-blue-200 text-blue-700'
      )}
    >
      {plan.plan === 'professional' ? '⭐' : '👑'} {plan.plan === 'professional' ? 'Pro' : 'Business'}
    </button>
  )
}