// src/app/admin/login/page.tsx
'use client'

import { useState, useEffect, Suspense, useCallback, useRef } from 'react'
import { useRouter, useSearchParams }    from 'next/navigation'
import {
  Shield, Eye, EyeOff,
  Loader2, AlertCircle,
  Smartphone, Key,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import Image from 'next/image'

function getSafeAdminRedirect(value: string | null) {
  if (!value) return '/admin/dashboard'
  if (typeof window === 'undefined') return '/admin/dashboard'

  try {
    const parsed = new URL(value, window.location.origin)
    const target = `${parsed.pathname}${parsed.search}${parsed.hash}`

    if (
      parsed.origin !== window.location.origin ||
      parsed.pathname === '/admin/login' ||
      parsed.pathname.startsWith('/api/') ||
      !parsed.pathname.startsWith('/admin/dashboard')
    ) {
      return '/admin/dashboard'
    }

    return target
  } catch {
    return '/admin/dashboard'
  }
}

// TOTP digits display — shows current code from phone
function TOTPInput({
  value,
  onChange,
  error,
}: {
  value:    string
  onChange: (v: string) => void
  error?:   string
}) {
  const digits = 6
  const chars  = value.padEnd(digits, '').split('').slice(0, digits)

  return (
    <div>
      <label className="block text-xs font-bold text-slate-500 uppercase
                         tracking-wide mb-3">
        Google Authenticator Code
      </label>
      <div className="flex gap-2 justify-center mb-2">
        {Array.from({ length: digits }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'w-11 h-14 rounded-xl border-2 flex items-center justify-center',
              'text-xl font-bold transition-colors',
              value.length === i
                ? 'border-blue-500 bg-blue-50'
                : value.length > i
                ? 'border-slate-300 bg-slate-50 text-slate-800'
                : 'border-slate-200 bg-white text-slate-300'
            )}
          >
            {chars[i] || '·'}
          </div>
        ))}
      </div>
      {/* Hidden input for keyboard */}
      <input
        type="number"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={6}
        value={value}
        onChange={e => onChange(e.target.value.replace(/\D/g,'').slice(0,6))}
        autoFocus
        className="sr-only"
        id="totp-input"
      />
      <label
        htmlFor="totp-input"
        className={cn(
          'block w-full text-center py-3 rounded-xl border-2 cursor-text text-sm',
          'font-medium transition-colors',
          error
            ? 'border-red-300 bg-red-50 text-red-600'
            : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-blue-400'
        )}
      >
        {error ?? 'Tap to enter code from your Authenticator app'}
      </label>
    </div>
  )
}

// 30-second countdown timer
function TOTPTimer() {
  const [seconds, setSeconds] = useState(() => 30 - (Math.floor(Date.now() / 1000) % 30))

  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds(30 - (Math.floor(Date.now() / 1000) % 30))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const pct = ((30 - seconds) / 30) * 100

  return (
    <div className="flex items-center gap-2 justify-center text-xs text-slate-500">
      <div className="relative w-6 h-6">
        <svg className="w-6 h-6 -rotate-90" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" fill="none"
            stroke="#e2e8f0" strokeWidth="2.5" />
          <circle cx="12" cy="12" r="10" fill="none"
            stroke={seconds <= 5 ? '#ef4444' : '#3b82f6'}
            strokeWidth="2.5"
            strokeDasharray={`${2 * Math.PI * 10}`}
            strokeDashoffset={`${2 * Math.PI * 10 * (1 - pct / 100)}`}
            className="transition-all"
          />
        </svg>
        <span className={cn(
          'absolute inset-0 flex items-center justify-center',
          'text-[8px] font-bold',
          seconds <= 5 ? 'text-red-500' : 'text-blue-600'
        )}>
          {seconds}
        </span>
      </div>
      <span className={seconds <= 5 ? 'text-red-500 font-semibold' : ''}>
        {seconds <= 5 ? 'Naya code aane wala hai...' : `Code ${seconds}s mein badlega`}
      </span>
    </div>
  )
}

function LoginContent() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const redirectTo   = getSafeAdminRedirect(searchParams.get('redirect'))

  const [step,        setStep]        = useState<'secret' | 'totp'>('secret')
  const [secret,      setSecret]      = useState('')
  const [showSecret,  setShowSecret]  = useState(false)
  const [totpCode,    setTotpCode]    = useState('')
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')
  const [requiresTOTP, setRequiresTOTP] = useState(false)
  const submittedTOTPRef = useRef('')

  // Check if already logged in
  useEffect(() => {
    fetch('/api/admin/verify')
      .then(r => r.json())
      .then(d => { if (d.valid) router.replace(redirectTo) })
      .catch(() => {})
  }, [redirectTo, router])

  const handleSecretSubmit = async () => {
    if (!secret.trim() || loading) return
    setLoading(true)
    setError('')

    try {
      const res  = await fetch('/api/admin/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ secret: secret.trim() }),
      })
      const data = await res.json()

      if (data.requiresTOTP) {
        setRequiresTOTP(true)
        setStep('totp')
      } else if (data.success) {
        router.replace(redirectTo)
      } else {
        setError(data.error ?? 'Secret galat hai')
      }
    } catch {
      setError('Server se connect nahi ho saka')
    } finally {
      setLoading(false)
    }
  }

  const handleTOTPSubmit = useCallback(async () => {
    if (totpCode.length !== 6 || loading) return
    if (submittedTOTPRef.current === totpCode) return
    submittedTOTPRef.current = totpCode
    setLoading(true)
    setError('')

    try {
      const res  = await fetch('/api/admin/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ secret: secret.trim(), totpCode }),
      })
      const data = await res.json()

      if (data.success) {
        router.replace(redirectTo)
      } else {
        setError(data.error ?? 'Code galat hai')
        setTotpCode('')
        submittedTOTPRef.current = ''
      }
    } catch {
      setError('Server se connect nahi ho saka')
      submittedTOTPRef.current = ''
    } finally {
      setLoading(false)
    }
  }, [loading, redirectTo, router, secret, totpCode])

  // Auto-submit when 6 digits entered
  useEffect(() => {
    if (totpCode.length === 6) handleTOTPSubmit()
  }, [totpCode, handleTOTPSubmit])

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-900 via-slate-800
                    to-blue-950 flex flex-col items-center justify-center p-4">

      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5
                        rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-500/5
                        rounded-full blur-3xl" />
      </div>

      {/* Card */}
      <div className="relative w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 flex items-center
                          justify-center mx-auto mb-4">
            <Image
            src="/icon.svg"
            alt="MeraDarzi"
            width={64}
            height={64}
            loading="eager"
            />
          </div>
          <h1 className="text-2xl font-bold text-white">MeraDarzi</h1>
          <p className="text-slate-400 text-sm mt-1">Super Admin Panel</p>
        </div>

        <div className="bg-white rounded-3xl p-8 shadow-2xl shadow-black/30">

          {/* Step indicator */}
          {requiresTOTP && (
            <div className="flex items-center gap-2 mb-6">
              {['Secret', 'Authenticator'].map((label, i) => (
                <div key={label} className="flex items-center gap-2 flex-1">
                  <div className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center',
                    'text-xs font-bold shrink-0',
                    i === 0
                      ? 'bg-green-500 text-white'
                      : step === 'totp'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-200 text-slate-500'
                  )}>
                    {i === 0 ? '✓' : i + 1}
                  </div>
                  <span className={cn(
                    'text-xs font-medium flex-1',
                    i === 0 ? 'text-green-600' :
                    step === 'totp' ? 'text-blue-600' : 'text-slate-400'
                  )}>
                    {label}
                  </span>
                  {i === 0 && (
                    <div className="flex-1 h-0.5 bg-slate-200 mx-1" />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* â”€â”€ STEP 1: Secret â”€â”€ */}
          {step === 'secret' && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-blue-100 rounded-2xl flex items-center
                                justify-center shrink-0">
                  <Key size={18} className="text-blue-600" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-800">Admin Secret</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Admin secret key daalein
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500
                                   uppercase tracking-wide mb-2">
                  Secret Key
                </label>
                <div className={cn(
                  'flex items-center gap-2 border-2 rounded-2xl px-4 py-3.5 mb-4',
                  'transition-all',
                  error
                    ? 'border-red-400 bg-red-50'
                    : 'border-slate-200 bg-slate-50 focus-within:border-blue-500 focus-within:bg-white'
                )}>
                  <Shield size={16} className="text-slate-400 shrink-0" />
                  <input
                    type={showSecret ? 'text' : 'password'}
                    placeholder="Admin secret key..."
                    value={secret}
                    onChange={e => { setSecret(e.target.value); setError('') }}
                    onKeyDown={e => e.key === 'Enter' && handleSecretSubmit()}
                    autoFocus
                    className="flex-1 text-sm font-mono bg-transparent outline-none
                               text-slate-800 placeholder:text-slate-400 placeholder:font-sans"
                  />
                  <button
                    onClick={() => setShowSecret(v => !v)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    {showSecret
                      ? <EyeOff size={16} />
                      : <Eye size={16} />
                    }
                  </button>
                </div>

                {error && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200
                                  rounded-xl px-3 py-2.5 mb-4">
                    <AlertCircle size={14} className="text-red-500 shrink-0" />
                    <p className="text-red-600 text-xs">{error}</p>
                  </div>
                )}

                <button
                  onClick={handleSecretSubmit}
                  disabled={!secret.trim() || loading}
                  className="w-full bg-blue-600 disabled:bg-slate-300 text-white
                             font-bold py-4 rounded-2xl transition-all active:scale-[0.98]
                             flex items-center justify-center gap-2"
                >
                  {loading
                    ? <><Loader2 size={18} className="animate-spin" /> Verify ho raha hai...</>
                    : 'Continue →'
                  }
                </button>
              </div>
            </div>
          )}

          {/* â”€â”€ STEP 2: TOTP â”€â”€ */}
          {step === 'totp' && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-green-100 rounded-2xl flex items-center
                                justify-center shrink-0">
                  <Smartphone size={18} className="text-green-600" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-800">Authenticator Code</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Google Authenticator app kholein
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <TOTPTimer />

                <TOTPInput
                  value={totpCode}
                  onChange={setTotpCode}
                  error={error || undefined}
                />

                {loading && (
                  <div className="flex items-center justify-center gap-2
                                  text-blue-600 text-sm">
                    <Loader2 size={16} className="animate-spin" />
                    Verify ho raha hai...
                  </div>
                )}

                <button
                  onClick={() => { setStep('secret'); setTotpCode(''); setError('') }}
                  className="w-full text-slate-400 text-sm font-medium py-2
                             hover:text-slate-600 transition-colors"
                >
                  ← Wapas
                </button>
              </div>
            </div>
          )}

          {/* Setup hint for first time */}
          <div className="mt-5 pt-5 border-t border-slate-100">
            <p className="text-xs text-slate-400 text-center">
              Google Authenticator setup nahi kiya?{' '}
              <a
                href="/admin/setup-totp"
                className="text-blue-600 font-semibold hover:underline"
              >
                Pehli baar setup karein
              </a>
            </p>
          </div>
        </div>

        <p className="text-center text-slate-600 text-xs mt-6">
          MeraDarzi · Super Admin · Secure Session
        </p>
      </div>
    </div>
  )
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-linear-to-br from-slate-900 via-slate-800
                      to-blue-950 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-4">
              <div className="w-16 h-16 bg-slate-800 rounded-2xl animate-pulse" />
            </div>
            <div className="h-7 w-40 bg-slate-800 rounded-lg animate-pulse mx-auto mb-2" />
            <div className="h-4 w-32 bg-slate-800 rounded-lg animate-pulse mx-auto" />
          </div>
          <div className="bg-white rounded-3xl p-8 shadow-2xl shadow-black/30">
            <div className="space-y-4">
              <div className="h-10 w-full bg-slate-100 rounded-2xl animate-pulse" />
              <div className="h-14 w-full bg-slate-100 rounded-2xl animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}
