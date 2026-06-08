// src/lib/photos/compress.ts

import loadImageLib from 'blueimp-load-image';

function loadImageOriented(blob: Blob): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    loadImageLib(
      blob,
      (result) => {
        if (result instanceof HTMLCanvasElement) {
          resolve(result);
        } else if (result instanceof Event) {
          reject(new Error('Failed to load image with orientation correction'));
        } else {
          reject(new Error('Unexpected result type from loadImage'));
        }
      },
      { orientation: true, canvas: true }
    );
  });
}

export interface CompressOptions {
  maxWidthPx:   number
  maxHeightPx:  number
  qualityStart: number
  qualityMin:   number
  targetKB:     number
  hardLimitKB:  number
}

const DEFAULTS: CompressOptions = {
  maxWidthPx:   1024,
  maxHeightPx:  1024,
  qualityStart: 0.82,
  qualityMin:   0.45,
  targetKB:     150,
  hardLimitKB:  280,
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
  input: File | Blob | string,
  opts: Partial<CompressOptions> = {}
): Promise<CompressResult> {
  const cfg = { ...DEFAULTS, ...opts }

  if (typeof input === 'string') {
    return compressSrc(input, cfg)
  }
  return compressBlob(input, cfg)
}

async function compressSrc(src: string, cfg: CompressOptions): Promise<CompressResult> {
  return new Promise((resolve, reject) => {
    const img = new Image()

    const onLoad = () => {
      try {
        if (!img.naturalWidth || !img.naturalHeight) {
          reject(new Error('Image has no dimensions — likely unsupported format')); return
        }

        let { width, height } = img

        const ratio = Math.min(
          cfg.maxWidthPx  / width,
          cfg.maxHeightPx / height,
          1
        )
        width  = Math.round(width  * ratio)
        height = Math.round(height * ratio)

        const canvas = document.createElement('canvas')
        canvas.width  = width
        canvas.height = height

        const ctx = canvas.getContext('2d', { alpha: false })
        if (!ctx) { reject(new Error('Canvas 2D not supported')); return }

        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(0, 0, width, height)

        ctx.imageSmoothingEnabled  = true
        ctx.imageSmoothingQuality  = 'high'
        ctx.drawImage(img, 0, 0, width, height)

        let quality    = cfg.qualityStart
        let base64     = canvas.toDataURL('image/jpeg', quality)
        let sizeKB     = base64ToKB(base64)
        let iterations = 0
        const maxIter  = 8

        while (sizeKB > cfg.hardLimitKB && quality > cfg.qualityMin && iterations < maxIter) {
          quality   = Math.max(quality - 0.08, cfg.qualityMin)
          base64    = canvas.toDataURL('image/jpeg', quality)
          sizeKB    = base64ToKB(base64)
          iterations++
        }

        if (sizeKB > cfg.targetKB && quality > cfg.qualityMin + 0.05) {
          const fineQuality = quality - 0.05
          const fineBase64  = canvas.toDataURL('image/jpeg', fineQuality)
          const fineSizeKB  = base64ToKB(fineBase64)
          if (fineSizeKB <= cfg.targetKB && fineQuality >= cfg.qualityMin) {
            quality = fineQuality
            base64  = fineBase64
            sizeKB  = fineSizeKB
          }
        }

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
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)))
      }
    }

    img.onload = onLoad
    img.onerror = () => reject(new Error('Image load failed — unsupported format or corrupt file'))
    img.src = src
  })
}

async function compressBlob(blob: Blob, cfg: CompressOptions): Promise<CompressResult> {
  const oriented = await loadImageOriented(blob)
  return compressCanvas(oriented, cfg)
}

async function compressCanvas(source: HTMLCanvasElement, cfg: CompressOptions): Promise<CompressResult> {
  let { width, height } = source

  const ratio = Math.min(
    cfg.maxWidthPx  / width,
    cfg.maxHeightPx / height,
    1
  )
  width  = Math.round(width  * ratio)
  height = Math.round(height * ratio)

  const canvas = document.createElement('canvas')
  canvas.width  = width
  canvas.height = height

  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) throw new Error('Canvas 2D not supported')

  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, width, height)
  ctx.imageSmoothingEnabled  = true
  ctx.imageSmoothingQuality  = 'high'
  ctx.drawImage(source, 0, 0, width, height)

  let quality    = cfg.qualityStart
  let base64     = canvas.toDataURL('image/jpeg', quality)
  let sizeKB     = base64ToKB(base64)
  let iterations = 0
  const maxIter  = 8

  while (sizeKB > cfg.hardLimitKB && quality > cfg.qualityMin && iterations < maxIter) {
    quality   = Math.max(quality - 0.08, cfg.qualityMin)
    base64    = canvas.toDataURL('image/jpeg', quality)
    sizeKB    = base64ToKB(base64)
    iterations++
  }

  if (sizeKB > cfg.targetKB && quality > cfg.qualityMin + 0.05) {
    const fineQuality = quality - 0.05
    const fineBase64  = canvas.toDataURL('image/jpeg', fineQuality)
    const fineSizeKB  = base64ToKB(fineBase64)
    if (fineSizeKB <= cfg.targetKB && fineQuality >= cfg.qualityMin) {
      quality = fineQuality
      base64  = fineBase64
      sizeKB  = fineSizeKB
    }
  }

  if (sizeKB > cfg.hardLimitKB) {
    const scale    = 0.75
    const w2       = Math.round(width  * scale)
    const h2       = Math.round(height * scale)
    canvas.width   = w2
    canvas.height  = h2
    ctx.fillStyle  = '#FFFFFF'
    ctx.fillRect(0, 0, w2, h2)
    ctx.drawImage(source, 0, 0, w2, h2)
    base64 = canvas.toDataURL('image/jpeg', quality)
    sizeKB = base64ToKB(base64)
    width  = w2
    height = h2
  }

  return {
    base64,
    sizeKB,
    width,
    height,
    quality: Math.round(quality * 100),
    format: 'image/jpeg',
  }
}

export function base64ToKB(base64: string): number {
  const base = base64.includes(',') ? base64.split(',')[1] : base64
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
