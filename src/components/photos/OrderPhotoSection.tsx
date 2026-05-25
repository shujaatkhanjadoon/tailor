// src/components/photos/OrderPhotoSection.tsx
'use client'

import { useState } from 'react'
import { Image, Lock, Upload, X } from 'lucide-react'
import { PhotoCapture } from './PhotoCapture'
import { usePlan } from '@/hooks/usePlan'

interface OrderPhotoSectionProps {
  orderId: string
}

function LockedPhotoPrompt() {
  const plan = usePlan()
  const [open, setOpen] = useState(false)

  return (
    <>
      <div className="mx-4 mt-4 lg:mx-0">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-left active:scale-[0.99] transition-transform"
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white">
              <Upload size={18} className="text-blue-600" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold text-slate-800">Upload Photos</span>
              <span className="mt-1 block text-xs leading-relaxed text-slate-500">
                Photos Professional plan mein available hain.
              </span>
            </span>
          </span>
          <Lock size={16} className="shrink-0 text-blue-600" />
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-md bg-white rounded-t-3xl lg:rounded-2xl p-5 shadow-2xl mb-16 lg:mb-0">
            <button
              aria-label="Close"
              onClick={() => setOpen(false)}
              className="absolute right-4 top-4 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"
            >
              <X size={15} className="text-slate-500" />
            </button>
            <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mb-4">
              <Lock size={20} className="text-blue-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 pr-8">Photo upload Professional plan mein hai</h3>
            <p className="text-sm text-slate-500 mt-2 leading-relaxed">
              Starter plan mein orders aur payments manage hotay hain. Photos attach karne ke liye account upgrade karein.
            </p>
            <button
              onClick={() => plan.upgrade('professional')}
              className="mt-5 w-full bg-blue-600 text-white font-bold py-3.5 rounded-2xl"
            >
              Upgrade to Professional
            </button>
          </div>
        </div>
      )}
    </>
  )
}

export function OrderPhotoSection({ orderId }: OrderPhotoSectionProps) {
  const plan = usePlan()

  if (plan.isLoading) {
    return <div className="mt-4 h-32 rounded-2xl bg-slate-100 animate-pulse" />
  }

  if (!plan.canUsePhotos) return <LockedPhotoPrompt />

  return (
    <div className="mt-4 lg:mx-0 bg-white border border-slate-200 rounded-2xl p-4 space-y-5">
      <div className="space-y-3">
        <h2 className="font-bold text-slate-800 text-sm flex items-center gap-2">
          <Image size={15} className="text-blue-600" />
          Photos
        </h2>

        <p className="text-[10px] leading-relaxed text-slate-400">
          Uploaded images are synced to cloud storage and automatically deleted after 90 days.
        </p>
      </div>

      <PhotoCapture
        orderId={orderId}
        type="fabric"
        label="Kapre Ki Photo"
        sublabel="Customer ka kapra kaisa hai"
        maxPhotos={2}
      />

      <div className="h-px bg-slate-100" />

      <PhotoCapture
        orderId={orderId}
        type="style"
        label="Style Reference"
        sublabel="Design ya design ki photo"
        maxPhotos={2}
      />

      <div className="h-px bg-slate-100" />

      <PhotoCapture
        orderId={orderId}
        type="reference"
        label="Tayyar Kapre Ki Photo"
        sublabel="Order complete hone ke baad"
        maxPhotos={1}
      />
    </div>
  )
}
