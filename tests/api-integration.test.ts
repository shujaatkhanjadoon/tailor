import assert from 'node:assert/strict'
import { describe, it, before, after, afterEach } from 'node:test'
import { randomUUID } from 'node:crypto'
import { generateMemberSessionToken } from '../src/lib/auth/session.ts'
import { generateTOTP } from '../src/lib/admin/auth.ts'

// ── Test environment (set BEFORE any module imports) ───────────────
const TEST_ENV = {
  NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
  NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
  ADMIN_SECRET: 'test-admin-secret-for-api-tests',
  ADMIN_TOTP_SECRET: 'JBSWY3DPEHPK3PXP',
  SESSION_SIGNING_SECRET: 'test-session-signing-secret-for-api-tests',
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

function api(path: string, body?: unknown, cookie?: string): MockNextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (cookie) headers['Cookie'] = cookie
  return new MockNextRequest(`http://localhost${path}`, {
    method: 'POST',
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
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
  // Default handlers for external APIs
  if (urlStr.includes('api.resend.com')) {
    return Promise.resolve(new Response(JSON.stringify({ data: { id: 'mock-email-id' } }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    }))
  }
  if (urlStr.includes('api.callmebot.com')) {
    return Promise.resolve(new Response('', { status: 200 }))
  }
  // Default: empty Supabase response (no rows found)
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

// ── Dynamic import route handlers ──────────────────────────────────
type Handler = (req: MockNextRequest) => Promise<Response>
const h: Record<string, Handler> = {}

before(async () => {
  originalFetch = global.fetch
  global.fetch = mockFetch as typeof global.fetch

  const mods = await Promise.all([
    import('../src/app/api/auth/check-phone/route.ts') as unknown as Promise<{ POST: Handler }>,
    import('../src/app/api/auth/send-otp/route.ts') as unknown as Promise<{ POST: Handler }>,
    import('../src/app/api/auth/verify-otp/route.ts') as unknown as Promise<{ POST: Handler }>,
    import('../src/app/api/auth/login/route.ts') as unknown as Promise<{ POST: Handler }>,
    import('../src/app/api/measurements/route.ts') as unknown as Promise<{ POST: Handler }>,
    import('../src/app/api/team/members/route.ts') as unknown as Promise<{ POST: Handler }>,
    import('../src/app/api/billing/submit-payment/route.ts') as unknown as Promise<{ POST: Handler }>,
    import('../src/app/api/admin/login/route.ts') as unknown as Promise<{ POST: Handler }>,
    import('../src/app/api/auth/session/route.ts') as unknown as Promise<{ POST: Handler }>,
  ])
  h.checkPhone = mods[0].POST
  h.sendOtp = mods[1].POST
  h.verifyOtp = mods[2].POST
  h.login = mods[3].POST
  h.measurements = mods[4].POST
  h.teamMembers = mods[5].POST
  h.submitPayment = mods[6].POST
  h.adminLogin = mods[7].POST
  h.session = mods[8].POST
})

after(() => {
  global.fetch = originalFetch
})

// ── Shared test data ───────────────────────────────────────────────
const TEST_SHOP_ID = '00000000-0000-0000-0000-000000000001'
const TEST_MEMBER_ID = '00000000-0000-0000-0000-000000000002'
const TEST_CUSTOMER_ID = '00000000-0000-4000-8000-000000000003'

function makeSessionToken(): string {
  return generateMemberSessionToken(TEST_MEMBER_ID, TEST_SHOP_ID)
}

function authCookie(): string {
  return `__Secure-md_session=${makeSessionToken()}`
}

// ════════════════════════════════════════════════════════════════════
//  POST /api/auth/check-phone
// ════════════════════════════════════════════════════════════════════
describe('POST /api/auth/check-phone', () => {
  afterEach(() => clearMocks())

  it('returns { found: true } when member exists', async () => {
    mockSupabase('team_members', [{ id: TEST_MEMBER_ID, shop_id: TEST_SHOP_ID, name: 'Test', role: 'owner' }])
    const res = await h.checkPhone(api('/api/auth/check-phone', { phone: '03001234567' }))
    assert.equal(res.status, 200)
    const body = await res.json() as any
    assert.equal(body.found, true)
  })

  it('returns { found: false } when no member', async () => {
    const res = await h.checkPhone(api('/api/auth/check-phone', { phone: '03001234567' }))
    assert.equal(res.status, 200)
    const body = await res.json() as any
    assert.equal(body.found, false)
  })

  it('returns 400 for too-short phone', async () => {
    const res = await h.checkPhone(api('/api/auth/check-phone', { phone: '123' }))
    assert.equal(res.status, 400)
    const body = await res.json() as any
    assert.equal(body.success, false)
  })

  it('returns 429 when rate limited (sensitive limit = 5)', async () => {
    const ip = '10.0.0.99'
    for (let i = 0; i < 5; i++) {
      const req = new MockNextRequest('http://localhost/api/auth/check-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
        body: JSON.stringify({ phone: `030099${String(i).padStart(6, '0')}` }),
      })
      await h.checkPhone(req)
    }
    const finalReq = new MockNextRequest('http://localhost/api/auth/check-phone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
      body: JSON.stringify({ phone: '030099999999' }),
    })
    const res = await h.checkPhone(finalReq)
    assert.equal(res.status, 429)
  })
})

// ════════════════════════════════════════════════════════════════════
//  POST /api/auth/send-otp
// ════════════════════════════════════════════════════════════════════
describe('POST /api/auth/send-otp', () => {
  afterEach(() => clearMocks())

  it('sends OTP and returns masked email + expiresAt', async () => {
    mockSupabase('team_members', []) // no duplicate email
    mockSupabase('email_verifications', {}, 201) // insert succeeds
    const res = await h.sendOtp(api('/api/auth/send-otp', {
      phone: '03001234567',
      email: 'test@example.com',
      purpose: 'signup',
    }))
    assert.equal(res.status, 200)
    const body = await res.json() as any
    assert.equal(body.success, true)
    assert.ok((body.data.maskedEmail as string).includes('***'))
    assert.ok(body.data.expiresAt)
  })

  it('returns 400 for missing phone', async () => {
    const res = await h.sendOtp(api('/api/auth/send-otp', {
      email: 'test@example.com',
    }))
    assert.equal(res.status, 400)
  })

  it('returns 400 for invalid email', async () => {
    const res = await h.sendOtp(api('/api/auth/send-otp', {
      phone: '03001234567',
      email: 'not-an-email',
    }))
    assert.equal(res.status, 400)
  })

  it('returns 400 when email already registered for signup', async () => {
    mockSupabase('team_members', [{ id: TEST_MEMBER_ID }])
    const res = await h.sendOtp(api('/api/auth/send-otp', {
      phone: '03001234567',
      email: 'existing@example.com',
      purpose: 'signup',
    }))
    assert.equal(res.status, 400)
    const body = await res.json() as any
    assert.ok((body.error as string).includes('registered'))
  })
})

// ════════════════════════════════════════════════════════════════════
//  POST /api/auth/verify-otp
// ════════════════════════════════════════════════════════════════════
describe('POST /api/auth/verify-otp', () => {
  afterEach(() => clearMocks())

  it('returns 400 for missing OTP code', async () => {
    const res = await h.verifyOtp(api('/api/auth/verify-otp', { phone: '03001234567', otp: '' }))
    assert.equal(res.status, 400)
  })

  it('returns 400 when no valid OTP record found', async () => {
    const res = await h.verifyOtp(api('/api/auth/verify-otp', { phone: '03001234567', otp: '123456' }))
    assert.equal(res.status, 400)
    const body = await res.json() as any
    assert.ok((body.error as string).includes('expire'))
  })

  it('returns 400 for invalid OTP (wrong code)', async () => {
    mockSupabase('email_verifications', [{
      id: randomUUID(), phone: '03001234567', otp_hash: '$2a$10$invalid', attempts: 0,
    }])
    const res = await h.verifyOtp(api('/api/auth/verify-otp', { phone: '03001234567', otp: '654321' }))
    assert.equal(res.status, 400)
    const body = await res.json() as any
    assert.ok((body.error as string).includes('galat'))
  })
})

// ════════════════════════════════════════════════════════════════════
//  POST /api/auth/login
// ════════════════════════════════════════════════════════════════════
describe('POST /api/auth/login', () => {
  afterEach(() => clearMocks())

  it('returns 400 for missing PIN', async () => {
    const res = await h.login(api('/api/auth/login', { phone: '03001234567' }))
    assert.equal(res.status, 400)
  })

  it('returns "Account not found" for unknown phone', async () => {
    const res = await h.login(api('/api/auth/login', { phone: '03001234567', pin: '123456' }))
    assert.equal(res.status, 400)
    const body = await res.json() as any
    assert.equal(body.error, 'Account not found')
  })

  it('returns 423 when account is locked', async () => {
    const lockedUntil = new Date(Date.now() + 60_000).toISOString()
    mockSupabase('team_members', [{
      id: TEST_MEMBER_ID, shop_id: TEST_SHOP_ID, name: 'Test', role: 'owner',
      pin_hash: '', locked_until: lockedUntil, failed_attempts: 5,
    }])
    const res = await h.login(api('/api/auth/login', { phone: '03001234567', pin: '123456' }))
    assert.equal(res.status, 423)
    const body = await res.json() as any
    assert.equal(body.error, 'Account locked')
    assert.equal(body.lockedUntil, lockedUntil)
  })

  it('returns 429 when rate limited', async () => {
    const ip = '10.0.0.97'
    const phone = '0300970000000'
    for (let i = 0; i < 5; i++) {
      const req = new MockNextRequest('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
        body: JSON.stringify({ phone, pin: '123456' }),
      })
      await h.login(req)
    }
    const finalReq = new MockNextRequest('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
      body: JSON.stringify({ phone, pin: '123456' }),
    })
    const res = await h.login(finalReq)
    assert.equal(res.status, 429)
  })
})

// ════════════════════════════════════════════════════════════════════
//  POST /api/measurements
// ════════════════════════════════════════════════════════════════════
describe('POST /api/measurements', () => {
  afterEach(() => clearMocks())

  it('returns 401 without auth cookie', async () => {
    const res = await h.measurements(api('/api/measurements', {
      id: randomUUID(), customerId: TEST_CUSTOMER_ID,
      garmentType: 'shirt', values: { length: '30' },
    }))
    assert.equal(res.status, 401)
  })

  it('returns 400 for missing garmentType', async () => {
    const res = await h.measurements(api('/api/measurements', {
      id: randomUUID(), customerId: TEST_CUSTOMER_ID,
      values: { length: '30' },
    }, authCookie()))
    assert.equal(res.status, 400)
  })

  it('creates a new measurement (201)', async () => {
    const id = randomUUID()
    // Check for existing measurement — none found
    mockSupabase(`measurements?id=eq.${encodeURIComponent(id)}&select=id&limit=1`, [])
    // Create
    mockSupabase('measurements', { id }, 201)
    const res = await h.measurements(api('/api/measurements', {
      id, customerId: TEST_CUSTOMER_ID,
      garmentType: 'shirt', values: { length: '30', shoulder: '18' },
    }, authCookie()))
    assert.equal(res.status, 201)
    const body = await res.json() as any
    assert.equal(body.success, true)
    assert.equal(body.data.id, id)
  })

  it('updates an existing measurement (200)', async () => {
    const id = randomUUID()
    // Check for existing — found
    mockSupabase(`measurements?id=eq.${encodeURIComponent(id)}&select=id&limit=1`, [{ id }])
    // Patch
    mockSupabase(`measurements?id=eq.${encodeURIComponent(id)}`, {}, 200)
    const res = await h.measurements(api('/api/measurements', {
      id, customerId: TEST_CUSTOMER_ID,
      garmentType: 'shirt', values: { length: '32' },
    }, authCookie()))
    assert.equal(res.status, 200)
    const body = await res.json() as any
    assert.equal(body.success, true)
    assert.equal(body.data.id, id)
  })
})

// ════════════════════════════════════════════════════════════════════
//  POST /api/team/members
// ════════════════════════════════════════════════════════════════════
describe('POST /api/team/members', () => {
  afterEach(() => clearMocks())

  it('returns 401 without auth cookie', async () => {
    const res = await h.teamMembers(api('/api/team/members', {
      name: 'Karigar', phone: '03001234567',
    }))
    assert.equal(res.status, 401)
  })

  it('returns 400 for missing name', async () => {
    const res = await h.teamMembers(api('/api/team/members', {
      phone: '03001234567',
    }, authCookie()))
    assert.equal(res.status, 400)
  })

  it('creates a new team member (201)', async () => {
    const id = randomUUID()
    mockSupabase('team_members', [{ id, name: 'Karigar', role: 'karigar', shop_id: TEST_SHOP_ID }], 201)
    const res = await h.teamMembers(api('/api/team/members', {
      name: 'Karigar', phone: '03001234567',
    }, authCookie()))
    assert.equal(res.status, 201)
    const body = await res.json() as any
    assert.equal(body.success, true)
  })

  it('updates an existing team member (200)', async () => {
    const id = randomUUID()
    mockSupabase(`team_members?id=eq.${encodeURIComponent(id)}&shop_id=eq.${encodeURIComponent(TEST_SHOP_ID)}`, {}, 200)
    const res = await h.teamMembers(api('/api/team/members', {
      id, name: 'Updated Karigar', phone: '03007654321',
    }, authCookie()))
    assert.equal(res.status, 200)
    const body = await res.json() as any
    assert.equal(body.success, true)
  })
})

// ════════════════════════════════════════════════════════════════════
//  POST /api/billing/submit-payment
// ════════════════════════════════════════════════════════════════════
describe('POST /api/billing/submit-payment', () => {
  afterEach(() => clearMocks())

  const validPayment = {
    planId: 'professional',
    cycle: 'monthly',
    amountPkr: 1500,
    paymentRef: 'PAY-REF-001',
    transactionId: 'TXN-001',
    payerName: 'Test Owner',
  }

  it('returns 401 without auth cookie', async () => {
    const res = await h.submitPayment(api('/api/billing/submit-payment', validPayment))
    assert.equal(res.status, 401)
  })

  it('returns 400 for invalid planId', async () => {
    const res = await h.submitPayment(api('/api/billing/submit-payment', {
      ...validPayment, planId: 'invalid-plan',
    }, authCookie()))
    assert.equal(res.status, 400)
  })

  it('returns 409 for duplicate transaction', async () => {
    const txId = encodeURIComponent(validPayment.transactionId)
    mockSupabase(`subscription_payments?gateway_tx_id=eq.${txId}&select=id&limit=1`, [{ id: randomUUID() }])
    const res = await h.submitPayment(api('/api/billing/submit-payment', validPayment, authCookie()))
    assert.equal(res.status, 409)
    const body = await res.json() as any
    assert.ok((body.error as string).includes('Duplicate'))
  })

  it('submits payment successfully (200)', async () => {
    const txId = encodeURIComponent(validPayment.transactionId)
    mockSupabase(`subscription_payments?gateway_tx_id=eq.${txId}&select=id&limit=1`, [])
    mockSupabase(`subscription_payments?shop_id=eq.${encodeURIComponent(TEST_SHOP_ID)}&status=eq.pending&select=id,plan,billing_cycle&limit=1`, [])
    const subId = randomUUID()
    mockSupabase(`subscriptions?shop_id=eq.${encodeURIComponent(TEST_SHOP_ID)}&select=id&limit=1`, [{ id: subId }])
    mockSupabase('subscription_payments', [{ id: randomUUID() }], 201)
    const res = await h.submitPayment(api('/api/billing/submit-payment', validPayment, authCookie()))
    assert.equal(res.status, 200)
    const body = await res.json() as any
    assert.equal(body.success, true)
  })
})

// ════════════════════════════════════════════════════════════════════
//  POST /api/auth/session
// ════════════════════════════════════════════════════════════════════
describe('POST /api/auth/session', () => {
  afterEach(() => clearMocks())

  it('returns 400 for empty body', async () => {
    const res = await h.session(api('/api/auth/session', {}))
    assert.equal(res.status, 400)
  })
})

// ════════════════════════════════════════════════════════════════════
//  POST /api/admin/login
// ════════════════════════════════════════════════════════════════════
describe('POST /api/admin/login', () => {
  afterEach(() => clearMocks())

  it('returns 400 for missing secret', async () => {
    const res = await h.adminLogin(api('/api/admin/login', { totpCode: '123456' }))
    assert.equal(res.status, 400)
  })

  it('returns 401 for wrong secret', async () => {
    const res = await h.adminLogin(api('/api/admin/login', { secret: 'wrong-secret', totpCode: '123456' }))
    assert.equal(res.status, 401)
    const body = await res.json() as any
    assert.ok((body.error as string).includes('galat'))
  })

  it('returns 401 with requiresTOTP flag when totpCode is missing but secret is correct', async () => {
    const res = await h.adminLogin(api('/api/admin/login', { secret: TEST_ENV.ADMIN_SECRET }))
    assert.equal(res.status, 401)
    const body = await res.json() as any
    assert.equal(body.requiresTOTP, true)
  })

  it('returns 200 on successful admin login', async () => {
    const code = generateTOTP(TEST_ENV.ADMIN_TOTP_SECRET)
    const res = await h.adminLogin(api('/api/admin/login', {
      secret: TEST_ENV.ADMIN_SECRET,
      totpCode: code,
    }))
    assert.equal(res.status, 200)
    const body = await res.json() as any
    assert.equal(body.success, true)
    assert.equal(body.role, 'super_admin')
  })
})

// ════════════════════════════════════════════════════════════════════
//  Idempotency — tests across multiple endpoints
// ════════════════════════════════════════════════════════════════════
describe('Idempotency-Key support', () => {
  afterEach(() => clearMocks())

  it('measurements: replays cached response for same key', async () => {
    const id = randomUUID()
    mockSupabase(`measurements?id=eq.${encodeURIComponent(id)}&select=id&limit=1`, [])
    mockSupabase('measurements', { id }, 201)

    const key = randomUUID()
    const cookie = authCookie()
    const headers = { 'Content-Type': 'application/json', 'Idempotency-Key': key, Cookie: cookie }
    const req1 = new MockNextRequest('http://localhost/api/measurements', {
      method: 'POST', headers,
      body: JSON.stringify({ id, customerId: TEST_CUSTOMER_ID, garmentType: 'shirt', values: { length: '30' } }),
    })
    const res1 = await h.measurements(req1)
    assert.equal(res1.status, 201)
    const body1 = await res1.json() as any
    assert.equal(body1.success, true)

    const req2 = new MockNextRequest('http://localhost/api/measurements', {
      method: 'POST', headers,
      body: JSON.stringify({ id, customerId: TEST_CUSTOMER_ID, garmentType: 'shirt', values: { length: '30' } }),
    })
    const res2 = await h.measurements(req2)
    assert.equal(res2.status, 201)
    assert.equal(res2.headers.get('X-Idempotent'), 'replayed')
    const body2 = await res2.json() as any
    assert.equal(body2.success, true)
  })

  it('measurements: different keys get independent results', async () => {
    const cookie = authCookie()

    // First request with key1
    const id1 = randomUUID()
    mockSupabase(`measurements?id=eq.${encodeURIComponent(id1)}&select=id&limit=1`, [])
    mockSupabase('measurements', { id: id1 }, 201)
    const res1 = await h.measurements(new MockNextRequest('http://localhost/api/measurements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': randomUUID(), Cookie: cookie },
      body: JSON.stringify({ id: id1, customerId: TEST_CUSTOMER_ID, garmentType: 'shirt', values: { length: '30' } }),
    }))
    assert.equal(res1.status, 201)

    clearMocks() // clean slate for second request

    // Second request with key2 — different measurement
    const id2 = randomUUID()
    mockSupabase(`measurements?id=eq.${encodeURIComponent(id2)}&select=id&limit=1`, [])
    mockSupabase('measurements', { id: id2 }, 201)
    const res2 = await h.measurements(new MockNextRequest('http://localhost/api/measurements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': randomUUID(), Cookie: cookie },
      body: JSON.stringify({ id: id2, customerId: TEST_CUSTOMER_ID, garmentType: 'shirt', values: { length: '30' } }),
    }))
    assert.equal(res2.status, 201)
    const body2 = await res2.json() as any
    assert.equal(body2.data.id, id2)
  })

  it('billing: replays cached response for same key', async () => {
    const txId = `idem-test-tx-${randomUUID()}`
    mockSupabase(`subscription_payments?gateway_tx_id=eq.${encodeURIComponent(txId)}&select=id&limit=1`, [])
    const shopId = TEST_SHOP_ID
    mockSupabase(`subscription_payments?shop_id=eq.${encodeURIComponent(shopId)}&status=eq.pending&select=id,plan,billing_cycle&limit=1`, [])
    mockSupabase(`subscriptions?shop_id=eq.${encodeURIComponent(shopId)}&select=id&limit=1`, [{ id: randomUUID() }])
    mockSupabase('subscription_payments', [{ id: randomUUID() }], 201)

    const key = randomUUID()
    const body = { planId: 'professional' as const, cycle: 'monthly' as const, amountPkr: 1500, paymentRef: 'idem-test', transactionId: txId, payerName: 'Test Payer' }
    const headers = { 'Content-Type': 'application/json', 'Idempotency-Key': key, Cookie: authCookie() }

    const req1 = new MockNextRequest('http://localhost/api/billing/submit-payment', {
      method: 'POST', headers, body: JSON.stringify(body),
    })
    const res1 = await h.submitPayment(req1)
    assert.equal(res1.status, 200)

    const req2 = new MockNextRequest('http://localhost/api/billing/submit-payment', {
      method: 'POST', headers, body: JSON.stringify(body),
    })
    const res2 = await h.submitPayment(req2)
    assert.equal(res2.status, 200)
    assert.equal(res2.headers.get('X-Idempotent'), 'replayed')
  })

  it('returns cached response for same key (no replay for new keys)', async () => {
    const id = randomUUID()
    mockSupabase(`measurements?id=eq.${encodeURIComponent(id)}&select=id&limit=1`, [])
    mockSupabase('measurements', { id }, 201)

    const key = randomUUID()
    const cookie = authCookie()
    const headers = { 'Content-Type': 'application/json', 'Idempotency-Key': key, Cookie: cookie }
    const makeReq = () => new MockNextRequest('http://localhost/api/measurements', {
      method: 'POST', headers,
      body: JSON.stringify({ id, customerId: TEST_CUSTOMER_ID, garmentType: 'shirt', values: { length: '30' } }),
    })

    const res1 = await h.measurements(makeReq())
    assert.equal(res1.status, 201)
    assert.equal(res1.headers.get('X-Idempotent'), null)

    const res2 = await h.measurements(makeReq())
    assert.equal(res2.headers.get('X-Idempotent'), 'replayed')
  })
})
