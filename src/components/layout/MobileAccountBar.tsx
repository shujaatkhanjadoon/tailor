'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CreditCard, Lock, LogOut, Settings, X } from 'lucide-react'
import { useAuth } from '@/lib/auth/AuthContext'
import Image from 'next/image'
import Link from 'next/link'
import type { ShopRecord } from '@/lib/db/schema'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { shopOps } from '@/lib/db/operations'

const actions = [
  { href: '/settings',             icon: Settings,   label: 'Settings' },
  { href: '/settings/change-pin',  icon: Lock,       label: 'PIN Badlein' },
  { href: '/billing',              icon: CreditCard, label: 'Billing' },
]

export function MobileAccountBar() {
  const router = useRouter()
  const { currentUser, logout, shopId } = useAuth()
  const [open, setOpen] = useState(false)
  const [shop, setShop] = useState<ShopRecord | undefined>()
  useEffect(() => {
    if (!shopId) return
    shopOps.get(shopId).then(setShop).catch(() => setShop(undefined))
  }, [shopId])
  const initials = (currentUser?.name ?? 'User')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part.charAt(0).toUpperCase())
    .join('') || '?'
  const showShopLogo = !!shop?.brandLogoUrl
  const visibleActions = currentUser?.role === 'karigar'
    ? []
    : actions

  const go = (href: string) => {
    setOpen(false)
    router.push(href)
  }

  const handleLogout = async () => {
    await logout()
    setOpen(false)
    router.replace('/auth')
  }

  return (
    <div className="sticky top-0 z-40 border-b border-slate-200 bg-slate-900 px-4 pt-[env(safe-area-inset-top)] backdrop-blur lg:hidden">
      <div className="flex h-14 items-center justify-between gap-3">
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
        <div className="flex items-center gap-2">
          <NotificationBell />
          <button
            aria-label="Open user actions"
            onClick={() => setOpen(v => !v)}
            className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-blue-600 text-sm font-bold text-white shadow-sm shadow-blue-100"
          >
            {open ? (
              <X size={17} />
            ) : showShopLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shop.brandLogoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              initials
            )}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-slate-100 py-3">
          <button
            onClick={() => currentUser?.role === 'karigar' ? go('/karigar') : go('/settings')}
            className="flex w-full items-center gap-3 rounded-2xl bg-slate-50 p-3 text-left active:bg-slate-100"
          >
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-white text-sm font-bold text-slate-600 shadow-sm">
              {showShopLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={shop.brandLogoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-800">
                {/* {shop?.brandName || shop?.shopName ? `${shop?.brandName || shop?.shopName} · ` : ''} */}
                {currentUser?.name ?? 'User'}
              </p>
              <p className="truncate text-xs text-slate-400">{currentUser?.phone}</p>
            </div>
            <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              {currentUser?.role === 'owner' ? 'Owner' : 'Karigar'}
            </span>
          </button>
          {visibleActions.length > 0 && (
          <div className="mt-2 grid grid-cols-3 gap-2">
            {visibleActions.map(({ href, icon: Icon, label }) => (
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
          )}
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
