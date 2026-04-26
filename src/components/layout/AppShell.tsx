// src/components/layout/AppShell.tsx
'use client'

import { useEffect, useRef } from 'react'
import { BottomNav }         from './BottomNav'
import { SideNav }           from './SideNav'
import { OfflineBanner }     from './OfflineBanner'
import { AuthGuard }         from '@/components/auth/AuthGuard'
import { PWAInstallPrompt }  from './PWAInstallPrompt'
import { useAuth }           from '@/lib/auth/AuthContext'
import { syncService }       from '@/lib/supabase/sync-service'
import { subscribeToShop }   from '@/lib/supabase/realtime'

export function AppShell({ children }: { children: React.ReactNode }) {
  const { currentUser, shopId } = useAuth()
  const isKarigar = currentUser?.role === 'karigar'

  // Use ref to store cleanup function — avoids stale closure issues
  const cleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    // Clean up previous subscription if shopId changes
    if (cleanupRef.current) {
      cleanupRef.current()
      cleanupRef.current = null
    }

    if (!shopId) return

    console.log('[AppShell] Initialising sync + realtime for:', shopId)

    // ── 1. Immediate push + pull ──────────────────────────────────
    syncService.pushAll(shopId).catch(console.error)
    syncService.pullAll(shopId).catch(console.error)

    // ── 2. Realtime subscription ──────────────────────────────────
    let rt: { unsubscribe: () => void } | null = null
    try {
      rt = subscribeToShop(shopId, () => {
        // useLiveQuery picks up IndexedDB changes automatically
      })
    } catch (e) {
      console.error('[AppShell] Realtime subscription failed:', e)
    }

    // ── 3. Push every 60 seconds ──────────────────────────────────
    const interval = setInterval(() => {
      if (navigator.onLine) {
        syncService.pushAll(shopId).catch(console.error)
      }
    }, 60_000)

    // ── 4. Push + pull on tab visibility ─────────────────────────
    const onVisible = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        syncService.pushAll(shopId).catch(console.error)
        syncService.pullAll(shopId).catch(console.error)
      }
    }
    document.addEventListener('visibilitychange', onVisible)

    // ── 5. Push + pull on network reconnect ──────────────────────
    const onOnline = () => {
      console.log('[AppShell] Back online — syncing')
      syncService.pushAll(shopId).catch(console.error)
      syncService.pullAll(shopId).catch(console.error)
    }
    window.addEventListener('online', onOnline)

    // ── Store cleanup ─────────────────────────────────────────────
    cleanupRef.current = () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onOnline)
      rt?.unsubscribe()
    }

    // Return cleanup for React's useEffect
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current()
        cleanupRef.current = null
      }
    }
  }, [shopId])   // Re-runs when shopId changes (login/logout)

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-slate-100">

        {/* Desktop sidebar — owner only */}
        {!isKarigar && (
          <aside className="hidden lg:flex lg:flex-col lg:w-64
                            lg:fixed lg:inset-y-0 lg:z-40">
            <SideNav />
          </aside>
        )}

        {/* Main content */}
        <div className={`flex-1 ${!isKarigar ? 'lg:pl-64' : ''}`}>

          {/* Mobile layout */}
          <div className="lg:hidden min-h-screen max-w-107.5 mx-auto
                          bg-white shadow-xl relative overflow-hidden">
            <OfflineBanner />
            {children}
            {!isKarigar && <BottomNav />}
          </div>

          {/* Desktop layout */}
          <div className="hidden lg:block min-h-screen bg-white">
            <OfflineBanner />
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