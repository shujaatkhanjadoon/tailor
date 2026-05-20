// src/components/orders/wizard/Step3Confirm.tsx
'use client'

import { useState } from 'react'
import { Calendar, Wallet, CheckCircle2, Scissors } from 'lucide-react'
import { PaymentMethod, GARMENT_LABELS } from '@/types'
import { cn } from '@/lib/utils'
import { formatAmount } from '@/lib/format/currency'
import { addDays, format } from 'date-fns'
import type { TeamMemberRecord } from '@/lib/db/schema'
import { recipientLabel } from '@/lib/order-recipient'

const QUICK_DATES = [
  { label: '3 Din', days: 3 },
  { label: '1 Hafta', days: 7 },
  { label: '2 Hafta', days: 14 },
  { label: '1 Mahina', days: 30 },
]

const PAYMENT_METHODS: { key: PaymentMethod; label: string; emoji: string }[] = [
  { key: 'cash', label: 'Cash', emoji: '💵' },
  { key: 'easypaisa', label: 'Easypaisa', emoji: '📱' },
  { key: 'jazzcash', label: 'JazzCash', emoji: '📲' },
  { key: 'bank', label: 'Bank', emoji: '🏦' },
]

interface Step3Props {
  data: {
    customerName?: string
    orderForRelation?: string
    orderForName?: string
    recipientGender?: 'male' | 'female' | 'child'
    garmentType?: string
    totalPrice?: number
    advancePaid?: number
    dueDate?: string
    paymentMethod?: PaymentMethod
    assignedTo?: string
    assignedToName?: string
  }
  onUpdate: (d: Partial<{
    totalPrice: number
    advancePaid: number
    dueDate: string
    paymentMethod: PaymentMethod
    assignedTo?: string
    assignedToName?: string
  }>) => void
  onSubmit: () => void
  karigars?: TeamMemberRecord[]
  selectableKarigarIds?: Set<string>
  saving?: boolean
}

export function Step3Confirm({
  data,
  onUpdate,
  onSubmit,
  karigars = [],
  selectableKarigarIds = new Set(),
  saving,
}: Step3Props) {
  const [submitted, setSubmitted] = useState(false)

  const totalPrice = data.totalPrice || 0
  const advancePaid = data.advancePaid || 0
  const balance = Math.max(0, totalPrice - advancePaid)
  const extraAdvance = Math.max(0, advancePaid - totalPrice)

  const handlePriceInput = (field: 'totalPrice' | 'advancePaid', value: string) => {
    const num = parseInt(value.replace(/\D/g, '')) || 0
    onUpdate({ [field]: num })
  }

  const handleSubmit = () => {
    setSubmitted(true)
    setTimeout(() => onSubmit(), 1200)
  }

  const canSubmit = totalPrice > 0 && !!data.dueDate

  // Success state
  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4 animate-bounce">
          <CheckCircle2 size={40} className="text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-1">Order Save Ho Gaya!</h2>
        <p className="text-slate-500 text-sm">Aap dashboard par wapis ja rahe hain...</p>
      </div>
    )
  }

  return (
    <div className="space-y-5 mb-16 lg:mb-0">

      {/* Order summary card */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
          Order Summary
        </p>
        <p className="font-bold text-slate-800">{data.customerName}</p>
        {(data.orderForRelation && data.orderForRelation !== 'self') && (
          <p className="text-xs font-semibold text-blue-600 mt-0.5">
            For: {recipientLabel(data.orderForRelation, data.orderForName)}
          </p>
        )}
        {data.garmentType && (
          <p className="text-sm text-slate-500 mt-0.5">
            {GARMENT_LABELS[data.garmentType as keyof typeof GARMENT_LABELS]?.emoji}{' '}
            {GARMENT_LABELS[data.garmentType as keyof typeof GARMENT_LABELS]?.label}
          </p>
        )}
      </div>

      {/* Karigar assignment */}
      {karigars.length > 0 && (
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Karigar Assign Karein — Optional
          </label>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => onUpdate({ assignedTo: undefined, assignedToName: undefined })}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2 text-left transition-all',
                !data.assignedTo
                  ? 'border-slate-400 bg-slate-50'
                  : 'border-slate-200 bg-white'
              )}
            >
              <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center">
                <Scissors size={15} className="text-slate-500" />
              </div>
              <p className="text-sm font-semibold text-slate-700">Baad mein assign karein</p>
            </button>

            {karigars.map((m) => {
              const canSelect = selectableKarigarIds.has(m.id)
              const selected = data.assignedTo === m.id
              return (
                <button
                  key={m.id}
                  type="button"
                  disabled={!canSelect}
                  onClick={() => {
                    if (canSelect) onUpdate({ assignedTo: m.id, assignedToName: m.name })
                  }}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2 text-left transition-all',
                    !canSelect
                      ? 'border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed'
                      : selected
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200 bg-white'
                  )}
                >
                  <div className={cn(
                    'w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold',
                    !canSelect
                      ? 'bg-slate-200 text-slate-400'
                      : selected ? 'bg-blue-600 text-white' : 'bg-green-100 text-green-700'
                  )}>
                    {selected ? '✓' : m.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{m.name}</p>
                    <p className="text-[10px] text-slate-400">
                      {canSelect ? m.speciality ?? 'Karigar' : 'Plan limit'}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Total price input */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">
          Kul Qeemat (Total Price) <span className="text-red-500">*</span>
        </label>
        <div className="flex items-center gap-3 bg-slate-50 border-2 border-slate-200
                        rounded-2xl px-4 py-4 focus-within:border-blue-500 transition-colors">
          <span className="text-slate-400 font-semibold text-lg shrink-0">Rs.</span>
          <input
            type="number"
            inputMode="numeric"
            placeholder="0"
            value={totalPrice || ''}
            onChange={e => handlePriceInput('totalPrice', e.target.value)}
            className="flex-1 text-2xl font-bold text-slate-800 bg-transparent outline-none"
          />
        </div>
        {/* Quick amount buttons */}
        <div className="flex gap-2 mt-2">
          {[500, 1000, 1500, 2000, 2500, 3000].map(amt => (
            <button
              key={amt}
              onClick={() => onUpdate({ totalPrice: amt })}
              className={cn(
                'flex-1 py-2 text-[11px] font-semibold rounded-xl border transition-colors',
                totalPrice === amt
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
              )}
            >
              {formatAmount(amt)}
            </button>
          ))}
        </div>
      </div>

      {/* Advance paid */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">
          Advance (Peshgi) — Optional
        </label>
        <div className="flex items-center gap-3 bg-slate-50 border-2 border-slate-200
                        rounded-2xl px-4 py-3 focus-within:border-blue-500 transition-colors">
          <span className="text-slate-400 font-semibold shrink-0">Rs.</span>
          <input
            type="number"
            inputMode="numeric"
            placeholder="0"
            value={advancePaid || ''}
            onChange={e => handlePriceInput('advancePaid', e.target.value)}
            className="flex-1 text-xl font-bold text-slate-800 bg-transparent outline-none"
          />
        </div>

        {/* Balance display */}
        {totalPrice > 0 && (
          <div className={cn(
            'flex items-center justify-between mt-3 px-4 py-2.5 rounded-xl',
            extraAdvance > 0
              ? 'bg-amber-50 border border-amber-200'
              : balance > 0 ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'
          )}>
            <span className={cn('text-sm font-medium',
              extraAdvance > 0 ? 'text-amber-800' : balance > 0 ? 'text-red-700' : 'text-green-700'
            )}>
              {extraAdvance > 0 ? 'Extra advance overpayment mein save hoga' : balance > 0 ? 'Baaki Raqam' : 'Poori raqam mil gayi ✓'}
            </span>
            {(balance > 0 || extraAdvance > 0) && (
              <span className={cn('text-base font-bold', extraAdvance > 0 ? 'text-amber-800' : 'text-red-700')}>
                Rs. {(extraAdvance || balance).toLocaleString()}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Payment method */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">
          Advance Ka Tarika
        </label>
        <div className="grid grid-cols-4 gap-2">
          {PAYMENT_METHODS.map(({ key, label, emoji }) => (
            <button
              key={key}
              onClick={() => onUpdate({ paymentMethod: key })}
              className={cn(
                'flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-all',
                data.paymentMethod === key
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-slate-200 bg-white'
              )}
            >
              <span className="text-xl">{emoji}</span>
              <span className="text-[10px] font-semibold text-slate-600">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Due date */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">
          Tayyar Kab Hoga? <span className="text-red-500">*</span>
        </label>
        {/* Quick date buttons */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          {QUICK_DATES.map(({ label, days }) => {
            const dateStr = format(addDays(new Date(), days), 'yyyy-MM-dd')
            const isSelected = data.dueDate === dateStr
            return (
              <button
                key={days}
                onClick={() => onUpdate({ dueDate: dateStr })}
                className={cn(
                  'py-3 rounded-xl border-2 text-xs font-semibold transition-all',
                  isSelected
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-white text-slate-600'
                )}
              >
                {label}
              </button>
            )
          })}
        </div>
        {/* Custom date */}
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
          <Calendar size={16} className="text-slate-400 shrink-0" />
          <input
            type="date"
            value={data.dueDate || ''}
            min={format(new Date(), 'yyyy-MM-dd')}
            onChange={e => onUpdate({ dueDate: e.target.value })}
            className="flex-1 text-sm text-slate-700 bg-transparent outline-none"
          />
        </div>
        {data.dueDate && (
          <p className="text-xs text-slate-500 mt-1 ml-1">
            📅 {format(new Date(data.dueDate), 'EEEE, d MMMM yyyy')}
          </p>
        )}
      </div>

      {/* Submit */}
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 w-full bg-white border-t border-slate-100 px-4 py-4
                      lg:static lg:max-w-none lg:pb-4">
        <button
          onClick={onSubmit}
          disabled={!canSubmit || saving}
          className="text-white w-full bg-green-600 disabled:bg-slate-300 ... pb-4 rounded-2xl"
        >
          {saving ? (
            <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Order Save Ho Raha Hai...</>
          ) : (
            <><CheckCircle2 size={20} /> {canSubmit ? 'Order Save Karein ✓' : 'Price aur date daalein'}</>
          )}
        </button>
      </div>
      <div className="h-44 lg:h-0" />
    </div>
  )
}
