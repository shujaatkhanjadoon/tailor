// src/middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken, ADMIN_SESSION_COOKIE } from '@/lib/admin/auth'

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // ── Security headers on all responses ────────────────────────────
  const res = NextResponse.next()
  res.headers.set('X-Frame-Options',        'DENY')
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('Referrer-Policy',        'strict-origin-when-cross-origin')
  res.headers.set('X-XSS-Protection',       '1; mode=block')

 if (
    pathname === '/admin/login'      ||
    pathname === '/admin/setup-totp' ||
    pathname === '/api/admin/login'  ||
    pathname === '/api/admin/logout' ||
    pathname === '/api/admin/verify'
  ) {
    return res
  }

   // ── Admin TOTP URI — allow with secret header (no session needed) ─
  if (pathname === '/api/admin/totp-uri') {
    const secret = req.headers.get('x-admin-secret')
    if (secret === process.env.ADMIN_SECRET) {
      return res   // allow through — API route handles auth
    }
    // Also allow with valid session
    const token = req.cookies.get(ADMIN_SESSION_COOKIE)?.value
    if (token && verifySessionToken(token)) {
      return res
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Admin API routes — protected ─────────────────────────────────
  if (pathname.startsWith('/api/admin') &&
      pathname !== '/api/admin/login' &&
      pathname !== '/api/admin/verify') {
    const token = req.cookies.get(ADMIN_SESSION_COOKIE)?.value
    if (!token || !verifySessionToken(token)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return res
  }

  // ── Admin dashboard pages — require session ───────────────────────
  if (pathname.startsWith('/admin/dashboard')) {
    const token = req.cookies.get(ADMIN_SESSION_COOKIE)?.value
    if (!token || !verifySessionToken(token)) {
      const loginUrl = new URL('/admin/login', req.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }
    return res
  }

  // ── Cron routes — require cron secret ────────────────────────────
  if (pathname.startsWith('/api/cron')) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return res
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