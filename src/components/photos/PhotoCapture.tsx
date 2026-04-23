// src/components/photos/PhotoCapture.tsx
'use client'

import { useLiveQuery }  from 'dexie-react-hooks'
import {
  Camera, ImagePlus, Trash2, Loader2,
  CloudUpload, HardDrive, Expand,
} from 'lucide-react'
import { db, PhotoRecord } from '@/lib/db/schema'
import { usePhotoCapture } from '@/hooks/usePhotoCapture'
import { useState }        from 'react'
import { cn }              from '@/lib/utils'

interface PhotoCaptureProps {
  orderId:   string
  type:      PhotoRecord['type']
  label:     string
  sublabel?: string
  maxPhotos?: number
}

export function PhotoCapture({
  orderId,
  type,
  label,
  sublabel,
  maxPhotos = 3,
}: PhotoCaptureProps) {
  const {
    fileInputRef, capturing, uploading,
    error, openCamera, openGallery,
    handleFileChange, deletePhoto, cloudEnabled,
  } = usePhotoCapture({ orderId, type })

  const [viewing, setViewing] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  // Live photos from IndexedDB
  const photos = useLiveQuery(
    async (): Promise<PhotoRecord[]> =>
      db.photos
        .where('orderId').equals(orderId)
        .filter(p => p.type === type)
        .toArray(),
    [orderId, type]
  ) ?? []

  const canAddMore = photos.length < maxPhotos

  const handleDelete = async (photoId: string) => {
    setDeleting(photoId)
    await deletePhoto(photoId)
    setDeleting(null)
  }

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-semibold text-slate-700">{label}</p>
          {sublabel && (
            <p className="text-xs text-slate-400 mt-0.5">{sublabel}</p>
          )}
        </div>
        <span className="text-xs text-slate-400">
          {photos.length}/{maxPhotos}
        </span>
      </div>

      {/* Photo grid */}
      <div className="grid grid-cols-3 gap-2">

        {/* Existing photos */}
        {photos.map(photo => (
          <div
            key={photo.id}
            className="relative aspect-square rounded-xl overflow-hidden
                       bg-slate-100 border border-slate-200 group"
          >
            {/* Photo */}
            <img
              src={photo.cloudUrl ?? photo.base64}
              alt={label}
              className="w-full h-full object-cover"
            />

            {/* Overlay on hover */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40
                            transition-all flex items-center justify-center gap-2">
              <button
                onClick={() => setViewing(photo.cloudUrl ?? photo.base64)}
                className="opacity-0 group-hover:opacity-100 w-8 h-8 bg-white/90
                           rounded-full flex items-center justify-center transition-all"
              >
                <Expand size={14} className="text-slate-700" />
              </button>
              <button
                onClick={() => handleDelete(photo.id)}
                disabled={deleting === photo.id}
                className="opacity-0 group-hover:opacity-100 w-8 h-8 bg-red-500
                           rounded-full flex items-center justify-center transition-all"
              >
                {deleting === photo.id
                  ? <Loader2 size={14} className="text-white animate-spin" />
                  : <Trash2  size={14} className="text-white" />
                }
              </button>
            </div>

            {/* Storage indicator */}
            <div className="absolute top-1 left-1">
              {photo.cloudUrl ? (
                <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center"
                     title="Cloudinary mein save hai">
                  <CloudUpload size={9} className="text-white" />
                </div>
              ) : (
                <div className="w-4 h-4 bg-slate-600/70 rounded-full flex items-center justify-center"
                     title="Device mein save hai">
                  <HardDrive size={9} className="text-white" />
                </div>
              )}
            </div>

            {/* Size badge */}
            <div className="absolute bottom-1 right-1 bg-black/50 text-white
                            text-[8px] px-1 py-0.5 rounded">
              {photo.sizeKB}KB
            </div>
          </div>
        ))}

        {/* Add photo buttons */}
        {canAddMore && (
          <div className="aspect-square rounded-xl border-2 border-dashed border-slate-300
                          flex flex-col items-center justify-center gap-1.5
                          bg-slate-50">
            {capturing ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 size={20} className="text-blue-600 animate-spin" />
                <span className="text-[10px] text-slate-500">Compress ho raha hai...</span>
                {uploading && (
                  <span className="text-[10px] text-blue-500">Upload ho raha hai...</span>
                )}
              </div>
            ) : (
              <>
                <button
                  onClick={openCamera}
                  className="flex flex-col items-center gap-1 active:scale-95 transition-transform"
                >
                  <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center">
                    <Camera size={16} className="text-blue-600" />
                  </div>
                  <span className="text-[10px] text-slate-500 font-medium">Camera</span>
                </button>
                <button
                  onClick={openGallery}
                  className="text-[9px] text-slate-400 hover:text-blue-600 transition-colors"
                >
                  ya Gallery
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="text-xs text-red-500 mt-2">{error}</p>
      )}

      {/* Storage info */}
      {photos.length > 0 && (
        <p className="text-[10px] text-slate-400 mt-2 flex items-center gap-1">
          <HardDrive size={9} />
          {photos.reduce((s, p) => s + p.sizeKB, 0)}KB device storage used
          {cloudEnabled && photos.some(p => p.cloudUrl) && (
            <span className="ml-1 text-blue-500">· Cloud backup on</span>
          )}
        </p>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Full-screen viewer */}
      {viewing && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setViewing(null)}
        >
          <img
            src={viewing}
            alt="Full view"
            className="max-w-full max-h-full object-contain rounded-xl"
          />
          <button
            onClick={() => setViewing(null)}
            className="absolute top-4 right-4 w-10 h-10 bg-white/20 rounded-full
                       flex items-center justify-center text-white text-xl font-bold"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}