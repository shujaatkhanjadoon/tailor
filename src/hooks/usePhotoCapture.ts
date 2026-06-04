import { useState, useCallback, useRef } from 'react'
import { compressImage, type CompressResult } from '@/lib/photos/compress'
import { uploadToCloudinary, cloudinaryEnabled } from '@/lib/photos/cloudinary'
import { db, PhotoRecord }               from '@/lib/db/schema'
import { useAuth }                       from '@/lib/auth/AuthContext'
import { usePlan }                       from '@/hooks/usePlan'
import { supabase }                      from '@/lib/supabase/client'
import { deleteOrderPhotoEverywhere }    from '@/lib/photos/delete-order-photo'

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

async function upsertPhotoMetadata(photo: PhotoRecord) {
  if (!photo.cloudUrl || !photo.publicId) return
  await supabase
    .from('order_photos')
    .upsert({
      id: photo.id,
      order_id: photo.orderId,
      shop_id: photo.shopId,
      type: photo.type,
      cloud_url: photo.cloudUrl,
      public_id: photo.publicId,
      cloud_size_kb: photo.cloudSizeKB ?? undefined,
      size_kb: photo.sizeKB,
      taken_at: photo.takenAt,
      deleted_at: undefined,
    } as any, { onConflict: 'id' })
}

export function usePhotoCapture({ orderId, type }: UsePhotoCaptureOptions) {
  const { shopId, currentUser } = useAuth()
  const plan         = usePlan()
  const canSyncImages = (plan.plan === 'professional' || plan.plan === 'business') && plan.isActive
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<PhotoUploadState>({ phase: 'idle' })
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const processFile = useCallback(async (file: File): Promise<PhotoRecord | null> => {
    if (!shopId) return null

    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    const unsupportedExt = ['heic', 'heif', 'heics', 'heifs', 'avif', 'arw', 'cr2', 'nef', 'dng']
    if (unsupportedExt.includes(ext)) {
      setState({ phase: 'error', error: `${ext.toUpperCase()} format support nahi hai. JPEG/PNG convert karein.` })
      setTimeout(() => setState({ phase: 'idle' }), 5000)
      return null
    }

    // Read file data immediately to avoid detached File issues on mobile
    let fileBytes: ArrayBuffer
    try {
      fileBytes = await file.arrayBuffer()
    } catch {
      setState({ phase: 'error', error: 'File read nahi ho saka. Dobara try karein.' })
      setTimeout(() => setState({ phase: 'idle' }), 4000)
      return null
    }

    setState({ phase: 'compressing' })

    let result: CompressResult
    try {
      // Use Blob from ArrayBuffer so it's independent of the original File reference
      const blob = new Blob([fileBytes], { type: file.type })
      result = await compressImage(blob, {
        maxWidthPx:   2048,
        maxHeightPx:  2048,
        qualityStart: 0.88,
        qualityMin:   0.6,
        targetKB:     400,
        hardLimitKB:  800,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('Photo compression failed:', msg, file.name, file.type, Math.round(file.size / 1024) + 'KB')
      setState({ phase: 'error', error: 'Photo compress nahi ho saki. Dobara try karein.' })
      setTimeout(() => setState({ phase: 'idle' }), 4000)
      return null
    }

    setState({ phase: 'saving', sizeKB: result.sizeKB, quality: result.quality })

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

    try {
      await db.photos.add(photo)
    } catch (e) {
      console.error('Local save failed:', e)
      setState({ phase: 'error', error: 'Device mein save nahi ho saka. Storage check karein.' })
      setTimeout(() => setState({ phase: 'idle' }), 4000)
      return null
    }

    if (canSyncImages && cloudinaryEnabled && navigator.onLine) {
      setState(s => ({ ...s, phase: 'uploading' }))

      try {
        const uploaded = await uploadToCloudinary(
          result.base64,
          shopId,
          orderId,
          type
        )

        if (uploaded) {
          const cloudSizeKB = Math.round(uploaded.bytes / 1024)
          await db.photos.update(photo.id, {
            cloudUrl:  uploaded.url,
            publicId:  uploaded.publicId,
            cloudSizeKB,
            _synced:   1,
          })
          photo.cloudUrl = uploaded.url
          photo.publicId = uploaded.publicId
          photo.cloudSizeKB = cloudSizeKB
          photo._synced = 1
          try {
            await upsertPhotoMetadata(photo)
          } catch (metaError) {
            console.error('Photo metadata upsert failed (non-fatal):', metaError)
          }
        }
      } catch (cloudError) {
        console.error('Cloud upload failed (non-fatal):', cloudError)
      }
    }

    setState({ phase: 'done', sizeKB: result.sizeKB })
    setTimeout(() => setState({ phase: 'idle' }), 2000)

    return photo
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
    e.target.value = ''
  }, [processFile])

  const deletePhoto = useCallback(async (photo: PhotoRecord) => {
    if (!shopId || !currentUser?.id) return
    setDeletingId(photo.id)
    try {
      await deleteOrderPhotoEverywhere(photo, shopId, currentUser.id)
    } catch (e) {
      console.error('Delete failed:', e)
    } finally {
      setDeletingId(null)
    }
  }, [shopId, currentUser?.id])

  const retryUpload = useCallback(async (photo: PhotoRecord) => {
    if (!shopId || !canSyncImages || !cloudinaryEnabled || !navigator.onLine || !photo.base64) return

    setState({ phase: 'uploading', sizeKB: photo.sizeKB })
    try {
      const uploaded = await uploadToCloudinary(
        photo.base64,
        shopId,
        photo.orderId,
        photo.type
      )
      if (uploaded) {
        const cloudSizeKB = Math.round(uploaded.bytes / 1024)
        await db.photos.update(photo.id, {
          cloudUrl: uploaded.url,
          publicId: uploaded.publicId,
          cloudSizeKB,
          _synced: 1,
        })
        await upsertPhotoMetadata({
          ...photo,
          cloudUrl: uploaded.url,
          publicId: uploaded.publicId,
          cloudSizeKB,
          _synced: 1,
        })
        setState({ phase: 'done', sizeKB: photo.sizeKB })
      } else {
        setState({ phase: 'error', error: 'Cloud upload nahi ho saka. Dobara try karein.' })
      }
    } catch (e) {
      console.error('Retry upload failed:', e)
      setState({ phase: 'error', error: 'Cloud upload nahi ho saka. Dobara try karein.' })
    } finally {
      setTimeout(() => setState({ phase: 'idle' }), 2500)
    }
  }, [shopId, canSyncImages])

  return {
    fileInputRef,
    state,
    deletingId,
    openCamera,
    openGallery,
    handleFileChange,
    deletePhoto,
    retryUpload,
    cloudEnabled:  canSyncImages && cloudinaryEnabled,
    isProcessing:  state.phase !== 'idle' && state.phase !== 'done' && state.phase !== 'error',
  }
}
