// src/hooks/usePhotoCapture.ts
import { useState, useCallback, useRef } from 'react'
import { compressImage, base64ToKB }     from '@/lib/photos/compress'
import { uploadToCloudinary, deleteFromCloudinary, cloudinaryEnabled } from '@/lib/photos/cloudinary'
import { db, PhotoRecord }               from '@/lib/db/schema'
import { useAuth }                       from '@/lib/auth/AuthContext'
import { usePlan }                       from '@/hooks/usePlan'

interface UsePhotoCaptureOptions {
  orderId:  string
  type:     PhotoRecord['type']
}

export interface PhotoUploadState {
  phase:    'idle' | 'compressing' | 'saving' | 'uploading' | 'done' | 'error'
  sizeKB?:  number
  quality?: number
  error?:   string
}

export function usePhotoCapture({ orderId, type }: UsePhotoCaptureOptions) {
  const { shopId }   = useAuth()
  const plan         = usePlan()
  const canSyncImages = plan.plan === 'business' && plan.isActive
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<PhotoUploadState>({ phase: 'idle' })
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const processFile = useCallback(async (file: File): Promise<PhotoRecord | null> => {
    if (!shopId) return null

    setState({ phase: 'compressing' })

    try {
      // ── 1. Compress client-side ──────────────────────────────
      const result = await compressImage(file, {
        maxWidthPx:   1024,
        maxHeightPx:  1024,
        qualityStart: 0.82,
        qualityMin:   0.45,
        targetKB:     150,     // aim for 150KB
        hardLimitKB:  280,     // never go above 280KB
      })

      setState({ phase: 'saving', sizeKB: result.sizeKB, quality: result.quality })

      // ── 2. Save to IndexedDB immediately (works offline) ─────
      const photo: PhotoRecord = {
        id:      crypto.randomUUID(),
        orderId,
        shopId,
        type,
        base64:  result.base64,
        sizeKB:  result.sizeKB,
        takenAt: new Date().toISOString(),
        _synced: 0,
      }
      await db.photos.add(photo)

      // ── 3. Upload to Cloudinary in background ────────────────
      if (canSyncImages && cloudinaryEnabled && navigator.onLine) {
        setState(s => ({ ...s, phase: 'uploading' }))

        const uploaded = await uploadToCloudinary(
          result.base64,
          shopId,
          orderId,
          type
        )

        if (uploaded) {
          await db.photos.update(photo.id, {
            cloudUrl:  uploaded.url,
            publicId:  uploaded.publicId,
            cloudSizeKB: Math.round(uploaded.bytes / 1024),
            _synced:   0,
          })
          photo.cloudUrl = uploaded.url
        }
      }

      setState({ phase: 'done', sizeKB: result.sizeKB })
      setTimeout(() => setState({ phase: 'idle' }), 2000)

      return photo
    } catch (e) {
      console.error('Photo processing failed:', e)
      setState({ phase: 'error', error: 'Photo save nahi hui. Dobara try karein.' })
      setTimeout(() => setState({ phase: 'idle' }), 4000)
      return null
    }
  }, [shopId, orderId, type, canSyncImages])

  const openCamera = useCallback(() => {
    if (!fileInputRef.current) return
    fileInputRef.current.setAttribute('capture', 'environment')
    fileInputRef.current.accept = 'image/*'
    fileInputRef.current.click()
  }, [])

  const openGallery = useCallback(() => {
    if (!fileInputRef.current) return
    fileInputRef.current.removeAttribute('capture')
    fileInputRef.current.accept = 'image/*'
    fileInputRef.current.click()
  }, [])

  const handleFileChange = useCallback(async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0]
    if (!file) return
    await processFile(file)
    e.target.value = ''   // reset so same file works again
  }, [processFile])

  const deletePhoto = useCallback(async (photo: PhotoRecord) => {
    setDeletingId(photo.id)
    try {
      // Delete from Cloudinary if uploaded
      if (photo.publicId) {
        await deleteFromCloudinary(photo.publicId)
      }
      if (photo.cloudUrl && photo.publicId) {
        await db.photos.update(photo.id, { _deleted: 1, _synced: 0 })
      } else {
        await db.photos.delete(photo.id)
      }
    } catch (e) {
      console.error('Delete failed:', e)
    } finally {
      setDeletingId(null)
    }
  }, [canSyncImages])

  return {
    fileInputRef,
    state,
    deletingId,
    openCamera,
    openGallery,
    handleFileChange,
    deletePhoto,
    cloudEnabled:  canSyncImages && cloudinaryEnabled,
    isProcessing:  state.phase !== 'idle' && state.phase !== 'done' && state.phase !== 'error',
  }
}
