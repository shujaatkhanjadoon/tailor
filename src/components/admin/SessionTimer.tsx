// src/components/admin/SessionTimer.tsx
'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter }    from 'next/navigation'
import { Shield, Clock } from 'lucide-react'
import { adminSession } from '@/lib/admin/session'
import { cn }           from '@/lib/utils'

interface SessionTimerProps {
  secret: string
}

export function SessionTimer({ secret }: SessionTimerProps) {
  const router              = useRouter()
  const [msLeft, setMsLeft] = useState(() => adminSession.msUntilTimeout())
  const [showWarning, setShowWarning] = useState(false)

  // Logout handler
  const handleLogout = useCallback(() => {
    adminSession.clear()
    router.replace(`/admin/${secret}/locked`)
  }, [router, secret])

  // Countdown tick
  useEffect(() => {
    adminSession.init()

    const interval = setInterval(() => {
      const remaining = adminSession.msUntilTimeout()
      setMsLeft(remaining)
      setShowWarning(remaining < 2 * 60 * 1000)   // warn at 2 min

      if (remaining <= 0) {
        clearInterval(interval)
        handleLogout()
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [handleLogout])

  // Reset on user activity
  useEffect(() => {
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart']
    const touch  = () => {
      adminSession.touch()
      setShowWarning(false)
    }
    events.forEach(e => window.addEventListener(e, touch, { passive: true }))
    return () => events.forEach(e => window.removeEventListener(e, touch))
  }, [])

  const minutes = Math.floor(msLeft / 60000)
  const seconds = Math.floor((msLeft % 60000) / 1000)
  const pct     = (msLeft / (15 * 60 * 1000)) * 100

  return (
    <>
      {/* Timer pill */}
      <div className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono font-bold',
        'border transition-colors',
        showWarning
          ? 'bg-red-900/50 border-red-600 text-red-300'
          : 'bg-slate-800 border-slate-600 text-slate-400'
      )}>
        <Clock size={11} className={showWarning ? 'text-red-400' : 'text-slate-500'} />
        {String(minutes).padStart(2,'0')}:{String(seconds).padStart(2,'0')}
      </div>

      {/* Warning overlay at 2 minutes */}
      {showWarning && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50
                        bg-red-900 border border-red-600 rounded-2xl px-5 py-4
                        shadow-2xl flex items-center gap-4 max-w-md">
          <Shield size={20} className="text-red-400 shrink-0" />
          <div>
            <p className="font-bold text-red-300 text-sm">
              Session {minutes}:{String(seconds).padStart(2,'0')} mein expire hogi
            </p>
            <p className="text-red-400/70 text-xs mt-0.5">
              Kuch bhi karein to session reset ho jayega
            </p>
          </div>
          <button
            onClick={() => { adminSession.touch(); setShowWarning(false) }}
            className="shrink-0 bg-red-700 hover:bg-red-600 text-red-200
                       font-bold text-xs px-4 py-2 rounded-xl transition-colors"
          >
            Continue
          </button>
        </div>
      )}
    </>
  )
}