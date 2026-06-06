import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { validatePakistaniPhone, formatPhoneDisplay } from '../src/lib/security/phone.ts'

describe('validatePakistaniPhone', () => {
  it('validates standard 03xx number', () => {
    const r = validatePakistaniPhone('03001234567')
    assert.equal(r.valid, true)
    assert.equal(r.cleaned, '03001234567')
  })
  it('validates +92 number', () => {
    const r = validatePakistaniPhone('+923001234567')
    assert.equal(r.valid, true)
    assert.equal(r.cleaned, '03001234567')
  })
  it('validates 92-prefixed number', () => {
    const r = validatePakistaniPhone('923001234567')
    assert.equal(r.valid, true)
    assert.equal(r.cleaned, '03001234567')
  })
  it('strips non-digits from input', () => {
    const r = validatePakistaniPhone('0300-1234567')
    assert.equal(r.valid, true)
    assert.equal(r.cleaned, '03001234567')
  })
  it('strips spaces and dashes', () => {
    const r = validatePakistaniPhone(' 0300 123 4567 ')
    assert.equal(r.valid, true)
    assert.equal(r.cleaned, '03001234567')
  })
  it('rejects empty input', () => {
    const r = validatePakistaniPhone('')
    assert.equal(r.valid, false)
    assert.ok(r.error)
  })
  it('rejects too short', () => {
    const r = validatePakistaniPhone('0300123456')
    assert.equal(r.valid, false)
  })
  it('rejects too long', () => {
    const r = validatePakistaniPhone('030012345678')
    assert.equal(r.valid, false)
  })
  it('rejects invalid prefix', () => {
    const r = validatePakistaniPhone('02901234567')
    assert.equal(r.valid, false)
  })
  it('rejects landline starting with 0', () => {
    const r = validatePakistaniPhone('04212345678')
    assert.equal(r.valid, false)
  })
  it('rejects number not starting with 0', () => {
    const r = validatePakistaniPhone('3001234567')
    assert.equal(r.valid, false)
  })
})

describe('formatPhoneDisplay', () => {
  it('formats 11-digit to XXXX-XXX-XXXX', () => {
    assert.equal(formatPhoneDisplay('03001234567'), '0300-123-4567')
  })
  it('strips non-digits before formatting', () => {
    assert.equal(formatPhoneDisplay('0300-123-4567'), '0300-123-4567')
  })
  it('returns input as-is for non-11-digit', () => {
    assert.equal(formatPhoneDisplay('123'), '123')
  })
})
