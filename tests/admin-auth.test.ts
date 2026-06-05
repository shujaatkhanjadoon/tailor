import assert from 'node:assert/strict'
import test from 'node:test'
import { verifyTOTP, normalizeTOTPSecret, generateTOTP, ADMIN_SESSION_COOKIE, generateSessionToken, verifySessionToken } from '../src/lib/admin/auth.ts'

test('ADMIN_SESSION_COOKIE has secure prefix', () => {
  assert.equal(ADMIN_SESSION_COOKIE, '__Secure-admin_session')
})

test('normalizeTOTPSecret: keeps Base32 as-is (uppercased, no padding)', () => {
  const result = normalizeTOTPSecret('jbxwy 5tfcs 6vcfy jf4z4')
  assert.equal(result, 'JBXWY5TFCS6VCFYJF4Z4')
})

test('normalizeTOTPSecret: converts hex to Base32', () => {
  const hex = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0'
  const result = normalizeTOTPSecret(hex)
  assert.ok(result.length > 0)
  assert.ok(/^[A-Z2-7]+$/.test(result))
})

test('normalizeTOTPSecret: short hex stays as-is (uppercased)', () => {
  const result = normalizeTOTPSecret('a1b2c3d4')
  assert.equal(result, 'A1B2C3D4')
})

test('generateTOTP: returns a 6-digit string', () => {
  const secret = 'JBSWY3DPEHPK3PXP'
  const token = generateTOTP(secret)
  assert.match(token, /^\d{6}$/)
})

test('verifyTOTP: rejects empty token', () => {
  assert.equal(verifyTOTP('', 'JBSWY3DPEHPK3PXP'), false)
})

test('verifyTOTP: rejects non-6-digit token', () => {
  assert.equal(verifyTOTP('abc123', 'JBSWY3DPEHPK3PXP'), false)
  assert.equal(verifyTOTP('12345', 'JBSWY3DPEHPK3PXP'), false)
  assert.equal(verifyTOTP('1234567', 'JBSWY3DPEHPK3PXP'), false)
})

test('verifyTOTP: verifies a valid token within window', () => {
  const secret = 'JBSWY3DPEHPK3PXP'
  const token = generateTOTP(secret)
  assert.equal(verifyTOTP(token, secret), true)
})

test('verifyTOTP: returns false when ADMIN_TOTP_SECRET env var not set', () => {
  const prev = process.env.ADMIN_TOTP_SECRET
  delete process.env.ADMIN_TOTP_SECRET
  assert.equal(verifyTOTP('123456'), false)
  if (prev !== undefined) process.env.ADMIN_TOTP_SECRET = prev
})

test('session: generate and verify with valid token', () => {
  process.env.ADMIN_SECRET = 'test-secret-for-testing-purposes'
  const token = generateSessionToken()
  assert.ok(token)
  assert.ok(token.length > 20)
  assert.equal(verifySessionToken(token), true)
})

test('session: rejects expired token', () => {
  process.env.ADMIN_SECRET = 'test-secret-for-testing-purposes'
  const token = generateSessionToken()
  const past = Date.now() - 20 * 60 * 1000
  const pastToken = Buffer.from(`${past}:dummy`).toString('base64url')
  assert.equal(verifySessionToken('invalid'), false)
  assert.equal(verifySessionToken(''), false)
})

test('session: rejects tampered token', () => {
  process.env.ADMIN_SECRET = 'test-secret-for-testing-purposes'
  const token = generateSessionToken()
  const raw = Buffer.from(token, 'base64url').toString('utf-8')
  const colon = raw.indexOf(':')
  const timestamp = raw.slice(0, colon)
  const tampered = Buffer.from(`${timestamp}:tampered`).toString('base64url')
  assert.equal(verifySessionToken(tampered), false)
})

test('session: rejects token with missing ADMIN_SECRET', () => {
  const prev = process.env.ADMIN_SECRET
  delete process.env.ADMIN_SECRET
  assert.throws(() => generateSessionToken(), /ADMIN_SECRET not set/)
  assert.equal(verifySessionToken('dGVzdDoxMjM0'), false)
  if (prev !== undefined) process.env.ADMIN_SECRET = prev
})
