import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getPlan, formatPrice, yearlySaving, yearlySavingPercent, formatYearlySaving, yearlyMonthsFree, formatYearlyDeal } from '../src/lib/billing/plans.ts'

describe('getPlan', () => {
  it('returns starter plan', () => {
    const plan = getPlan('starter')
    assert.equal(plan.name, 'Starter')
    assert.equal(plan.monthlyPkr, null)
  })
  it('returns professional plan', () => {
    const plan = getPlan('professional')
    assert.equal(plan.name, 'Professional')
    assert.equal(plan.monthlyPkr, 499)
  })
  it('returns business plan', () => {
    const plan = getPlan('business')
    assert.equal(plan.name, 'Business')
    assert.equal(plan.monthlyPkr, 999)
  })
})

describe('formatPrice', () => {
  it('free for null amount', () => assert.equal(formatPrice(null, 'monthly'), 'Free'))
  it('monthly format', () => assert.equal(formatPrice(499, 'monthly'), 'Rs. 499/month'))
  it('yearly format', () => assert.equal(formatPrice(4999, 'yearly'), 'Rs. 4,999/year'))
  it('lifetime format', () => assert.equal(formatPrice(9999, 'lifetime'), 'Rs. 9,999 one-time'))
  it('formats large yearly', () => assert.equal(formatPrice(9999, 'yearly'), 'Rs. 9,999/year'))
})

describe('yearlySaving', () => {
  it('returns null for free plan', () => assert.equal(yearlySaving(getPlan('starter')), null))
  it('calculates professional saving', () => {
    const saving = yearlySaving(getPlan('professional'))
    assert.equal(saving, 499 * 12 - 4999)
  })
  it('calculates business saving', () => {
    const saving = yearlySaving(getPlan('business'))
    assert.equal(saving, 999 * 12 - 9999)
  })
})

describe('yearlySavingPercent', () => {
  it('returns null for free plan', () => assert.equal(yearlySavingPercent(getPlan('starter')), null))
  it('calculates professional saving percent', () => {
    const pct = yearlySavingPercent(getPlan('professional'))
    assert.ok(typeof pct === 'number')
    assert.ok(pct > 0)
  })
  it('business has some saving', () => {
    const pct = yearlySavingPercent(getPlan('business'))
    assert.ok(typeof pct === 'number')
    assert.ok(pct > 0)
  })
})

describe('formatYearlySaving', () => {
  it('returns null for free plan', () => assert.equal(formatYearlySaving(getPlan('starter')), null))
  it('formats professional saving', () => {
    const result = formatYearlySaving(getPlan('professional'))
    assert.ok(result?.includes('bachat'))
  })
  it('formats business saving', () => {
    const result = formatYearlySaving(getPlan('business'))
    assert.ok(result?.includes('bachat'))
  })
})

describe('yearlyMonthsFree', () => {
  it('returns null for free plan', () => assert.equal(yearlyMonthsFree(getPlan('starter')), null))
  it('professional gives 2 months free', () => {
    assert.equal(yearlyMonthsFree(getPlan('professional')), 2)
  })
  it('business gives 2 months free', () => {
    assert.equal(yearlyMonthsFree(getPlan('business')), 2)
  })
})

describe('formatYearlyDeal', () => {
  it('returns null for free plan', () => assert.equal(formatYearlyDeal(getPlan('starter')), null))
  it('professional deal message', () => {
    const msg = formatYearlyDeal(getPlan('professional'))
    assert.ok(msg?.includes('10 months'))
    assert.ok(msg?.includes('2 months free'))
  })
  it('business deal message', () => {
    const msg = formatYearlyDeal(getPlan('business'))
    assert.ok(msg?.includes('10 months'))
    assert.ok(msg?.includes('2 months free'))
  })
})
