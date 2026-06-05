import assert from 'node:assert/strict'
import test from 'node:test'
import { getClientIP, getClientFingerprint, getRateLimitId, checkRateLimit } from '../src/lib/security/rate-limit.ts'

function mockReq(headers: Record<string, string>): Request {
  return { headers: { get: (k: string) => headers[k.toLowerCase()] ?? null } } as unknown as Request
}

test('getClientIP: falls back to 127.0.0.1', () => {
  const req = mockReq({})
  assert.equal(getClientIP(req), '127.0.0.1')
})

test('getClientIP: picks first x-forwarded-for', () => {
  const req = mockReq({ 'x-forwarded-for': '203.0.113.1, 10.0.0.1' })
  assert.equal(getClientIP(req), '203.0.113.1')
})

test('getClientIP: prefers x-forwarded-for over x-real-ip', () => {
  const req = mockReq({ 'x-forwarded-for': '203.0.113.1', 'x-real-ip': '10.0.0.1' })
  assert.equal(getClientIP(req), '203.0.113.1')
})

test('getClientIP: falls back to x-real-ip', () => {
  const req = mockReq({ 'x-real-ip': '203.0.113.1' })
  assert.equal(getClientIP(req), '203.0.113.1')
})

test('getClientIP: falls back to cf-connecting-ip', () => {
  const req = mockReq({ 'cf-connecting-ip': '203.0.113.1' })
  assert.equal(getClientIP(req), '203.0.113.1')
})

test('getClientFingerprint: returns consistent hash for same headers', () => {
  const req1 = mockReq({ 'user-agent': 'Chrome/120', 'accept-language': 'en-US' })
  const req2 = mockReq({ 'user-agent': 'Chrome/120', 'accept-language': 'en-US' })
  assert.equal(getClientFingerprint(req1), getClientFingerprint(req2))
})

test('getClientFingerprint: returns different hash for different user-agents', () => {
  const req1 = mockReq({ 'user-agent': 'Chrome/120', 'accept-language': 'en-US' })
  const req2 = mockReq({ 'user-agent': 'Firefox/121', 'accept-language': 'en-US' })
  assert.notEqual(getClientFingerprint(req1), getClientFingerprint(req2))
})

test('getClientFingerprint: empty headers produce a fallback', () => {
  const req = mockReq({})
  const fp = getClientFingerprint(req)
  assert.ok(typeof fp === 'string')
  assert.ok(fp.length > 0)
})

test('getRateLimitId: combines IP and fingerprint', () => {
  const req = mockReq({ 'x-forwarded-for': '203.0.113.1', 'user-agent': 'Chrome/120' })
  const id = getRateLimitId(req)
  assert.ok(id.includes('203.0.113.1'))
})

test('checkRateLimit: in-memory fallback allows requests', async () => {
  const req = mockReq({ 'x-forwarded-for': '198.51.100.1' })
  const result = await checkRateLimit(null, `test:${getRateLimitId(req)}`, 'normal')
  assert.equal(result.allowed, true)
  assert.ok(result.remaining !== undefined)
  assert.ok(result.reset instanceof Date)
})

test('checkRateLimit: in-memory fallback blocks after limit for sensitive', async () => {
  const id = `sensitive-test:127.0.0.1|${Date.now()}`
  const results: boolean[] = []
  for (let i = 0; i < 10; i++) {
    const r = await checkRateLimit(null, id, 'sensitive')
    results.push(r.allowed)
  }
  const allowed = results.filter(Boolean).length
  const blocked = results.filter(r => !r).length
  assert.equal(allowed, 5, 'sensitive limit allows exactly 5 requests')
  assert.ok(blocked >= 1, 'sensitive limit blocks excess requests')
})

test('checkRateLimit: in-memory normal allows 60 requests', async () => {
  const id = `normal-test:127.0.0.1|${Date.now()}`
  let allowed = 0
  for (let i = 0; i < 70; i++) {
    const r = await checkRateLimit(null, id, 'normal')
    if (r.allowed) allowed++
  }
  assert.equal(allowed, 60, 'normal limit allows exactly 60 requests')
})
