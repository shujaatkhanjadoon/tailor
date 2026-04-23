// src/app/setup/page.tsx
'use client'
import { db } from '@/lib/db/schema'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Scissors, Store, Phone, Lock, CheckCircle2 } from 'lucide-react'
import { useAuth } from '@/lib/auth/AuthContext'
import { cn } from '@/lib/utils'
import { PinPad } from '@/components/auth/PinPad'

type SetupStep = 'welcome' | 'shop' | 'phone' | 'pin' | 'confirm' | 'done'

export default function SetupPage() {
    const router = useRouter()
    const { setupShop, isSetupDone } = useAuth()

    const [step, setStep] = useState<SetupStep>('welcome')
    const [shopName, setShopName] = useState('')
    const [ownerName, setOwnerName] = useState('')
    const [phone, setPhone] = useState('')
    const [pin, setPin] = useState('')
    const [pinError, setPinError] = useState('')
    const [saving, setSaving] = useState(false)

    // Already setup → go to login
    useEffect(() => {
        if (isSetupDone) router.replace('/login')
    }, [isSetupDone, router])

    const handlePinEntry = (enteredPin: string) => {
        setPin(enteredPin)
        setStep('confirm')
    }

const isSubmittingRef = useRef(false)

const handleConfirmPin = async (enteredConfirm: string) => {
  // Hard guard — reject any call after first
  if (isSubmittingRef.current) {
    console.log('Duplicate submit blocked')
    return
  }

  if (enteredConfirm !== pin) {
    setPinError('PIN match nahi kiya! Dobara try karein.')
    setStep('pin')
    setPin('')
    return
  }

  // Lock immediately before ANY async work
  isSubmittingRef.current = true
  setSaving(true)

  try {
    await setupShop(shopName.trim(), phone, pin, ownerName.trim())
    setStep('done')
    setTimeout(() => router.replace('/dashboard'), 1800)
  } catch (e) {
    console.error('Setup failed:', e)
    // Only unlock on failure so user can retry
    isSubmittingRef.current = false
    setSaving(false)
    setPinError('Kuch masla hua. Dobara try karein.')
  }
}

    // ── WELCOME ──────────────────────────────────────────────────────
    if (step === 'welcome') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700
                      flex flex-col items-center justify-center px-6 text-center">
                {/* Logo */}
                <div className="w-24 h-24 bg-white/10 rounded-3xl flex items-center justify-center mb-8 border border-white/20">
                    <Scissors size={44} className="text-white" strokeWidth={1.5} />
                </div>

                <h1 className="text-3xl font-bold text-white mb-2">Darzi Manager</h1>
                <p className="text-blue-200 text-base mb-1">Pakistan ka pehla</p>
                <p className="text-blue-200 text-base mb-10">darzi management app</p>

                {/* Feature pills */}
                <div className="flex flex-col gap-3 w-full max-w-xs mb-12">
                    {[
                        { emoji: '📋', text: 'Orders easily manage karein' },
                        { emoji: '📏', text: 'Gahak ka nap yaad rakhe' },
                        { emoji: '💰', text: 'Payment ka hisaab rakhe' },
                        { emoji: '📱', text: 'WhatsApp se notify karein' },
                    ].map(f => (
                        <div key={f.text} className="flex items-center gap-3 bg-white/10 rounded-2xl px-4 py-3">
                            <span className="text-xl">{f.emoji}</span>
                            <span className="text-white text-sm font-medium">{f.text}</span>
                        </div>
                    ))}
                </div>

                <button
                    onClick={() => setStep('shop')}
                    className="w-full max-w-xs bg-white text-blue-800 font-bold py-4 rounded-2xl
                     text-base transition-transform active:scale-95 shadow-lg shadow-blue-900/40"
                >
                    Shuru Karein →
                </button>
                <p className="text-blue-400 text-xs mt-4">Bilkul free • Offline bhi kaam kare</p>
            </div>
        )
    }

    // ── SHOP NAME ────────────────────────────────────────────────────
    if (step === 'shop') {
        const canProceed = shopName.trim().length >= 2 && ownerName.trim().length >= 2
        return (
            <div className="min-h-screen bg-white flex flex-col px-6 pt-16 pb-8">
                {/* Progress */}
                <StepProgress current={1} total={3} />

                <div className="flex-1 flex flex-col justify-center">
                    <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mb-6">
                        <Store size={26} className="text-blue-600" />
                    </div>

                    <h2 className="text-2xl font-bold text-slate-800 mb-1">Apni Dukaan</h2>
                    <p className="text-slate-400 text-sm mb-8">Dukaan ka naam aur apna naam daalein</p>

                    <div className="space-y-4">
                        {/* Shop name */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                                Dukaan Ka Naam *
                            </label>
                            <input
                                type="text"
                                placeholder="Jaise: Ahmed Tailor House"
                                value={shopName}
                                onChange={e => setShopName(e.target.value)}
                                autoFocus
                                className="w-full px-4 py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl
                           text-base font-medium text-slate-800 outline-none
                           focus:border-blue-500 focus:bg-white transition-all
                           placeholder:text-slate-400"
                            />
                        </div>

                        {/* Owner name */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                                Aapka Naam (Ustad) *
                            </label>
                            <input
                                type="text"
                                placeholder="Jaise: Ahmed Bhai"
                                value={ownerName}
                                onChange={e => setOwnerName(e.target.value)}
                                className="w-full px-4 py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl
                           text-base font-medium text-slate-800 outline-none
                           focus:border-blue-500 focus:bg-white transition-all
                           placeholder:text-slate-400"
                            />
                        </div>
                    </div>
                </div>

                <button
                    onClick={() => setStep('phone')}
                    disabled={!canProceed}
                    className="w-full bg-blue-600 disabled:bg-slate-300 text-white font-bold
                     py-4 rounded-2xl text-base transition-all active:scale-[0.98]"
                >
                    Aage Barein →
                </button>
            </div>
        )
    }

    // ── PHONE NUMBER ────────────────────────────────────────────────
    if (step === 'phone') {
        const isValid = phone.length === 11 && phone.startsWith('0')
        return (
            <div className="min-h-screen bg-white flex flex-col px-6 pt-16 pb-8">
                <StepProgress current={2} total={3} />

                <div className="flex-1 flex flex-col justify-center">
                    <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center mb-6">
                        <Phone size={26} className="text-green-600" />
                    </div>

                    <h2 className="text-2xl font-bold text-slate-800 mb-1">Phone Number</h2>
                    <p className="text-slate-400 text-sm mb-8">
                        Yeh aapka login phone number hoga
                    </p>

                    {/* Phone input with big styling */}
                    <div className={cn(
                        'flex items-center gap-3 border-2 rounded-2xl px-4 py-4 transition-all',
                        isValid
                            ? 'border-green-500 bg-green-50'
                            : 'border-slate-200 bg-slate-50 focus-within:border-blue-500 focus-within:bg-white'
                    )}>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className="text-xl">🇵🇰</span>
                            <span className="text-slate-500 font-semibold text-sm">+92</span>
                            <div className="w-px h-5 bg-slate-300 ml-1" />
                        </div>
                        <input
                            type="tel"
                            inputMode="numeric"
                            placeholder="03XX-XXXXXXX"
                            value={phone}
                            onChange={e => {
                                const val = e.target.value.replace(/\D/g, '').slice(0, 11)
                                setPhone(val)
                            }}
                            autoFocus
                            className="flex-1 text-xl font-bold text-slate-800 bg-transparent outline-none
                         placeholder:text-slate-300 placeholder:font-normal font-mono tracking-wider"
                        />
                        {isValid && (
                            <CheckCircle2 size={22} className="text-green-500 flex-shrink-0" />
                        )}
                    </div>

                    <p className="text-xs text-slate-400 mt-3 ml-1">
                        Jaise: 03001234567 (11 numbers)
                    </p>

                    {/* Show number toggle */}
                    <div className="mt-6 bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3">
                        <p className="text-xs text-blue-700 font-medium">
                            💡 Yeh number aapka User ID hoga. Ise yaad rakhein.
                        </p>
                    </div>
                </div>

                <button
                    onClick={() => setStep('pin')}
                    disabled={!isValid}
                    className="w-full bg-blue-600 disabled:bg-slate-300 text-white font-bold
                     py-4 rounded-2xl text-base transition-all active:scale-[0.98]"
                >
                    PIN Set Karein →
                </button>
            </div>
        )
    }

    // ── SET PIN ─────────────────────────────────────────────────────
    if (step === 'pin') {
        return (
            <div className="min-h-screen bg-white flex flex-col px-6 pt-16 pb-8">
                <StepProgress current={3} total={3} />

                <div className="flex-1 flex flex-col items-center justify-center">
                    <div className="w-14 h-14 bg-purple-100 rounded-2xl flex items-center justify-center mb-6">
                        <Lock size={26} className="text-purple-600" />
                    </div>

                    <h2 className="text-2xl font-bold text-slate-800 mb-1 text-center">Apna PIN Banayein</h2>
                    <p className="text-slate-400 text-sm mb-10 text-center">
                        4 numbers ka secret code — yaad rakhein!
                    </p>

                    <PinPad
                        onComplete={handlePinEntry}
                        error={pinError}
                        onClear={() => setPinError('')}
                        label="Naya 4-digit PIN"
                        sublabel="Koi bhi 4 numbers chunein"
                    />
                </div>
            </div>
        )
    }

    // ── CONFIRM PIN ──────────────────────────────────────────────────
    if (step === 'confirm') {
        return (
            <div className="min-h-screen bg-white flex flex-col px-6 pt-16 pb-8">
                <StepProgress current={3} total={3} />

                <div className="flex-1 flex flex-col items-center justify-center">
                    <div className="w-14 h-14 bg-purple-100 rounded-2xl flex items-center justify-center mb-6">
                        <CheckCircle2 size={26} className="text-purple-600" />
                    </div>

                    <h2 className="text-2xl font-bold text-slate-800 mb-1 text-center">PIN Confirm Karein</h2>
                    <p className="text-slate-400 text-sm mb-10 text-center">
                        Wahi PIN dobara daalein
                    </p>

                    <PinPad
                        onComplete={handleConfirmPin}
                        disabled={saving || isSubmittingRef.current}  // ← blocks UI too
                        error={pinError}
                        onClear={() => setPinError('')}
                        label="PIN dobara daalein"
                    />

                    {saving && (
                        <div className="mt-6 flex items-center gap-2 text-blue-600">
                            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                            <span className="text-sm font-medium">Setup ho raha hai...</span>
                        </div>
                    )}
                </div>
            </div>
        )
    }

    // ── DONE ────────────────────────────────────────────────────────
    if (step === 'done') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-green-600 to-green-500
                      flex flex-col items-center justify-center px-6 text-center">
                <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mb-6
                        animate-bounce">
                    <CheckCircle2 size={48} className="text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">
                    Mubarak ho! 🎉
                </h2>
                <p className="text-green-100 text-base mb-1">{shopName}</p>
                <p className="text-green-200 text-sm">App tayyar hai — shuru karte hain!</p>
            </div>
        )
    }

    return null
}

// ── Helper: Step Progress Bar ─────────────────────────────────────
function StepProgress({ current, total }: { current: number; total: number }) {
    return (
        <div className="mb-10">
            <div className="flex gap-2 mb-2">
                {Array.from({ length: total }).map((_, i) => (
                    <div
                        key={i}
                        className={cn(
                            'flex-1 h-1.5 rounded-full transition-all duration-300',
                            i < current ? 'bg-blue-600' : 'bg-slate-200'
                        )}
                    />
                ))}
            </div>
            <p className="text-xs text-slate-400 font-medium">
                Step {current} of {total}
            </p>
        </div>
    )
}