import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getPlan, formatPrice, yearlySaving, yearlySavingPercent, formatYearlySaving } from '../src/lib/billing/plans.ts'

describe('getPlan', () => {
  it('returns starter plan', () => {
    const plan = getPlan('starter')
    assert.equal(plan.name, 'Starter')
    assert.equal(plan.monthlyPkr, null)
  })
  it('returns professional plan', () => {
    const plan = getPlan('professional')
    assert.equal(plan.name, 'Professional')
    assert.equal(plan.monthlyPkr, 999)
  })
  it('returns business plan', () => {
    const plan = getPlan('business')
    assert.equal(plan.name, 'Business')
    assert.equal(plan.monthlyPkr, 2499)
  })
})

describe('formatPrice', () => {
  it('free for null amount', () => assert.equal(formatPrice(null, 'monthly'), 'Free'))
  it('monthly format', () => assert.equal(formatPrice(999, 'monthly'), 'Rs. 999/month'))
  it('yearly format', () => assert.equal(formatPrice(9999, 'yearly'), 'Rs. 9,999/year'))
  it('lifetime format', () => assert.equal(formatPrice(25000, 'lifetime'), 'Rs. 25,000 one-time'))
  it('formats large yearly', () => assert.equal(formatPrice(25000, 'yearly'), 'Rs. 25,000/year'))
})

describe('yearlySaving', () => {
  it('returns null for free plan', () => assert.equal(yearlySaving(getPlan('starter')), null))
  it('calculates professional saving', () => {
    const saving = yearlySaving(getPlan('professional'))
    assert.equal(saving, 999 * 12 - 9999)
  })
  it('calculates business saving', () => {
    const saving = yearlySaving(getPlan('business'))
    assert.equal(saving, 2499 * 12 - 25000)
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
