// src/app/api/photos/delete/route.ts
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  const { publicId } = await req.json()

  if (!publicId || typeof publicId !== 'string') {
    return NextResponse.json({ error: 'publicId required' }, { status: 400 })
  }

  const cloudName  = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  const apiKey     = process.env.CLOUDINARY_API_KEY ?? process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY
  const apiSecret  = process.env.CLOUDINARY_API_SECRET

  if (!cloudName || !apiKey || !apiSecret) {
    return NextResponse.json({ error: 'Cloudinary not configured' }, { status: 500 })
  }

  try {
    const timestamp = Math.round(Date.now() / 1000)

    // Build signature (required by Cloudinary)
    const signString = `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`
    const signature  = crypto
      .createHash('sha256')
      .update(signString)
      .digest('hex')

    const formData = new FormData()
    formData.append('public_id',  publicId)
    formData.append('timestamp',  String(timestamp))
    formData.append('api_key',    apiKey)
    formData.append('signature',  signature)

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`,
      { method: 'POST', body: formData }
    )

    const data = await res.json()

    if (data.result === 'ok' || data.result === 'not found') {
      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json({ error: data.result }, { status: 400 })
    }
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
