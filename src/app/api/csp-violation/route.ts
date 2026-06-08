import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    console.warn('[CSP Violation]', JSON.stringify(body))
  } catch {
    // ignore parse errors
  }
  return NextResponse.json({ ok: true })
}
