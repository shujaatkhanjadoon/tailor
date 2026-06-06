import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { validate, schemas } from '@/lib/validation'
import { sbFetch, sbGet } from '@/lib/supabase/service'

export async function POST(req: NextRequest) {
  const parsed = await validate(schemas.deletePhoto, req)
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  }
  const { publicId, shopId, memberId } = parsed.data

  // Extract shopId from publicId path: darzi-manager/{shopId}/{orderId}/...
  const parts = publicId.split('/')
  const expectedShopId = parts[1]
  if (!expectedShopId || expectedShopId !== shopId) {
    return NextResponse.json({ error: 'Photo ownership mismatch' }, { status: 403 })
  }

  // Verify caller is an active member of this shop
  try {
    const member = await sbGet(
      `team_members?id=eq.${encodeURIComponent(memberId)}` +
      `&shop_id=eq.${encodeURIComponent(shopId)}` +
      `&is_active=eq.true&select=id&limit=1`,
    )
    if (member.length === 0) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
  } catch {
    return NextResponse.json({ error: 'Auth check failed' }, { status: 500 })
  }

  const cloudName  = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  const apiKey     = process.env.CLOUDINARY_API_KEY ?? process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY
  const apiSecret  = process.env.CLOUDINARY_API_SECRET

  if (!cloudName || !apiKey || !apiSecret) {
    return NextResponse.json({ error: 'Cloudinary not configured' }, { status: 500 })
  }

  try {
    const timestamp = Math.round(Date.now() / 1000)

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
      { method: 'POST', body: formData, signal: AbortSignal.timeout(30000) },
    )

    const data = await res.json()

    if (data.result === 'ok' || data.result === 'not found') {
      // Also delete the DB record so no orphaned rows remain
      try {
        await sbFetch(
          `order_photos?public_id=eq.${encodeURIComponent(publicId)}`,
          { method: 'DELETE', headers: { Prefer: 'return=minimal' } },
        )
      } catch {
        // Non-critical — Cloudinary deletion succeeded, DB cleanup is best-effort
      }
      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json({ error: 'Failed to delete photo from cloud storage' }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: 'Photo delete failed' }, { status: 500 })
  }
}
