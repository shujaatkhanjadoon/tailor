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

  // src/components/layout/AppShell.tsx — replace useEffect

  useEffect(() => {
    if (!shopId) return

    // Don't use a ref guard here — let it re-run when shopId changes
    // Previous cleanup will cancel old listeners/intervals

    console.log('[AppShell] Sync + Realtime starting for:', shopId)

    // ── Push immediately — don't await, fire and forget ──────────
    syncService.pushAll(shopId).catch(console.error)
    syncService.pullAll(shopId).catch(console.error)

    // ── Real-time subscription ────────────────────────────────────
    const rt = subscribeToShop(shopId, () => {})

    // ── Periodic push every 60s ───────────────────────────────────
    const interval = setInterval(() => {
      if (navigator.onLine) syncService.pushAll(shopId).catch(console.error)
    }, 60_000)

    // ── Visibility change ────────────────────────────────────────
    const onVisible = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        syncService.pushAll(shopId).catch(console.error)
        syncService.pullAll(shopId).catch(console.error)
      }
    }
    document.addEventListener('visibilitychange', onVisible)

    // ── Online event ─────────────────────────────────────────────
    const onOnline = () => {
      syncService.pushAll(shopId).catch(console.error)
      syncService.pullAll(shopId).catch(console.error)
    }
    window.addEventListener('online', onOnline)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onOnline)
      rt.unsubscribe()
    }
  }, [shopId])  // ← correct: re-runs when shopId changes

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