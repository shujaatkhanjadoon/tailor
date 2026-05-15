'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CreditCard, Lock, LogOut, Settings, UserRound, X } from 'lucide-react'
import { useAuth } from '@/lib/auth/AuthContext'

const actions = [
  { href: '/settings',             icon: Settings,   label: 'Settings' },
  { href: '/settings/change-pin',  icon: Lock,       label: 'PIN Badlein' },
  { href: '/billing',              icon: CreditCard, label: 'Billing' },
]

export function MobileAccountBar() {
  const router = useRouter()
  const { currentUser, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const initial = currentUser?.name?.charAt(0)?.toUpperCase() ?? '?'

  const go = (href: string) => {
    setOpen(false)
    router.push(href)
  }

  const handleLogout = () => {
    logout()
    setOpen(false)
    router.replace('/auth')
  }

  return (
    <div className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 px-4 pt-[env(safe-area-inset-top)] backdrop-blur lg:hidden">
      <div className="flex h-14 items-center gap-3">
        <div className="h-9 w-9 shrink-0 overflow-hidden rounded-xl bg-slate-100">
          <img src="/logo.png" alt="DarziHub logo" className="h-full w-full object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-slate-800">{currentUser?.name ?? 'User'}</p>
          <p className="truncate text-[11px] font-medium text-slate-400">
            {currentUser?.role === 'owner' ? 'Owner account' : 'Karigar account'}
          </p>
        </div>
        <button
          aria-label="Open user actions"
          onClick={() => setOpen(v => !v)}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-sm font-bold text-white shadow-sm shadow-blue-100"
        >
          {open ? <X size={17} /> : initial}
        </button>
      </div>

      {open && (
        <div className="border-t border-slate-100 py-3">
          <button
            onClick={() => go('/settings')}
            className="flex w-full items-center gap-3 rounded-2xl bg-slate-50 p-3 text-left active:bg-slate-100"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm">
              <UserRound size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-800">{currentUser?.name ?? 'User'}</p>
              <p className="truncate text-xs text-slate-400">{currentUser?.phone}</p>
            </div>
            <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              {currentUser?.role === 'owner' ? 'Owner' : 'Karigar'}
            </span>
          </button>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {actions.map(({ href, icon: Icon, label }) => (
              <button
                key={href}
                onClick={() => go(href)}
                className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-2 py-2 text-center text-[11px] font-semibold text-slate-600 active:bg-slate-50"
              >
                <Icon size={16} />
                <span className="max-w-full truncate">{label}</span>
              </button>
            ))}
          </div>
          <button
            onClick={handleLogout}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-red-50 px-3 py-3 text-sm font-semibold text-red-600 active:bg-red-100"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      )}
    </div>
  )
}
