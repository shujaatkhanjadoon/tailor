// src/components/layout/BottomNav.tsx
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ClipboardList, Users, Wallet, Settings, BarChart3, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const navItems = [
  { href: '/', icon: Home, key: 'home' },
  { href: '/orders', icon: ClipboardList, key: 'orders' },
  { href: '/customers', icon: Users, key: 'customers' },
  { href: '/payments', icon: Wallet, key: 'payments' },
  { href: '/reports', icon: BarChart3, key: 'reports' },
  { href: '/trash', icon: Trash2, key: 'trash' },
  { href: '/settings', icon: Settings, key: 'settings' },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const { t } = useTranslation();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 w-full bg-white/95 border-t border-slate-200 backdrop-blur lg:hidden pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto grid h-16 max-w-3xl grid-cols-7">
        {navItems.map(({ href, icon: Icon, key }) => {
          const isActive = pathname === href;
          return (
            <Link key={href} href={href} className={`relative flex h-full min-w-0 flex-col items-center justify-center gap-1 px-1 transition-colors ${isActive ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}>
              <Icon size={21} strokeWidth={isActive ? 2.5 : 1.8} className={isActive ? 'text-blue-600' : 'text-slate-400'} />
              <span className={`max-w-full truncate text-[9.5px] font-medium leading-none sm:text-[10px] ${isActive ? 'text-blue-600' : 'text-slate-400'}`}>{t(`navMobile.${key}`)}</span>
              {isActive && <span className="absolute bottom-1 size-1 rounded-full bg-blue-600" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
