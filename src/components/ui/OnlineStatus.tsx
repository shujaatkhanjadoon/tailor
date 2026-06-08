'use client'

import { useState, useEffect } from 'react'
import { getPendingSyncCount } from '@/lib/db/offline'

export function OnlineStatus() {
  const [online, setOnline] = useState(true)
  const [pending, setPending] = useState(0)

  useEffect(() => {
    setOnline(navigator.onLine)
    const checkPending = async () => {
      setPending(await getPendingSyncCount())
    }
    checkPending()

    const onOnline = () => {
      setOnline(true)
      checkPending()
    }
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)

    const interval = setInterval(checkPending, 5000)

    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      clearInterval(interval)
    }
  }, [])

  if (!online) {
    const text = pending > 0
      ? `No internet — ${pending} change${pending === 1 ? '' : 's'} pending sync`
      : 'No internet'
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg animate-bounce whitespace-nowrap">
        {text}
      </div>
    )
  }

  if (pending > 0) {
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-amber-500 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg whitespace-nowrap">
        Syncing {pending} change{pending === 1 ? '' : 's'}...
      </div>
    )
  }

  return null
}
