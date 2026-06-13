import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { sbGet, sbDelete } from '@/lib/supabase/service'
import { logger } from '@/lib/logger'
import { mapConcurrent } from '@/lib/concurrent'

const BATCH_SIZE = 50

async function deleteCloudinaryAsset(publicId: string): Promise<boolean> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY ?? process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET
  if (!cloudName || !apiKey || !apiSecret) return true

  try {
    const timestamp = Math.round(Date.now() / 1000)
    const signString = `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`
    const signature = crypto.createHash('sha256').update(signString).digest('hex')
    const formData = new FormData()
    formData.append('public_id', publicId)
    formData.append('timestamp', String(timestamp))
    formData.append('api_key', apiKey)
    formData.append('signature', signature)
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`,
      { method: 'POST', body: formData, signal: AbortSignal.timeout(10000) },
    )
    const data = await res.json().catch(() => ({}))
    return res.ok && ['ok', 'not found'].includes(data.result)
  } catch {
    return false
  }
}

export const maxDuration = 300

export async function GET(req: NextRequest) {
  return POST(req)
}

export async function POST(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cutoff = new Date(Date.now() - 30 * 86400000).toISOString()
  const results: { scannedCustomers: number; scannedOrders: number; errors: string[] } = {
    scannedCustomers: 0, scannedOrders: 0, errors: [],
  }

  try {
    // ── Expired customers ──
    const expiredCustomers: { id: string }[] = await sbGet<{ id: string }>(
      `customers?deleted_at=lt.${cutoff}&select=id&limit=${BATCH_SIZE}&order=deleted_at.asc`
    ).catch(() => [])
    results.scannedCustomers = expiredCustomers.length

    if (expiredCustomers.length > 0) {
      const ids = expiredCustomers.map(c => encodeURIComponent(c.id)).join(',')
      const cids = expiredCustomers.map(c => c.id)

      // Destroy Cloudinary photos for their orders
      const orderPhotos: { public_id: string }[] = await sbGet<{ public_id: string }>(
        `order_photos?order_id=in.(${ids})&select=public_id`
      ).catch(() => [])
      const photoPublicIds = orderPhotos.map(p => p.public_id).filter((id): id is string => id !== null)
      await mapConcurrent(photoPublicIds, async (publicId) => {
        await deleteCloudinaryAsset(publicId)
      })

      // Cascade delete
      for (const c of cids) {
        const eid = encodeURIComponent(c)

        const orderRows: { id: string; measurement_id: string | null }[] = await sbGet<{ id: string; measurement_id: string | null }>(
          `orders?customer_id=eq.${eid}&select=id,measurement_id`
        ).catch(() => [])

        const oids = orderRows.map(o => o.id).filter((id): id is string => id !== null)
        if (oids.length > 0) {
          const oidParam = oids.map(encodeURIComponent).join(',')
          await sbDelete(`order_photos?order_id=in.(${oidParam})`).catch(() => {})
          await sbDelete(`payments?order_id=in.(${oidParam})`).catch(() => {})

          const mids = orderRows.map(o => o.measurement_id).filter((id): id is string => id !== null)
          if (mids.length > 0) {
            await sbDelete(`measurements?id=in.(${mids.map(encodeURIComponent).join(',')})`).catch(() => {})
          }

          await sbDelete(`orders?id=in.(${oidParam})`).catch(() => {})
        }

        await sbDelete(`measurements?customer_id=eq.${eid}`).catch(() => {})
        await sbDelete(`customers?id=eq.${eid}`).catch(() => {})
      }
    }

    // ── Expired orders (not linked to expired customers) ──
    const expiredOrders: { id: string }[] = await sbGet<{ id: string }>(
      `orders?deleted_at=lt.${cutoff}&select=id&limit=${BATCH_SIZE}&order=deleted_at.asc`
    ).catch(() => [])
    results.scannedOrders = expiredOrders.length

    if (expiredOrders.length > 0) {
      for (const o of expiredOrders) {
        const eid = encodeURIComponent(o.id)

        const photos: { public_id: string }[] = await sbGet<{ public_id: string }>(
          `order_photos?order_id=eq.${eid}&select=public_id`
        ).catch(() => [])
        const publicIds = photos.map(p => p.public_id).filter((id): id is string => id !== null)
        await mapConcurrent(publicIds, async (publicId) => {
          await deleteCloudinaryAsset(publicId)
        })

        await sbDelete(`order_photos?order_id=eq.${eid}`).catch(() => {})
        await sbDelete(`payments?order_id=eq.${eid}`).catch(() => {})

        const orderRows: { measurement_id: string | null }[] = await sbGet<{ measurement_id: string | null }>(
          `orders?id=eq.${eid}&select=measurement_id`
        ).catch(() => [])
        const mid = orderRows[0]?.measurement_id
        if (mid) {
          await sbDelete(`measurements?id=eq.${encodeURIComponent(mid)}`).catch(() => {})
        }

        await sbDelete(`orders?id=eq.${eid}`).catch(() => {})
      }
    }

    const hasMore = expiredCustomers.length >= BATCH_SIZE || expiredOrders.length >= BATCH_SIZE

    return NextResponse.json({
      success: true,
      cutoff,
      ...results,
      hasMore,
    })
  } catch (e) {
    logger.error('purge-trash', 'error', e)
    return NextResponse.json({ success: false, error: 'Cron job failed' }, { status: 500 })
  }
}
