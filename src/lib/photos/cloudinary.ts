// src/lib/photos/cloudinary.ts
// Cloudinary free tier: 25GB storage, 25GB/month bandwidth
// Sign up at cloudinary.com — no credit card needed
// Set NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME in .env.local

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
const UPLOAD_PRESET = 'darzi_photos'   // create this in Cloudinary dashboard

export const cloudinaryEnabled = !!CLOUD_NAME

export async function uploadToCloudinary(
  base64: string,
  folder = 'darzi-orders'
): Promise<string | null> {
  if (!CLOUD_NAME) return null

  try {
    const formData = new FormData()
    formData.append('file',           base64)
    formData.append('upload_preset',  UPLOAD_PRESET)
    formData.append('folder',         folder)
    formData.append('quality',        'auto')
    formData.append('fetch_format',   'auto')

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
      { method: 'POST', body: formData }
    )

    if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
    const data = await res.json()
    return data.secure_url as string
  } catch (e) {
    console.error('Cloudinary upload failed:', e)
    return null
  }
}