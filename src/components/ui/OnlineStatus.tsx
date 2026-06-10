'use client'

import { useState, useEffect, useRef } from 'react'
import { getPendingSyncCount } from '@/lib/db/offline'
import { syncEngine, type SyncEventType } from '@/lib/db/sync'
import { toast } from 'sonner'

export function OnlineStatus() {
  const [online, setOnline] = useState(true)
  const [pending, setPending] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [syncTable, setSyncTable] = useState('')
  const conflictToastShown = useRef(false)

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

    // Listen for sync progress events
    const unsub = syncEngine.onSyncEvent((event: SyncEventType, table?: string) => {
      if (event === 'push-start' || event === 'pull-start') {
        setSyncing(true)
        setSyncTable(table ?? '')
      }
      if (event === 'push-end' || event === 'pull-end') {
        setSyncing(false)
        setSyncTable('')
        checkPending()
      }
      if (event === 'sync-conflict' && table && !conflictToastShown.current) {
        conflictToastShown.current = true
        toast.warning(`Server version kept for ${table} — your local change was skipped`, {
          duration: 4000,
          onDismiss: () => { conflictToastShown.current = false },
          onAutoClose: () => { conflictToastShown.current = false },
        })
      }
    })

    const interval = setInterval(checkPending, 5000)

    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      unsub()
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

  if (syncing) {
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-blue-600 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg whitespace-nowrap flex items-center gap-2">
        <span className="inline-block w-2.5 h-2.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
        Syncing {syncTable || 'data'}...
      </div>
    )
  }

  if (pending > 0) {
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-amber-500 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg whitespace-nowrap">
        {pending} change{pending === 1 ? '' : 's'} pending sync
      </div>
    )
  }

  return null
}
