import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildActivationWhatsApp, buildRejectionWhatsApp, buildExpiryReminderWhatsApp } from '../src/lib/billing/whatsapp-notify.ts'

describe('buildActivationWhatsApp', () => {
  it('returns valid wa.me URL', () => {
    const url = buildActivationWhatsApp('03001234567', 'MyShop', 'Professional', 'monthly', null)
    assert.ok(url.startsWith('https://wa.me/'))
    assert.ok(url.includes('text='))
  })
  it('formats phone to 92 prefix', () => {
    const url = buildActivationWhatsApp('03001234567', 'MyShop', 'Pro', 'monthly', null)
    assert.ok(url.includes('wa.me/923001234567'))
  })
  it('handles phone with +92', () => {
    const url = buildActivationWhatsApp('+923001234567', 'S', 'P', 'yearly', null)
    assert.ok(url.includes('wa.me/923001234567'))
  })
  it('handles 92 prefixed phone', () => {
    const url = buildActivationWhatsApp('923001234567', 'S', 'P', 'monthly', null)
    assert.ok(url.includes('wa.me/923001234567'))
  })
  it('includes plan name in message', () => {
    const url = buildActivationWhatsApp('03001234567', 'Shop', 'Business', 'monthly', null)
    assert.ok(decodeURIComponent(url).includes('Business'))
  })
  it('mentions Lifetime plan for null expiry', () => {
    const url = buildActivationWhatsApp('03001234567', 'S', 'P', 'monthly', null)
    assert.ok(decodeURIComponent(url).includes('Lifetime'))
  })
  it('includes expiry date when provided', () => {
    const url = buildActivationWhatsApp('03001234567', 'S', 'P', 'monthly', '2026-12-31T00:00:00.000Z')
    assert.ok(decodeURIComponent(url).includes('December'))
  })
})

describe('buildRejectionWhatsApp', () => {
  it('returns valid wa.me URL', () => {
    const url = buildRejectionWhatsApp('03001234567', 'Invalid receipt')
    assert.ok(url.startsWith('https://wa.me/'))
    assert.ok(url.includes('text='))
  })
  it('includes rejection reason', () => {
    const url = buildRejectionWhatsApp('03001234567', 'Invalid receipt')
    const msg = decodeURIComponent(url)
    assert.ok(msg.includes('Invalid receipt'))
  })
})

describe('buildExpiryReminderWhatsApp', () => {
  it('returns valid wa.me URL', () => {
    const url = buildExpiryReminderWhatsApp('03001234567', 'MyShop', 'Professional', 5)
    assert.ok(url.startsWith('https://wa.me/'))
  })
  it('includes days left', () => {
    const url = buildExpiryReminderWhatsApp('03001234567', 'S', 'P', 3)
    const msg = decodeURIComponent(url)
    assert.ok(msg.includes('3 din'))
  })
  it('includes shop name', () => {
    const url = buildExpiryReminderWhatsApp('03001234567', 'MyShop', 'P', 5)
    assert.ok(decodeURIComponent(url).includes('MyShop'))
  })
})
