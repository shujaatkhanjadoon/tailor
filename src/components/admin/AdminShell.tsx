// src/components/admin/AdminShell.tsx
'use client'

import { useRouter, usePathname } from 'next/navigation'
import {
  Scissors, LayoutDashboard, CreditCard,
  Store, BarChart2, ScrollText, LogOut,
  Shield,
} from 'lucide-react'
import { SessionTimer }  from './SessionTimer'
import { adminSession }  from '@/lib/admin/session'
import { cn }            from '@/lib/utils'

interface AdminShellProps {
  secret:   string
  children: React.ReactNode
}

export function AdminShell({ secret, children }: AdminShellProps) {
  const router   = useRouter()
  const pathname = usePathname()

  const base = `/admin/${secret}`

  const navItems = [
    { href: base,                label: 'Dashboard',   icon: LayoutDashboard },
    { href: `${base}/payments`,  label: 'Payments',    icon: CreditCard      },
    { href: `${base}/shops`,     label: 'All Shops',   icon: Store           },
    { href: `${base}/analytics`, label: 'Analytics',   icon: BarChart2       },
    { href: `${base}/logs`,      label: 'Audit Log',   icon: ScrollText      },
  ]

  const handleLogout = () => {
    adminSession.clear()
    router.replace('/')
  }

  return (
    <div className="min-h-screen bg-slate-950 flex">

      {/* ── Sidebar ── */}
      <aside className="w-60 shrink-0 bg-slate-900 border-r border-slate-800
                        flex flex-col fixed inset-y-0 z-20">

        {/* Logo */}
        <div className="px-5 py-5 border-b border-slate-800">
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
              <Scissors size={16} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-white text-sm">Darzi Manager</p>
              <p className="text-slate-500 text-[10px]">Super Admin</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 mt-3">
            <Shield size={10} className="text-green-500" />
            <span className="text-[10px] text-green-500 font-semibold">Secure Session</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(item => {
            const isActive = pathname === item.href ||
              (item.href !== base && pathname.startsWith(item.href))
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl',
                  'text-sm font-medium transition-colors text-left',
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                )}
              >
                <item.icon size={16} className="shrink-0" />
                {item.label}
              </button>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="px-3 py-4 border-t border-slate-800 space-y-2">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
                       text-sm font-medium text-red-400 hover:bg-red-900/30 transition-colors"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 ml-60 flex flex-col min-h-screen">

        {/* Top bar */}
        <header className="bg-slate-900 border-b border-slate-800 px-6 py-3
                           flex items-center justify-between sticky top-0 z-10">
          <p className="text-slate-400 text-sm font-mono">
            {pathname.replace(`/admin/${secret}`, '') || '/dashboard'}
          </p>
          <SessionTimer secret={secret} />
        </header>

        {/* Page content */}
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  )
}