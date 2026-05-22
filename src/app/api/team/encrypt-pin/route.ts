// src/app/api/team/encrypt-pin/route.ts
// Server-only endpoint: encrypts a plaintext PIN for secure storage.
// The encrypted value is stored in the pin_plain column.
// This replaces direct plaintext PIN writes from client code.

import { NextRequest, NextResponse } from 'next/server'
import { encryptPIN } from '@/lib/security/pin-crypto'

export async function POST(req: NextRequest) {
  try {
    const { pin } = await req.json()

    if (!pin || typeof pin !== 'string') {
      return NextResponse.json({ error: 'PIN required' }, { status: 400 })
    }

    if (!/^\d{4}$|^\d{6}$/.test(pin)) {
      return NextResponse.json({ error: 'PIN must be exactly 4 or 6 digits' }, { status: 400 })
    }

    const encrypted = encryptPIN(pin)
    return NextResponse.json({ encrypted })
  } catch (e) {
    console.error('[encrypt-pin]', e)
    return NextResponse.json({ error: 'Encryption failed' }, { status: 500 })
  }
}
