// src/components/settings/DangerZone.tsx
'use client'

import { useState } from 'react'
import { Trash2, AlertTriangle, X } from 'lucide-react'
import { useAuth } from '@/lib/auth/AuthContext'
import { cn } from '@/lib/utils'

export function DangerZone() {
  const { clearAllData, currentUser, shopId } = useAuth()
  const [showModal, setShowModal]   = useState(false)
  const [step,      setStep]        = useState<'confirm' | 'typing' | 'deleting'>('confirm')
  const [typed,     setTyped]       = useState('')
  const [deleting,  setDeleting]    = useState(false)
  const CONFIRM_WORD = 'DELETE'

  const handleReset = async () => {
    if (!shopId || !currentUser) return
    setDeleting(true)
    setStep('deleting')
    try {
      const res = await fetch('/api/shop/delete', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          shopId,
          memberId: currentUser.id,
          confirm: CONFIRM_WORD,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error ?? 'Shop delete nahi ho saki')
      }
      await clearAllData()
      window.location.href = '/setup'
    } catch (e) {
      console.error(e)
      setDeleting(false)
      setStep('typing')
    }
  }

  return (
    <>
      <button
        onClick={() => { setShowModal(true); setStep('confirm'); setTyped('') }}
        className="w-full flex items-center gap-3 px-4 py-4 text-left"
      >
        <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
          <Trash2 size={17} className="text-red-600" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-red-600">Sab Data Mitao</p>
          <p className="text-xs text-slate-400 mt-0.5">Shop aur server data permanently delete hoga</p>
        </div>
      </button>

      {/* Modal overlay */}
      {showModal && (
        <div className="fixed bottom-[calc(3rem+env(safe-area-inset-bottom))] inset-0 z-50 flex items-end justify-center lg:items-center lg:bottom-[calc(0rem+env(safe-area-inset-bottom))]">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => !deleting && setShowModal(false)}
          />
          <div className="relative z-10 max-h-[92dvh] w-full max-w-[min(100vw,34rem)] overflow-y-auto bg-white px-5 pt-5 pb-8 shadow-2xl rounded-t-3xl lg:rounded-2xl">

            {/* Handle */}
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-5 lg:hidden" />

            {/* Close */}
            {!deleting && (
              <button
                aria-label="Close delete data dialog"
                onClick={() => setShowModal(false)}
                className="absolute top-4 right-4 w-11 h-11 flex items-center justify-center
                           rounded-full bg-slate-100"
              >
                <X size={14} className="text-slate-500" />
              </button>
            )}

            {step === 'deleting' ? (
              <div className="flex flex-col items-center py-8 text-center">
                <div className="w-12 h-12 border-3 border-red-500 border-t-transparent
                                rounded-full animate-spin mb-4" />
                <p className="font-bold text-slate-800">Sab mita raha hai...</p>
                <p className="text-sm text-slate-400 mt-1">Thori der wait karein</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center shrink-0">
                    <AlertTriangle size={24} className="text-red-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">Yaqeen hai?</h3>
                    <p className="text-xs text-slate-400">Yeh action wapas nahi hoga</p>
                  </div>
                </div>

                <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-5">
                  <p className="text-sm text-red-700 font-medium mb-1">Yeh sab permanently mit jayega:</p>
                  <ul className="text-xs text-red-600 space-y-1">
                    {['Sare gahak','Sare orders','Sari payments','Sare karigar','Sab measurements'].map(item => (
                      <li key={item} className="flex items-center gap-1.5">
                        <span className="w-1 h-1 bg-red-400 rounded-full shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mb-5">
                  <label className="block text-xs font-semibold text-slate-600 mb-2">
                    Confirm karne ke liye{' '}
                    <span className="font-mono font-bold text-red-600">{CONFIRM_WORD}</span>
                    {' '}likhein:
                  </label>
                  <input
                    type="text"
                    value={typed}
                    onChange={e => setTyped(e.target.value.toUpperCase())}
                    placeholder={CONFIRM_WORD}
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-sm
                               font-mono outline-none focus:border-red-400 transition-colors
                               placeholder:text-slate-300"
                    autoComplete="off"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowModal(false)}
                    className="flex-1 py-3.5 rounded-2xl border-2 border-slate-200
                               text-slate-700 font-semibold text-sm"
                  >
                    Rehne Do
                  </button>
                  <button
                    onClick={handleReset}
                    disabled={typed !== CONFIRM_WORD}
                    className={cn(
                      'flex-1 py-3.5 rounded-2xl font-semibold text-sm transition-colors',
                      typed === CONFIRM_WORD
                        ? 'bg-red-600 text-white active:bg-red-700'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    )}
                  >
                    Haan, Mitao
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
