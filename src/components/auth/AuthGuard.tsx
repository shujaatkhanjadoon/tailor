// src/components/auth/AuthGuard.tsx
'use client'

import { useEffect, ReactNode }       from 'react'
import { usePathname }                from 'next/navigation'
import { useAuth }                    from '@/lib/auth/AuthContext'
import Image                          from 'next/image'

const PUBLIC_ROUTES = [
  '/auth', '/login', '/setup', '/track',
  '/pricing', '/about', '/privacy-policy',
  '/terms-of-service', '/contact',
  '/admin',    // admin handles its own auth
]

function isPublicPath(pathname: string) {
  return PUBLIC_ROUTES.some(route =>
    pathname === route || pathname.startsWith(`${route}/`)
  )
}

export function AuthGuard({ children }: { children: ReactNode }) {
  const { isLoading, currentUser } = useAuth()
  const pathname = usePathname()
  const isPublic = isPublicPath(pathname)
  const karigarAllowed = currentUser?.role !== 'karigar' || ['/karigar', '/orders'].some(r => pathname.startsWith(r))

  useEffect(() => {
    if (isLoading) return
    if (isPublic) return

    // Proxy handles unauthenticated redirect at the network boundary.
    // This is a defensive fallback for mid-session expiry.
    if (!currentUser) {
      const currentPath = `${window.location.pathname}${window.location.search}`
      window.location.replace(`/auth?redirect=${encodeURIComponent(currentPath)}`)
      return
    }

    if (currentUser.role === 'karigar') {
      const allowed = ['/karigar', '/orders']
      if (!allowed.some(r => pathname.startsWith(r))) {
        window.location.href = '/karigar'
      }
    }
  }, [isLoading, currentUser, pathname, isPublic])

  if (isLoading || (!isPublic && (!currentUser || !karigarAllowed))) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center
                          justify-center">
            <Image src="/icon.svg" alt="MeraDarzi" width={64} height={64} loading="eager" />
          </div>
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent
                          rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  return <>{children}</>
}
