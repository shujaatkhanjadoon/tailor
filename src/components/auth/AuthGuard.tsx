// src/components/auth/AuthGuard.tsx
'use client'

import { useEffect, ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthContext'
import { Scissors } from 'lucide-react'

// All routes that never need auth check
const PUBLIC_ROUTES = [
  '/auth',
  '/login',
  '/setup',
  '/track',
  '/pricing',
  '/about',
  '/privacy-policy',
  '/terms-of-service',
  '/contact',
  '/admin',        // ← admin handles its own secret-based auth
]

export function AuthGuard({ children }: { children: ReactNode }) {
  const { isLoading, currentUser, shopId } = useAuth()
  const router   = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (isLoading) return

    const isMarketing = pathname === '/'
    const isPublic    = PUBLIC_ROUTES.some(r => pathname.startsWith(r))
    if (isMarketing || isPublic) return

    // Not logged in → go to auth
    if (!currentUser) {
      // Use window.location to avoid RSC conflict
      window.location.href = '/auth'
      return
    }

    // Karigar routing
    if (currentUser.role === 'karigar') {
      const allowed = ['/karigar', '/orders', '/settings/change-pin']
      const isAllowed = allowed.some(r => pathname.startsWith(r))
      if (!isAllowed) {
        window.location.href = '/karigar'
      }
      return
    }

    // Owner trying to access karigar-only route
    if (pathname === '/karigar') {
      window.location.href = '/dashboard'
    }
  }, [isLoading, currentUser, pathname])

  // Show spinner while loading
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
            <Scissors size={24} className="text-white" strokeWidth={1.5} />
          </div>
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  return <>{children}</>
}