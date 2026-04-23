// src/components/auth/AuthGuard.tsx
'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthContext'
import { notifScheduler } from '@/lib/notifications/scheduler'
import { notifPermission } from '@/lib/notifications/permission'
import { Scissors } from 'lucide-react'

const PUBLIC_ROUTES  = [ '/auth', '/setup', '/login', '/track', '/privacy-policy', '/terms-of-service', '/contact', '/pricing']
const MARKETING_ROOT = ['/']

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isLoading, isSetupDone, currentUser, shopId } = useAuth()
  const router   = useRouter()
  const pathname = usePathname()

  // Route protection
  useEffect(() => {
  if (isLoading) return
  const isPublic    = PUBLIC_ROUTES.some(r => pathname.startsWith(r))
  const isMarketing = pathname === '/'
  if (isMarketing || isPublic) return

  // Not logged in → auth page (handles both new + existing users)
  if (!currentUser) {
    router.replace('/auth')
    return
  }

  // Karigar routing
  if (currentUser.role === 'karigar') {
    const ok = ['/karigar', '/orders', '/settings'].some(r => pathname.startsWith(r))
    if (!ok) router.replace('/karigar')
  }
}, [isLoading, currentUser, pathname, router])

  // Run notification scheduler when user logs in
  useEffect(() => {
    if (!currentUser || !shopId) return
    if (notifPermission.current() === 'granted') {
      notifScheduler.run(shopId)
    }
  }, [currentUser?.id, shopId])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center">
            <Scissors size={24} className="text-white" />
          </div>
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-400 font-medium">Loading...</p>
        </div>
      </div>
    )
  }

  if (MARKETING_ROOT.includes(pathname)) return <>{children}</>
  return <>{children}</>
}