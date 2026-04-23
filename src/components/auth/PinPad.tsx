// src/components/auth/PinPad.tsx
'use client'

import { useState, useEffect } from 'react'
import { Delete } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PinPadProps {
  length?:      number           // PIN length, default 4
  onComplete:   (pin: string) => void
  onClear?:     () => void
  error?:       string           // shake + show error
  disabled?:    boolean
  label?:       string
  sublabel?:    string
}

const KEYS = ['1','2','3','4','5','6','7','8','9','','0','⌫']

export function PinPad({
  length    = 4,
  onComplete,
  onClear,
  error,
  disabled  = false,
  label     = 'PIN daalein',
  sublabel,
}: PinPadProps) {
  const [pin,    setPin]    = useState('')
  const [shake,  setShake]  = useState(false)

  // Shake on error
  useEffect(() => {
    if (error) {
      setShake(true)
      setPin('')
      const t = setTimeout(() => setShake(false), 600)
      return () => clearTimeout(t)
    }
  }, [error])

  // Auto-submit when full
  useEffect(() => {
    if (pin.length === length) {
      onComplete(pin)
    }
  }, [pin, length, onComplete])

  const handleKey = (key: string) => {
    if (disabled) return
    if (key === '⌫') {
      setPin(p => p.slice(0, -1))
      onClear?.()
    } else if (key === '') {
      return
    } else if (pin.length < length) {
      setPin(p => p + key)
    }
  }

  // Keyboard support
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (disabled) return
      if (e.key >= '0' && e.key <= '9') handleKey(e.key)
      if (e.key === 'Backspace') handleKey('⌫')
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [pin, disabled])

  return (
    <div className="flex flex-col items-center w-full">

      {/* Label */}
      <p className="text-slate-500 text-sm font-medium mb-1">{label}</p>
      {sublabel && <p className="text-slate-400 text-xs mb-4">{sublabel}</p>}

      {/* PIN dots */}
      <div className={cn('flex gap-4 mb-2', shake && 'animate-[shake_0.5s_ease-in-out]')}>
        {Array.from({ length }).map((_, i) => {
          const filled = i < pin.length
          return (
            <div
              key={i}
              className={cn(
                'w-4 h-4 rounded-full border-2 transition-all duration-150',
                filled
                  ? error
                    ? 'bg-red-500 border-red-500 scale-110'
                    : 'bg-blue-600 border-blue-600 scale-110'
                  : 'bg-transparent border-slate-300'
              )}
            />
          )
        })}
      </div>

      {/* Error message */}
      <div className="h-5 mb-4">
        {error && (
          <p className="text-red-500 text-xs font-medium text-center">{error}</p>
        )}
      </div>

      {/* Number grid */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-[280px]">
        {KEYS.map((key, i) => {
          const isEmpty  = key === ''
          const isDelete = key === '⌫'

          return (
            <button
              key={i}
              onClick={() => handleKey(key)}
              disabled={disabled || isEmpty}
              className={cn(
                'h-16 rounded-2xl text-xl font-semibold transition-all',
                'select-none touch-manipulation',
                isEmpty
                  ? 'invisible'
                  : isDelete
                  ? 'bg-slate-100 text-slate-500 active:bg-slate-200 active:scale-95'
                  : disabled
                  ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                  : 'bg-white border-2 border-slate-200 text-slate-800 active:bg-blue-50 active:border-blue-400 active:scale-95'
              )}
            >
              {isDelete ? <Delete size={20} className="mx-auto" /> : key}
            </button>
          )
        })}
      </div>
    </div>
  )
}