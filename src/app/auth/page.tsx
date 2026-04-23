// src/app/auth/page.tsx
'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Scissors, Phone, CheckCircle2, ArrowLeft, Store, Lock, Eye, EyeOff } from 'lucide-react'
import { supabase }      from '@/lib/supabase/client'
import { syncService }   from '@/lib/supabase/sync-service'
import { useAuth }       from '@/lib/auth/AuthContext'
import { PinPad }        from '@/components/auth/PinPad'
import { db }            from '@/lib/db/schema'
import { cn }            from '@/lib/utils'

type AuthStep =
  | 'phone'       // enter phone number
  | 'pin_login'   // existing user: enter PIN
  | 'setup_name'  // new user: shop name + owner name
  | 'setup_pin'   // new user: set PIN
  | 'setup_confirm' // new user: confirm PIN
  | 'success'     // done

export default function AuthPage() {
  const router                          = useRouter()
  const { login, setupShop, currentUser, isSetupDone } = useAuth()

  const [step,        setStep]        = useState<AuthStep>('phone')
  const [phone,       setPhone]       = useState('')
  const [shopName,    setShopName]    = useState('')
  const [ownerName,   setOwnerName]   = useState('')
  const [pin,         setPin]         = useState('')
  const [pinError,    setPinError]    = useState('')
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')
  const [existingShop, setExistingShop] = useState<{
    shopName: string; memberId?: string
  } | null>(null)

  const isSubmittingRef = useRef(false)

  // Already logged in
  useEffect(() => {
    if (currentUser) {
      router.replace(currentUser.role === 'karigar' ? '/karigar' : '/dashboard')
    }
  }, [currentUser])

  // ── Step 1: Check if phone exists ──────────────────────────────
  const handlePhoneSubmit = useCallback(async () => {
    if (loading) return
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.length < 10) {
      setError('Sahi phone number daalein')
      return
    }

    setLoading(true)
    setError('')

    try {
      // 1. Check local IndexedDB first (fast, works offline)
      const localMember = await db.teamMembers
        .where('phone').equals(cleaned).first()

      if (localMember) {
        const localShop = await db.shop.toCollection().first()
        setExistingShop({ shopName: localShop?.shopName ?? 'Your Shop', memberId: localMember.id })
        setStep('pin_login')
        setLoading(false)
        return
      }

      // 2. Check Supabase (cross-device lookup)
      if (navigator.onLine) {
        const { data: members } = await (supabase as any)
          .from('team_members')
          .select(`*, shops(shop_name, id)`)
          .eq('phone', cleaned)
          .eq('is_active', true)
          .maybeSingle()

        if (members) {
          // Found in Supabase — pull shop data to local DB
          setExistingShop({
            shopName:  members.shops?.shop_name ?? 'Your Shop',
            memberId:  members.id,
          })

          // Pull all shop data to this device
          await syncService.pullAll(members.shops?.id)

          // Also pull team members and shop itself
          const { data: shopRow } = await (supabase as any)
            .from('shops')
            .select('*')
            .eq('id', members.shops?.id)
            .single()

          if (shopRow) {
            await db.shop.put({
              id:              shopRow.id,
              shopName:        shopRow.shop_name,
              ownerPhone:      shopRow.owner_phone,
              whatsappNumber:  shopRow.whatsapp_number,
              city:            shopRow.city,
              createdAt:       shopRow.created_at,
              updatedAt:       shopRow.updated_at,
              _synced:         1,
              _deleted:        0,
            })
            await db.appSettings.put({
              key:   'shopId',
              value: JSON.stringify(shopRow.id),
            })
          }

          // Pull all team members for this shop
          const { data: allMembers } = await (supabase as any)
            .from('team_members')
            .select('*')
            .eq('shop_id', members.shops?.id)
            .eq('is_active', true)

          if (allMembers) {
            await db.teamMembers.bulkPut(allMembers.map((m: any) => ({
              id:          m.id,
              shopId:      m.shop_id,
              name:        m.name,
              phone:       m.phone,
              role:        m.role,
              pin:         m.pin_hash,
              speciality:  m.speciality  ?? undefined,
              payRateType: m.pay_rate_type ?? undefined,
              payRate:     m.pay_rate    ?? undefined,
              isActive:    m.is_active ? 1 : 0,
              joinedAt:    m.joined_at,
              createdAt:   m.created_at,
              _synced:     1,
              _deleted:    0,
            })))
          }

          setStep('pin_login')
          setLoading(false)
          return
        }
      }

      // 3. Phone not found anywhere → new user → setup
      setStep('setup_name')

    } catch (e) {
      console.error('Phone check failed:', e)
      setError('Kuch masla hua. Dobara try karein.')
    } finally {
      setLoading(false)
    }
  }, [phone, loading])

  // ── Step 2a: PIN login ──────────────────────────────────────────
  const handlePinLogin = useCallback(async (enteredPin: string) => {
    setLoading(true)
    setPinError('')
    const success = await login(phone.replace(/\D/g,''), enteredPin)
    setLoading(false)
    if (success) {
      router.replace('/dashboard')
    } else {
      setPinError('Galat PIN! Dobara try karein.')
    }
  }, [phone, login, router])

  // ── Step 2b: Setup flow ─────────────────────────────────────────
  const handleSetupPin = useCallback((enteredPin: string) => {
    setPin(enteredPin)
    setStep('setup_confirm')
  }, [])

  const handleSetupConfirm = useCallback(async (enteredConfirm: string) => {
    if (isSubmittingRef.current) return
    if (enteredConfirm !== pin) {
      setPinError('PIN match nahi kiya!')
      setStep('setup_pin')
      setPin('')
      return
    }
    isSubmittingRef.current = true
    setLoading(true)
    try {
      await setupShop(shopName.trim(), phone.replace(/\D/g,''), pin, ownerName.trim())
      router.replace('/dashboard')
    } catch (e) {
      console.error(e)
      isSubmittingRef.current = false
      setPinError('Setup fail ho gaya. Dobara try karein.')
      setStep('setup_pin')
    } finally {
      setLoading(false)
    }
  }, [pin, shopName, ownerName, phone, setupShop, router])

  const goBack = () => {
    setPinError('')
    setError('')
    if (step === 'pin_login')      setStep('phone')
    if (step === 'setup_name')     setStep('phone')
    if (step === 'setup_pin')      setStep('setup_name')
    if (step === 'setup_confirm')  setStep('setup_pin')
  }

  const isNewUser = step.startsWith('setup')

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900
                    flex flex-col">

      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full
                        blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-500/10 rounded-full
                        blur-3xl translate-y-1/2 -translate-x-1/2" />
      </div>

      {/* Logo area */}
      <div className="relative pt-16 pb-8 px-6 text-center">
        <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center
                        mx-auto mb-4 shadow-xl shadow-blue-900/50">
          <Scissors size={30} className="text-white" strokeWidth={1.5} />
        </div>
        <h1 className="text-2xl font-bold text-white mb-1">Darzi Manager</h1>
        <p className="text-blue-300 text-sm">
          {isNewUser ? 'Apni dukaan setup karein' : 'Welcome back'}
        </p>
      </div>

      {/* Card */}
      <div className="relative flex-1 flex flex-col">
        <div className="flex-1 bg-white rounded-t-3xl px-6 pt-8 pb-10
                        shadow-2xl shadow-slate-900/50">

          {/* Back button */}
          {step !== 'phone' && (
            <button
              onClick={goBack}
              className="flex items-center gap-2 text-slate-400 hover:text-slate-600
                         text-sm font-medium mb-6 transition-colors"
            >
              <ArrowLeft size={16} />
              Wapas
            </button>
          )}

          {/* ── STEP: Phone ── */}
          {step === 'phone' && (
            <div>
              <h2 className="text-xl font-bold text-slate-800 mb-1">
                Shuru Karein
              </h2>
              <p className="text-slate-400 text-sm mb-6">
                Apna phone number daalein — hum check karenge aapka account hai ya nahi
              </p>

              <div className={cn(
                'flex items-center gap-2 border-2 rounded-2xl px-4 py-4 mb-3 transition-all',
                error
                  ? 'border-red-400 bg-red-50'
                  : 'border-slate-200 bg-slate-50 focus-within:border-blue-500 focus-within:bg-white'
              )}>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-lg">🇵🇰</span>
                  <span className="text-slate-500 font-semibold text-sm">+92</span>
                  <div className="w-px h-5 bg-slate-300" />
                </div>
                <input
                  type="tel"
                  inputMode="numeric"
                  placeholder="03XX-XXXXXXX"
                  value={phone}
                  onChange={e => {
                    setPhone(e.target.value.replace(/\D/g,'').slice(0,11))
                    setError('')
                  }}
                  onKeyDown={e => e.key === 'Enter' && handlePhoneSubmit()}
                  autoFocus
                  className="flex-1 text-xl font-bold text-slate-800 bg-transparent
                             outline-none placeholder:text-slate-300 font-mono"
                />
                {phone.replace(/\D/g,'').length >= 10 && (
                  <CheckCircle2 size={20} className="text-green-500 flex-shrink-0" />
                )}
              </div>

              {error && <p className="text-red-500 text-xs mb-3 ml-1">{error}</p>}

              <button
                onClick={handlePhoneSubmit}
                disabled={loading || phone.replace(/\D/g,'').length < 10}
                className="w-full bg-blue-600 disabled:bg-slate-300 text-white font-bold
                           py-4 rounded-2xl text-base transition-all active:scale-[0.98]
                           flex items-center justify-center gap-2 shadow-lg shadow-blue-200"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/40 border-t-white
                                  rounded-full animate-spin" />
                ) : (
                  <>
                    <Phone size={18} />
                    Aage Barein
                  </>
                )}
              </button>

              <p className="text-center text-xs text-slate-400 mt-5">
                Naya account? Yeh automatically setup ho jayega.
              </p>
            </div>
          )}

          {/* ── STEP: PIN Login ── */}
          {step === 'pin_login' && (
            <div className="flex flex-col items-center">
              {/* Shop info */}
              <div className="flex items-center gap-3 bg-slate-50 border border-slate-200
                              rounded-2xl px-4 py-3 mb-6 w-full">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center
                                justify-center flex-shrink-0">
                  <Store size={18} className="text-blue-600" />
                </div>
                <div>
                  <p className="font-bold text-slate-800 text-sm">
                    {existingShop?.shopName}
                  </p>
                  <p className="text-xs text-slate-400">{phone}</p>
                </div>
              </div>

              <h2 className="text-xl font-bold text-slate-800 mb-1 text-center">
                PIN Daalein
              </h2>
              <p className="text-slate-400 text-sm mb-8 text-center">
                Apna 4-digit PIN enter karein
              </p>

              <PinPad
                onComplete={handlePinLogin}
                disabled={loading}
                error={pinError}
                onClear={() => setPinError('')}
                label="4-digit PIN"
              />

              {loading && (
                <div className="flex items-center gap-2 mt-4 text-blue-600">
                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent
                                  rounded-full animate-spin" />
                  <span className="text-sm">Login ho raha hai...</span>
                </div>
              )}
            </div>
          )}

          {/* ── STEP: Setup — Shop Name ── */}
          {step === 'setup_name' && (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center
                                justify-center text-blue-600 text-xs font-bold">1</div>
                <h2 className="text-xl font-bold text-slate-800">Dukaan Ka Naam</h2>
              </div>
              <p className="text-slate-400 text-sm mb-6 ml-8">
                Apni dukaan aur apna naam daalein
              </p>

              <div className="space-y-3 mb-6">
                <div>
                  <label className="block text-xs font-semibold text-slate-500
                                    uppercase tracking-wide mb-2">
                    Dukaan Ka Naam *
                  </label>
                  <div className="flex items-center gap-2 bg-slate-50 border-2 border-slate-200
                                  rounded-2xl px-4 py-4 focus-within:border-blue-500
                                  focus-within:bg-white transition-all">
                    <Store size={16} className="text-slate-400 flex-shrink-0" />
                    <input
                      type="text"
                      placeholder="Jaise: Ahmed Tailor House"
                      value={shopName}
                      onChange={e => setShopName(e.target.value)}
                      autoFocus
                      className="flex-1 text-sm font-medium text-slate-800 bg-transparent
                                 outline-none placeholder:text-slate-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500
                                    uppercase tracking-wide mb-2">
                    Aapka Naam *
                  </label>
                  <input
                    type="text"
                    placeholder="Jaise: Ahmed Bhai"
                    value={ownerName}
                    onChange={e => setOwnerName(e.target.value)}
                    className="w-full px-4 py-4 bg-slate-50 border-2 border-slate-200
                               rounded-2xl text-sm font-medium text-slate-800 outline-none
                               focus:border-blue-500 focus:bg-white transition-all
                               placeholder:text-slate-400"
                  />
                </div>
              </div>

              <button
                onClick={() => {
                  if (shopName.trim().length < 2 || ownerName.trim().length < 2) {
                    setError('Dono fields zaroor bharein')
                    return
                  }
                  setError('')
                  setStep('setup_pin')
                }}
                disabled={shopName.trim().length < 2 || ownerName.trim().length < 2}
                className="w-full bg-blue-600 disabled:bg-slate-300 text-white font-bold
                           py-4 rounded-2xl text-base transition-all active:scale-[0.98]"
              >
                PIN Set Karein →
              </button>

              {error && <p className="text-red-500 text-xs mt-2 text-center">{error}</p>}
            </div>
          )}

          {/* ── STEP: Setup — Set PIN ── */}
          {step === 'setup_pin' && (
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-2 mb-1 self-start">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center
                                justify-center text-blue-600 text-xs font-bold">2</div>
                <h2 className="text-xl font-bold text-slate-800">Apna PIN Banayein</h2>
              </div>
              <p className="text-slate-400 text-sm mb-8 self-start ml-8">
                4 numbers — yaad rakhein!
              </p>

              <PinPad
                onComplete={handleSetupPin}
                error={pinError}
                onClear={() => setPinError('')}
                label="Naya PIN chunein"
                sublabel="Koi bhi 4 numbers"
              />
            </div>
          )}

          {/* ── STEP: Setup — Confirm PIN ── */}
          {step === 'setup_confirm' && (
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-2 mb-1 self-start">
                <div className="w-6 h-6 bg-green-100 rounded-full flex items-center
                                justify-center text-green-600 text-xs font-bold">3</div>
                <h2 className="text-xl font-bold text-slate-800">PIN Confirm Karein</h2>
              </div>
              <p className="text-slate-400 text-sm mb-8 self-start ml-8">
                Wahi PIN dobara daalein
              </p>

              <PinPad
                onComplete={handleSetupConfirm}
                disabled={loading}
                error={pinError}
                onClear={() => setPinError('')}
                label="PIN dobara daalein"
              />

              {loading && (
                <div className="flex items-center gap-2 mt-4 text-blue-600">
                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent
                                  rounded-full animate-spin" />
                  <span className="text-sm">Setup ho raha hai...</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}