// src/components/layout/AppShell.tsx
'use client'

import { useEffect, useRef } from 'react'
import { BottomNav }           from './BottomNav'
import { SideNav }             from './SideNav'
import { AuthGuard }           from '@/components/auth/AuthGuard'
import { PWAInstallPrompt }    from './PWAInstallPrompt'
import { useAuth }             from '@/lib/auth/AuthContext'
import { syncService }         from '@/lib/supabase/sync-service'
import { subscribeToShop }     from '@/lib/supabase/realtime'

export function AppShell({ children }: { children: React.ReactNode }) {
  const { currentUser, shopId } = useAuth()
  const isKarigar              = currentUser?.role === 'karigar'

  const syncStartedRef  = useRef(false)
  const realtimeRef     = useRef<{ unsubscribe: () => void } | null>(null)

  useEffect(() => {
    if (!shopId) return
    if (syncStartedRef.current) return
    syncStartedRef.current = true

    console.log('[AppShell] Initialising sync + realtime for:', shopId)

    // ── 1. Push any locally unsynced data immediately ────────────
    syncService.pushAll(shopId).then(({ errors }) => {
      if (errors.length > 0) console.warn('[AppShell] Push errors:', errors)
    })

    // ── 2. Pull latest from cloud (covers missed changes) ────────
    syncService.pullAll(shopId).catch(console.error)

    // ── 3. Subscribe to real-time changes ────────────────────────
    // onChange is called whenever Supabase streams a change.
    // Dexie's useLiveQuery automatically re-renders components
    // because it watches IndexedDB — no manual state updates needed.
    realtimeRef.current = subscribeToShop(shopId, () => {
      // useLiveQuery hooks pick up IndexedDB changes automatically
      // so we don't need to do anything here — it's just a callback
      // you could use for logging or analytics if needed
    })

    // ── 4. Push every 90 seconds (catches anything missed) ───────
    const interval = setInterval(() => {
      if (navigator.onLine) {
        syncService.pushAll(shopId).catch(console.error)
      }
    }, 90_000)

    // ── 5. Push when tab becomes visible again ───────────────────
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        syncService.pushAll(shopId).catch(console.error)
        // Also pull to catch changes from other devices
        syncService.pullAll(shopId).catch(console.error)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    // ── 6. Push + pull when network reconnects ───────────────────
    const handleOnline = () => {
      console.log('[AppShell] Back online — syncing...')
      syncService.pushAll(shopId).catch(console.error)
      syncService.pullAll(shopId).catch(console.error)
    }
    window.addEventListener('online', handleOnline)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('online', handleOnline)
      realtimeRef.current?.unsubscribe()
      realtimeRef.current  = null
      syncStartedRef.current = false
    }
  }, [shopId])

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-slate-100">
        {!isKarigar && (
          <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 lg:z-40">
            <SideNav />
          </aside>
        )}

        <div className={`flex-1 ${!isKarigar ? 'lg:pl-64' : ''}`}>
          <div className="lg:hidden min-h-screen max-w-107.5 mx-auto bg-white shadow-xl relative">
            {children}
            {!isKarigar && <BottomNav />}
          </div>
          <div className="hidden lg:block min-h-screen bg-white">
            <div className="max-w-6xl mx-auto px-8 py-8">
              {children}
            </div>
          </div>
        </div>
      </div>

      <PWAInstallPrompt />
    </AuthGuard>
  )
}