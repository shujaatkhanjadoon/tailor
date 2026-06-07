// src/app/api/admin/verify/route.ts
// Called by client to check if session is still valid (rotates token on each request)
import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken, rotateSessionToken, getSessionMaxAge, ADMIN_SESSION_COOKIE } from '@/lib/admin/auth'

export async function GET(req: NextRequest) {
  const token = req.cookies.get(ADMIN_SESSION_COOKIE)?.value
  if (!token || !verifySessionToken(token)) {
    return NextResponse.json({ valid: false }, { status: 401 })
  }

  const newToken = rotateSessionToken(token)
  const res = NextResponse.json({ valid: true })
  if (newToken) {
    res.cookies.set(ADMIN_SESSION_COOKIE, newToken, {
      httpOnly: true,
      secure:   true,
      sameSite: 'strict',
      maxAge:   getSessionMaxAge(token),
      path:     '/',
    })
  }
  return res
}