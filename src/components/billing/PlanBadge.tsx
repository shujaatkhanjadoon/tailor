// src/components/billing/PlanBadge.tsx
'use client'

import { useState }  from 'react'
import { usePlan }   from '@/hooks/usePlan'
import { useRouter } from 'next/navigation'
import { cn }        from '@/lib/utils'

export function PlanBadge() {
  const [now] = useState(() => Date.now())
  const plan   = usePlan()
  const router = useRouter()

  if (plan.isLoading) return null

  // ── Starter: no badge at all ──────────────────────────────────────
  // Starter is the free plan — no need to show a badge
  if (plan.plan === 'starter' && !plan.isTrial && !plan.isExpired && !plan.inGrace) {
    return null
  }

  // ── Expired ───────────────────────────────────────────────────────
  if (plan.isExpired) {
    return (
      <button
        onClick={() => router.push('/billing/upgrade')}
        className="flex items-center gap-1.5 bg-red-100 border border-red-300
                   text-red-700 text-xs font-bold px-3 py-1.5 rounded-full
                   hover:bg-red-200 transition-colors"
      >
        🔴 Plan Expired
      </button>
    )
  }

  // ── Grace period ──────────────────────────────────────────────────
  if (plan.inGrace) {
    const days = plan.gracEndsAt
      ? Math.max(0, Math.ceil((plan.gracEndsAt.getTime() - now) / 86400000))
      : 0
    return (
      <button
        onClick={() => router.push('/billing/upgrade')}
        className="flex items-center gap-1.5 bg-orange-100 border border-orange-300
                   text-orange-700 text-xs font-bold px-3 py-1.5 rounded-full"
      >
        ⚠️ Grace: {days}d
      </button>
    )
  }

  // ── Trial (show warning when ≤ 7 days left) ───────────────────────
  if (plan.isTrial) {
    const urgent = (plan.daysLeft ?? 99) <= 3
    return (
      <button
        onClick={() => router.push('/billing')}
        className={cn(
          'flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border',
          urgent
            ? 'bg-amber-100 border-amber-300 text-amber-800'
            : 'bg-blue-100 border-blue-200 text-blue-700'
        )}
      >
        ✨ Trial {plan.daysLeft !== null ? `· ${plan.daysLeft}d` : ''}
      </button>
    )
  }

  // ── Active paid plan ──────────────────────────────────────────────
  if (plan.plan === 'professional') {
    return (
      <button
        onClick={() => router.push('/billing')}
        className="flex items-center gap-1.5 bg-blue-100 border border-blue-200
                   text-blue-700 text-xs font-bold px-3 py-1.5 rounded-full
                   hover:bg-blue-200 transition-colors"
      >
        ⭐ Pro
      </button>
    )
  }

  if (plan.plan === 'business') {
    return (
      <button
        onClick={() => router.push('/billing')}
        className="flex items-center gap-1.5 bg-purple-100 border border-purple-200
                   text-purple-700 text-xs font-bold px-3 py-1.5 rounded-full
                   hover:bg-purple-200 transition-colors"
      >
        👑 Business
      </button>
    )
  }

  // Fallback: starter active — no badge
  return null
}