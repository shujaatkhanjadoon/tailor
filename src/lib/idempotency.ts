import { Redis } from '@upstash/redis'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

const IDEMPOTENCY_TTL_SEC = 60 * 60 * 24 // 24 hours

interface IdempotencyRecord {
  status: number
  body: unknown
}

// In-memory fallback (same pattern as rate-limit.ts)
const memStore = new Map<string, { record: IdempotencyRecord; expiresAt: number }>()

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

async function getRecord(key: string): Promise<IdempotencyRecord | null> {
  const redis = getRedis()
  if (redis) {
    try {
      return await redis.get<IdempotencyRecord>(`idemp:${key}`)
    } catch {
      return null
    }
  }
  const entry = memStore.get(`idemp:${key}`)
  if (entry && Date.now() < entry.expiresAt) {
    return entry.record
  }
  memStore.delete(`idemp:${key}`)
  return null
}

async function setRecord(key: string, record: IdempotencyRecord): Promise<void> {
  const redis = getRedis()
  if (redis) {
    try {
      await redis.set(`idemp:${key}`, record, { ex: IDEMPOTENCY_TTL_SEC })
    } catch (e) {
      logger.warn('idempotency', 'Redis set failed, skipping cache', e)
    }
  } else {
    memStore.set(`idemp:${key}`, {
      record,
      expiresAt: Date.now() + IDEMPOTENCY_TTL_SEC * 1000,
    })
  }
}

async function tryLock(key: string): Promise<boolean> {
  const redis = getRedis()
  if (redis) {
    try {
      const ok = await redis.set(`idemp:lock:${key}`, '1', { nx: true, ex: 30 })
      return ok === 'OK'
    } catch {
      return true // lock failed, allow processing (fail-open)
    }
  }
  const now = Date.now()
  const lockKey = `idemp:lock:${key}`
  if (memStore.has(lockKey)) {
    const entry = memStore.get(lockKey)!
    if (now < entry.expiresAt) return false
  }
  memStore.set(lockKey, { record: { status: 0, body: null }, expiresAt: now + 30000 })
  return true
}

async function releaseLock(key: string): Promise<void> {
  const redis = getRedis()
  if (redis) {
    try {
      await redis.del(`idemp:lock:${key}`)
    } catch { /* best-effort */ }
  } else {
    memStore.delete(`idemp:lock:${key}`)
  }
}

function readIdempotencyKey(req: NextRequest): string | null {
  const key = req.headers.get('Idempotency-Key') || req.headers.get('idempotency-key')
  if (!key || typeof key !== 'string' || key.length > 255) return null
  return key
}

export async function withIdempotency(
  req: NextRequest,
  handler: () => Promise<NextResponse>,
): Promise<NextResponse> {
  const key = readIdempotencyKey(req)
  if (!key) return handler()

  const existing = await getRecord(key)
  if (existing) {
    return NextResponse.json(existing.body, {
      status: existing.status,
      headers: { 'X-Idempotent': 'replayed' },
    })
  }

  const acquired = await tryLock(key)
  if (!acquired) {
    return NextResponse.json(
      { success: false, error: 'Another request with this idempotency key is already being processed.' },
      { status: 409 },
    )
  }

  try {
    const response = await handler()

    if (response.status < 500) {
      const body = await response.clone().json().catch(() => null)
      if (body) {
        await setRecord(key, { status: response.status, body })
      }
    }

    return response
  } finally {
    await releaseLock(key)
  }
}
