// src/app/settings/change-pin/page.tsx
'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import { PinPad } from '@/components/auth/PinPad'
import { useAuth } from '@/lib/auth/AuthContext'
import { db } from '@/lib/db/schema'
import { syncQueue } from '@/lib/db/sync'
import { cn } from '@/lib/utils'

type PinStep = 'verify' | 'new' | 'confirm' | 'done'

export default function ChangePinPage() {
  const router             = useRouter()
  const { currentUser }    = useAuth()

  const [step,      setStep]      = useState<PinStep>('verify')
  const [newPin,    setNewPin]    = useState('')
  const [error,     setError]     = useState('')
  const [saving,    setSaving]    = useState(false)

  // Step 1: Verify current PIN
  const handleVerify = useCallback(async (pin: string) => {
    if (!currentUser) return
    if (pin !== currentUser.pin) {
      setError('Galat PIN! Apna purana PIN daalein.')
      return
    }
    setError('')
    setStep('new')
  }, [currentUser])

  // Step 2: Enter new PIN
  const handleNewPin = useCallback((pin: string) => {
    setNewPin(pin)
    setError('')
    setStep('confirm')
  }, [])

  // Step 3: Confirm new PIN + save
  const handleConfirm = useCallback(async (pin: string) => {
    if (pin !== newPin) {
      setError('PIN match nahi kiya! Dobara try karein.')
      setNewPin('')
      setStep('new')
      return
    }
    if (!currentUser) return
    setSaving(true)
    try {
      await db.teamMembers.update(currentUser.id, { pin, _synced: 0 })
      syncQueue.push('update', 'teamMembers', currentUser.id, { pin })
      setStep('done')
      setTimeout(() => router.back(), 1500)
    } finally {
      setSaving(false)
    }
  }, [newPin, currentUser, router])

  const STEP_CONFIG: Record<PinStep, {
    title: string; subtitle: string
    label: string; sublabel: string
    onComplete: (pin: string) => void
    bg: string
  }> = {
    verify: {
      title:    'Purana PIN',
      subtitle: 'Pehle apna purana PIN confirm karein',
      label:    'Purana PIN daalein',
      sublabel: 'Security ke liye',
      onComplete: handleVerify,
      bg:       'bg-slate-100',
    },
    new: {
      title:    'Naya PIN',
      subtitle: 'Apna naya 4-digit PIN chunein',
      label:    'Naya PIN banayein',
      sublabel: 'Koi bhi 4 numbers',
      onComplete: handleNewPin,
      bg:       'bg-blue-100',
    },
    confirm: {
      title:    'PIN Confirm',
      subtitle: 'Wahi naya PIN dobara daalein',
      label:    'PIN dobara daalein',
      sublabel: 'Same naya PIN',
      onComplete: handleConfirm,
      bg:       'bg-purple-100',
    },
    done: {
      title:    'Ho Gaya!',
      subtitle: '',
      label:    '',
      sublabel: '',
      onComplete: () => {},
      bg:       'bg-green-100',
    },
  }

  const cfg = STEP_CONFIG[step]

  // Progress dots
  const STEPS: PinStep[] = ['verify','new','confirm']
  const stepIdx = STEPS.indexOf(step)

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="px-4 pt-12 lg:pt-6 pb-4 border-b border-slate-100 flex items-center gap-3">
        <button
          aria-label="Go back"
          onClick={() => router.back()}
          className="w-11 h-11 flex items-center justify-center rounded-full bg-slate-100"
        >
          <ArrowLeft size={18} className="text-slate-600" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-slate-800">PIN Badlein</h1>
          <p className="text-xs text-slate-400">3 aasaan steps</p>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8">

        {step === 'done' ? (
          // ── SUCCESS ──
          <div className="text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center
                            justify-center mx-auto mb-5 animate-bounce">
              <CheckCircle2 size={40} className="text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-1">PIN Change Ho Gaya!</h2>
            <p className="text-slate-400 text-sm">Naya PIN yaad rakhein</p>
          </div>

        ) : (
          <>
            {/* Progress dots */}
            {stepIdx >= 0 && (
              <div className="flex gap-2 mb-8">
                {STEPS.map((s, i) => (
                  <div
                    key={s}
                    className={cn(
                      'h-1.5 rounded-full transition-all duration-300',
                      i <= stepIdx ? 'bg-blue-600 w-8' : 'bg-slate-200 w-4'
                    )}
                  />
                ))}
              </div>
            )}

            {/* Icon */}
            <div className={cn(
              'w-16 h-16 rounded-2xl flex items-center justify-center mb-5',
              cfg.bg
            )}>
              <span className="text-3xl">
                {step === 'verify' ? '🔒' : step === 'new' ? '🔑' : '✅'}
              </span>
            </div>

            <h2 className="text-xl font-bold text-slate-800 mb-1 text-center">{cfg.title}</h2>
            <p className="text-slate-400 text-sm mb-8 text-center">{cfg.subtitle}</p>

            <PinPad
              onComplete={cfg.onComplete}
              error={error}
              onClear={() => setError('')}
              disabled={saving}
              label={cfg.label}
              sublabel={cfg.sublabel}
            />

            {saving && (
              <div className="flex items-center gap-2 mt-6 text-blue-600">
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm font-medium">Save ho raha hai...</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
