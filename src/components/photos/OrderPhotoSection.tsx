// src/components/photos/OrderPhotoSection.tsx
'use client'

import { Image } from 'lucide-react'
import { PhotoCapture } from './PhotoCapture'
import { FeatureGate } from '@/components/billing/FeatureGate'

interface OrderPhotoSectionProps {
  orderId: string
}

export function OrderPhotoSection({ orderId }: OrderPhotoSectionProps) {
  return (
    <FeatureGate feature="photos" mode="blur">
      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-5">
        <h2 className="font-bold text-slate-800 text-sm flex items-center gap-2">
          <Image size={15} className="text-blue-600" />
          Photos
        </h2>

        {/* Fabric photo */}
        <PhotoCapture
          orderId={orderId}
          type="fabric"
          label="Kapre Ki Photo"
          sublabel="Customer ka kapra kaisa hai"
          maxPhotos={2}
        />

        <div className="h-px bg-slate-100" />

        {/* Style reference */}
        <PhotoCapture
          orderId={orderId}
          type="style"
          label="Style Reference"
          sublabel="Design ya design ki photo"
          maxPhotos={2}
        />

        <div className="h-px bg-slate-100" />

        {/* Ready/finished photo */}
        <PhotoCapture
          orderId={orderId}
          type="reference"
          label="Tayyar Kapre Ki Photo"
          sublabel="Order complete hone ke baad"
          maxPhotos={1}
        />
      </div>
    </FeatureGate>
  )
}
