// src/lib/photos/cloudinary.ts

const CLOUD_NAME    = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
const UPLOAD_PRESET = 'darzi_photos'    // must match Step 2 exactly

export const cloudinaryEnabled = !!CLOUD_NAME

export interface CloudinaryUploadResult {
  url:       string    // https delivery URL
  publicId:  string    // for future deletion/transformation
  bytes:     number
  width:     number
  height:    number
  format:    string
}

// ── Main upload function ──────────────────────────────────────────
export async function uploadToCloudinary(
  base64:    string,
  shopId:    string,
  orderId:   string,
  photoType: string
): Promise<CloudinaryUploadResult | null> {
  if (!CLOUD_NAME) {
    console.warn('Cloudinary not configured — skipping cloud upload')
    return null
  }

  if (!navigator.onLine) return null

  try {
    const formData = new FormData()
    formData.append('file',           base64)
    formData.append('upload_preset',  UPLOAD_PRESET)
    formData.append('folder',         `darzi-manager/${shopId}/${orderId}`)
    formData.append('public_id',      `${photoType}_${Date.now()}`)
    formData.append('quality',        'auto:good')
    formData.append('fetch_format',   'auto')

    const endpoint = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`
    const res = await fetch(endpoint, { method: 'POST', body: formData })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error('Cloudinary error:', err)
      return null
    }

    const data = await res.json()

    return {
      url:      data.secure_url,
      publicId: data.public_id,
      bytes:    data.bytes,
      width:    data.width,
      height:   data.height,
      format:   data.format,
    }
  } catch (e) {
    console.error('Cloudinary upload failed:', e)
    return null
  }
}

// ── Delete from Cloudinary (needs server-side API route) ──────────
export async function deleteFromCloudinary(
  publicId: string,
  shopId:   string,
  memberId: string,
): Promise<boolean> {
  if (!CLOUD_NAME) return false
  try {
    const res = await fetch('/api/photos/delete', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ publicId, shopId, memberId }),
    })
    return res.ok
  } catch {
    return false
  }
}

export function publicIdFromCloudinaryUrl(url?: string | null): string | null {
  if (!url?.includes('cloudinary.com')) return null
  try {
    const path = new URL(url).pathname
    const uploadIndex = path.indexOf('/upload/')
    if (uploadIndex === -1) return null
    const parts = path.slice(uploadIndex + '/upload/'.length).split('/')
    if (parts[0]?.includes(',')) parts.shift()
    if (/^v\d+$/.test(parts[0] ?? '')) parts.shift()
    const withoutVersion = parts.join('/')
    return withoutVersion.replace(/\.[^.]+$/, '') || null
  } catch {
    return null
  }
}

// ── Get optimised URL with transformations ────────────────────────
export function getOptimisedUrl(
  cloudUrl: string,
  opts: { width?: number; quality?: string } = {}
): string {
  if (!cloudUrl.includes('cloudinary.com')) return cloudUrl

  const { width = 800, quality = 'auto:good' } = opts

  return cloudUrl.replace(
    '/upload/',
    `/upload/w_${width},q_${quality},f_auto/`
  )
}
