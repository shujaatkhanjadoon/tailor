// src/lib/security/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit'
import { Redis }     from '@upstash/redis'

// ── Create Redis client ───────────────────────────────────────────
function getRedis(): Redis | null {
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) {
    console.warn('[RateLimit] Upstash not configured — skipping rate limiting')
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

export async function checkRateLimit(
  limiter: Ratelimit | null,
  identifier: string
): Promise<RateLimitResult> {
  if (!limiter) return { allowed: true }

  try {
    const { success, remaining, reset } = await limiter.limit(identifier)
    return {
      allowed:   success,
      remaining,
      reset:     new Date(reset),
      error:     success ? undefined : 'Bahut zyada requests. Kuch der mein dobara try karein.',
    }
  } catch (e) {
    console.error('[RateLimit] Error:', e)
    return { allowed: true }   // Fail open — don't block on Redis errors
  }
}

// ── Get client IP from request ────────────────────────────────────
export function getClientIP(req: Request): string {
  const headers = req.headers as any
  return (
    headers.get?.('x-forwarded-for')?.split(',')[0]?.trim() ??
    headers.get?.('x-real-ip') ??
    headers.get?.('cf-connecting-ip') ??
    '127.0.0.1'
  )
}