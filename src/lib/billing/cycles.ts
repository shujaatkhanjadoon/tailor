import type { BillingCycle } from './plans'

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
