// src/components/layout/SideNav.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Home, ClipboardList, Users, Wallet,
  Settings, Scissors, Plus, BarChart3,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { db } from '@/lib/db/schema'
import { useAuth } from '@/lib/auth/AuthContext'

const navItems = [
  { href: '/dashboard', icon: Home,          label: 'Dashboard'  },
  { href: '/orders',    icon: ClipboardList, label: 'Orders'     },
  { href: '/customers', icon: Users,         label: 'Gahak'      },
  { href: '/payments',  icon: Wallet,        label: 'Payments'   },
  { href: '/reports',   icon: BarChart3,     label: 'Reports'  },
  { href: '/settings',  icon: Settings,      label: 'Settings'   },
]

export function SideNav() {
  const pathname = usePathname()
  const { shopId } = useAuth()
  const shop = useLiveQuery(
    async () => shopId ? db.shop.get(shopId) : undefined,
    [shopId]
  )

  return (
    <div className="flex flex-col h-full bg-slate-900 text-white">

      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-6 border-b border-slate-700">
        <div className="w-9 h-9 bg-blue-500 rounded-xl flex items-center justify-center shrink-0">
          <Scissors size={18} className="text-white" strokeWidth={2} />
        </div>
        <div>
          <p className="font-bold text-sm leading-tight">{shop?.shopName ?? 'DarziHub'}</p>
          <p className="text-slate-400 text-[11px]">Tailor App</p>
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
          const isActive = pathname === href || (href === '/dashboard' && pathname === '/dashboard')
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

      {/* Bottom: version */}
      <div className="px-5 py-4 border-t border-slate-700">
        <p className="text-slate-500 text-[11px]">v0.1.0 — Beta</p>
      </div>
    </div>
  )
}
