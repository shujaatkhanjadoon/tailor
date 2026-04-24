// src/components/layout/OfflineBanner.tsx
'use client'

import { useEffect, useState } from 'react'
import { WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react'
import { useAuth } from '@/lib/auth/AuthContext'
import { syncService } from '@/lib/supabase/sync-service'
import { cn } from '@/lib/utils'

export function OfflineBanner() {
  const { shopId }                      = useAuth()
  const [isOnline,  setIsOnline]        = useState(true)
  const [isSyncing, setIsSyncing]       = useState(false)
  const [justSynced, setJustSynced]     = useState(false)
  const [syncError,  setSyncError]      = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    setIsOnline(navigator.onLine)

    const handleOnline = async () => {
      setIsOnline(true)
      if (!shopId) return
      setIsSyncing(true)
      setSyncError(false)
      const { success } = await syncService.pushAll(shopId)
      setIsSyncing(false)
      if (success) {
        setJustSynced(true)
        setTimeout(() => setJustSynced(false), 3000)
      } else {
        setSyncError(true)
        setTimeout(() => setSyncError(false), 5000)
      }
    }

    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online',  handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online',  handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [shopId])

  if (isOnline && !isSyncing && !justSynced && !syncError) return null

  return (
    <div className={cn(
      'fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-107.5 lg:max-w-none',
      'lg:left-64 lg:translate-x-0 z-50 px-4 py-2.5',
      'flex items-center gap-2 text-sm font-medium',
      !isOnline   ? 'bg-slate-800 text-white' :
      syncError   ? 'bg-amber-500 text-white'  :
      justSynced  ? 'bg-green-600 text-white'  :
                    'bg-blue-600  text-white'
    )}>
      {!isOnline && <><WifiOff size={14} /> Offline — data locally safe</>}
      {isOnline && isSyncing && <><RefreshCw size={14} className="animate-spin" /> Supabase sync ho raha hai...</>}
      {isOnline && justSynced && <><CheckCircle2 size={14} /> Cloud sync complete ✓</>}
      {isOnline && syncError  && <><RefreshCw size={14} /> Sync failed — retry hogi</>}
    </div>
  )
}