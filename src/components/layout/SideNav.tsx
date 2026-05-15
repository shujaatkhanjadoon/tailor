// src/components/layout/SideNav.tsx
'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Home, ClipboardList, Users, Wallet,
  Settings, Plus, BarChart3, LogOut, UserRound,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { db } from '@/lib/db/schema'
import { useAuth } from '@/lib/auth/AuthContext'

const navItems = [
  { href: '/',          icon: Home,          label: 'Dashboard'  },
  { href: '/orders',    icon: ClipboardList, label: 'Orders'     },
  { href: '/customers', icon: Users,         label: 'Gahak'      },
  { href: '/payments',  icon: Wallet,        label: 'Payments'   },
  { href: '/reports',   icon: BarChart3,     label: 'Reports'  },
  { href: '/settings',  icon: Settings,      label: 'Settings'   },
]

export function SideNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { shopId, currentUser, logout } = useAuth()
  const shop = useLiveQuery(
    async () => shopId ? db.shop.get(shopId) : undefined,
    [shopId]
  )
  const userInitial = currentUser?.name?.charAt(0)?.toUpperCase() ?? '?'

  const handleLogout = () => {
    logout()
    router.replace('/auth')
  }

  return (
    <div className="flex flex-col h-full bg-slate-900 text-white">

      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-6 border-b border-slate-700">
        <div className="w-10 h-10 overflow-hidden rounded-xl bg-white flex items-center justify-center shrink-0">
          <img src="/logo.png" alt="DarziHub logo" className="h-full w-full object-cover" />
        </div>
        <div className="min-w-0">
          <p className="font-bold text-sm leading-tight">{shop?.shopName ?? 'DarziHub'}</p>
        </div>
      </div>

      {/* Quick action button */}
      <div className="px-4 py-4">
        <Link
          href="/orders/new"
          className="flex items-center justify-center gap-2 w-full bg-blue-600
                     hover:bg-blue-500 text-white text-sm font-semibold py-2.5 
                     rounded-xl transition-colors"
        >
          <Plus size={16} strokeWidth={2.5} />
          Naya Order
        </Link>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 space-y-1">
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              )}
            >
              <Icon size={18} strokeWidth={isActive ? 2.5 : 1.8} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Account */}
      <div className="border-t border-slate-700 px-4 py-4">
        <Link
          href="/settings"
          className="flex min-w-0 items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-slate-800"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
            {userInitial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{currentUser?.name ?? 'User'}</p>
            <p className="truncate text-[11px] text-slate-400">
              {currentUser?.role === 'owner' ? 'Owner' : 'Karigar'}
            </p>
          </div>
          <UserRound size={16} className="text-slate-400" />
        </Link>
        <button
          onClick={handleLogout}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-red-200 transition-colors hover:bg-red-500/10 hover:text-red-100"
        >
          <LogOut size={14} />
          Logout
        </button>
        <p className="mt-3 text-center text-[11px] text-slate-500">v0.1.0 Beta</p>
      </div>
    </div>
  )
}
