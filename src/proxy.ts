// src/proxy.ts
import { NextRequest, NextResponse }    from 'next/server'
import { verifySessionToken, ADMIN_SESSION_COOKIE } from '@/lib/admin/auth'
import { checkRateLimit, getAPIRatelimiter, getClientIP, getLoginRatelimiter } from '@/lib/security/rate-limit'

// ── Security headers ──────────────────────────────────────────────
function addSecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set('X-Frame-Options',           'DENY')
  res.headers.set('X-Content-Type-Options',    'nosniff')
  res.headers.set('Referrer-Policy',           'strict-origin-when-cross-origin')
  res.headers.set('X-XSS-Protection',          '1; mode=block')
  res.headers.set('Permissions-Policy',        'camera=self, microphone=()')
  res.headers.set(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains'
  )
  return res
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  const res          = NextResponse.next()
  addSecurityHeaders(res)

  // ── Global API rate limiting ─────────────────────────────────
  if (pathname.startsWith('/api/')) {
    const sensitive = pathname.startsWith('/api/auth') || pathname.startsWith('/api/admin')
    const limiter = sensitive ? getLoginRatelimiter() : getAPIRatelimiter()
    const rl = await checkRateLimit(limiter, `${sensitive ? 'sensitive' : 'api'}:${getClientIP(req)}:${pathname}`)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: rl.error ?? 'Too many requests. Please try again later.' },
        { status: 429 }
      )
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
