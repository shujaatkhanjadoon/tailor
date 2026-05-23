import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'


const BASE = () => `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1`

const getHeaders = () => ({
  'Content-Type':  'application/json',
  'apikey':        process.env.SUPABASE_SERVICE_ROLE_KEY!,
  'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
})

async function sbGet(path: string) {
  const res = await fetch(`${BASE()}/${path}`, { headers: getHeaders() })
  if (!res.ok) throw new Error(`GET ${path}: ${await res.text()}`)
  return res.json()
}

async function sbPatch(path: string, data: object) {
  const res = await fetch(`${BASE()}/${path}`, {
    method:  'PATCH',
    headers: { ...getHeaders(), 'Prefer': 'return=minimal' },
    body:    JSON.stringify(data),
  })
  if (!res.ok) throw new Error(`PATCH ${path}: ${await res.text()}`)
}

async function destroyCloudinaryImage(publicId: string) {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  const apiKey    = process.env.CLOUDINARY_API_KEY ?? process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Cloudinary not configured')
  }

  const timestamp = Math.round(Date.now() / 1000)
  const signature = crypto
    .createHash('sha256')
    .update(`public_id=${publicId}&timestamp=${timestamp}${apiSecret}`)
    .digest('hex')

  const formData = new FormData()
  formData.append('public_id', publicId)
  formData.append('timestamp', String(timestamp))
  formData.append('api_key', apiKey)
  formData.append('signature', signature)

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`,
    { method: 'POST', body: formData }
  )
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !['ok', 'not found'].includes(data.result)) {
    throw new Error(`Cloudinary destroy failed: ${data.result ?? res.status}`)
  }
}

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY not set' }, { status: 500 })
  }

  const now = new Date()
  const cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString()
  const deletedAt = now.toISOString()
  const results = { scanned: 0, deleted: 0, errors: [] as string[] }

  try {
    const photos = await sbGet(
      `order_photos?taken_at=lt.${cutoff}&deleted_at=is.null&select=id,public_id`
    )
    results.scanned = photos.length

    for (const photo of photos) {
      try {
        if (photo.public_id) await destroyCloudinaryImage(photo.public_id)
        await sbPatch(`order_photos?id=eq.${photo.id}`, { deleted_at: deletedAt })
        results.deleted++
      } catch (e) {
        results.errors.push(`${photo.id}: ${String(e)}`)
      }
    }

    return NextResponse.json({ success: true, cutoff, ...results })
  } catch (e) {
    return NextResponse.json({ success: false, error: 'Cron job failed' }, { status: 500 })
  }
}
