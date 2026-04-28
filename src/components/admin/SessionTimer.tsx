// src/components/admin/SessionTimer.tsx
'use client'

import { useEffect, useState, useCallback } from 'react'
import { Clock } from 'lucide-react'
import { cn }    from '@/lib/utils'

const TIMEOUT_MS = 15 * 60 * 1000   // 15 minutes
const WARN_MS    =  2 * 60 * 1000   //  2 minutes warning

export function SessionTimer({ onExpired }: { onExpired: () => void }) {
  const [msLeft,   setMsLeft]   = useState(TIMEOUT_MS)
  const [lastActivity, setLastActivity] = useState(Date.now())

  const resetTimer = useCallback(() => {
    setLastActivity(Date.now())
  }, [])

  useEffect(() => {
    const events = ['mousedown','keydown','scroll','touchstart','click']
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }))
    return () => events.forEach(e => window.removeEventListener(e, resetTimer))
  }, [resetTimer])

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = TIMEOUT_MS - (Date.now() - lastActivity)
      setMsLeft(Math.max(0, remaining))
      if (remaining <= 0) onExpired()
    }, 1000)
    return () => clearInterval(interval)
  }, [lastActivity, onExpired])

  const minutes = Math.floor(msLeft / 60000)
  const seconds = Math.floor((msLeft % 60000) / 1000)
  const isWarn  = msLeft < WARN_MS && msLeft > 0

  return (
    <>
      <div className={cn(
        'flex items-center gap-1.5 px-2.5 py-1.5 rounded-full',
        'text-xs font-mono font-bold border transition-colors',
        isWarn
          ? 'bg-red-900/50 border-red-700 text-red-300'
          : 'bg-slate-800 border-slate-700 text-slate-400'
      )}>
        <Clock size={11} className={isWarn ? 'text-red-400' : 'text-slate-500'} />
        {String(minutes).padStart(2,'0')}:{String(seconds).padStart(2,'0')}
      </div>

      {/* Warning toast */}
      {isWarn && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50
                        bg-red-900 border border-red-700 rounded-2xl
                        px-4 py-3 shadow-2xl flex items-center gap-3
                        max-w-[calc(100vw-2rem)] w-full sm:max-w-sm">
          <Clock size={16} className="text-red-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-red-300 text-sm">
              Session {minutes}m {seconds}s mein expire hogi
            </p>
            <p className="text-red-400/70 text-xs">
              Kuch bhi karein to extend ho jayegi
            </p>
          </div>
          <button
            onClick={resetTimer}
            className="shrink-0 bg-red-700 hover:bg-red-600 text-red-200
                       font-bold text-xs px-3 py-2 rounded-xl transition-colors"
          >
            Extend
          </button>
        </div>
      )}
    </>
  )
}