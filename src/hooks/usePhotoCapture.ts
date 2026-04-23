// src/hooks/usePhotoCapture.ts
import { useState, useCallback, useRef } from 'react'
import { compressImage, base64SizeKB } from '@/lib/photos/compress'
import { uploadToCloudinary, cloudinaryEnabled } from '@/lib/photos/cloudinary'
import { db, PhotoRecord } from '@/lib/db/schema'
import { useAuth } from '@/lib/auth/AuthContext'

interface UsePhotoCaptureOptions {
  orderId:  string
  type:     PhotoRecord['type']
}

export function usePhotoCapture({ orderId, type }: UsePhotoCaptureOptions) {
  const { shopId }           = useAuth()
  const fileInputRef         = useRef<HTMLInputElement>(null)
  const [capturing, setCapturing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError]         = useState<string | null>(null)

  const processFile = useCallback(async (file: File): Promise<PhotoRecord | null> => {
    if (!shopId) return null
    setCapturing(true)
    setError(null)

    try {
      // 1. Compress image
      const base64 = await compressImage(file, {
        maxWidthPx: 1200,
        qualityPct: 0.8,
        maxSizeKB:  300,
      })

      const sizeKB = base64SizeKB(base64)

      // 2. Save to IndexedDB immediately (works offline)
      const photo: PhotoRecord = {
        id:       crypto.randomUUID(),
        orderId,
        shopId,
        type,
        base64,
        sizeKB,
        takenAt:  new Date().toISOString(),
        _synced:  0,
      }
      await db.photos.add(photo)

      // 3. Try Cloudinary upload in background (optional)
      if (cloudinaryEnabled && navigator.onLine) {
        setUploading(true)
        const cloudUrl = await uploadToCloudinary(base64, `darzi/${shopId}`)
        if (cloudUrl) {
          await db.photos.update(photo.id, { cloudUrl, _synced: 1 })
          photo.cloudUrl = cloudUrl
        }
        setUploading(false)
      }

      return photo
    } catch (e) {
      console.error('Photo capture failed:', e)
      setError('Photo save nahi hui. Dobara try karein.')
      return null
    } finally {
      setCapturing(false)
    }
  }, [shopId, orderId, type])

  const openCamera = useCallback(() => {
    // Trigger file input with camera capture
    if (fileInputRef.current) {
      fileInputRef.current.setAttribute('capture', 'environment')
      fileInputRef.current.click()
    }
  }, [])

  const openGallery = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.removeAttribute('capture')
      fileInputRef.current.click()
    }
  }, [])

  const handleFileChange = useCallback(async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0]
    if (!file) return
    await processFile(file)
    // Reset input so same file can be selected again
    e.target.value = ''
  }, [processFile])

  const deletePhoto = useCallback(async (photoId: string) => {
    await db.photos.delete(photoId)
  }, [])

  return {
    fileInputRef,
    capturing,
    uploading,
    error,
    openCamera,
    openGallery,
    handleFileChange,
    deletePhoto,
    cloudEnabled: cloudinaryEnabled,
  }
}