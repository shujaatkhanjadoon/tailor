// src/lib/photos/compress.ts
// Compresses images client-side before storing
// No external library needed — uses Canvas API

export interface CompressOptions {
  maxWidthPx:  number    // max dimension
  qualityPct:  number    // 0-1, JPEG quality
  maxSizeKB:   number    // target max file size
}

const DEFAULTS: CompressOptions = {
  maxWidthPx: 800,       // enough for fabric photo detail
  qualityPct: 0.75,      // good quality, small size
  maxSizeKB:  200,       // ~200KB per photo
}

export async function compressImage(
  file: File | Blob,
  opts: Partial<CompressOptions> = {}
): Promise<string> {
  const { maxWidthPx, qualityPct, maxSizeKB } = { ...DEFAULTS, ...opts }

  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      // Calculate new dimensions preserving aspect ratio
      let { width, height } = img
      if (width > maxWidthPx || height > maxWidthPx) {
        if (width > height) {
          height = Math.round((height * maxWidthPx) / width)
          width  = maxWidthPx
        } else {
          width  = Math.round((width * maxWidthPx) / height)
          height = maxWidthPx
        }
      }

      const canvas = document.createElement('canvas')
      canvas.width  = width
      canvas.height = height

      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('Canvas not supported')); return }

      // White background (avoids black bg on transparent PNGs)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, width, height)
      ctx.drawImage(img, 0, 0, width, height)

      // Try to hit the size target
      let quality = qualityPct
      let base64  = canvas.toDataURL('image/jpeg', quality)

      // If still too large, reduce quality iteratively
      while (base64.length > maxSizeKB * 1024 * 1.37 && quality > 0.3) {
        quality -= 0.1
        base64   = canvas.toDataURL('image/jpeg', quality)
      }

      resolve(base64)
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Image load failed'))
    }

    img.src = url
  })
}

// Get file size from base64 string
export function base64SizeKB(base64: string): number {
  const base = base64.split(',')[1] ?? base64
  return Math.round((base.length * 3) / 4 / 1024)
}

// Convert base64 back to Blob (for sharing / uploading)
export function base64ToBlob(base64: string, mime = 'image/jpeg'): Blob {
  const binary = atob(base64.split(',')[1])
  const bytes  = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Blob([bytes], { type: mime })
}