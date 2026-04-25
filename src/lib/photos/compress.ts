// src/lib/photos/compress.ts

export interface CompressOptions {
  maxWidthPx:   number
  maxHeightPx:  number
  qualityStart: number   // start quality attempt
  qualityMin:   number   // never go below this
  targetKB:     number   // aim for this size
  hardLimitKB:  number   // never exceed this
}

const DEFAULTS: CompressOptions = {
  maxWidthPx:   1024,    // enough detail for fabric texture
  maxHeightPx:  1024,
  qualityStart: 0.82,    // good starting point
  qualityMin:   0.45,    // minimum acceptable quality
  targetKB:     150,     // aim for 150KB
  hardLimitKB:  280,     // never exceed 280KB
}

export interface CompressResult {
  base64:    string
  sizeKB:    number
  width:     number
  height:    number
  quality:   number
  format:    string
}

export async function compressImage(
  input: File | Blob | string,   // File, Blob, or base64 string
  opts: Partial<CompressOptions> = {}
): Promise<CompressResult> {
  const cfg = { ...DEFAULTS, ...opts }

  return new Promise((resolve, reject) => {
    const img = new Image()

    const onLoad = () => {
      // Calculate dimensions
      let { width, height } = img

      // Maintain aspect ratio within limits
      const ratio = Math.min(
        cfg.maxWidthPx  / width,
        cfg.maxHeightPx / height,
        1   // never upscale
      )
      width  = Math.round(width  * ratio)
      height = Math.round(height * ratio)

      const canvas = document.createElement('canvas')
      canvas.width  = width
      canvas.height = height

      const ctx = canvas.getContext('2d', { alpha: false })
      if (!ctx) {
        reject(new Error('Canvas 2D not supported'))
        return
      }

      // White background — eliminates transparency,
      // reduces PNG→JPEG size significantly
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(0, 0, width, height)

      // Use better image smoothing
      ctx.imageSmoothingEnabled  = true
      ctx.imageSmoothingQuality  = 'high'
      ctx.drawImage(img, 0, 0, width, height)

      // Try to hit target size with binary-search quality
      let quality    = cfg.qualityStart
      let base64     = canvas.toDataURL('image/jpeg', quality)
      let sizeKB     = base64ToKB(base64)
      let iterations = 0
      const maxIter  = 8

      // Phase 1: Reduce quality if over hard limit
      while (sizeKB > cfg.hardLimitKB && quality > cfg.qualityMin && iterations < maxIter) {
        quality   = Math.max(quality - 0.08, cfg.qualityMin)
        base64    = canvas.toDataURL('image/jpeg', quality)
        sizeKB    = base64ToKB(base64)
        iterations++
      }

      // Phase 2: Try to get closer to target with fine adjustments
      if (sizeKB > cfg.targetKB && quality > cfg.qualityMin + 0.05) {
        const fineQuality = quality - 0.05
        const fineBase64  = canvas.toDataURL('image/jpeg', fineQuality)
        const fineSizeKB  = base64ToKB(fineBase64)
        // Only use if it doesn't drop too much quality
        if (fineSizeKB <= cfg.targetKB && fineQuality >= cfg.qualityMin) {
          quality = fineQuality
          base64  = fineBase64
          sizeKB  = fineSizeKB
        }
      }

      // Phase 3: If still over hard limit, reduce dimensions
      if (sizeKB > cfg.hardLimitKB) {
        const scale    = 0.75
        const w2       = Math.round(width  * scale)
        const h2       = Math.round(height * scale)
        canvas.width   = w2
        canvas.height  = h2
        ctx.fillStyle  = '#FFFFFF'
        ctx.fillRect(0, 0, w2, h2)
        ctx.drawImage(img, 0, 0, w2, h2)
        base64 = canvas.toDataURL('image/jpeg', quality)
        sizeKB = base64ToKB(base64)
        width  = w2
        height = h2
      }

      resolve({
        base64,
        sizeKB,
        width,
        height,
        quality: Math.round(quality * 100),
        format:  'image/jpeg',
      })
    }

    img.onerror = () => {
      URL.revokeObjectURL(img.src)
      reject(new Error('Image failed to load'))
    }
    img.onload = () => { onLoad(); URL.revokeObjectURL(img.src) }

    if (typeof input === 'string') {
      img.src = input
    } else {
      img.src = URL.createObjectURL(input)
    }
  })
}

// Helpers
export function base64ToKB(base64: string): number {
  const base = base64.includes(',') ? base64.split(',')[1] : base64
  // base64 encodes 3 bytes in 4 chars, minus padding
  return Math.round((base.length * 3) / 4 / 1024)
}

export function base64ToBlob(base64: string, mime = 'image/jpeg'): Blob {
  const [, data] = base64.split(',')
  const binary   = atob(data)
  const bytes    = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Blob([bytes], { type: mime })
}

// Test compression — useful in development
export async function testCompression(file: File): Promise<void> {
  const original  = Math.round(file.size / 1024)
  const result    = await compressImage(file)
  console.table({
    'Original KB':    original,
    'Compressed KB':  result.sizeKB,
    'Reduction':      `${Math.round((1 - result.sizeKB / original) * 100)}%`,
    'Dimensions':     `${result.width}×${result.height}`,
    'Final Quality':  `${result.quality}%`,
  })
}