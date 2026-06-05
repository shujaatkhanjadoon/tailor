// src/app/customers/[id]/measurements/page.tsx
'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Ruler, Copy, ChevronDown, ChevronUp, Pencil } from 'lucide-react'
import type { CustomerRecord, MeasurementRecord } from '@/lib/db/schema'
import { useAuth } from '@/lib/auth/AuthContext'
import { GarmentType, GARMENT_LABELS } from '@/types'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { supabase } from '@/lib/supabase/client'
import { mapCustomer, mapMeasurement } from '@/lib/supabase/records'
import { nowKarachiIso } from '@/lib/time'
import { uuid } from '@/lib/db/operations'
import { napOwnerLabel } from '@/lib/order-recipient'

// All fields per garment type
const MEASUREMENT_FIELDS: Record<GarmentType, { key: string; label: string; labelUrdu: string }[]> = {
  shalwar_kameez: [
    { key: 'length',         label: 'Length',        labelUrdu: 'لمبائی'    },
    { key: 'chest',          label: 'Chest',         labelUrdu: 'سینہ'     },
    { key: 'waist',          label: 'Waist',         labelUrdu: 'کمر'     },
    { key: 'hip',            label: 'Hip',           labelUrdu: 'سرین'     },
    { key: 'shoulder',       label: 'Shoulder',      labelUrdu: 'کندھا'    },
    { key: 'sleeve',         label: 'Sleeve',        labelUrdu: 'بازو'     },
    { key: 'armhole',        label: 'Armhole',       labelUrdu: 'بازو گولائی' },
    { key: 'bicep',          label: 'Bicep',         labelUrdu: 'بازو'     },
    { key: 'collar',         label: 'Collar',        labelUrdu: 'گریبان'   },
    { key: 'front_neck',     label: 'Front Neck',    labelUrdu: 'اگلا گلا' },
    { key: 'back_neck',      label: 'Back Neck',     labelUrdu: 'پچھلا گلا' },
    { key: 'trouser_length', label: 'Shalwar Length',labelUrdu: 'شلوار'   },
    { key: 'trouser_waist',  label: 'Shalwar Waist', labelUrdu: 'شلوار کمر' },
    { key: 'thigh',          label: 'Thigh',         labelUrdu: 'ران'      },
    { key: 'knee',           label: 'Knee',          labelUrdu: 'گھٹنا'    },
    { key: 'bottom',         label: 'Bottom',        labelUrdu: 'پائنچہ'   },
  ],
  kurta: [
    { key: 'length', label: 'Length', labelUrdu: 'لمبائی' },
    { key: 'chest', label: 'Chest', labelUrdu: 'سینہ' },
    { key: 'waist', label: 'Waist', labelUrdu: 'کمر' },
    { key: 'shoulder', label: 'Shoulder', labelUrdu: 'کندھا' },
    { key: 'sleeve', label: 'Sleeve', labelUrdu: 'بازو' },
    { key: 'collar', label: 'Collar', labelUrdu: 'گلا' },
    { key: 'bottom', label: 'Daman Width', labelUrdu: 'دامن' },
  ],
  kurti: [
    { key: 'length', label: 'Length', labelUrdu: 'لمبائی' },
    { key: 'chest', label: 'Chest', labelUrdu: 'سینہ' },
    { key: 'waist', label: 'Waist', labelUrdu: 'کمر' },
    { key: 'hip', label: 'Hip', labelUrdu: 'سرین' },
    { key: 'shoulder', label: 'Shoulder', labelUrdu: 'کندھا' },
    { key: 'sleeve', label: 'Sleeve', labelUrdu: 'بازو' },
  ],
  shirt: [
    { key: 'length',   label: 'Length',   labelUrdu: 'لمبائی'  },
    { key: 'chest',    label: 'Chest',    labelUrdu: 'سینہ'   },
    { key: 'waist',    label: 'Waist',    labelUrdu: 'کمر'   },
    { key: 'shoulder', label: 'Shoulder', labelUrdu: 'کندھا'  },
    { key: 'sleeve',   label: 'Sleeve',   labelUrdu: 'بازو'   },
    { key: 'collar',   label: 'Collar',   labelUrdu: 'گریبان' },
    { key: 'cuff',     label: 'Cuff',     labelUrdu: 'کف'     },
  ],
  trouser: [
    { key: 'trouser_length', label: 'Length',  labelUrdu: 'لمبائی'  },
    { key: 'trouser_waist',  label: 'Waist',   labelUrdu: 'کمر'   },
    { key: 'hip',            label: 'Hip',     labelUrdu: 'سرین'   },
    { key: 'thigh',          label: 'Thigh',   labelUrdu: 'ران'    },
    { key: 'knee',           label: 'Knee',    labelUrdu: 'گھٹنا'  },
    { key: 'bottom',         label: 'Bottom',  labelUrdu: 'پائنچہ' },
  ],
  pajama: [
    { key: 'trouser_length', label: 'Length', labelUrdu: 'لمبائی' },
    { key: 'trouser_waist', label: 'Waist', labelUrdu: 'ناڑہ' },
    { key: 'hip', label: 'Hip', labelUrdu: 'سرین' },
    { key: 'thigh', label: 'Thigh', labelUrdu: 'ران' },
    { key: 'bottom', label: 'Bottom', labelUrdu: 'پائنچہ' },
  ],
  sherwani: [
    { key: 'length',   label: 'Length',   labelUrdu: 'لمبائی'  },
    { key: 'chest',    label: 'Chest',    labelUrdu: 'سینہ'   },
    { key: 'waist',    label: 'Waist',    labelUrdu: 'کمر'   },
    { key: 'shoulder', label: 'Shoulder', labelUrdu: 'کندھا'  },
    { key: 'sleeve',   label: 'Sleeve',   labelUrdu: 'بازو'   },
    { key: 'hip',      label: 'Hip',      labelUrdu: 'سرین'   },
  ],
  waistcoat: [
    { key: 'length', label: 'Length', labelUrdu: 'لمبائی' },
    { key: 'chest', label: 'Chest', labelUrdu: 'سینہ' },
    { key: 'waist', label: 'Waist', labelUrdu: 'کمر' },
    { key: 'shoulder', label: 'Shoulder', labelUrdu: 'کندھا' },
  ],
  prince_coat: [
    { key: 'length', label: 'Length', labelUrdu: 'لمبائی' },
    { key: 'chest', label: 'Chest', labelUrdu: 'سینہ' },
    { key: 'waist', label: 'Waist', labelUrdu: 'کمر' },
    { key: 'hip', label: 'Hip', labelUrdu: 'سرین' },
    { key: 'shoulder', label: 'Shoulder', labelUrdu: 'کندھا' },
    { key: 'sleeve', label: 'Sleeve', labelUrdu: 'بازو' },
  ],
  pant_coat: [
    { key: 'length', label: 'Coat Length', labelUrdu: 'کوٹ لمبائی' },
    { key: 'chest', label: 'Chest', labelUrdu: 'سینہ' },
    { key: 'waist', label: 'Waist', labelUrdu: 'کمر' },
    { key: 'shoulder', label: 'Shoulder', labelUrdu: 'کندھا' },
    { key: 'sleeve', label: 'Sleeve', labelUrdu: 'بازو' },
    { key: 'trouser_length', label: 'Pant Length', labelUrdu: 'پینٹ لمبائی' },
    { key: 'trouser_waist', label: 'Pant Waist', labelUrdu: 'پینٹ کمر' },
  ],
  lehenga: [
    { key: 'length', label: 'Lehenga Length', labelUrdu: 'لہنگا' },
    { key: 'waist', label: 'Waist', labelUrdu: 'کمر' },
    { key: 'hip', label: 'Hip', labelUrdu: 'سرین' },
    { key: 'chest', label: 'Blouse Chest', labelUrdu: 'بلاؤز سینہ' },
    { key: 'shoulder', label: 'Blouse Shoulder', labelUrdu: 'کندھا' },
    { key: 'sleeve', label: 'Blouse Sleeve', labelUrdu: 'بازو' },
  ],
  maxi: [
    { key: 'length', label: 'Full Length', labelUrdu: 'لمبائی' },
    { key: 'chest', label: 'Chest', labelUrdu: 'سینہ' },
    { key: 'waist', label: 'Waist', labelUrdu: 'کمر' },
    { key: 'hip', label: 'Hip', labelUrdu: 'سرین' },
    { key: 'shoulder', label: 'Shoulder', labelUrdu: 'کندھا' },
    { key: 'sleeve', label: 'Sleeve', labelUrdu: 'بازو' },
  ],
  blazer: [
    { key: 'length',   label: 'Length',   labelUrdu: 'لمبائی'  },
    { key: 'chest',    label: 'Chest',    labelUrdu: 'سینہ'   },
    { key: 'waist',    label: 'Waist',    labelUrdu: 'کمر'   },
    { key: 'shoulder', label: 'Shoulder', labelUrdu: 'کندھا'  },
    { key: 'sleeve',   label: 'Sleeve',   labelUrdu: 'بازو'   },
  ],
  jacket: [
    { key: 'length', label: 'Length', labelUrdu: 'لمبائی' },
    { key: 'chest', label: 'Chest', labelUrdu: 'سینہ' },
    { key: 'waist', label: 'Waist', labelUrdu: 'کمر' },
    { key: 'shoulder', label: 'Shoulder', labelUrdu: 'کندھا' },
    { key: 'sleeve', label: 'Sleeve', labelUrdu: 'بازو' },
  ],
  other: [
    { key: 'length', label: 'Length', labelUrdu: 'لمبائی' },
    { key: 'chest', label: 'Chest', labelUrdu: 'سینہ' },
    { key: 'shoulder', label: 'Shoulder', labelUrdu: 'کندھا' },
    { key: 'waist', label: 'Waist', labelUrdu: 'کمر' },
  ],
}

const now  = () => nowKarachiIso()

export default function MeasurementsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id }     = use(params)
  const router     = useRouter()
  const { shopId } = useAuth()

  const [customer, setCustomer] = useState<CustomerRecord | undefined>()
  const [measurements, setMeasurements] = useState<MeasurementRecord[]>([])

  const load = async () => {
    const [{ data: customerRow }, { data: measurementRows }] = await Promise.all([
      supabase.from('customers').select('id,shop_id,name,phone,whatsapp,gender,notes,photo_url,total_orders,created_at,updated_at,last_order_at,deleted_at').eq('id', id).maybeSingle(),
      supabase.from('measurements').select('id,customer_id,shop_id,garment_type,order_for_relation,order_for_name,recipient_gender,values,notes,taken_at,deleted_at').eq('customer_id', id).is('deleted_at', null).order('taken_at', { ascending: false }),
    ])
    setCustomer(customerRow ? mapCustomer(customerRow) : undefined)
    setMeasurements((measurementRows ?? []).map(mapMeasurement))
  }

  useEffect(() => {
    load().catch(console.error)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const [showForm,      setShowForm]      = useState(false)
  const [selectedType,  setSelectedType]  = useState<GarmentType>('shalwar_kameez')
  const [values,        setValues]        = useState<Record<string, string>>({})
  const [notes,         setNotes]         = useState('')
  const [saving,        setSaving]        = useState(false)
  const [expandedId,    setExpandedId]    = useState<string | null>(null)
  const [editingId,     setEditingId]     = useState<string | null>(null)
  const [categoryFilter,setCategoryFilter]= useState<GarmentType | 'all'>('all')

  const fields = MEASUREMENT_FIELDS[selectedType] ?? MEASUREMENT_FIELDS.other ?? []
  const visibleMeasurements = measurements.filter(m =>
    categoryFilter === 'all' || m.garmentType === categoryFilter
  )

  const handleSave = async () => {
    if (!shopId) return
    setSaving(true)
    try {
      const record: MeasurementRecord = {
        id: editingId ?? uuid(),
        customerId:  id,
        shopId,
        garmentType: selectedType,
        values,
        notes:       notes || undefined,
        takenAt:     editingId
          ? measurements.find(m => m.id === editingId)?.takenAt ?? now()
          : now(),
        _synced:     1,
        _deleted:    0,
      }
      const measPayload = {
        id: record.id,
        customerId: record.customerId,
        orderForRelation: record.orderForRelation ?? 'self',
        orderForName: record.orderForName ?? null,
        recipientGender: record.recipientGender ?? customer?.gender ?? null,
        garmentType: record.garmentType,
        values: record.values,
        notes: record.notes ?? null,
        takenAt: record.takenAt,
      }
      const res = await fetch('/api/measurements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(measPayload),
      })
      if (!res.ok) {
        const errBody = await res.json()
        throw new Error(errBody.error ?? 'Measurement save failed')
      }
      await load()
      setShowForm(false)
      setEditingId(null)
      setValues({})
      setNotes('')
      setExpandedId(record.id)
    } finally {
      setSaving(false)
    }
  }

  // Copy previous measurements into form
  const copyFromPrevious = (m: MeasurementRecord) => {
    setEditingId(null)
    setSelectedType(m.garmentType as GarmentType)
    setValues(m.values)
    setNotes(m.notes ?? '')
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const editMeasurement = (m: MeasurementRecord) => {
    setEditingId(m.id)
    setSelectedType(m.garmentType as GarmentType)
    setValues(m.values)
    setNotes(m.notes ?? '')
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const filledCount = Object.values(values).filter(v => v && v !== '0').length

  return (
    <div className="min-h-screen bg-slate-50 pb-8">

      {/* Header */}
      <header className="bg-white border-b border-slate-100 px-4 pt-12 lg:pt-6 pb-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              aria-label="Go back"
              onClick={() => router.back()}
              className="w-11 h-11 flex items-center justify-center rounded-full bg-slate-100"
            >
              <ArrowLeft size={16} className="text-slate-600" />
            </button>
            <div>
              <h1 className="text-base font-bold text-slate-800">
                {customer?.name || '...'} — Nap
              </h1>
      <p className="text-xs text-slate-400">{measurements.length} nap records</p>
            </div>
          </div>
          <button
            onClick={() => {
              if (showForm) {
                setEditingId(null)
                setValues({})
                setNotes('')
              }
              setShowForm(v => !v)
            }}
            className={cn(
              'flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-xl transition-colors',
              showForm ? 'bg-slate-200 text-slate-700' : 'bg-blue-600 text-white'
            )}
          >
            <Plus size={15} />
            Naya Nap
          </button>
        </div>
      </header>

      <div className="px-4 pt-5 space-y-5">

        {/* ── ADD FORM ── */}
        {showForm && (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="bg-blue-600 px-4 py-3">
              <p className="text-white font-semibold text-sm">{editingId ? 'Nap Edit Karein' : 'Naya Nap Daalo'}</p>
              <p className="text-blue-200 text-xs">Sab fields optional hain — jo ho woh bharein</p>
            </div>

            <div className="p-4 space-y-4">

              {/* Garment type tabs */}
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">
                  Kapra ka qisam
                </p>
                <div className="flex gap-2 flex-wrap">
                  {(Object.keys(MEASUREMENT_FIELDS) as GarmentType[]).map(type => {
                    const gc = GARMENT_LABELS[type]
                    return (
                      <button
                        key={type}
                        onClick={() => {
                          if (type === selectedType) return
                          setSelectedType(type)
                          setValues({})
                        }}
                        className={cn(
                          'flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors',
                          selectedType === type
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                        )}
                      >
                        <span>{gc.emoji}</span>
                        {gc.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Measurement fields — 2-column grid */}
              <div className="grid grid-cols-2 gap-2.5">
                {fields.map(({ key, label, labelUrdu }) => {
                  const val     = values[key] || ''
                  const isEmpty = !val || val === '0'
                  return (
                    <div
                      key={key}
                      className={cn(
                        'rounded-xl border p-3 transition-colors',
                        !isEmpty ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-slate-50'
                      )}
                    >
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1 uppercase tracking-wide">
                        {labelUrdu} <span className="text-slate-400 normal-case">({label})</span>
                      </label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          inputMode="decimal"
                          placeholder="—"
                          value={val}
                          onChange={e => setValues(prev => ({ ...prev, [key]: e.target.value }))}
                          className="flex-1 w-full text-base font-bold text-slate-800
                                     bg-transparent outline-none placeholder:text-slate-300"
                        />
                        <span className="text-[10px] text-slate-400 shrink-0">"</span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Progress indicator */}
              {filledCount > 0 && (
                <div className="flex items-center gap-2 text-xs text-blue-600">
                  <Ruler size={12} />
                  <span>{filledCount} / {fields.length} fields fill hue</span>
                </div>
              )}

              {/* Notes */}
              <textarea
                placeholder="Koi khaas baat? (optional)"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl
                           text-sm outline-none focus:border-blue-500 resize-none placeholder:text-slate-400"
              />

              {/* Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowForm(false); setEditingId(null); setValues({}); setNotes('') }}
                  className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600
                             font-semibold text-sm"
                >
                  Rehne Do
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || filledCount === 0}
                  className="flex-1 py-3 rounded-xl bg-blue-600 disabled:bg-slate-300
                             text-white font-semibold text-sm"
                >
                  {saving ? 'Save...' : editingId ? 'Changes Save Karein ✓' : 'Nap Save Karein ✓'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── PREVIOUS MEASUREMENTS ── */}
        {(measurements?.length ?? 0) > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setCategoryFilter('all')}
              className={cn(
                'shrink-0 rounded-xl border px-3 py-2 text-xs font-semibold',
                categoryFilter === 'all' ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-600'
              )}
            >
              Sab latest
            </button>
            {(Object.keys(MEASUREMENT_FIELDS) as GarmentType[]).map(type => {
              const gc = GARMENT_LABELS[type]
              return (
                <button
                  key={type}
                  onClick={() => setCategoryFilter(type)}
                  className={cn(
                    'shrink-0 rounded-xl border px-3 py-2 text-xs font-semibold',
                    categoryFilter === type ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-600'
                  )}
                >
                  {gc.emoji} {gc.label}
                </button>
              )
            })}
          </div>
        )}

        {measurements.length === 0 && !showForm ? (
          <div className="text-center py-16">
            <Ruler size={48} className="text-slate-200 mx-auto mb-4" />
            <p className="font-semibold text-slate-500">Koi nap record nahi</p>
            <p className="text-sm text-slate-400 mt-1">Pehla nap add karein</p>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleMeasurements.map((m, idx) => {
              const gc       = GARMENT_LABELS[m.garmentType as GarmentType]
              const isExpanded = expandedId === m.id
              const mFields  = MEASUREMENT_FIELDS[m.garmentType as GarmentType] ?? []
              const filled   = mFields.filter(f => m.values[f.key] && m.values[f.key] !== '0')
              const isLatest = idx === 0

              return (
                <div
                  key={m.id}
                  className={cn(
                    'bg-white border rounded-2xl overflow-hidden transition-all',
                    isLatest ? 'border-blue-300' : 'border-slate-200'
                  )}
                >
                  {/* Card header */}
                  <div
                    className="flex items-center gap-3 px-4 py-3.5 cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : m.id)}
                  >
                    <span className="text-2xl shrink-0">{gc?.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-800 text-sm">
                          {napOwnerLabel({ relation: m.orderForRelation, name: m.orderForName, garmentType: m.garmentType })}
                        </p>
                        {isLatest && (
                          <span className="text-[9px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
                            LATEST
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {format(new Date(m.takenAt), 'd MMM yyyy')} · {filled.length} nap
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        aria-label="Copy measurements into new form"
                        onClick={e => { e.stopPropagation(); copyFromPrevious(m) }}
                        title="Copy into new form"
                        className="w-11 h-11 flex items-center justify-center rounded-full
                                   bg-slate-100 hover:bg-blue-100 transition-colors"
                      >
                        <Copy size={13} className="text-slate-500" />
                      </button>
                      <button
                        aria-label="Edit measurements"
                        onClick={e => { e.stopPropagation(); editMeasurement(m) }}
                        title="Edit nap"
                        className="w-11 h-11 flex items-center justify-center rounded-full
                                   bg-slate-100 hover:bg-blue-100 transition-colors"
                      >
                        <Pencil size={13} className="text-slate-500" />
                      </button>
                      {isExpanded
                        ? <ChevronUp size={16} className="text-slate-400" />
                        : <ChevronDown size={16} className="text-slate-400" />
                      }
                    </div>
                  </div>

                  {/* Expanded measurements */}
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-slate-100">
                      {m.notes && (
                        <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mt-3 mb-3">
                          📝 {m.notes}
                        </p>
                      )}
                      <div className="grid grid-cols-3 gap-2 mt-3">
                        {mFields.map(({ key, labelUrdu }) => {
                          const val = m.values[key]
                          if (!val || val === '0') return null
                          return (
                            <div
                              key={key}
                              className="bg-slate-50 rounded-xl p-2.5 text-center"
                            >
                              <p className="text-[10px] text-slate-400">{labelUrdu}</p>
                              <p className="text-base font-bold text-slate-800 mt-0.5">
                                {val}<span className="text-[10px] text-slate-400">"</span>
                              </p>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

