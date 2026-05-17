// src/components/layout/SideNav.tsx
'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Home, ClipboardList, Users, Wallet,
  Settings, Plus, BarChart3, LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { db } from '@/lib/db/schema'
import { useAuth } from '@/lib/auth/AuthContext'
import Image from 'next/image'
import { usePlan } from '@/hooks/usePlan'

const navItems = [
  { href: '/', icon: Home, label: 'Dashboard' },
  { href: '/orders', icon: ClipboardList, label: 'Orders' },
  { href: '/customers', icon: Users, label: 'Gahak' },
  { href: '/payments', icon: Wallet, label: 'Payments' },
  { href: '/reports', icon: BarChart3, label: 'Reports' },
  { href: '/settings', icon: Settings, label: 'Settings' },
]

export function SideNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { shopId, currentUser, logout } = useAuth()
  const plan = usePlan()
  const shop = useLiveQuery(
    async () => shopId ? db.shop.get(shopId) : undefined,
    [shopId]
  )
  const userInitials = (currentUser?.name ?? 'User')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part.charAt(0).toUpperCase())
    .join('') || '?'
  const showShopLogo = plan.plan === 'business' && plan.isActive && !!shop?.brandLogoUrl

  const handleLogout = () => {
    logout()
    router.replace('/auth')
  }

  return (
    <div className="flex flex-col h-full bg-slate-900 text-white">

      {/* Logo */}
      <div className="flex items-center px-5 py-6 border-b border-slate-700">
        <div className="flex items-center justify-center shrink-0">
          <Link href="/">
            <Image
              src="/logo.png"
              alt="Meradarzi Logo"
              width={150}
              height={25}
            />
          </Link>
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
      <div className="border-t border-slate-800 p-3">
        <Link
          href="/settings"
          className="group flex min-w-0 items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/40 p-3 transition-colors hover:border-slate-700 hover:bg-slate-800/70"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-blue-600 text-sm font-bold text-white shadow-sm shadow-blue-950/40">
            {showShopLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shop.brandLogoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              userInitials
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{currentUser?.name ?? 'User'}</p>
            <p className="mt-0.5 truncate text-[11px] font-medium text-slate-400">
              {currentUser?.role === 'owner' ? 'Owner' : 'Karigar'}
            </p>
          </div>
          <Settings size={16} className="text-slate-500 transition-colors group-hover:text-slate-300" />
        </Link>
        <button
          onClick={handleLogout}
          className="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 transition-colors hover:bg-red-500/10 hover:text-red-200"
        >
          <LogOut size={14} />
          Logout
        </button>
      </div>
    </div>
  )
}
