// src/components/orders/wizard/Step3Confirm.tsx
'use client'

import { useState } from 'react'
import { Calendar, Wallet, CheckCircle2 } from 'lucide-react'
import { PaymentMethod, GARMENT_LABELS } from '@/types'
import { cn } from '@/lib/utils'
import { addDays, format } from 'date-fns'

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
    garmentType?: string
    totalPrice?: number
    advancePaid?: number
    dueDate?: string
    paymentMethod?: PaymentMethod
  }
  onUpdate: (d: Partial<{
    totalPrice: number
    advancePaid: number
    dueDate: string
    paymentMethod: PaymentMethod
  }>) => void
  onSubmit: () => void
  saving?: boolean
}

export function Step3Confirm({ data, onUpdate, onSubmit, saving }: Step3Props) {
  const [submitted, setSubmitted] = useState(false)

  const totalPrice = data.totalPrice || 0
  const advancePaid = data.advancePaid || 0
  const balance = Math.max(0, totalPrice - advancePaid)

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
    <div className="space-y-5">

      {/* Order summary card */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
          Order Summary
        </p>
        <p className="font-bold text-slate-800">{data.customerName}</p>
        {data.garmentType && (
          <p className="text-sm text-slate-500 mt-0.5">
            {GARMENT_LABELS[data.garmentType as keyof typeof GARMENT_LABELS]?.emoji}{' '}
            {GARMENT_LABELS[data.garmentType as keyof typeof GARMENT_LABELS]?.label}
          </p>
        )}
      </div>

      {/* Total price input */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">
          Kul Qeemat (Total Price) <span className="text-red-500">*</span>
        </label>
        <div className="flex items-center gap-3 bg-slate-50 border-2 border-slate-200
                        rounded-2xl px-4 py-4 focus-within:border-blue-500 transition-colors">
          <span className="text-slate-400 font-semibold text-lg flex-shrink-0">Rs.</span>
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
              {amt >= 1000 ? `${amt / 1000}k` : amt}
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
          <span className="text-slate-400 font-semibold flex-shrink-0">Rs.</span>
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
            balance > 0 ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'
          )}>
            <span className={cn('text-sm font-medium',
              balance > 0 ? 'text-red-700' : 'text-green-700'
            )}>
              {balance > 0 ? 'Baaki Raqam' : 'Poori raqam mil gayi ✓'}
            </span>
            {balance > 0 && (
              <span className="text-base font-bold text-red-700">
                Rs. {balance.toLocaleString()}
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
          <Calendar size={16} className="text-slate-400 flex-shrink-0" />
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
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px]
                      lg:static lg:translate-x-0 lg:max-w-none
                      bg-white border-t border-slate-100 px-4 py-4">
        <button
          onClick={onSubmit}
          disabled={!canSubmit || saving}
          className="w-full bg-green-600 disabled:bg-slate-300 ..."
        >
          {saving ? (
            <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Order Save Ho Raha Hai...</>
          ) : (
            <><CheckCircle2 size={20} /> {canSubmit ? 'Order Save Karein ✓' : 'Price aur date daalein'}</>
          )}
        </button>
      </div>
      <div className="h-24 lg:h-0" />
    </div>
  )
}