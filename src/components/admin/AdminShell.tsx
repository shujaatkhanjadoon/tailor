// src/components/admin/AdminShell.tsx
'use client'

import { useState, useEffect, useCallback, ReactNode } from 'react'
import { useRouter, usePathname }  from 'next/navigation'
import {
  Scissors, LayoutDashboard, CreditCard,
  Store, BarChart2, ScrollText, LogOut,
  Shield, Menu, X, ChevronRight, Bell,
} from 'lucide-react'
import { SessionTimer } from './SessionTimer'
import { cn }           from '@/lib/utils'
import Image from 'next/image'

const NAV_ITEMS = [
  { href: '/admin/dashboard',           label: 'Dashboard',  icon: LayoutDashboard },
  { href: '/admin/dashboard/payments',  label: 'Payments',   icon: CreditCard      },
  { href: '/admin/dashboard/shops',     label: 'All Shops',  icon: Store           },
  { href: '/admin/dashboard/notifications', label: 'Notify', icon: Bell            },
  { href: '/admin/dashboard/analytics', label: 'Analytics',  icon: BarChart2       },
  { href: '/admin/dashboard/logs',      label: 'Audit Log',  icon: ScrollText      },
]

export function AdminShell({ children }: { children: ReactNode }) {
  const router        = useRouter()
  const pathname      = usePathname()
  const [sideOpen, setSideOpen] = useState(false)

  const handleLogout = useCallback(async () => {
    await fetch('/api/admin/logout', { method: 'POST' })
    window.location.href = '/admin/login'
  }, [])

  // Close sidebar on route change (mobile)
  useEffect(() => { setSideOpen(false) }, [pathname])

  const NavContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 flex items-center
                          justify-center shrink-0">
            <Image
            src="/icon.svg"
            alt="MeraDarzi"
            width={32}
            height={32} 
            />
          </div>
          <div>
            <p className="font-bold text-white text-sm leading-tight">MeraDarzi</p>
            <p className="text-slate-500 text-[10px]">Super Admin</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 mt-3">
          <Shield size={10} className="text-green-500" />
          <span className="text-[10px] text-green-500 font-semibold">Secure Session</span>
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(item => {
          const isActive = pathname === item.href ||
            (item.href !== '/admin/dashboard' && pathname.startsWith(item.href))
          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-3 rounded-xl',
                'text-sm font-medium transition-colors text-left',
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              )}
            >
              <item.icon size={16} className="shrink-0" />
              {item.label}
              {isActive && <ChevronRight size={13} className="ml-auto opacity-60" />}
            </button>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-slate-800 shrink-0">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-3 rounded-xl
                     text-sm font-medium text-red-400 hover:bg-red-900/30
                     transition-colors"
        >
          <LogOut size={16} />
          Logout
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-950 flex">

      {/* â”€â”€ Desktop sidebar â”€â”€ */}
      <aside className="hidden lg:flex flex-col w-60 shrink-0
                        bg-slate-900 border-r border-slate-800 fixed inset-y-0 z-30">
        <NavContent />
      </aside>

      {/* â”€â”€ Mobile sidebar overlay â”€â”€ */}
      {sideOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          onClick={() => setSideOpen(false)}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        </div>
      )}

      {/* â”€â”€ Mobile sidebar drawer â”€â”€ */}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 border-r border-slate-800',
        'transform transition-transform duration-300 ease-in-out lg:hidden',
        sideOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        {/* Close button */}
        <button
          onClick={() => setSideOpen(false)}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center
                     rounded-full bg-slate-800 text-slate-400"
        >
          <X size={16} />
        </button>
        <NavContent />
      </aside>

      {/* â”€â”€ Main content area â”€â”€ */}
      <div className="flex-1 lg:ml-60 flex min-w-0 flex-col min-h-screen">

        {/* Top bar */}
        <header className="bg-slate-900 border-b border-slate-800 px-4 lg:px-6 py-3
                           flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            {/* Mobile menu button */}
            <button
              onClick={() => setSideOpen(true)}
              className="lg:hidden w-9 h-9 flex items-center justify-center
                         rounded-xl bg-slate-800 text-slate-400"
            >
              <Menu size={18} />
            </button>

            {/* Breadcrumb */}
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500">
              <span>Admin</span>
              <ChevronRight size={12} />
              <span className="text-slate-300 font-medium capitalize">
                {pathname.split('/').pop() ?? 'Dashboard'}
              </span>
            </div>
          </div>

          <SessionTimer onExpired={() => window.location.href = '/admin/login'} />
        </header>

        {/* Page content */}
        <main className="flex-1 w-full min-w-0 overflow-x-hidden p-3 pb-24 sm:p-4 lg:p-6">
          {children}
        </main>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900 border-t border-slate-800 lg:hidden">
        <div className="grid grid-cols-6 h-16">
          {NAV_ITEMS.map(item => {
            const isActive = pathname === item.href ||
              (item.href !== '/admin/dashboard' && pathname.startsWith(item.href))
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 text-[10px] font-medium',
                  isActive ? 'text-blue-400' : 'text-slate-500'
                )}
              >
                <item.icon size={19} strokeWidth={isActive ? 2.5 : 1.8} />
                <span className="max-w-full truncate leading-none">{item.label.replace('All ', '').replace('Audit ', '')}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
