// src/app/api/admin/totp-uri/route.ts
import { NextRequest, NextResponse }                   from 'next/server'
import { verifySessionToken, getTOTPUri, ADMIN_SESSION_COOKIE } from '@/lib/admin/auth'
import QRCode from 'qrcode'

export async function GET(req: NextRequest) {
  // Allow access with either valid session OR admin secret header
  const token  = req.cookies.get(ADMIN_SESSION_COOKIE)?.value
  const secret = req.headers.get('x-admin-secret')

  const ok = (token && verifySessionToken(token)) ||
             (secret === process.env.ADMIN_SECRET)

  if (!ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.ADMIN_TOTP_SECRET) {
    return NextResponse.json(
      { error: 'ADMIN_TOTP_SECRET not set in environment variables' },
      { status: 500 }
    )
  }

  try {
    const uri    = getTOTPUri()
    const qrData = await QRCode.toDataURL(uri, {
      width:  240,
      margin: 2,
      color: { dark: '#1e293b', light: '#ffffff' },
    })

    return NextResponse.json({ uri, qrData, hasSetup: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}