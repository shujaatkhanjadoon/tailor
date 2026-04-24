// src/components/layout/AppShell.tsx
'use client'

import { useEffect } from 'react'
import { BottomNav }        from './BottomNav'
import { SideNav }          from './SideNav'
import { AuthGuard }        from '@/components/auth/AuthGuard'
import { PWAInstallPrompt } from './PWAInstallPrompt'
import { useAuth }          from '@/lib/auth/AuthContext'
import { syncService }      from '@/lib/supabase/sync-service'

export function AppShell({ children }: { children: React.ReactNode }) {
  const { currentUser, shopId } = useAuth()
  const isKarigar = currentUser?.role === 'karigar'

  // ── Auto-sync when user is logged in ──────────────────────
  useEffect(() => {
    if (!shopId) return

    // Immediate push when user logs in / app loads
    syncService.pushAll(shopId).then(({ success, errors }) => {
      if (!success && errors.length > 0) {
        console.warn('[AutoSync] Errors:', errors)
      }
    })

    // Pull latest from Supabase on load (for cross-device updates)
    syncService.pullAll(shopId).catch(console.error)

    // Start ongoing auto-sync
    const stop = syncService.startAutoSync(shopId)
    return stop
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