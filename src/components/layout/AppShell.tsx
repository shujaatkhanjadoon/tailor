// src/components/layout/AppShell.tsx
'use client'

import { useEffect, useRef } from 'react'
import { BottomNav }        from './BottomNav'
import { SideNav }          from './SideNav'
import { AuthGuard }        from '@/components/auth/AuthGuard'
import { PWAInstallPrompt } from './PWAInstallPrompt'
import { useAuth }          from '@/lib/auth/AuthContext'
import { syncService }      from '@/lib/supabase/sync-service'

export function AppShell({ children }: { children: React.ReactNode }) {
  const { currentUser, shopId } = useAuth()
  const isKarigar = currentUser?.role === 'karigar'

  const syncStartedRef = useRef(false)

  useEffect(() => {
    // Don't run until we have a real shopId
    if (!shopId) return

    // Prevent duplicate sync setup on re-renders
    if (syncStartedRef.current) return
    syncStartedRef.current = true

    console.log('[AppShell] Starting sync for shopId:', shopId)

    // 1. Push immediately on login/load
    syncService.pushAll(shopId).then(({ success, errors }) => {
      if (errors.length > 0) console.warn('[AutoSync] Push errors:', errors)
    })

    // 2. Pull latest from cloud
    syncService.pullAll(shopId).catch(console.error)

    // 3. Push every 2 minutes while app is open
    const interval = setInterval(() => {
      if (navigator.onLine) {
        syncService.pushAll(shopId).catch(console.error)
      }
    }, 2 * 60 * 1000)

    // 4. Push when user returns to the tab (visibility change)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        syncService.pushAll(shopId).catch(console.error)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    // 5. Push when network reconnects
    const handleOnline = () => {
      console.log('[AutoSync] Back online — pushing...')
      syncService.pushAll(shopId).catch(console.error)
    }
    window.addEventListener('online', handleOnline)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('online', handleOnline)
      syncStartedRef.current = false
    }
  }, [shopId])   // re-runs when shopId changes (null → real ID on login)

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