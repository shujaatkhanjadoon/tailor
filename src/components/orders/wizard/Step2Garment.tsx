// src/components/orders/wizard/Step2Garment.tsx
'use client'

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AlertCircle, Loader2 } from 'lucide-react'
import { GarmentType, GARMENT_LABELS } from '@/types'
import { cn } from '@/lib/utils'
import { Camera } from 'lucide-react'
import { compressImage } from '@/lib/photos/compress'
import { db } from '@/lib/db/schema'
import { ToggleSwitch } from '@/components/ui/toggle-switch'

// Measurement fields per garment type
const FABRIC_HINTS: Record<GarmentType, string> = {
  shalwar_kameez: 'Lawn, cotton, wash & wear, boski, khaddar, linen',
  kurta: 'Cotton, wash & wear, linen, khaddar, boski',
  kurti: 'Lawn, cotton, cambric, chiffon, silk',
  shirt: 'Cotton, lawn, poplin, cambric, silk, chiffon',
  trouser: 'Cotton, denim, twill, linen, suiting',
  pajama: 'Cotton, wash & wear, lawn, linen',
  sherwani: 'Jamawar, banarsi, raw silk, velvet, brocade',
  waistcoat: 'Suiting, jamawar, raw silk, wash & wear',
  prince_coat: 'Suiting, jamawar, velvet, raw silk',
  pant_coat: 'Suiting, tropical, wool blend, wash & wear',
  lehenga: 'Net, chiffon, organza, raw silk, banarsi',
  maxi: 'Chiffon, net, silk, georgette, organza',
  blazer: 'Suiting, wool blend, tweed, tropical',
  jacket: 'Denim, cotton, suiting, leatherette',
  other: 'Abaya, kids wear, custom design',
}

const MEASUREMENT_FIELDS: Record<GarmentType, { key: string; label: string; unit: string }[]> = {
  shalwar_kameez: [
    { key: 'length', label: 'Length (Lambai)', unit: 'inch' },
    { key: 'chest', label: 'Chest (Seena)', unit: 'inch' },
    { key: 'waist', label: 'Waist (Kamar)', unit: 'inch' },
    { key: 'hip', label: 'Hip (Kolha)', unit: 'inch' },
    { key: 'shoulder', label: 'Shoulder (Kandha)', unit: 'inch' },
    { key: 'sleeve', label: 'Sleeves (Aasteen)', unit: 'inch' },
    { key: 'armhole', label: 'Armhole (Baazu Golai)', unit: 'inch' },
    { key: 'bicep', label: 'Bicep (Bazoo)', unit: 'inch' },
    { key: 'collar', label: 'Collar (Gireban)', unit: 'inch' },
    { key: 'front_neck', label: 'Front Neck (Agla Gala)', unit: 'inch' },
    { key: 'back_neck', label: 'Back Neck (Pichla Gala)', unit: 'inch' },
    { key: 'trouser_length', label: 'Shalwar Length (Shalwar Lambai)', unit: 'inch' },
    { key: 'trouser_waist', label: 'Shalwar Waist (Nara)', unit: 'inch' },
    { key: 'thigh', label: 'Thigh (Raan)', unit: 'inch' },
    { key: 'knee', label: 'Knee (Ghutna)', unit: 'inch' },
    { key: 'bottom', label: 'Bottom (Paincha)', unit: 'inch' },
  ],
  kurta: [
    { key: 'length', label: 'Length (Lambai)', unit: 'inch' },
    { key: 'chest', label: 'Chest (Seena)', unit: 'inch' },
    { key: 'waist', label: 'Waist (Kamar)', unit: 'inch' },
    { key: 'shoulder', label: 'Shoulder (Kandha)', unit: 'inch' },
    { key: 'sleeve', label: 'Sleeves (Aasteen)', unit: 'inch' },
    { key: 'collar', label: 'Collar/Gala', unit: 'inch' },
    { key: 'bottom', label: 'Daman Width', unit: 'inch' },
  ],
  kurti: [
    { key: 'length', label: 'Length (Lambai)', unit: 'inch' },
    { key: 'chest', label: 'Chest (Seena)', unit: 'inch' },
    { key: 'waist', label: 'Waist (Kamar)', unit: 'inch' },
    { key: 'hip', label: 'Hip (Kolha)', unit: 'inch' },
    { key: 'shoulder', label: 'Shoulder (Kandha)', unit: 'inch' },
    { key: 'sleeve', label: 'Sleeves (Aasteen)', unit: 'inch' },
  ],
  shirt: [
    { key: 'length', label: 'Length (Lambai)', unit: 'inch' },
    { key: 'chest', label: 'Chest (Seena)', unit: 'inch' },
    { key: 'waist', label: 'Waist (Kamar)', unit: 'inch' },
    { key: 'shoulder', label: 'Shoulder (Kandha)', unit: 'inch' },
    { key: 'sleeve', label: 'Sleeves (Aasteen)', unit: 'inch' },
    { key: 'collar', label: 'Collar (Gireban)', unit: 'inch' },
    { key: 'cuff', label: 'Cuff (Kaf)', unit: 'inch' },
  ],
  trouser: [
    { key: 'trouser_length', label: 'Length (Lambai)', unit: 'inch' },
    { key: 'trouser_waist', label: 'Waist (Kamar)', unit: 'inch' },
    { key: 'hip', label: 'Hip (Sirin)', unit: 'inch' },
    { key: 'thigh', label: 'Thigh (Raan)', unit: 'inch' },
    { key: 'knee', label: 'Knee (Ghutna)', unit: 'inch' },
    { key: 'bottom', label: 'Bottom (Paincha)', unit: 'inch' },
  ],
  pajama: [
    { key: 'trouser_length', label: 'Length (Lambai)', unit: 'inch' },
    { key: 'trouser_waist', label: 'Waist/Nara', unit: 'inch' },
    { key: 'hip', label: 'Hip (Sirin)', unit: 'inch' },
    { key: 'thigh', label: 'Thigh (Raan)', unit: 'inch' },
    { key: 'bottom', label: 'Paincha', unit: 'inch' },
  ],
  sherwani: [
    { key: 'length', label: 'Length (Lambai)', unit: 'inch' },
    { key: 'chest', label: 'Chest (Seena)', unit: 'inch' },
    { key: 'waist', label: 'Waist (Kamar)', unit: 'inch' },
    { key: 'shoulder', label: 'Shoulder (Kandha)', unit: 'inch' },
    { key: 'sleeve', label: 'Sleeves (Aasteen)', unit: 'inch' },
    { key: 'hip', label: 'Hip (Kolha)', unit: 'inch' },
  ],
  waistcoat: [
    { key: 'length', label: 'Length (Lambai)', unit: 'inch' },
    { key: 'chest', label: 'Chest (Seena)', unit: 'inch' },
    { key: 'waist', label: 'Waist (Kamar)', unit: 'inch' },
    { key: 'shoulder', label: 'Shoulder (Kandha)', unit: 'inch' },
  ],
  prince_coat: [
    { key: 'length', label: 'Length (Lambai)', unit: 'inch' },
    { key: 'chest', label: 'Chest (Seena)', unit: 'inch' },
    { key: 'waist', label: 'Waist (Kamar)', unit: 'inch' },
    { key: 'hip', label: 'Hip (Kolha)', unit: 'inch' },
    { key: 'shoulder', label: 'Shoulder (Kandha)', unit: 'inch' },
    { key: 'sleeve', label: 'Sleeves (Aasteen)', unit: 'inch' },
  ],
  pant_coat: [
    { key: 'length', label: 'Length (Lambai)', unit: 'inch' },
    { key: 'chest', label: 'Chest (Seena)', unit: 'inch' },
    { key: 'waist', label: 'Waist (Kamar)', unit: 'inch' },
    { key: 'shoulder', label: 'Shoulder (Kandha)', unit: 'inch' },
    { key: 'sleeve', label: 'Sleeves (Aasteen)', unit: 'inch' },
    { key: 'trouser_length', label: 'Pant Length', unit: 'inch' },
    { key: 'trouser_waist', label: 'Pant Waist', unit: 'inch' },
  ],
  lehenga: [
    { key: 'length', label: 'Lehenga Length', unit: 'inch' },
    { key: 'waist', label: 'Waist (Kamar)', unit: 'inch' },
    { key: 'hip', label: 'Hip (Kolha)', unit: 'inch' },
    { key: 'chest', label: 'Blouse Chest', unit: 'inch' },
    { key: 'shoulder', label: 'Blouse Shoulder', unit: 'inch' },
    { key: 'sleeve', label: 'Blouse Sleeve', unit: 'inch' },
  ],
  maxi: [
    { key: 'length', label: 'Full Length', unit: 'inch' },
    { key: 'chest', label: 'Chest (Seena)', unit: 'inch' },
    { key: 'waist', label: 'Waist (Kamar)', unit: 'inch' },
    { key: 'hip', label: 'Hip (Kolha)', unit: 'inch' },
    { key: 'shoulder', label: 'Shoulder (Kandha)', unit: 'inch' },
    { key: 'sleeve', label: 'Sleeves (Aasteen)', unit: 'inch' },
  ],
  blazer: [
    { key: 'length', label: 'Length (Lambai)', unit: 'inch' },
    { key: 'chest', label: 'Chest (Seena)', unit: 'inch' },
    { key: 'waist', label: 'Waist (Kamar)', unit: 'inch' },
    { key: 'shoulder', label: 'Shoulder (Kandha)', unit: 'inch' },
    { key: 'sleeve', label: 'Sleeves (Aasteen)', unit: 'inch' },
  ],
  jacket: [
    { key: 'length', label: 'Length (Lambai)', unit: 'inch' },
    { key: 'chest', label: 'Chest (Seena)', unit: 'inch' },
    { key: 'waist', label: 'Waist (Kamar)', unit: 'inch' },
    { key: 'shoulder', label: 'Shoulder (Kandha)', unit: 'inch' },
    { key: 'sleeve', label: 'Sleeves (Aasteen)', unit: 'inch' },
  ],
  other: [
    { key: 'length', label: 'Length (Lambai)', unit: 'inch' },
    { key: 'chest', label: 'Chest (Seena)', unit: 'inch' },
    { key: 'shoulder', label: 'Shoulder (Kandha)', unit: 'inch' },
    { key: 'waist', label: 'Waist (Kamar)', unit: 'inch' },
  ],
}

export type StyleSelections = {
  neck?: string
  daman?: string
  sleeve?: string
  fit?: string
  buttons?: string[]
  extras?: string[]
}

const STYLE_GROUPS = [
  {
    key: 'neck',
    title: 'Neck / Gala Style',
    type: 'radio',
    options: ['Gol Gala', 'Ban Gala', 'V Gala', 'Collar Gala', 'Sherwani Collar', 'Chinese Collar'],
  },
  {
    key: 'daman',
    title: 'Daman Style',
    type: 'radio',
    options: ['Gol Daman', 'Square Daman', 'Round Cut Daman', 'Side Cut Daman', 'Straight Daman'],
  },
  {
    key: 'sleeve',
    title: 'Sleeve Style',
    type: 'radio',
    options: ['Full Sleeve', 'Half Sleeve', 'Cuff Sleeve', 'Loose Sleeve', 'Straight Sleeve'],
  },
  {
    key: 'fit',
    title: 'Fit Type',
    type: 'radio',
    options: ['Slim Fit', 'Regular Fit', 'Loose Fit'],
  },
  {
    key: 'buttons',
    title: 'Button Types',
    type: 'checkbox',
    options: ['Simple Button', 'Fancy Button', 'Metal Button', 'Covered Button', 'Hidden Patti', 'Double Button'],
  },
  {
    key: 'extras',
    title: 'Extra Details',
    type: 'checkbox',
    options: ['Side Pocket', 'Front Pocket', 'Kaf Patti', 'Embroidery', 'Piping', 'Lace', 'Lining', 'Chak Patti'],
  },
] as const

export function formatStyleSelections(styles: StyleSelections): string {
  const labels: string[] = []
  STYLE_GROUPS.forEach((group) => {
    const value = styles[group.key]
    if (Array.isArray(value) && value.length > 0) labels.push(`${group.title}: ${value.join(', ')}`)
    if (typeof value === 'string' && value) labels.push(`${group.title}: ${value}`)
  })
  return labels.length ? `Style: ${labels.join(' | ')}` : ''
}

interface Step2Props {
  data: {
    garmentType?: GarmentType
    customerId?: string
    measurementId?: string
    measurements?: Record<string, string>
    styleSelections?: StyleSelections
    specialInstructions?: string
    isUrgent?: boolean
    fabricPhotoBase64?: string
  }
  onUpdate: (d: Partial<{
    garmentType: GarmentType
    measurementId: string | undefined
    measurements: Record<string, string>
    styleSelections: StyleSelections
    specialInstructions: string
    isUrgent: boolean
    fabricPhotoBase64?: string
  }>) => void
  onNext: () => void
}

export function Step2Garment({ data, onUpdate, onNext }: Step2Props) {
  const [measurements, setMeasurements] = useState<Record<string, string>>(
    data.measurements || {}
  )
  const [styleSelections, setStyleSelections] = useState<StyleSelections>(
    data.styleSelections || {}
  )

  // Add state inside Step2Garment:
  const [quickPhoto, setQuickPhoto] = useState<string | null>(data.fabricPhotoBase64 ?? null)
  const [takingPhoto, setTakingPhoto] = useState(false)

  const handleQuickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setTakingPhoto(true)
    try {
      const result = await compressImage(file)
      setQuickPhoto(result.base64)
      onUpdate({ fabricPhotoBase64: result.base64 })
    } finally {
      setTakingPhoto(false)
    }
  }

  const selectedType = data.garmentType
  const fields = selectedType ? MEASUREMENT_FIELDS[selectedType] : []
  const previousMeasurements = useLiveQuery(
    async () => {
      if (!data.customerId || !selectedType) return []
      return db.measurements
        .where('customerId').equals(data.customerId)
        .filter(m => m._deleted === 0 && m.garmentType === selectedType)
        .reverse()
        .sortBy('takenAt')
    },
    [data.customerId, selectedType]
  ) ?? []
  const selectedPrevious = previousMeasurements.find(m => m.id === data.measurementId)

  const updateMeasurement = (key: string, value: string) => {
    const updated = { ...measurements, [key]: value }
    setMeasurements(updated)
    onUpdate({ measurements: updated, measurementId: undefined })
  }

  const updateStyle = (key: keyof StyleSelections, value: string, multi: boolean) => {
    const current = styleSelections[key]
    const updated: StyleSelections = {
      ...styleSelections,
      [key]: multi
        ? (Array.isArray(current) && current.includes(value)
            ? current.filter(item => item !== value)
            : [...(Array.isArray(current) ? current : []), value])
        : value,
    }
    setStyleSelections(updated)
    onUpdate({ styleSelections: updated })
  }

  const filledCount = Object.values(measurements).filter(v => v && v !== '0').length
  const canProceed = !!selectedType && (!!data.measurementId || filledCount > 0)

  return (
    <div className="space-y-6 mb-16 lg:mb-0">

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
                  onClick={() => {
                    setMeasurements({})
                    onUpdate({ garmentType: type, measurements: {}, measurementId: undefined })
                  }}
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
                  <span className="px-1 text-center text-[9px] leading-tight text-slate-400">
                    {FABRIC_HINTS[type]}
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
        <ToggleSwitch
          checked={!!data.isUrgent}
          onCheckedChange={(checked) => onUpdate({ isUrgent: checked })}
          label="Urgent Order"
          activeClassName="bg-orange-500"
        />
      </div>

      {/* Measurements — only shows after garment type selected */}
      {selectedType && (
        <div>
          <p className="text-sm font-semibold text-slate-700 mb-1">
            Nap (Measurements)
          </p>
          <p className="text-xs text-slate-400 mb-3">
            Naye customer/order ke liye nap zaroori hai. Purani nap use karein ya nayi nap bharein.
          </p>
          {previousMeasurements.length > 0 && (
            <div className="mb-4 space-y-2">
              <p className="text-xs font-semibold text-slate-500">Purani nap</p>
              {previousMeasurements.slice(0, 3).map((m, idx) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setMeasurements(m.values)
                    onUpdate({ measurementId: m.id, measurements: m.values })
                  }}
                  className={cn(
                    'w-full rounded-xl border px-3 py-2.5 text-left transition-colors',
                    data.measurementId === m.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 bg-white'
                  )}
                >
                  <span className="block text-xs font-bold text-slate-700">
                    {idx === 0 ? 'Latest nap' : `Purani nap ${idx + 1}`}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-slate-400">
                    {new Date(m.takenAt).toLocaleDateString('en-PK')} · {Object.values(m.values).filter(Boolean).length} fields
                  </span>
                </button>
              ))}
              {selectedPrevious && (
                <button
                  type="button"
                  onClick={() => {
                    setMeasurements({})
                    onUpdate({ measurementId: undefined, measurements: {} })
                  }}
                  className="text-xs font-semibold text-blue-600"
                >
                  Nayi nap likhein
                </button>
              )}
            </div>
          )}
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
                    disabled={!!selectedPrevious}
                    onChange={e => updateMeasurement(key, e.target.value)}
                    className="flex-1 w-full text-sm font-semibold text-slate-800
                               bg-transparent outline-none disabled:text-slate-500"
                  />
                  <span className="text-[10px] text-slate-400 shrink-0">{unit}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Style reference options */}
      {selectedType && (
        <div>
          <p className="text-sm font-semibold text-slate-700 mb-1">
            Style Reference
          </p>
          <p className="text-xs text-slate-400 mb-3">
            Pakistani tailoring details select karein taake karigar ko clear brief milay.
          </p>
          <div className="space-y-3">
            {STYLE_GROUPS.map((group) => (
              <div key={group.key} className="rounded-2xl border border-slate-200 bg-white p-3">
                <p className="text-xs font-bold text-slate-600 mb-2">{group.title}</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {group.options.map((option) => {
                    const value = styleSelections[group.key]
                    const selected = Array.isArray(value)
                      ? value.includes(option)
                      : value === option
                    const multi = group.type === 'checkbox'
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => updateStyle(group.key, option, multi)}
                        className={cn(
                          'flex min-h-10 items-center gap-2 rounded-xl border px-3 py-2 text-left text-[11px] font-semibold transition-colors',
                          selected
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
                        )}
                      >
                        <span className={cn(
                          'flex h-4 w-4 shrink-0 items-center justify-center border',
                          multi ? 'rounded' : 'rounded-full',
                          selected ? 'border-blue-600 bg-blue-600' : 'border-slate-300 bg-white'
                        )}>
                          {selected && <span className={cn('bg-white', multi ? 'h-2 w-2 rounded-[2px]' : 'h-1.5 w-1.5 rounded-full')} />}
                        </span>
                        <span>{option}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
          {formatStyleSelections(styleSelections) && (
            <p className="mt-3 rounded-xl bg-blue-50 px-3 py-2 text-[11px] leading-relaxed text-blue-700">
              {formatStyleSelections(styleSelections)}
            </p>
          )}
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
              aria-label="Remove fabric photo"
              onClick={() => { setQuickPhoto(null); onUpdate({ fabricPhotoBase64: undefined }) }}
              className="absolute top-2 right-2 w-11 h-11 bg-red-500 text-white
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
      <div className="fixed inset-x-0 bottom-0 w-full bg-white border-t border-slate-100 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]
                      lg:static lg:max-w-none lg:pb-4 mb-16 lg:mb-0">
        <button
          onClick={onNext}
          disabled={!canProceed}
          className="w-full bg-blue-600 disabled:bg-slate-300 disabled:cursor-not-allowed
                     text-white font-bold py-4 rounded-2xl text-base
                     transition-colors active:scale-[0.98]"
        >
          {canProceed ? 'Payment Details →' : selectedType ? 'Nap select ya fill karein' : 'Pehle Kapra Chunein'}
        </button>
      </div>
      <div className="h-24 lg:h-0" />
    </div>
  )
}
