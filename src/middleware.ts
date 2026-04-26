// src/middleware.ts — replace entirely
import { NextRequest, NextResponse } from 'next/server'

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const res          = NextResponse.next()

  // ── Security headers (all responses) ─────────────────────────────
  res.headers.set('X-Frame-Options',          'DENY')
  res.headers.set('X-Content-Type-Options',   'nosniff')
  res.headers.set('Referrer-Policy',          'strict-origin-when-cross-origin')
  res.headers.set('Permissions-Policy',       'camera=self, microphone=()')
  res.headers.set('X-XSS-Protection',         '1; mode=block')

  // ── Admin route protection ────────────────────────────────────────
  if (pathname.startsWith('/admin')) {
    const secret    = process.env.ADMIN_SECRET
    const segments  = pathname.split('/')
    const urlSecret = segments[2]

    if (!secret || urlSecret !== secret) {
      // Return 404 — don't reveal admin exists
      return NextResponse.rewrite(new URL('/not-found', req.url))
    }
  }

  // ── Cron endpoint protection ──────────────────────────────────────
  if (pathname.startsWith('/api/cron')) {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  return res
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/api/cron/:path*',
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}