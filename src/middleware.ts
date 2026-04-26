// src/middleware.ts
import { NextRequest, NextResponse } from 'next/server'

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // ── Protect /admin routes ────────────────────────────────────────
  if (pathname.startsWith('/admin')) {
    const secret      = process.env.ADMIN_SECRET
    const urlSecret   = pathname.split('/')[2]   // /admin/[secret]/...

    // No secret configured or wrong secret → 404 (not 403 — don't reveal admin exists)
    if (!secret || urlSecret !== secret) {
      return NextResponse.rewrite(new URL('/not-found', req.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*'],
}