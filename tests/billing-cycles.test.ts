import assert from 'node:assert/strict'
import test from 'node:test'

import { subscriptionExpiresAt } from '../src/lib/billing/cycles.ts'

test('monthly subscriptions expire on the final inclusive billing date', () => {
  assert.equal(
    subscriptionExpiresAt('monthly', new Date('2026-06-04T15:30:00.000Z')),
    '2026-07-03T00:00:00.000Z',
  )
})

test('yearly subscriptions expire on the final inclusive billing date', () => {
  assert.equal(
    subscriptionExpiresAt('yearly', new Date('2026-06-04T15:30:00.000Z')),
    '2027-06-03T00:00:00.000Z',
  )
})

test('lifetime subscriptions do not expire', () => {
  assert.equal(
    subscriptionExpiresAt('lifetime', new Date('2026-06-04T15:30:00.000Z')),
    null,
  )
})

test('month-end subscriptions clamp to the last valid target date', () => {
  assert.equal(
    subscriptionExpiresAt('monthly', new Date('2026-01-31T15:30:00.000Z')),
    '2026-02-28T00:00:00.000Z',
  )
})
