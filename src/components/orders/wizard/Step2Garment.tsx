// src/components/orders/wizard/Step2Garment.tsx
'use client'

import { useState } from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'
import { GarmentType, GARMENT_LABELS } from '@/types'
import { cn } from '@/lib/utils'
import { Camera } from 'lucide-react'
import { compressImage } from '@/lib/photos/compress'

// Measurement fields per garment type
const MEASUREMENT_FIELDS: Record<GarmentType, { key: string; label: string; unit: string }[]> = {
  shalwar_kameez: [
    { key: 'length', label: 'Length', unit: 'inch' },
    { key: 'chest', label: 'Chest (Seena)', unit: 'inch' },
    { key: 'waist', label: 'Waist (Kamar)', unit: 'inch' },
    { key: 'shoulder', label: 'Shoulder (Kandhа)', unit: 'inch' },
    { key: 'sleeve', label: 'Sleeve (Bazoo)', unit: 'inch' },
    { key: 'collar', label: 'Collar (Gireban)', unit: 'inch' },
    { key: 'trouser_length', label: 'Shalwar Length', unit: 'inch' },
    { key: 'trouser_waist', label: 'Shalwar Waist', unit: 'inch' },
    { key: 'bottom', label: 'Bottom (Paincha)', unit: 'inch' },
  ],
  shirt: [
    { key: 'length', label: 'Length', unit: 'inch' },
    { key: 'chest', label: 'Chest', unit: 'inch' },
    { key: 'shoulder', label: 'Shoulder', unit: 'inch' },
    { key: 'sleeve', label: 'Sleeve', unit: 'inch' },
    { key: 'collar', label: 'Collar', unit: 'inch' },
  ],
  trouser: [
    { key: 'trouser_length', label: 'Length', unit: 'inch' },
    { key: 'trouser_waist', label: 'Waist (Kamar)', unit: 'inch' },
    { key: 'hip', label: 'Hip (Sirin)', unit: 'inch' },
    { key: 'knee', label: 'Knee', unit: 'inch' },
    { key: 'bottom', label: 'Bottom (Paincha)', unit: 'inch' },
  ],
  sherwani: [
    { key: 'length', label: 'Length', unit: 'inch' },
    { key: 'chest', label: 'Chest', unit: 'inch' },
    { key: 'waist', label: 'Waist', unit: 'inch' },
    { key: 'shoulder', label: 'Shoulder', unit: 'inch' },
    { key: 'sleeve', label: 'Sleeve', unit: 'inch' },
  ],
  coat: [
    { key: 'length', label: 'Length', unit: 'inch' },
    { key: 'chest', label: 'Chest', unit: 'inch' },
    { key: 'shoulder', label: 'Shoulder', unit: 'inch' },
    { key: 'sleeve', label: 'Sleeve', unit: 'inch' },
  ],
  other: [
    { key: 'length', label: 'Length', unit: 'inch' },
    { key: 'chest', label: 'Chest', unit: 'inch' },
  ],
}

interface Step2Props {
  data: {
    garmentType?: GarmentType
    measurements?: Record<string, string>
    specialInstructions?: string
    isUrgent?: boolean
  }
  onUpdate: (d: Partial<{
    garmentType: GarmentType
    measurements: Record<string, string>
    specialInstructions: string
    isUrgent: boolean
  }>) => void
  onNext: () => void
}

export function Step2Garment({ data, onUpdate, onNext }: Step2Props) {
  const [measurements, setMeasurements] = useState<Record<string, string>>(
    data.measurements || {}
  )

  // Add state inside Step2Garment:
  const [quickPhoto, setQuickPhoto] = useState<string | null>(null)
  const [takingPhoto, setTakingPhoto] = useState(false)

  const handleQuickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setTakingPhoto(true)
    try {
      const base64 = await compressImage(file)
      setQuickPhoto(base64)
      onUpdate({ fabricPhotoBase64: base64 } as any)
    } finally {
      setTakingPhoto(false)
    }
  }

  const selectedType = data.garmentType
  const fields = selectedType ? MEASUREMENT_FIELDS[selectedType] : []

  const updateMeasurement = (key: string, value: string) => {
    const updated = { ...measurements, [key]: value }
    setMeasurements(updated)
    onUpdate({ measurements: updated })
  }

  const canProceed = !!selectedType

  return (
    <div className="space-y-6">

      {/* Garment type picker — big icon buttons */}
      <div>
        <p className="text-sm font-semibold text-slate-700 mb-3">
          Kapra Kaisa Hai? <span className="text-red-500">*</span>
        </p>
        <div className="grid grid-cols-3 gap-3">
          {(Object.entries(GARMENT_LABELS) as [GarmentType, { label: string; emoji: string }][]).map(
            ([type, { label, emoji }]) => {
              const isSelected = type === selectedType
              return (
                <button
                  key={type}
                  onClick={() => onUpdate({ garmentType: type })}
                  className={cn(
                    'flex flex-col items-center gap-2 py-4 rounded-2xl border-2',
                    'transition-all active:scale-95',
                    isSelected
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  )}
                >
                  <span className="text-2xl">{emoji}</span>
                  <span className="text-[11px] font-semibold leading-tight text-center">
                    {label}
                  </span>
                </button>
              )
            }
          )}
        </div>
      </div>

      {/* Urgent toggle */}
      <div className="flex items-center justify-between bg-orange-50 border border-orange-200 rounded-2xl px-4 py-3">
        <div className="flex items-center gap-2">
          <AlertCircle size={18} className="text-orange-600" />
          <div>
            <p className="text-sm font-semibold text-orange-800">Urgent Order?</p>
            <p className="text-xs text-orange-500">Jaldi banana zaroor hai</p>
          </div>
        </div>
        <button
          onClick={() => onUpdate({ isUrgent: !data.isUrgent })}
          className={cn(
            'relative w-12 h-6 rounded-full transition-colors flex-shrink-0',
            data.isUrgent ? 'bg-orange-500' : 'bg-slate-300'
          )}
        >
          <span className={cn(
            'absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform',
            data.isUrgent ? 'translate-x-6' : 'translate-x-0.5'
          )} />
        </button>
      </div>

      {/* Measurements — only shows after garment type selected */}
      {selectedType && (
        <div>
          <p className="text-sm font-semibold text-slate-700 mb-1">
            Nap (Measurements)
          </p>
          <p className="text-xs text-slate-400 mb-3">
            Sab fields optional hain — jo ho woh bharein
          </p>
          <div className="grid grid-cols-2 gap-3">
            {fields.map(({ key, label, unit }) => (
              <div key={key} className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <label className="block text-[11px] font-medium text-slate-500 mb-1">
                  {label}
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder="0"
                    value={measurements[key] || ''}
                    onChange={e => updateMeasurement(key, e.target.value)}
                    className="flex-1 w-full text-sm font-semibold text-slate-800
                               bg-transparent outline-none"
                  />
                  <span className="text-[10px] text-slate-400 flex-shrink-0">{unit}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Special instructions */}
      {selectedType && (
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Koi Khaas Baat? (Optional)
          </label>
          <textarea
            placeholder="Jaise: pocket wala banana, kali button lagana..."
            value={data.specialInstructions || ''}
            onChange={e => onUpdate({ specialInstructions: e.target.value })}
            rows={3}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl
                       text-sm outline-none focus:border-blue-500 resize-none
                       placeholder:text-slate-400 transition-colors"
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">
          Kapre Ki Photo (Optional)
        </label>
        {quickPhoto ? (
          <div className="relative">
            <img
              src={quickPhoto}
              alt="Fabric"
              className="w-full h-40 object-cover rounded-2xl"
            />
            <button
              onClick={() => { setQuickPhoto(null); onUpdate({ fabricPhotoBase64: undefined } as any) }}
              className="absolute top-2 right-2 w-8 h-8 bg-red-500 text-white
                   rounded-full flex items-center justify-center text-sm font-bold"
            >
              ✕
            </button>
          </div>
        ) : (
          <label className={cn(
            'flex flex-col items-center justify-center gap-2 py-6 border-2 border-dashed',
            'border-slate-300 rounded-2xl bg-slate-50 cursor-pointer',
            'hover:border-blue-400 hover:bg-blue-50 transition-colors'
          )}>
            {takingPhoto
              ? <Loader2 size={24} className="text-blue-600 animate-spin" />
              : <Camera size={24} className="text-slate-400" />
            }
            <span className="text-xs text-slate-500 font-medium">
              {takingPhoto ? 'Photo le raha hai...' : 'Camera se photo len'}
            </span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleQuickPhoto}
              className="hidden"
            />
          </label>
        )}
      </div>

      {/* Next button */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px]
                      lg:static lg:translate-x-0 lg:max-w-none
                      bg-white border-t border-slate-100 px-4 py-4">
        <button
          onClick={onNext}
          disabled={!canProceed}
          className="w-full bg-blue-600 disabled:bg-slate-300 disabled:cursor-not-allowed
                     text-white font-bold py-4 rounded-2xl text-base
                     transition-colors active:scale-[0.98]"
        >
          {canProceed ? 'Payment Details →' : 'Pehle Kapra Chunein'}
        </button>
      </div>
      <div className="h-24 lg:h-0" />
    </div>
  )
}