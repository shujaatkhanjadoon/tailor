// src/components/layout/BottomNav.tsx
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ClipboardList, Users, Wallet, Settings, BarChart3 } from 'lucide-react';

const navItems = [
  { href: '/dashboard', icon: Home, label: 'Ghar' },
  { href: '/orders', icon: ClipboardList, label: 'Orders' },
  { href: '/customers', icon: Users, label: 'Gahak' },
  { href: '/payments', icon: Wallet, label: 'Raseed' },
  { href: '/reports', icon: BarChart3, label: 'Reports' },
  { href: '/settings', icon: Settings, label: 'Settings' },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-107.5 bg-white border-t border-slate-200 z-50 lg:hidden pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around h-16">
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href || (href === '/dashboard' && pathname === '/dashboard');
          return (
            <Link key={href} href={href} className={`flex flex-col items-center justify-center gap-0.5 w-full h-full transition-colors ${isActive ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}>
              <Icon size={22} strokeWidth={isActive ? 2.5 : 1.8} className={isActive ? 'text-blue-600' : 'text-slate-400'} />
              <span className={`text-[10px] font-medium leading-none ${isActive ? 'text-blue-600' : 'text-slate-400'}`}>{label}</span>
              {isActive && <span className="absolute bottom-1 w-1 h-1 bg-blue-600 rounded-full" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}