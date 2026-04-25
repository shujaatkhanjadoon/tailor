// src/components/photos/PhotoCapture.tsx
'use client'

import { useState }      from 'react'
import { useLiveQuery }  from 'dexie-react-hooks'
import {
  Camera, Images, Trash2, Loader2,
  Cloud, HardDrive, Expand, CheckCircle2,
  AlertCircle, Upload,
} from 'lucide-react'
import { db, PhotoRecord }     from '@/lib/db/schema'
import { usePhotoCapture }     from '@/hooks/usePhotoCapture'
import { getOptimisedUrl }     from '@/lib/photos/cloudinary'
import { cn }                  from '@/lib/utils'

interface PhotoCaptureProps {
  orderId:   string
  type:      PhotoRecord['type']
  label:     string
  sublabel?: string
  maxPhotos?: number
}

// Phase labels shown during upload
const PHASE_LABELS: Record<string, string> = {
  compressing: 'Compress ho raha hai...',
  saving:      'Device mein save ho raha hai...',
  uploading:   'Cloudinary upload ho raha hai...',
  done:        'Save ho gaya!',
  error:       'Error!',
}

export function PhotoCapture({
  orderId,
  type,
  label,
  sublabel,
  maxPhotos = 3,
}: PhotoCaptureProps) {
  const {
    fileInputRef,
    state,
    deletingId,
    openCamera,
    openGallery,
    handleFileChange,
    deletePhoto,
    cloudEnabled,
    isProcessing,
  } = usePhotoCapture({ orderId, type })

  const [viewing, setViewing] = useState<string | null>(null)

  const photos = useLiveQuery(
    async (): Promise<PhotoRecord[]> =>
      db.photos
        .where('orderId').equals(orderId)
        .filter(p => p.type === type)
        .sortBy('takenAt'),
    [orderId, type]
  ) ?? []

  const canAdd = photos.length < maxPhotos && !isProcessing

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-semibold text-slate-700">{label}</p>
          {sublabel && (
            <p className="text-xs text-slate-400 mt-0.5">{sublabel}</p>
          )}
        </div>
        <span className="text-xs text-slate-400 font-medium">
          {photos.length}/{maxPhotos}
        </span>
      </div>

      {/* Photo grid */}
      <div className="grid grid-cols-3 gap-2">

        {/* Existing photos */}
        {photos.map(photo => {
          const displayUrl = photo.cloudUrl
            ? getOptimisedUrl(photo.cloudUrl, { width: 400 })
            : photo.base64
          const isDeleting = deletingId === photo.id

          return (
            <div
              key={photo.id}
              className="relative aspect-square rounded-2xl overflow-hidden
                         bg-slate-100 border border-slate-200 group"
            >
              {/* Image */}
              <img
                src={displayUrl}
                alt={label}
                className="w-full h-full object-cover"
                loading="lazy"
              />

              {/* Hover overlay */}
              <div className={cn(
                'absolute inset-0 transition-all duration-200',
                'bg-black/0 group-hover:bg-black/50',
                'flex items-center justify-center gap-2'
              )}>
                {/* Expand */}
                <button
                  onClick={() => setViewing(photo.cloudUrl ?? photo.base64)}
                  className="opacity-0 group-hover:opacity-100 w-9 h-9 bg-white/90
                             rounded-full flex items-center justify-center
                             transition-all active:scale-90"
                >
                  <Expand size={15} className="text-slate-700" />
                </button>

                {/* Delete */}
                <button
                  onClick={() => deletePhoto(photo)}
                  disabled={isDeleting}
                  className="opacity-0 group-hover:opacity-100 w-9 h-9 bg-red-500
                             rounded-full flex items-center justify-center
                             transition-all active:scale-90 disabled:opacity-50"
                >
                  {isDeleting
                    ? <Loader2 size={15} className="text-white animate-spin" />
                    : <Trash2  size={15} className="text-white" />
                  }
                </button>
              </div>

              {/* Top-left: storage status */}
              <div className="absolute top-1.5 left-1.5">
                {photo.cloudUrl ? (
                  <div
                    className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center shadow"
                    title="Cloudinary mein save hai"
                  >
                    <Cloud size={10} className="text-white" />
                  </div>
                ) : (
                  <div
                    className="w-5 h-5 bg-slate-700/80 rounded-full flex items-center justify-center shadow"
                    title="Sirf device mein hai"
                  >
                    <HardDrive size={10} className="text-white" />
                  </div>
                )}
              </div>

              {/* Bottom-right: size */}
              <div className="absolute bottom-1.5 right-1.5 bg-black/60 text-white
                              text-[9px] font-medium px-1.5 py-0.5 rounded-full">
                {photo.cloudUrl && photo.cloudSizeKB
                  ? `${photo.cloudSizeKB}KB ☁`
                  : `${photo.sizeKB}KB`
                }
              </div>
            </div>
          )
        })}

        {/* Upload button / processing state */}
        {(canAdd || isProcessing) && (
          <div className={cn(
            'aspect-square rounded-2xl border-2 border-dashed',
            'flex flex-col items-center justify-center gap-1.5',
            isProcessing
              ? 'border-blue-300 bg-blue-50'
              : 'border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50 transition-colors'
          )}>

            {/* Processing state */}
            {isProcessing && state.phase !== 'error' && (
              <div className="flex flex-col items-center gap-1.5 px-2 text-center">
                {state.phase === 'done' ? (
                  <CheckCircle2 size={22} className="text-green-500" />
                ) : (
                  <Loader2 size={22} className="text-blue-600 animate-spin" />
                )}
                <span className="text-[9px] text-blue-600 font-medium leading-tight">
                  {PHASE_LABELS[state.phase]}
                </span>
                {state.sizeKB && state.phase === 'uploading' && (
                  <span className="text-[9px] text-slate-500">
                    {state.sizeKB}KB → Cloud
                  </span>
                )}
              </div>
            )}

            {/* Error state */}
            {state.phase === 'error' && (
              <div className="flex flex-col items-center gap-1 px-2 text-center">
                <AlertCircle size={20} className="text-red-500" />
                <span className="text-[9px] text-red-500 leading-tight">
                  {state.error}
                </span>
              </div>
            )}

            {/* Idle — show buttons */}
            {!isProcessing && state.phase !== 'error' && (
              <>
                <button
                  onClick={openCamera}
                  className="flex flex-col items-center gap-1 active:scale-90 transition-transform w-full py-1"
                >
                  <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
                    <Camera size={18} className="text-blue-600" />
                  </div>
                  <span className="text-[10px] text-slate-500 font-semibold">Camera</span>
                </button>
                <button
                  onClick={openGallery}
                  className="flex items-center gap-1 text-[9px] text-slate-400 hover:text-blue-600 transition-colors"
                >
                  <Images size={10} />
                  Gallery
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Storage info footer */}
      {photos.length > 0 && (
        <div className="flex items-center gap-3 mt-2.5 text-[10px] text-slate-400">
          <span className="flex items-center gap-1">
            <HardDrive size={9} />
            {photos.reduce((s, p) => s + p.sizeKB, 0)}KB device
          </span>
          {cloudEnabled && photos.some(p => p.cloudUrl) && (
            <span className="flex items-center gap-1 text-blue-500">
              <Cloud size={9} />
              {photos.filter(p => p.cloudUrl).length}/{photos.length} on cloud
            </span>
          )}
          {cloudEnabled && photos.some(p => !p.cloudUrl) && navigator.onLine && (
            <button
              onClick={() => {/* TODO: retry upload */}}
              className="flex items-center gap-1 text-amber-500 hover:text-amber-700"
            >
              <Upload size={9} />
              Retry upload
            </button>
          )}
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Full-screen viewer */}
      {viewing && (
        <div
          className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4"
          onClick={() => setViewing(null)}
        >
          <img
            src={viewing.includes('cloudinary.com')
              ? getOptimisedUrl(viewing, { width: 1200 })
              : viewing
            }
            alt="Full view"
            className="max-w-full max-h-full object-contain rounded-xl"
            onClick={e => e.stopPropagation()}
          />
          <button
            onClick={() => setViewing(null)}
            className="absolute top-5 right-5 w-11 h-11 bg-white/20
                       backdrop-blur-sm rounded-full flex items-center justify-center
                       text-white text-lg font-bold hover:bg-white/30 transition-colors"
          >
            ✕
          </button>
          {/* Bottom info bar */}
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2
                          bg-black/60 backdrop-blur-sm text-white text-xs
                          px-4 py-2 rounded-full">
            {viewing.includes('cloudinary.com')
              ? '☁️ Cloudinary se load ho raha hai'
              : '📱 Device se load ho raha hai'
            }
          </div>
        </div>
      )}
    </div>
  )
}