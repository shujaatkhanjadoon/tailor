// src/components/layout/BottomNav.tsx
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ClipboardList, Users, Wallet, Settings, BarChart3 } from 'lucide-react';

const navItems = [
  { href: '/', icon: Home, label: 'Ghar' },
  { href: '/orders', icon: ClipboardList, label: 'Orders' },
  { href: '/customers', icon: Users, label: 'Gahak' },
  { href: '/payments', icon: Wallet, label: 'Raseed' },
  { href: '/reports', icon: BarChart3, label: 'Reports' },
  { href: '/settings', icon: Settings, label: 'Settings' },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 w-full bg-white/95 border-t border-slate-200 backdrop-blur lg:hidden pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto grid h-16 max-w-3xl grid-cols-6">
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href;
          return (
            <Link key={href} href={href} className={`relative flex h-full min-w-0 flex-col items-center justify-center gap-1 px-1 transition-colors ${isActive ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}>
              <Icon size={21} strokeWidth={isActive ? 2.5 : 1.8} className={isActive ? 'text-blue-600' : 'text-slate-400'} />
              <span className={`max-w-full truncate text-[9.5px] font-medium leading-none sm:text-[10px] ${isActive ? 'text-blue-600' : 'text-slate-400'}`}>{label}</span>
              {isActive && <span className="absolute bottom-1 size-1 rounded-full bg-blue-600" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
