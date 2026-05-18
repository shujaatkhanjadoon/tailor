// src/app/settings/change-pin/page.tsx
'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter }                     from 'next/navigation'
import { ArrowLeft, CheckCircle2, Lock, Eye, EyeOff } from 'lucide-react'
import { useAuth }                       from '@/lib/auth/AuthContext'
import {
  KARIGAR_PIN_LENGTH,
  SHOP_PIN_LENGTH,
  verifyPIN,
  hashPIN,
  validatePIN,
  getPINStrength,
} from '@/lib/security/pin'
import { cn }                            from '@/lib/utils'

type PinStep = 'verify' | 'new' | 'confirm' | 'done'

// ── Inline PIN input ──────────────────────────────────────────────
function PINInput({
  value,
  onChange,
  error,
  disabled = false,
  showDigits = false,
  length,
}: {
  value:      string
  onChange:   (v: string) => void
  error?:     string
  disabled?:  boolean
  showDigits?: boolean
  length:      number
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div>
      {/* Visual dots */}
      <div
        className="flex gap-2 justify-center mb-3 cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {Array.from({ length }).map((_, i) => {
          const filled = i < value.length
          return (
            <div
              key={i}
              className={cn(
                'w-9 h-11 rounded-xl border-2 flex items-center justify-center',
                'text-lg font-bold transition-all',
                filled && showDigits
                  ? 'border-blue-500 bg-blue-50 text-blue-800'
                  : filled
                  ? 'border-blue-500 bg-blue-600'
                  : value.length === i
                  ? 'border-blue-500 bg-white scale-105 shadow-sm'
                  : 'border-slate-200 bg-white'
              )}
            >
              {filled && showDigits
                ? value[i]
                : filled
                ? <div className="w-2 h-2 rounded-full bg-white" />
                : null
              }
            </div>
          )
        })}
      </div>

      {/* Hidden input */}
      <input
        ref={inputRef}
        type="tel"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={length}
        value={value}
        onChange={e => onChange(e.target.value.replace(/\D/g, '').slice(0, length))}
        disabled={disabled}
        autoFocus
        className="sr-only"
      />

      {/* Tap label */}
      <button
        type="button"
        onClick={() => inputRef.current?.focus()}
        className={cn(
          'w-full py-3 rounded-xl border-2 text-sm font-medium transition-colors',
          error
            ? 'border-red-300 bg-red-50 text-red-600'
            : 'border-slate-200 bg-slate-50 text-slate-400 hover:border-blue-400'
        )}
      >
        {error ?? `Tap karein aur ${length}-digit PIN daalein`}
      </button>
    </div>
  )
}

export default function ChangePinPage() {
  const router                      = useRouter()
  const { currentUser, reinitialize } = useAuth()

  const [step,      setStep]      = useState<PinStep>('verify')
  const [currentPin, setCurrentPin] = useState('')
  const [newPin,    setNewPin]    = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [error,     setError]     = useState('')
  const [saving,    setSaving]    = useState(false)
  const [showPin,   setShowPin]   = useState(false)

  const pinStrength = getPINStrength(newPin)
  const pinLength = currentUser?.role === 'karigar' ? KARIGAR_PIN_LENGTH : SHOP_PIN_LENGTH

  // ── Auto-advance on full input ───────────────────────────────
  const handleCurrentPinChange = useCallback(async (val: string) => {
    setCurrentPin(val)
    setError('')
    if (val.length === pinLength) {
      // Verify
      if (!currentUser) return
      const valid = await verifyPIN(val, currentUser.pin)
      if (valid) {
        setCurrentPin('')
        setStep('new')
      } else {
        setError('Galat PIN! Purana PIN daalein.')
        setCurrentPin('')
      }
    }
  }, [currentUser, pinLength])

  const handleNewPinChange = useCallback((val: string) => {
    setNewPin(val)
    setError('')
    if (val.length === pinLength) {
      const validation = validatePIN(val, pinLength)
      if (!validation.valid) {
        setError(validation.error!)
        setNewPin('')
        return
      }
      setStep('confirm')
    }
  }, [pinLength])

  const handleConfirmPinChange = useCallback(async (val: string) => {
    setConfirmPin(val)
    setError('')
    if (val.length === pinLength) {
      if (val !== newPin) {
        setError('PIN match nahi kiya! Dobara try karein.')
        setConfirmPin('')
        setNewPin('')
        setStep('new')
        return
      }
      if (!currentUser) return
      setSaving(true)
      try {
        // Hash the new PIN
        const hashed = await hashPIN(val)

        const res = await fetch('/api/auth/update-pin', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            memberId: currentUser.id,
            pinHash:  hashed,
            pinPlain: val,
          }),
        })
        if (!res.ok) throw new Error('PIN update failed')

        await reinitialize()
        setStep('done')
        setTimeout(() => router.back(), 1800)
      } finally {
        setSaving(false)
      }
    }
  }, [newPin, currentUser, router, reinitialize, pinLength])

  const STEPS: PinStep[] = ['verify', 'new', 'confirm']
  const stepIdx = STEPS.indexOf(step)

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="px-4 pt-12 lg:pt-6 pb-4 border-b border-slate-100
                         flex items-center gap-3">
        <button
          aria-label="Go back"
          onClick={() => router.back()}
          className="w-11 h-11 flex items-center justify-center rounded-full bg-slate-100"
        >
          <ArrowLeft size={18} className="text-slate-600" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-slate-800">PIN Badlein</h1>
          <p className="text-xs text-slate-400">{pinLength}-digit naya PIN set karein</p>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8">

        {step === 'done' ? (
          <div className="text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center
                            justify-center mx-auto mb-5">
              <CheckCircle2 size={40} className="text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-1">
              PIN Change Ho Gaya!
            </h2>
            <p className="text-slate-400 text-sm">Naya {pinLength}-digit PIN yaad rakhein</p>
          </div>

        ) : (
          <div className="w-full max-w-sm">
            {/* Progress */}
            {stepIdx >= 0 && (
              <div className="flex gap-2 mb-8">
                {STEPS.map((s, i) => (
                  <div key={s} className="flex-1">
                    <div className={cn(
                      'h-1.5 rounded-full transition-all duration-300',
                      i <= stepIdx ? 'bg-blue-600' : 'bg-slate-200'
                    )} />
                    <p className={cn(
                      'text-[10px] font-semibold text-center mt-1',
                      i === stepIdx
                        ? 'text-blue-600'
                        : i < stepIdx
                        ? 'text-green-600'
                        : 'text-slate-400'
                    )}>
                      {s === 'verify' ? 'Purana PIN' : s === 'new' ? 'Naya PIN' : 'Confirm'}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Icon */}
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center
                            mb-5 mx-auto bg-blue-100">
              <Lock size={28} className="text-blue-600" />
            </div>

            {/* Title */}
            <h2 className="text-xl font-bold text-slate-800 mb-1 text-center">
              {step === 'verify' ? 'Purana PIN Daalein' :
               step === 'new'    ? 'Naya PIN Banayein'  :
                                   'PIN Confirm Karein'  }
            </h2>
            <p className="text-slate-400 text-sm mb-6 text-center">
              {step === 'verify' ? 'Security ke liye purana PIN verify karein' :
               step === 'new'    ? `${pinLength} numbers ka naya PIN chunein` :
                                   'Wahi naya PIN dobara daalein'  }
            </p>

            {/* PIN Input */}
            {step === 'verify' && (
              <PINInput
                value={currentPin}
                onChange={handleCurrentPinChange}
                error={error || undefined}
                disabled={saving}
                length={pinLength}
              />
            )}

            {step === 'new' && (
              <div>
                <PINInput
                  value={newPin}
                  onChange={handleNewPinChange}
                  error={error || undefined}
                  showDigits={showPin}
                  disabled={saving}
                  length={pinLength}
                />

                {/* Strength meter */}
                {newPin.length > 0 && newPin.length < pinLength && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-500">PIN Strength</span>
                      {pinStrength.label && (
                        <span className={cn(
                          'text-xs font-bold',
                          pinStrength.score >= 4 ? 'text-green-600' :
                          pinStrength.score >= 3 ? 'text-amber-600' : 'text-red-500'
                        )}>
                          {pinStrength.label}
                        </span>
                      )}
                    </div>
                    <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all', pinStrength.color)}
                        style={{ width: `${(pinStrength.score / 4) * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                <button
                  onClick={() => setShowPin(v => !v)}
                  className="flex items-center gap-1.5 text-slate-400 text-xs mt-3 mx-auto"
                >
                  {showPin ? <EyeOff size={12} /> : <Eye size={12} />}
                  {showPin ? 'PIN chupayein' : 'PIN dikhayein'}
                </button>

                {/* Tips */}
                <div className="bg-blue-50 border border-blue-200 rounded-2xl
                                px-4 py-3 mt-4">
                  <p className="text-blue-700 text-xs leading-relaxed">
                    💡 Mazboot PIN ke liye: Alag alag numbers use karein,
                    date of birth use mat karein
                  </p>
                </div>
              </div>
            )}

            {step === 'confirm' && (
              <PINInput
                value={confirmPin}
                onChange={handleConfirmPinChange}
                error={error || undefined}
                disabled={saving}
                length={pinLength}
              />
            )}

            {saving && (
              <div className="flex items-center gap-2 mt-5 text-blue-600 justify-center">
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent
                                rounded-full animate-spin" />
                <span className="text-sm font-medium">Save ho raha hai...</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
