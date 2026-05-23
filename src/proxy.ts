// src/proxy.ts
import { NextRequest, NextResponse }    from 'next/server'
import { verifySessionToken, ADMIN_SESSION_COOKIE } from '@/lib/admin/auth'
import { rotateMemberSessionToken, MEMBER_SESSION_COOKIE, getSessionCookieOptions } from '@/lib/auth/session'
import { checkRateLimit, getAPIRatelimiter, getLoginRatelimiter, getRateLimitId } from '@/lib/security/rate-limit'

// ── CSP nonce ────────────────────────────────────────────────────
function buildCspHeader(nonce: string): string {
  const isDev = process.env.NODE_ENV === 'development'
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self' https:",
    "frame-ancestors 'none'",
    "form-action 'self'",
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
    'max-age=31536000; includeSubDomains'
  )
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // CSP nonce — must be unique per request
  const nonce = crypto.randomUUID()
  const cspHeader = buildCspHeader(nonce)
  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', cspHeader)

  const res = NextResponse.next({
    request: { headers: requestHeaders },
  })
  addSecurityHeaders(res)
  res.headers.set('Content-Security-Policy', cspHeader)

  // ── Global API rate limiting ─────────────────────────────────
  if (pathname.startsWith('/api/')) {
    // Session endpoints are called on every page load — use generous API limiter
    const isSensitive = (pathname.startsWith('/api/auth') || pathname === '/api/admin/login') && !pathname.startsWith('/api/auth/session')
    const limiter = isSensitive ? getLoginRatelimiter() : getAPIRatelimiter()
    const prefix = isSensitive ? 'sensitive' : 'api'
    const rl = await checkRateLimit(limiter, `${prefix}:${getRateLimitId(req)}:${pathname}`)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: rl.error ?? 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }
  }

  // ── Cache-Control for non-sensitive GET API routes ────────────
  if (req.method === 'GET' && pathname.startsWith('/api/') && !pathname.startsWith('/api/admin') && !pathname.startsWith('/api/auth')) {
    res.headers.set('Cache-Control', 'private, max-age=30, stale-while-revalidate=120')
  }

  // ── CSRF origin check for state-changing API requests ──────────
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && pathname.startsWith('/api/')) {
    const origin = req.headers.get('origin')
    const host   = req.headers.get('host')
    if (origin) {
      try {
        const originUrl = new URL(origin)
        if (originUrl.host !== host && originUrl.host !== process.env.NEXT_PUBLIC_APP_URL?.replace(/^https?:\/\//, '')) {
          return NextResponse.json({ error: 'Cross-origin request rejected' }, { status: 403 })
        }
      } catch {
        return NextResponse.json({ error: 'Invalid origin' }, { status: 400 })
      }
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
    const secretOk    = secret === process.env.ADMIN_SECRET
    const sessionOk   = token  && verifySessionToken(token)
    if (!secretOk && !sessionOk) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return res
  }

  // ── Cron routes ────────────────────────────────────────────────
  if (pathname.startsWith('/api/cron')) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
        // Valid session — rotate the token and set the new cookie
        res.cookies.set(MEMBER_SESSION_COOKIE, rotated.newToken, getSessionCookieOptions())
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
      return NextResponse.json(
        { error: 'Request too large (max 5MB)' },
        { status: 413 }
      )
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
