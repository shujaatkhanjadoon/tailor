import { Ratelimit } from '@upstash/ratelimit'
import { Redis }     from '@upstash/redis'

// ── In-memory fallback rate limiter (when Upstash Redis is unavailable) ──
interface MemEntry {
  count: number
  resetAt: number
}
const memStore = new Map<string, MemEntry>()

function memSlidingWindow(key: string, max: number, windowMs: number): { success: boolean; remaining: number; reset: Date } {
  const now = Date.now()
  const entry = memStore.get(key)
  if (!entry || now > entry.resetAt) {
    const reset = new Date(now + windowMs)
    memStore.set(key, { count: 1, resetAt: reset.getTime() })
    return { success: true, remaining: max - 1, reset }
  }
  if (entry.count >= max) {
    return { success: false, remaining: 0, reset: new Date(entry.resetAt) }
  }
  entry.count++
  return { success: true, remaining: max - entry.count, reset: new Date(entry.resetAt) }
}

// Clean stale entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of memStore) {
    if (now > entry.resetAt) memStore.delete(key)
  }
}, 5 * 60 * 1000).unref()

// ── Create Redis client ───────────────────────────────────────────
function getRedis(): Redis | null {
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) {
    console.warn('[RateLimit] Upstash not configured — using in-memory fallback')
    return null
  }
  return new Redis({ url, token })
}

// ── Rate limiters for different actions ──────────────────────────

// OTP sending: 3 per phone per hour
export function getOTPRatelimiter() {
  const redis = getRedis()
  if (!redis) return null
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(3, '1h'),
    prefix:  'rl:otp',
  })
}

// Login attempts: 5 per IP per 15 minutes
export function getLoginRatelimiter() {
  const redis = getRedis()
  if (!redis) return null
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '15m'),
    prefix:  'rl:login',
  })
}

// Shop creation: 2 per IP per day
export function getSignupRatelimiter() {
  const redis = getRedis()
  if (!redis) return null
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(2, '24h'),
    prefix:  'rl:signup',
  })
}

// General API: 100 per IP per minute
export function getAPIRatelimiter() {
  const redis = getRedis()
  if (!redis) return null
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, '1m'),
    prefix:  'rl:api',
  })
}

// ── Helper: check rate limit and return response ──────────────────
export interface RateLimitResult {
  allowed:    boolean
  remaining?: number
  reset?:     Date
  error?:     string
}

const FALLBACK_LIMITS = {
  sensitive:   { max: 5,  windowMs: 15  * 60 * 1000 },   // login, signup, OTP
  normal:      { max: 60, windowMs: 60  * 1000 },         // general API
} as const

type EndpointSensitivity = keyof typeof FALLBACK_LIMITS

export async function checkRateLimit(
  limiter: Ratelimit | null,
  identifier: string,
  sensitivity: EndpointSensitivity = 'normal',
): Promise<RateLimitResult> {
  // Use in-memory fallback when Redis limiter is null
  if (!limiter) {
    const { max, windowMs } = FALLBACK_LIMITS[sensitivity]
    const result = memSlidingWindow(identifier, max, windowMs)
    if (!result.success) {
      return {
        allowed: false,
        remaining: 0,
        reset: result.reset,
        error: 'Bahut zyada requests. Kuch der mein dobara try karein.',
      }
    }
    return {
      allowed: true,
      remaining: result.remaining,
      reset: result.reset,
    }
  }

  try {
    const { success, remaining, reset } = await limiter.limit(identifier)
    return {
      allowed:   success,
      remaining,
      reset:     new Date(reset),
      error:     success ? undefined : 'Bahut zyada requests. Kuch der mein dobara try karein.',
    }
  } catch (e) {
    console.error('[RateLimit] Redis error — rate limiting unavailable:', String(e))
    return { allowed: false, remaining: 0, error: 'Rate limiting unavailable. Please try again.' }
  }
}

// ── Get client IP from request ────────────────────────────────────
export function getClientIP(req: Request): string {
  const h = req.headers as any
  return (
    h.get?.('x-forwarded-for')?.split(',')[0]?.trim() ??
    h.get?.('x-real-ip') ??
    h.get?.('cf-connecting-ip') ??
    '127.0.0.1'
  )
}

// ── Basic browser fingerprint from request headers ────────────────
export function getClientFingerprint(req: Request): string {
  const h = req.headers as any
  const ua = h.get?.('user-agent') ?? ''
  const lang = h.get?.('accept-language') ?? ''
  const secChUa = h.get?.('sec-ch-ua') ?? ''
  const hash = simpleHash(`${ua}|${lang}|${secChUa}`)
  return hash
}

// ── Combined identifier (IP + browser fingerprint) ───────────────
export function getRateLimitId(req: Request): string {
  return `${getClientIP(req)}|${getClientFingerprint(req)}`
}

function simpleHash(s: string): string {
  let hash = 0
  for (let i = 0; i < s.length; i++) {
    const char = s.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36)
}
