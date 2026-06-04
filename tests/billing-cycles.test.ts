import assert from 'node:assert/strict'
import test from 'node:test'

import { subscriptionExpiresAt } from '../src/lib/billing/cycles.ts'

// ── Monthly inclusive billing dates ──────────────────────────────

test('monthly: same-day-next-month for mid-month purchase', () => {
  assert.equal(
    subscriptionExpiresAt('monthly', new Date('2026-06-04T15:30:00.000Z')),
    '2026-07-04T00:00:00.000Z',
  )
})

test('monthly: Jan 31 clamps to Feb 28', () => {
  assert.equal(
    subscriptionExpiresAt('monthly', new Date('2026-01-31T15:30:00.000Z')),
    '2026-02-28T00:00:00.000Z',
  )
})

test('monthly: Jan 30 lands on Feb 28', () => {
  assert.equal(
    subscriptionExpiresAt('monthly', new Date('2026-01-30T15:30:00.000Z')),
    '2026-02-28T00:00:00.000Z',
  )
})

test('monthly: Mar 31 clamps to Apr 30', () => {
  assert.equal(
    subscriptionExpiresAt('monthly', new Date('2026-03-31T15:30:00.000Z')),
    '2026-04-30T00:00:00.000Z',
  )
})

test('monthly: Mar 30 stays Apr 30', () => {
  assert.equal(
    subscriptionExpiresAt('monthly', new Date('2026-03-30T15:30:00.000Z')),
    '2026-04-30T00:00:00.000Z',
  )
})

test('monthly: Dec 31 clamps to Jan 31 of next year', () => {
  assert.equal(
    subscriptionExpiresAt('monthly', new Date('2026-12-31T15:30:00.000Z')),
    '2027-01-31T00:00:00.000Z',
  )
})

test('monthly: Sep 1 stays Oct 1', () => {
  assert.equal(
    subscriptionExpiresAt('monthly', new Date('2026-09-01T03:00:00.000Z')),
    '2026-10-01T00:00:00.000Z',
  )
})

test('monthly: Feb 28 in non-leap clamps to Mar 28', () => {
  assert.equal(
    subscriptionExpiresAt('monthly', new Date('2026-02-28T12:00:00.000Z')),
    '2026-03-28T00:00:00.000Z',
  )
})

// ── Yearly inclusive billing dates ──────────────────────────────

test('yearly: same-day-next-year for mid-year purchase', () => {
  assert.equal(
    subscriptionExpiresAt('yearly', new Date('2026-06-04T15:30:00.000Z')),
    '2027-06-04T00:00:00.000Z',
  )
})

test('yearly: leap Feb 29 clamps to Feb 28 in non-leap', () => {
  assert.equal(
    subscriptionExpiresAt('yearly', new Date('2024-02-29T12:00:00.000Z')),
    '2025-02-28T00:00:00.000Z',
  )
})

// ── Lifetime ────────────────────────────────────────────────────

test('lifetime never expires', () => {
  assert.equal(
    subscriptionExpiresAt('lifetime', new Date('2026-06-04T15:30:00.000Z')),
    null,
  )
})

// ── Null / undefined cycle handling ─────────────────────────────

test('null cycle defaults to monthly', () => {
  const result = subscriptionExpiresAt(null)
  assert.ok(typeof result === 'string')
})

test('undefined cycle defaults to monthly', () => {
  const result = subscriptionExpiresAt(undefined)
  assert.ok(typeof result === 'string')
})

// ── Extension logic (renewal/upgrade preserves old expiry) ──────

test('monthly renewal extends from old expiry, not now', () => {
  // Simulate: user was active until July 4, renews on June 20
  const oldExpiry = new Date('2026-07-04T00:00:00.000Z')
  const result = subscriptionExpiresAt('monthly', oldExpiry)
  // Should extend one month from old expiry: Aug 4
  assert.equal(result, '2026-08-04T00:00:00.000Z')
})

test('yearly renewal extends from old expiry', () => {
  const oldExpiry = new Date('2026-07-04T00:00:00.000Z')
  const result = subscriptionExpiresAt('yearly', oldExpiry)
  assert.equal(result, '2027-07-04T00:00:00.000Z')
})

test('renewal clamps month-end correctly when extending', () => {
  const oldExpiry = new Date('2026-01-31T00:00:00.000Z')
  const result = subscriptionExpiresAt('monthly', oldExpiry)
  // Jan 31 + 1 month → Feb 28 (clamped)
  assert.equal(result, '2026-02-28T00:00:00.000Z')
})

// ── Cron expiry comparisons (edge cases for cron checks) ─────────

test('expiry at midnight UTC is correctly past by 1am cron', () => {
  const expiresAt = new Date('2026-07-04T00:00:00.000Z')
  const cronRun   = new Date('2026-07-04T01:00:00.000Z')
  // Cron checks: expires_at < now
  assert.ok(expiresAt < cronRun, 'expires_at should be < cron run time for expiry')
})

test('expiry at midnight UTC is NOT past at 11pm day before', () => {
  const expiresAt = new Date('2026-07-04T00:00:00.000Z')
  const cronRun   = new Date('2026-07-03T23:00:00.000Z')
  assert.ok(!(expiresAt < cronRun), 'expires_at should NOT be < cron run before midnight')
})
