import assert from 'node:assert/strict'
import { describe, it, before, after, afterEach } from 'node:test'
import { randomUUID } from 'node:crypto'

// ── Test environment (set BEFORE any module imports) ───────────────
const TEST_ENV = {
  NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
  NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
  ADMIN_SECRET: 'test-admin-secret-for-api-tests',
  SESSION_SIGNING_SECRET: 'test-session-signing-secret-for-api-tests',
  ADMIN_TOTP_SECRET: 'JBSWY3DPEHPK3PXP',
  CRON_SECRET: 'test-cron-secret-for-api-tests',
  OTP_PEPPER_SECRET: 'test-otp-pepper-for-api-tests',
  RESEND_API_KEY: 'test-resend-key-for-api-tests',
  ADMIN_NOTIFICATION_EMAIL: 'admin@test.local',
}
for (const [k, v] of Object.entries(TEST_ENV)) process.env[k] = v

// ── Mock NextRequest / NextResponse (no import from next/server) ───
class MockNextRequest extends Request {
  private readonly _cookies: Map<string, string>

  constructor(input: string | URL, init?: RequestInit & { headers?: Record<string, string> | [string, string][] | Headers }) {
    super(input, init)
    this._cookies = new Map()
    const h = new Headers(init?.headers)
    const raw = h.get('Cookie') || h.get('cookie') || ''
    raw.split(';').forEach(pair => {
      const idx = pair.indexOf('=')
      if (idx > 0) {
        const k = pair.substring(0, idx).trim()
        const v = pair.substring(idx + 1).trim()
        if (k) this._cookies.set(k, v)
      }
    })
  }

  get cookies() {
    return {
      get: (name: string) => {
        const value = this._cookies.get(name)
        return value ? { value } : undefined
      },
    }
  }
}

function api(path: string, body?: unknown, cookie?: string, ip?: string): MockNextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (cookie) headers['Cookie'] = cookie
  if (ip) headers['x-forwarded-for'] = ip
  return new MockNextRequest(`http://localhost${path}`, {
    method: 'POST',
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

function apiGet(path: string, cookie?: string): MockNextRequest {
  const headers: Record<string, string> = {}
  if (cookie) headers['Cookie'] = cookie
  return new MockNextRequest(`http://localhost${path}`, { method: 'GET', headers })
}

function apiDelete(path: string, cookie?: string): MockNextRequest {
  const headers: Record<string, string> = {}
  if (cookie) headers['Cookie'] = cookie
  return new MockNextRequest(`http://localhost${path}`, { method: 'DELETE', headers })
}

// ── Fetch mock ──────────────────────────────────────────────────────
type JsonValue = unknown
interface MockEntry { status: number; body: JsonValue | ((url: string, init: RequestInit) => JsonValue) }
const mockRoutes = new Map<string, MockEntry>()
let originalFetch: typeof global.fetch

function mockFetch(url: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.href : url.url
  for (const [pattern, entry] of mockRoutes) {
    if (urlStr.includes(pattern)) {
      const body = typeof entry.body === 'function'
        ? (entry.body as (u: string, i: RequestInit) => JsonValue)(urlStr, init ?? {})
        : entry.body
      const bodyStr = body !== undefined ? JSON.stringify(body) : ''
      return Promise.resolve(new Response(bodyStr, {
        status: entry.status,
        headers: { 'Content-Type': 'application/json' },
      }))
    }
  }
  if (urlStr.includes('api.resend.com')) {
    return Promise.resolve(new Response(JSON.stringify({ data: { id: 'mock-email-id' } }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    }))
  }
  if (urlStr.includes('api.callmebot.com')) {
    return Promise.resolve(new Response('', { status: 200 }))
  }
  return Promise.resolve(new Response(JSON.stringify([]), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  }))
}

function mockSupabase(table: string, body: JsonValue, status = 200) {
  mockRoutes.set(`/rest/v1/${table}`, { status, body })
}

function clearMocks() {
  mockRoutes.clear()
}

// Each test gets a unique IP to avoid shared rate limit state
let ipCounter = 0
function uniqueIP(): string {
  ipCounter++
  return `10.0.${Math.floor(ipCounter / 256)}.${ipCounter % 256}`
}

// ── Dynamic import route handlers ──────────────────────────────────
type Handler = (req: MockNextRequest) => Promise<Response>
const h: Record<string, Handler> = {}

before(async () => {
  originalFetch = global.fetch
  global.fetch = mockFetch as typeof global.fetch

  const mods = await Promise.all([
    import('../src/app/api/auth/create-shop/route.ts') as unknown as Promise<{ POST: Handler }>,
    import('../src/app/api/auth/session/route.ts') as unknown as Promise<{ POST: Handler; GET: Handler; DELETE: Handler }>,
  ])
  h.createShop = mods[0].POST
  h.sessionPost = mods[1].POST
  h.sessionGet = mods[1].GET
  h.sessionDelete = mods[1].DELETE
})

after(() => {
  global.fetch = originalFetch
})

// ── Shared test data ───────────────────────────────────────────────
const TEST_SHOP_ID = randomUUID()
const TEST_MEMBER_ID = randomUUID()

// ════════════════════════════════════════════════════════════════════
//  POST /api/auth/create-shop
// ════════════════════════════════════════════════════════════════════
describe('POST /api/auth/create-shop', () => {
  afterEach(() => clearMocks())

  it('returns 400 for missing required fields', async () => {
    const res = await h.createShop(api('/api/auth/create-shop', {}, undefined, uniqueIP()))
    assert.equal(res.status, 400)
  })

  it('returns 400 for missing shop name', async () => {
    const res = await h.createShop(api('/api/auth/create-shop', {
      shopId: TEST_SHOP_ID,
      phone: '03001928377',
      pin: '192837',
      email: 'test@example.com',
      ownerName: 'Test Owner',
    }, undefined, uniqueIP()))
    assert.equal(res.status, 400)
  })

  it('returns 400 for weak PIN', async () => {
    const res = await h.createShop(api('/api/auth/create-shop', {
      shopId: TEST_SHOP_ID,
      shopName: 'Test Tailor',
      phone: '03001928377',
      pin: '12',
      email: 'test@example.com',
      ownerName: 'Test Owner',
    }, undefined, uniqueIP()))
    assert.equal(res.status, 400)
  })

  it('returns 409 for duplicate phone', async () => {
    mockSupabase(
      `team_members?phone=eq.03001928377&is_active=eq.true&select=id,shop_id&limit=1`,
      [{ id: TEST_MEMBER_ID, shop_id: randomUUID() }]
    )
    const res = await h.createShop(api('/api/auth/create-shop', {
      shopId: TEST_SHOP_ID,
      shopName: 'Test Tailor',
      phone: '03001928377',
      pin: '192837',
      email: 'dup-phone@example.com',
      ownerName: 'Test Owner',
    }, undefined, uniqueIP()))
    assert.equal(res.status, 409)
  })

  it('returns 409 for duplicate email', async () => {
    mockSupabase(
      `team_members?phone=eq.03009999999&is_active=eq.true&select=id,shop_id&limit=1`,
      []
    )
    mockSupabase(
      `team_members?email=eq.dup%40example.com&is_active=eq.true&select=id,shop_id&limit=1`,
      [{ id: TEST_MEMBER_ID, shop_id: randomUUID() }]
    )
    const res = await h.createShop(api('/api/auth/create-shop', {
      shopId: TEST_SHOP_ID,
      shopName: 'Test Tailor',
      phone: '03009999999',
      pin: '192837',
      email: 'dup@example.com',
      ownerName: 'Test Owner',
    }, undefined, uniqueIP()))
    assert.equal(res.status, 409)
  })

  it('returns 403 when email is not verified', async () => {
    mockSupabase(
      `team_members?phone=eq.03009999998&is_active=eq.true&select=id,shop_id&limit=1`,
      []
    )
    mockSupabase(
      `team_members?email=eq.unverified%40example.com&is_active=eq.true&select=id,shop_id&limit=1`,
      []
    )
    mockSupabase(
      `email_verifications?phone=eq.03009999998&email=eq.unverified%40example.com&verified_at=not.is.null&select=id&order=verified_at.desc&limit=1`,
      []
    )
    const res = await h.createShop(api('/api/auth/create-shop', {
      shopId: TEST_SHOP_ID,
      shopName: 'Test Tailor',
      phone: '03009999998',
      pin: '192837',
      email: 'unverified@example.com',
      ownerName: 'Test Owner',
    }, undefined, uniqueIP()))
    assert.equal(res.status, 403)
  })

  it('creates shop successfully (201)', async () => {
    const shopId = randomUUID()
    const memberId = randomUUID()
    mockSupabase(
      `team_members?phone=eq.03009999997&is_active=eq.true&select=id,shop_id&limit=1`,
      []
    )
    mockSupabase(
      `team_members?email=eq.success%40example.com&is_active=eq.true&select=id,shop_id&limit=1`,
      []
    )
    mockSupabase(
      `email_verifications?phone=eq.03009999997&email=eq.success%40example.com&verified_at=not.is.null&select=id&order=verified_at.desc&limit=1`,
      [{ id: randomUUID() }]
    )
    mockSupabase('shops?id=eq.' + shopId, {}, 200)
    mockSupabase('team_members?id=eq.', {}, 200)
    mockSupabase('subscriptions?shop_id=eq.' + shopId, {}, 200)
    mockSupabase('shop_usage?shop_id=eq.' + shopId, {}, 200)
    mockSupabase('shop_verification_requests', {}, 201)
    const res = await h.createShop(api('/api/auth/create-shop', {
      shopId,
      shopName: 'New Tailor Shop',
      phone: '03009999997',
      pin: '192837',
      email: 'success@example.com',
      ownerName: 'Owner Saab',
    }, undefined, uniqueIP()))
    assert.equal(res.status, 201)
    const body = await res.json() as any
    assert.equal(body.success, true)
    assert.equal(body.data.shopId, shopId)
  })

  it('returns 400 for invalid email format', async () => {
    const res = await h.createShop(api('/api/auth/create-shop', {
      shopId: TEST_SHOP_ID,
      shopName: 'Test Tailor',
      phone: '03001928377',
      pin: '192837',
      email: 'not-an-email',
      ownerName: 'Test Owner',
    }, undefined, uniqueIP()))
    assert.equal(res.status, 400)
  })

  it('returns 400 for invalid phone format', async () => {
    const res = await h.createShop(api('/api/auth/create-shop', {
      shopId: TEST_SHOP_ID,
      shopName: 'Test Tailor',
      phone: 'abc123',
      pin: '192837',
      email: 'test@example.com',
      ownerName: 'Test Owner',
    }, undefined, uniqueIP()))
    assert.equal(res.status, 400)
  })

  it('returns 400 for invalid shopId (not a UUID)', async () => {
    const res = await h.createShop(api('/api/auth/create-shop', {
      shopId: 'not-a-uuid',
      shopName: 'Test Tailor',
      phone: '03001928377',
      pin: '192837',
      email: 'test@example.com',
      ownerName: 'Test Owner',
    }, undefined, uniqueIP()))
    assert.equal(res.status, 400)
  })

  it('returns 400 for too short shop name', async () => {
    const res = await h.createShop(api('/api/auth/create-shop', {
      shopId: TEST_SHOP_ID,
      shopName: 'A',
      phone: '03001928377',
      pin: '192837',
      email: 'test@example.com',
      ownerName: 'Test Owner',
    }, undefined, uniqueIP()))
    assert.equal(res.status, 400)
  })

  it('returns 400 for too short owner name', async () => {
    const res = await h.createShop(api('/api/auth/create-shop', {
      shopId: TEST_SHOP_ID,
      shopName: 'Test Tailor',
      phone: '03001928377',
      pin: '192837',
      email: 'test@example.com',
      ownerName: 'A',
    }, undefined, uniqueIP()))
    assert.equal(res.status, 400)
  })

  it('returns 400 for PIN with all same digits', async () => {
    const res = await h.createShop(api('/api/auth/create-shop', {
      shopId: TEST_SHOP_ID,
      shopName: 'Test Tailor',
      phone: '03001928377',
      pin: '111111',
      email: 'test@example.com',
      ownerName: 'Test Owner',
    }, undefined, uniqueIP()))
    assert.equal(res.status, 400)
  })

  it('returns 400 for sequential PIN', async () => {
    const res = await h.createShop(api('/api/auth/create-shop', {
      shopId: TEST_SHOP_ID,
      shopName: 'Test Tailor',
      phone: '03001928377',
      pin: '123456',
      email: 'test@example.com',
      ownerName: 'Test Owner',
    }, undefined, uniqueIP()))
    assert.equal(res.status, 400)
  })

  it('returns 500 when shop upsert fails', async () => {
    mockSupabase(
      `team_members?phone=eq.03009999996&is_active=eq.true&select=id,shop_id&limit=1`,
      []
    )
    mockSupabase(
      `team_members?email=eq.faildb%40example.com&is_active=eq.true&select=id,shop_id&limit=1`,
      []
    )
    mockSupabase(
      `email_verifications?phone=eq.03009999996&email=eq.faildb%40example.com&verified_at=not.is.null&select=id&order=verified_at.desc&limit=1`,
      [{ id: randomUUID() }]
    )
    mockSupabase('shops?on_conflict=id', { error: 'DB failure' }, 500)
    const res = await h.createShop(api('/api/auth/create-shop', {
      shopId: TEST_SHOP_ID,
      shopName: 'DB Fail Shop',
      phone: '03009999996',
      pin: '192837',
      email: 'faildb@example.com',
      ownerName: 'DB Fail Owner',
    }, undefined, uniqueIP()))
    assert.equal(res.status, 500)
  })

  it('returns 201 with all optional fields (city, stateProvince, etc.)', async () => {
    const shopId = randomUUID()
    mockSupabase(
      `team_members?phone=eq.03009999995&is_active=eq.true&select=id,shop_id&limit=1`,
      []
    )
    mockSupabase(
      `team_members?email=eq.optional%40example.com&is_active=eq.true&select=id,shop_id&limit=1`,
      []
    )
    mockSupabase(
      `email_verifications?phone=eq.03009999995&email=eq.optional%40example.com&verified_at=not.is.null&select=id&order=verified_at.desc&limit=1`,
      [{ id: randomUUID() }]
    )
    mockSupabase('shops?id=eq.' + shopId, {}, 200)
    mockSupabase('team_members?id=eq.', {}, 200)
    mockSupabase('subscriptions?shop_id=eq.' + shopId, {}, 200)
    mockSupabase('shop_usage?shop_id=eq.' + shopId, {}, 200)
    mockSupabase('shop_verification_requests', {}, 201)
    const res = await h.createShop(api('/api/auth/create-shop', {
      shopId,
      shopName: 'Optional Fields Shop',
      phone: '03009999995',
      pin: '192837',
      email: 'optional@example.com',
      ownerName: 'Optional Owner',
      city: 'Lahore',
      stateProvince: 'Punjab',
      addressLine: '123 Main St',
      postalCode: '54000',
    }, undefined, uniqueIP()))
    assert.equal(res.status, 201)
    const body = await res.json() as any
    assert.equal(body.success, true)
    assert.equal(body.data.shopId, shopId)
  })

  it('replays cached response when idempotency key is reused', async () => {
    const shopId = randomUUID()
    const key = randomUUID()
    mockSupabase(
      `team_members?phone=eq.03009999994&is_active=eq.true&select=id,shop_id&limit=1`,
      []
    )
    mockSupabase(
      `team_members?email=eq.idempotent%40example.com&is_active=eq.true&select=id,shop_id&limit=1`,
      []
    )
    mockSupabase(
      `email_verifications?phone=eq.03009999994&email=eq.idempotent%40example.com&verified_at=not.is.null&select=id&order=verified_at.desc&limit=1`,
      [{ id: randomUUID() }]
    )
    mockSupabase('shops?id=eq.' + shopId, {}, 200)
    mockSupabase('team_members?id=eq.', {}, 200)
    mockSupabase('subscriptions?shop_id=eq.' + shopId, {}, 200)
    mockSupabase('shop_usage?shop_id=eq.' + shopId, {}, 200)
    mockSupabase('shop_verification_requests', {}, 201)

    const req = new MockNextRequest('http://localhost/api/auth/create-shop', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': key,
      },
      body: JSON.stringify({
        shopId,
        shopName: 'Idempotent Shop',
        phone: '03009999994',
        pin: '192837',
        email: 'idempotent@example.com',
        ownerName: 'Idempotent Owner',
      }),
    })
    const first = await h.createShop(req)
    assert.equal(first.status, 201)

    const second = await h.createShop(req)
    assert.equal(second.status, 201)
    assert.equal(second.headers.get('X-Idempotent'), 'replayed')
  })

  it('returns 429 when rate limited (sensitive limit = 5)', async () => {
    const ip = '10.0.99.99'
    const shopId = randomUUID()
    for (let i = 0; i < 5; i++) {
      const req = api('/api/auth/create-shop', {
        shopId, shopName: 'Rate Test', phone: `0300999${String(i).padStart(5, '0')}`,
        pin: '192837', email: `rate${i}@example.com`, ownerName: 'Owner',
      }, undefined, ip)
      await h.createShop(req)
      clearMocks()
    }
    const finalReq = api('/api/auth/create-shop', {
      shopId, shopName: 'Rate Test', phone: '030099999999',
      pin: '192837', email: 'ratelast@example.com', ownerName: 'Owner',
    }, undefined, ip)
    const res = await h.createShop(finalReq)
    assert.equal(res.status, 429)
  })
})

// ════════════════════════════════════════════════════════════════════
//  GET /api/auth/session
// ════════════════════════════════════════════════════════════════════
describe('GET /api/auth/session', () => {
  afterEach(() => clearMocks())

  it('returns 401 without a session cookie', async () => {
    const res = await h.sessionGet(apiGet('/api/auth/session'))
    assert.equal(res.status, 401)
    const body = await res.json() as any
    assert.equal(body.error, 'No session')
  })

  it('returns 401 with an expired token', async () => {
    const { generateMemberSessionToken } = await import('../src/lib/auth/session.ts')
    const token = generateMemberSessionToken(TEST_MEMBER_ID, TEST_SHOP_ID)
    const cookie = `__Secure-md_session=${token}`
    const res = await h.sessionGet(apiGet('/api/auth/session', cookie))
    assert.equal(res.status, 401)
  })

  it('returns member info (200) with active session', async () => {
    const { generateMemberSessionToken } = await import('../src/lib/auth/session.ts')
    const token = generateMemberSessionToken(TEST_MEMBER_ID, TEST_SHOP_ID)
    const cookie = `__Secure-md_session=${token}`

    mockSupabase(
      `team_members?id=eq.${TEST_MEMBER_ID}&is_active=eq.true&deleted_at=is.null`,
      [{
        id: TEST_MEMBER_ID, shop_id: TEST_SHOP_ID, name: 'Test Member',
        phone: '03001928377', role: 'owner', pin_hash: '', speciality: null,
        pay_rate_type: null, pay_rate: null, email: null, email_verified: false,
        is_active: true, joined_at: '2026-01-01', created_at: new Date().toISOString(),
        deleted_at: null, updated_at: null, token_version: 1,
      }]
    )
    mockSupabase(
      `shops?id=eq.${TEST_SHOP_ID}&select=is_active&limit=1`,
      [{ is_active: true }]
    )

    const res = await h.sessionGet(apiGet('/api/auth/session', cookie))
    assert.equal(res.status, 200)
    const body = await res.json() as any
    assert.equal(body.authenticated, true)
    assert.equal(body.memberId, TEST_MEMBER_ID)
    assert.equal(body.shopId, TEST_SHOP_ID)
    assert.equal(body.shopActive, true)
    assert.equal(body.member.id, TEST_MEMBER_ID)
  })

  it('rejects session when token_version is revoked', async () => {
    const { generateMemberSessionToken } = await import('../src/lib/auth/session.ts')
    const token = generateMemberSessionToken(TEST_MEMBER_ID, TEST_SHOP_ID, undefined, 1)
    const cookie = `__Secure-md_session=${token}`

    mockSupabase(
      `team_members?id=eq.${TEST_MEMBER_ID}&is_active=eq.true&deleted_at=is.null`,
      [{
        id: TEST_MEMBER_ID, shop_id: TEST_SHOP_ID, name: 'Revoked Member',
        phone: '03001928377', role: 'owner', pin_hash: '',
        speciality: null, pay_rate_type: null, pay_rate: null,
        email: null, email_verified: false,
        is_active: true, joined_at: '2026-01-01',
        created_at: new Date().toISOString(),
        deleted_at: null, updated_at: null, token_version: 2,
      }]
    )

    const res = await h.sessionGet(apiGet('/api/auth/session', cookie))
    assert.equal(res.status, 401)
    const body = await res.json() as any
    assert.equal(body.error, 'Session revoked')
  })

  it('rejects session when member does not belong to session shop', async () => {
    const { generateMemberSessionToken } = await import('../src/lib/auth/session.ts')
    const token = generateMemberSessionToken(TEST_MEMBER_ID, TEST_SHOP_ID)
    const cookie = `__Secure-md_session=${token}`

    mockSupabase(
      `team_members?id=eq.${TEST_MEMBER_ID}&is_active=eq.true&deleted_at=is.null`,
      [{
        id: TEST_MEMBER_ID, shop_id: randomUUID(), name: 'Wrong Shop Member',
        phone: '03001928377', role: 'owner', pin_hash: '',
        speciality: null, pay_rate_type: null, pay_rate: null,
        email: null, email_verified: false,
        is_active: true, joined_at: '2026-01-01',
        created_at: new Date().toISOString(),
        deleted_at: null, updated_at: null, token_version: 1,
      }]
    )

    const res = await h.sessionGet(apiGet('/api/auth/session', cookie))
    assert.equal(res.status, 401)
    const body = await res.json() as any
    assert.equal(body.error, 'Session shop mismatch')
  })

  it('rotates session token on each GET', async () => {
    const { generateMemberSessionToken } = await import('../src/lib/auth/session.ts')
    const token = generateMemberSessionToken(TEST_MEMBER_ID, TEST_SHOP_ID)
    const cookie = `__Secure-md_session=${token}`

    mockSupabase(
      `team_members?id=eq.${TEST_MEMBER_ID}&is_active=eq.true&deleted_at=is.null`,
      [{
        id: TEST_MEMBER_ID, shop_id: TEST_SHOP_ID, name: 'Rotation Test',
        phone: '03001928377', role: 'owner', pin_hash: '',
        speciality: null, pay_rate_type: null, pay_rate: null,
        email: null, email_verified: false,
        is_active: true, joined_at: '2026-01-01',
        created_at: new Date().toISOString(),
        deleted_at: null, updated_at: null, token_version: 1,
      }]
    )
    mockSupabase(
      `shops?id=eq.${TEST_SHOP_ID}&select=is_active&limit=1`,
      [{ is_active: true }]
    )

    const res = await h.sessionGet(apiGet('/api/auth/session', cookie))
    assert.equal(res.status, 200)
    const setCookie = res.headers.get('Set-Cookie')
    assert.ok(setCookie)
    assert.ok(setCookie.includes('__Secure-md_session='))
    const newTokenMatch = setCookie.match(/__Secure-md_session=([^;]+)/)
    assert.ok(newTokenMatch)
    assert.notEqual(newTokenMatch[1], token)
  })
})

// ════════════════════════════════════════════════════════════════════
//  DELETE /api/auth/session (logout)
// ════════════════════════════════════════════════════════════════════
describe('DELETE /api/auth/session', () => {
  it('clears session cookie on logout', async () => {
    const res = await h.sessionDelete(apiDelete('/api/auth/session', '__Secure-md_session=any-token'))
    assert.equal(res.status, 200)
    const body = await res.json() as any
    assert.equal(body.success, true)
    assert.equal(body.data.loggedOut, true)
    const setCookie = res.headers.get('Set-Cookie')
    assert.ok(setCookie)
    assert.ok(setCookie.includes('__Secure-md_session=;'))
    assert.ok(setCookie.includes('Max-Age=0'))
  })
})
