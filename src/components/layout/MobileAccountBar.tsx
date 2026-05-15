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
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-slate-800">{currentUser?.name ?? 'User'}</p>
          <p className="truncate text-[11px] font-medium text-slate-400">
            {currentUser?.role === 'owner' ? 'Owner account' : 'Karigar account'}
          </p>
        </div>
        <button
          aria-label="Open user actions"
          onClick={() => setOpen(v => !v)}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white shadow-sm"
        >
          {open ? <X size={17} /> : initial}
        </button>
        <button
          aria-label="Logout"
          onClick={handleLogout}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-600"
        >
          <LogOut size={17} />
        </button>
      </div>

      {open && (
        <div className="border-t border-slate-100 py-2">
          <button
            onClick={() => go('/settings')}
            className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left active:bg-slate-50"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600">
              <UserRound size={16} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-800">{currentUser?.name ?? 'User'}</p>
              <p className="truncate text-xs text-slate-400">{currentUser?.phone}</p>
            </div>
          </button>
          <div className="mt-1 grid grid-cols-3 gap-2">
            {actions.map(({ href, icon: Icon, label }) => (
              <button
                key={href}
                onClick={() => go(href)}
                className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl bg-slate-50 px-2 py-2 text-center text-[11px] font-semibold text-slate-600 active:bg-slate-100"
              >
                <Icon size={16} />
                <span className="max-w-full truncate">{label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
