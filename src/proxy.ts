// src/middleware.ts
import { timingSafeEqual }              from 'crypto'
import { NextRequest, NextResponse }    from 'next/server'
import { verifySessionToken, ADMIN_SESSION_COOKIE } from '@/lib/admin/auth'
import { rotateMemberSessionToken, MEMBER_SESSION_COOKIE, getSessionCookieOptions } from '@/lib/auth/session'
import { checkRateLimit, getAPIRatelimiter, getLoginRatelimiter, getRateLimitId } from '@/lib/security/rate-limit'

// In-memory IP blocklist cache — avoids Supabase round-trip on every API request
const ipBlockCache = new Map<string, { ts: number; blocked: boolean }>()

// ── CSP ──────────────────────────────────────────────────────────
function buildCspHeader(): string {
  const isDev = process.env.NODE_ENV === 'development'
  return [
    "default-src 'self'",
    // Next.js requires 'unsafe-inline' for hydration scripts unless using strict CSP with nonces.
    // TODO: migrate to nonce-based CSP via next.config.js experimental.csp.strict
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://*.sentry.io`,
    // style-src 'unsafe-inline' is needed by CSS-in-JS and Next.js style injection
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self' https://*.supabase.co https://api.cloudinary.com https://*.upstash.io wss://*.supabase.co https://*.sentry.io",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join('; ')
}

// ── Security headers ──────────────────────────────────────────────
function addSecurityHeaders(res: NextResponse): void {
  res.headers.set('X-Frame-Options',           'DENY')
  res.headers.set('X-Content-Type-Options',    'nosniff')
  res.headers.set('Referrer-Policy',           'strict-origin-when-cross-origin')
  res.headers.set('X-XSS-Protection',          '1; mode=block')
  res.headers.set('Permissions-Policy',        'camera=self, microphone=()')
  res.headers.set(
    'Strict-Transport-Security',
    'max-age=63072000; includeSubDomains'
  )
}

function respond(json: Record<string, unknown>, status: number, headers?: Record<string, string>) {
  const res = NextResponse.json(json, { status, headers })
  addSecurityHeaders(res)
  res.headers.set('Content-Security-Policy', buildCspHeader())
  return res
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  const res = NextResponse.next()
  addSecurityHeaders(res)
  res.headers.set('Content-Security-Policy', buildCspHeader())

  // ── Cron routes — handle early (skip IP check, rate limit, CSRF) ──
  // External schedulers (cron-job.org, Vercel Cron) have no origin & may share IPs
  if (pathname.startsWith('/api/cron')) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return respond({ error: 'Unauthorized' }, 401)
    }
    return res
  }

  // ── Global IP blocklist check (with in-memory cache + timeout) ──
  if (pathname.startsWith('/api/')) {
    try {
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        ?? req.headers.get('x-real-ip')
        ?? 'unknown'

      // In-memory cache: skip Supabase query for recently-checked IPs
      const cacheKey = `bl:${ip}`
      const cached = ipBlockCache.get(cacheKey)
      const now = Date.now()
      if (cached && (now - cached.ts) < 60_000) {
        if (cached.blocked) return respond({ error: 'Access denied' }, 403)
      } else {
        const blockRes = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/ip_blocklist?ip=eq.${encodeURIComponent(ip)}&is_active=eq.true&select=id&limit=1`,
          {
            headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '', Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''}` },
            signal: AbortSignal.timeout(3000),
          }
        )
        if (blockRes.ok) {
          const blocked = await blockRes.json()
          const isBlocked = blocked?.length > 0
          ipBlockCache.set(cacheKey, { ts: now, blocked: isBlocked })
          if (isBlocked) return respond({ error: 'Access denied' }, 403)
        }
      }

      // Cleanup old cache entries periodically
      if (ipBlockCache.size > 1000) {
        const cutoff = now - 120_000
        for (const [k, v] of ipBlockCache) {
          if (v.ts < cutoff) ipBlockCache.delete(k)
        }
      }
    } catch {
      // Fail closed on network errors (timeout or Supabase unreachable)
      return respond({ error: 'Access denied' }, 403)
    }
  }

  // ── Public / internal endpoints (skip auth + rate limiting) ──
  const PUBLIC_API = ['/api/health']
  if (PUBLIC_API.some(p => pathname === p)) {
    return res
  }

  // ── Global API rate limiting ─────────────────────────────────
  if (pathname.startsWith('/api/')) {
    // Session endpoints are called on every page load — use generous API limiter
    const isSensitive = (pathname.startsWith('/api/auth') || pathname === '/api/admin/login') && !pathname.startsWith('/api/auth/session')
    const limiter = isSensitive ? getLoginRatelimiter() : getAPIRatelimiter()
    const prefix = isSensitive ? 'sensitive' : 'api'
    const rl = await checkRateLimit(limiter, `${prefix}:${getRateLimitId(req)}:${pathname}`, isSensitive ? 'sensitive' : 'normal')
    if (!rl.allowed) {
      return respond({ error: rl.error ?? 'Too many requests. Please try again later.' }, 429)
    }
  }

  // ── Cache-Control for non-sensitive GET API routes ────────────
  if (req.method === 'GET' && pathname.startsWith('/api/') && !pathname.startsWith('/api/admin') && !pathname.startsWith('/api/auth')) {
    res.headers.set('Cache-Control', 'private, max-age=30, stale-while-revalidate=120')
  }

  // ── CSRF origin/referer check for state-changing API requests ──
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && pathname.startsWith('/api/')) {
    const origin  = req.headers.get('origin')
    const referer = req.headers.get('referer')
    const allowedHost = process.env.NEXT_PUBLIC_APP_URL!.replace(/^https?:\/\//, '')

    function isAllowedHost(checkHost: string): boolean {
      return checkHost === allowedHost
    }

    let csrfOk = false
    if (origin) {
      try {
        csrfOk = isAllowedHost(new URL(origin).host)
      } catch {
        csrfOk = false
      }
    } else if (referer) {
      try {
        csrfOk = isAllowedHost(new URL(referer).host)
      } catch {
        csrfOk = false
      }
    }

    if (!csrfOk) {
      return respond({ error: 'Cross-origin request rejected' }, 403)
    }
  }

  // ── Public admin routes ───────────────────────────────────────
  const adminPublic = [
    '/admin/login',
    '/admin/setup-totp',
    '/api/admin/login',
    '/api/admin/logout',
    '/api/admin/verify',
  ]
  if (adminPublic.some(p => pathname === p || pathname.startsWith(p))) {
    return res
  }

  // ── Admin TOTP URI ─────────────────────────────────────────────
  if (pathname === '/api/admin/totp-uri') {
    const secret      = req.headers.get('x-admin-secret')
    const token       = req.cookies.get(ADMIN_SESSION_COOKIE)?.value
    const adminSecret = process.env.ADMIN_SECRET
    let secretOk = false
    if (secret && adminSecret) {
      try {
        secretOk = timingSafeEqual(Buffer.from(secret), Buffer.from(adminSecret))
      } catch { /* length mismatch or other — stays false */ }
    }
    const sessionOk   = token  && verifySessionToken(token)
    if (!secretOk && !sessionOk) {
      return respond({ error: 'Unauthorized' }, 401)
    }
    return res
  }

  // ── Admin dashboard pages ──────────────────────────────────────
  if (pathname.startsWith('/admin/dashboard')) {
    const token = req.cookies.get(ADMIN_SESSION_COOKIE)?.value
    if (!token || !verifySessionToken(token)) {
      const url = new URL('/admin/login', req.url)
      url.searchParams.set('redirect', pathname)
      return NextResponse.redirect(url)
    }
    return res
  }

  // ── Admin API routes ───────────────────────────────────────────
  if (pathname.startsWith('/api/admin')) {
    const token = req.cookies.get(ADMIN_SESSION_COOKIE)?.value
    if (!token || !verifySessionToken(token)) {
      return respond({ error: 'Unauthorized' }, 401)
    }
    return res
  }

  // ── Main app public routes (no auth required) ────────────────────
  const mainAppPublic = [
    '/auth', '/login', '/setup', '/track',
    '/pricing', '/about', '/privacy-policy',
    '/terms-of-service', '/contact',
  ]
  const isMainAppPublic = mainAppPublic.some(p =>
    pathname === p || pathname.startsWith(`${p}/`)
  )

  // ── Main app protected routes — check member session ───────────
  const STATIC_EXTS = /\.(ico|png|jpg|svg|webp|css|js|json|txt|xml)$/
  if (
    !pathname.startsWith('/api/') &&
    !pathname.startsWith('/admin/') &&
    !isMainAppPublic &&
    !pathname.startsWith('/_next/') &&
    !pathname.startsWith('/icons/') &&
    !STATIC_EXTS.test(pathname)
  ) {
    const token = req.cookies.get(MEMBER_SESSION_COOKIE)?.value
    if (token) {
      const rotated = rotateMemberSessionToken(token)
      if (rotated) {
        // Valid session — rotate the token, set the new cookie, and expose shop_id for RLS
        res.cookies.set(MEMBER_SESSION_COOKIE, rotated.newToken, getSessionCookieOptions())
        res.headers.set('X-Shop-ID', rotated.session.shopId)
        res.headers.set('X-Member-ID', rotated.session.memberId)
      } else {
        // Invalid / expired session — redirect to login
        const url = new URL('/auth', req.url)
        // Sanitize redirect: must be same-origin, not a public route, not an API route
        let redirectPath = pathname + req.nextUrl.search
        try {
          const parsed = new URL(redirectPath, req.url)
          redirectPath = parsed.pathname + parsed.search
          const isAllowed = (
            parsed.origin === req.nextUrl.origin &&
            !mainAppPublic.some(p => parsed.pathname === p || parsed.pathname.startsWith(`${p}/`)) &&
            !parsed.pathname.startsWith('/admin/') &&
            !parsed.pathname.startsWith('/api/')
          )
          if (isAllowed) {
            url.searchParams.set('redirect', redirectPath)
          }
        } catch {
          // invalid URL — don't set redirect
        }
        return NextResponse.redirect(url)
      }
    } else {
      // No token at all — redirect to login
      const url = new URL('/auth', req.url)
      return NextResponse.redirect(url)
    }
  }

  // ── Request size limit on API routes ──────────────────────────
  if (pathname.startsWith('/api/')) {
    const contentLength = req.headers.get('content-length')
    if (contentLength && parseInt(contentLength) > 5 * 1024 * 1024) {
      return respond({ error: 'Request too large (max 5MB)' }, 413)
    }
  }

  return res
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/api/admin/:path*',
    '/api/cron/:path*',
    '/((?!_next/static|_next/image|favicon.ico|icons).*)',
  ],
}
