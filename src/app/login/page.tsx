// src/app/login/page.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Scissors, ChevronDown, Phone, X } from 'lucide-react'
import { useAuth } from '@/lib/auth/AuthContext'
import { PinPad } from '@/components/auth/PinPad'
import { db } from '@/lib/db/schema'
import { cn } from '@/lib/utils'

interface TeamOption {
  id:    string
  name:  string
  phone: string
  role:  'owner' | 'karigar'
}

export default function LoginPage() {
  const router                             = useRouter()
  const { login, isSetupDone, currentUser } = useAuth()

  const [teamMembers,   setTeamMembers]   = useState<TeamOption[]>([])
  const [selected,      setSelected]      = useState<TeamOption | null>(null)
  const [showPicker,    setShowPicker]    = useState(false)
  const [pinError,      setPinError]      = useState('')
  const [loading,       setLoading]       = useState(false)
  const [shopName,      setShopName]      = useState('')

  // Already logged in → go home
  useEffect(() => {
    if (currentUser) {
      router.replace(currentUser.role === 'karigar' ? '/karigar' : '/')
    }
  }, [currentUser, router])

  // Not setup yet → go to setup
  useEffect(() => {
    if (!isSetupDone) router.replace('/setup')
  }, [isSetupDone, router])

  // Load team members + shop name
  useEffect(() => {
    const load = async () => {
      const shop = await db.shop.toCollection().first()
      if (shop) setShopName(shop.shopName)

      const members = await db.teamMembers
        .filter(m => m.isActive === 1 && m._deleted === 0)
        .toArray()

      const options: TeamOption[] = members.map(m => ({
        id: m.id, name: m.name, phone: m.phone, role: m.role,
      }))
      setTeamMembers(options)

      // Auto-select owner if only one member
      const owner = options.find(m => m.role === 'owner')
      if (options.length === 1 && owner) setSelected(owner)
    }
    load()
  }, [])

  const handlePinComplete = useCallback(async (pin: string) => {
    if (!selected) return
    setLoading(true)
    setPinError('')

    const success = await login(selected.phone, pin)
    setLoading(false)

    if (success) {
      router.replace(selected.role === 'karigar' ? '/karigar' : '/')
    } else {
      setPinError('Galat PIN! Dobara try karein.')
    }
  }, [selected, login, router])

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">

      {/* Top brand area */}
      <div className="bg-gradient-to-br from-blue-900 to-blue-700 px-6 pt-16 pb-10 text-center">
        <div className="w-16 h-16 bg-white/15 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/20">
          <Scissors size={30} className="text-white" strokeWidth={1.5} />
        </div>
        <h1 className="text-xl font-bold text-white">{shopName || 'Darzi Manager'}</h1>
        <p className="text-blue-300 text-sm mt-1">Apna account chunein</p>
      </div>

      {/* Main card */}
      <div className="flex-1 px-5 -mt-5">
        <div className="bg-white rounded-3xl shadow-lg shadow-blue-900/10 border border-slate-100 p-6">

          {/* ── WHO IS LOGGING IN ── */}
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
            Kaun login kar raha hai?
          </p>

          {/* Member picker */}
          <div className="relative mb-6">
            <button
              onClick={() => setShowPicker(v => !v)}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-4 rounded-2xl border-2 transition-all text-left',
                selected
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-slate-200 bg-slate-50 hover:border-slate-300'
              )}
            >
              {/* Avatar */}
              <div className={cn(
                'w-11 h-11 rounded-full flex items-center justify-center font-bold text-base flex-shrink-0',
                selected?.role === 'owner'
                  ? 'bg-blue-600 text-white'
                  : selected?.role === 'karigar'
                  ? 'bg-green-500 text-white'
                  : 'bg-slate-200 text-slate-500'
              )}>
                {selected ? selected.name.charAt(0).toUpperCase() : '?'}
              </div>

              <div className="flex-1 min-w-0">
                {selected ? (
                  <>
                    <p className="font-bold text-slate-800 truncate">{selected.name}</p>
                    <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                      <Phone size={10} />
                      {selected.phone}
                      <span className={cn(
                        'ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                        selected.role === 'owner'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-green-100 text-green-700'
                      )}>
                        {selected.role === 'owner' ? 'Ustad' : 'Karigar'}
                      </span>
                    </p>
                  </>
                ) : (
                  <p className="text-slate-400 font-medium">Account chunein...</p>
                )}
              </div>

              <ChevronDown
                size={18}
                className={cn('text-slate-400 transition-transform', showPicker && 'rotate-180')}
              />
            </button>

            {/* Dropdown */}
            {showPicker && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200
                              rounded-2xl shadow-xl z-20 overflow-hidden">
                {teamMembers.map(m => (
                  <button
                    key={m.id}
                    onClick={() => { setSelected(m); setShowPicker(false); setPinError('') }}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors',
                      'hover:bg-slate-50 border-b border-slate-100 last:border-0',
                      selected?.id === m.id ? 'bg-blue-50' : ''
                    )}
                  >
                    <div className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center font-bold flex-shrink-0',
                      m.role === 'owner' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                    )}>
                      {m.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 truncate text-sm">{m.name}</p>
                      <p className="text-xs text-slate-400">{m.phone}</p>
                    </div>
                    <span className={cn(
                      'text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0',
                      m.role === 'owner' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                    )}>
                      {m.role === 'owner' ? '⭐ Ustad' : '✂️ Karigar'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── PIN PAD ── */}
          <div className={cn(
            'transition-all duration-300',
            selected ? 'opacity-100' : 'opacity-30 pointer-events-none'
          )}>
            <div className="w-full h-px bg-slate-100 mb-6" />

            <PinPad
              onComplete={handlePinComplete}
              disabled={!selected || loading}
              error={pinError}
              onClear={() => setPinError('')}
              label={selected ? `${selected.name.split(' ')[0]} ka PIN` : 'PIN daalein'}
              sublabel="4-digit secret code"
            />

            {loading && (
              <div className="flex items-center justify-center gap-2 mt-4 text-blue-600">
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm font-medium">Login ho raha hai...</span>
              </div>
            )}
          </div>

          {/* Setup link */}
          <p className="text-center text-xs text-slate-400 mt-6">
            Naya karigar add karna hai?{' '}
            <button
              onClick={() => router.push('/settings')}
              className="text-blue-500 font-semibold"
            >
              Settings mein jayein
            </button>
          </p>
        </div>
      </div>

      <div className="py-6 text-center">
        <p className="text-xs text-slate-400">Darzi Manager • Made for Pakistan 🇵🇰</p>
      </div>
    </div>
  )
}