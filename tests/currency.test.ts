import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { formatAmount, formatRupees } from '../src/lib/format/currency.ts'

describe('formatAmount', () => {
  it('formats number', () => assert.equal(formatAmount(1000), '1,000'))
  it('formats string number', () => assert.equal(formatAmount('2500'), '2,500'))
  it('returns 0 for null', () => assert.equal(formatAmount(null), '0'))
  it('returns 0 for undefined', () => assert.equal(formatAmount(undefined), '0'))
  it('returns 0 for NaN', () => assert.equal(formatAmount(NaN), '0'))
  it('returns 0 for Infinity', () => assert.equal(formatAmount(Infinity), '0'))
  it('rounds decimals', () => assert.equal(formatAmount(999.7), '1,000'))
  it('rounds down', () => assert.equal(formatAmount(999.3), '999'))
  it('formats zero', () => assert.equal(formatAmount(0), '0'))
  it('formats large number', () => assert.equal(formatAmount(10000000), '10,000,000'))
})

describe('formatRupees', () => {
  it('adds Rs. prefix', () => assert.equal(formatRupees(500), 'Rs. 500'))
  it('handles null', () => assert.equal(formatRupees(null), 'Rs. 0'))
  it('handles large values', () => assert.equal(formatRupees(100000), 'Rs. 100,000'))
})
