// src/components/auth/AuthGuard.tsx
'use client'

import { useEffect, ReactNode }       from 'react'
import { usePathname }                from 'next/navigation'
import { useAuth }                    from '@/lib/auth/AuthContext'
import { Scissors }                   from 'lucide-react'

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

  useEffect(() => {
    if (isLoading) return

    const isPublic    = isPublicPath(pathname)
    const isMarketing = pathname === '/'
    if (isMarketing || isPublic) return

    if (!currentUser) {
      // Full page navigation avoids RSC conflict
      const currentPath = `${window.location.pathname}${window.location.search}`
      window.location.replace(`/auth?redirect=${encodeURIComponent(currentPath)}`)
      return
    }

    if (currentUser.role === 'karigar') {
      const allowed = ['/karigar', '/orders', '/settings']
      if (!allowed.some(r => pathname.startsWith(r))) {
        window.location.href = '/karigar'
      }
    }
  }, [isLoading, currentUser, pathname])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center
                          justify-center shadow-lg">
            <Scissors size={24} className="text-white" strokeWidth={1.5} />
          </div>
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent
                          rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  return <>{children}</>
}
