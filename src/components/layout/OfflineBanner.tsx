// src/components/layout/OfflineBanner.tsx
'use client'

import { useEffect, useState, useCallback } from 'react'
import { WifiOff, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react'
import { useAuth }     from '@/lib/auth/AuthContext'
import { syncService } from '@/lib/supabase/sync-service'
import { db }          from '@/lib/db/schema'
import { cn }          from '@/lib/utils'

export function OfflineBanner() {
  const { shopId }                              = useAuth()
  const [isOnline,    setIsOnline]              = useState(true)
  const [pendingCount, setPendingCount]         = useState(0)
  const [isSyncing,   setIsSyncing]             = useState(false)
  const [justSynced,  setJustSynced]            = useState(false)
  const [syncError,   setSyncError]             = useState(false)

  // Count actual unsynced records across all tables
  const countPending = useCallback(async () => {
    if (!shopId) return
    try {
      const [o, c, p, m, t, h] = await Promise.all([
        db.orders.where('shopId').equals(shopId)
          .filter(x => x._synced === 0 && x._deleted === 0).count(),
        db.customers.where('shopId').equals(shopId)
          .filter(x => x._synced === 0 && x._deleted === 0).count(),
        db.payments.where('shopId').equals(shopId)
          .filter(x => x._synced === 0).count(),
        db.measurements.where('shopId').equals(shopId)
          .filter(x => x._synced === 0).count(),
        db.teamMembers.where('shopId').equals(shopId)
          .filter(x => x._synced === 0 && x._deleted === 0).count(),
        db.orderStatusHistory.where('shopId').equals(shopId)
          .filter(x => x._synced === 0).count(),
      ])
      setPendingCount(o + c + p + m + t + h)
    } catch { /* ignore */ }
  }, [shopId])

  useEffect(() => {
    if (typeof window === 'undefined') return

    setIsOnline(navigator.onLine)
    countPending()

    const handleOnline = async () => {
      setIsOnline(true)
      if (!shopId) return

      setIsSyncing(true)
      setSyncError(false)

      try {
        const { success } = await syncService.pushAll(shopId)
        await countPending()

        if (success) {
          setJustSynced(true)
          setTimeout(() => setJustSynced(false), 3000)
        } else {
          setSyncError(true)
          setTimeout(() => setSyncError(false), 5000)
        }
      } finally {
        setIsSyncing(false)
      }
    }

    const handleOffline = () => {
      setIsOnline(false)
      setJustSynced(false)
    }

    window.addEventListener('online',  handleOnline)
    window.addEventListener('offline', handleOffline)

    // Poll pending count every 15 seconds
    const interval = setInterval(countPending, 15_000)

    return () => {
      window.removeEventListener('online',  handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(interval)
    }
  }, [shopId, countPending])

  // Determine what to show
  const showOffline  = !isOnline
  const showSyncing  = isOnline && isSyncing
  const showSynced   = isOnline && !isSyncing && justSynced
  const showError    = isOnline && !isSyncing && syncError
  const showPending  = isOnline && !isSyncing && !justSynced && !syncError && pendingCount > 0

  if (!showOffline && !showSyncing && !showSynced && !showError && !showPending) {
    return null
  }

  return (
    <div className={cn(
      'fixed top-0 left-1/2 -translate-x-1/2',
      'w-full max-w-107.5 lg:max-w-none lg:left-64 lg:translate-x-0',
      'z-50 px-4 py-2.5',
      'flex items-center gap-2 text-sm font-medium',
      'transition-all duration-300 will-change-transform',
      showOffline ? 'bg-slate-800 text-white' :
      showError   ? 'bg-amber-500 text-white'  :
      showSynced  ? 'bg-green-600 text-white'  :
      showSyncing ? 'bg-blue-600  text-white'  :
                    'bg-blue-500  text-white'
    )}>
      {showOffline && (
        <>
          <WifiOff size={14} className="shrink-0" />
          <span>Offline — data locally saved</span>
        </>
      )}
      {showSyncing && (
        <>
          <RefreshCw size={14} className="animate-spin shrink-0" />
          <span>Syncing to cloud...</span>
        </>
      )}
      {showSynced && (
        <>
          <CheckCircle2 size={14} className="shrink-0" />
          <span>Sab sync ho gaya ✓</span>
        </>
      )}
      {showError && (
        <>
          <AlertCircle size={14} className="shrink-0" />
          <span>Sync failed — retry hogi</span>
        </>
      )}
      {showPending && (
        <>
          <RefreshCw size={14} className="shrink-0" />
          <span>{pendingCount} changes syncing...</span>
        </>
      )}
    </div>
  )
}
