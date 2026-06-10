import type { BillingCycle, PlanId } from './plans'
import { PLANS } from './plans'

function daysInUtcMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
}

function addUtcMonthsInclusive(start: Date, months: number): Date {
  const year = start.getUTCFullYear()
  const month = start.getUTCMonth()
  const day = start.getUTCDate()
  const target = new Date(Date.UTC(year, month + months, 1))
  const maxTargetDay = daysInUtcMonth(target.getUTCFullYear(), target.getUTCMonth())
  const targetDay = Math.min(day, maxTargetDay)

  target.setUTCDate(targetDay)
  target.setUTCHours(0, 0, 0, 0)

  return target
}

function addUtcYearsInclusive(start: Date, years: number): Date {
  const year = start.getUTCFullYear() + years
  const month = start.getUTCMonth()
  const day = start.getUTCDate()
  const maxTargetDay = daysInUtcMonth(year, month)
  const targetDay = Math.min(day, maxTargetDay)
  const target = new Date(Date.UTC(year, month, targetDay))

  return target
}

export function subscriptionExpiresAt(
  cycle: BillingCycle | string | null | undefined,
  activatedAt: Date = new Date(),
): string | null {
  if (cycle === 'lifetime') return null
  if (cycle === 'yearly') return addUtcYearsInclusive(activatedAt, 1).toISOString()
  return addUtcMonthsInclusive(activatedAt, 1).toISOString()
}

// ── Proration helpers ─────────────────────────────────────────────

/**
 * Calculate daily rate for a plan in PKR.
 * Yearly plans are ~17% cheaper per day than monthly.
 */
export function getDailyRate(planId: PlanId, cycle: string): number {
  const plan = PLANS[planId]
  if (!plan) return 0
  const price = cycle === 'yearly' ? (plan.yearlyPkr ?? 0) : (plan.monthlyPkr ?? 0)
  if (!price) return 0
  const days = cycle === 'yearly' ? 365 : 30
  return price / days
}

/**
 * Calculate remaining value of a subscription in PKR.
 * Returns 0 for starter/free plans or expired subscriptions.
 */
export function calculateRemainingValue(
  planId: string,
  cycle: string | null | undefined,
  expiresAt: string | null | undefined,
  now: Date = new Date(),
): number {
  if (!expiresAt || !cycle || planId === 'starter') return 0
  const expiry = new Date(expiresAt)
  if (expiry <= now) return 0
  const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / 86400000)
  if (daysLeft <= 0) return 0
  const dailyRate = getDailyRate(planId as PlanId, cycle)
  return Math.round(daysLeft * dailyRate)
}

/**
 * Calculate prorated expiry date considering remaining value from previous plan
 * and the new payment amount. Remaining value is applied as credit toward the
 * new plan, extending the expiry beyond the standard period.
 */
export function calculateProratedExpiry(
  previousPlan: string | null | undefined,
  previousCycle: string | null | undefined,
  previousExpiry: string | null | undefined,
  newPlan: PlanId,
  newCycle: string,
  paymentAmount: number,
  now: Date = new Date(),
): string {
  // For upgrades/applies: extend from previous expiry (don't waste paid time)
  const baseDate = previousExpiry && new Date(previousExpiry) > now
    ? new Date(previousExpiry)
    : now

  // Standard expiry from base date
  const standardExpiry = subscriptionExpiresAt(newCycle, baseDate)

  // Calculate remaining credit from previous plan (for upgrades)
  const remainingCredit = calculateRemainingValue(
    previousPlan ?? 'starter',
    previousCycle,
    previousExpiry,
    now,
  )

  // Total value = payment + remaining credit
  const dailyRate = getDailyRate(newPlan, newCycle)
  const totalValue = paymentAmount + remainingCredit
  const standardValue = newCycle === 'yearly'
    ? (PLANS[newPlan]?.yearlyPkr ?? 0)
    : (PLANS[newPlan]?.monthlyPkr ?? 0)

  // If total value <= standard value, just use standard expiry
  if (totalValue <= standardValue || dailyRate <= 0) {
    return standardExpiry!
  }

  // Extra days from remaining credit
  const extraDays = Math.round((totalValue - standardValue) / dailyRate)
  const proratedExpiry = new Date(baseDate)
  proratedExpiry.setDate(proratedExpiry.getDate() + (newCycle === 'yearly' ? 365 : 30) + extraDays)

  return proratedExpiry.toISOString()
}
