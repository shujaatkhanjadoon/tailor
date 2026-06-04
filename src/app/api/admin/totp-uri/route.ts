// src/app/api/admin/totp-uri/route.ts — complete fix
import { NextRequest, NextResponse }                          from 'next/server'
import { verifySessionToken, getTOTPUri, ADMIN_SESSION_COOKIE } from '@/lib/admin/auth'
import QRCode from 'qrcode'
import { logger } from '@/lib/logger'

export async function GET(req: NextRequest) {
  const token       = req.cookies.get(ADMIN_SESSION_COOKIE)?.value
  const headerSecret = req.headers.get('x-admin-secret')
  const adminSecret  = process.env.ADMIN_SECRET

  const sessionOk = token && verifySessionToken(token)
  const secretOk  = headerSecret && adminSecret && headerSecret === adminSecret

  if (!sessionOk && !secretOk) {
    logger.error('admin', 'TOTP Setup Unauthorized — neither session nor secret matched')
    return NextResponse.json(
      { error: 'Unauthorized — check ADMIN_SECRET env var' },
      { status: 401 }
    )
  }

  if (!process.env.ADMIN_TOTP_SECRET) {
    return NextResponse.json(
      { error: 'ADMIN_TOTP_SECRET not set in .env.local' },
      { status: 500 }
    )
  }

  try {
    const uri    = getTOTPUri()
    const qrData = await QRCode.toDataURL(uri, {
      width:  240,
      margin: 2,
      color:  { dark: '#1e293b', light: '#ffffff' },
    })
    return NextResponse.json({ uri, qrData, hasSetup: true })
  } catch (e) {
    logger.error('admin', 'TOTP Setup error', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}