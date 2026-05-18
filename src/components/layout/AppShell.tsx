// src/components/layout/AppShell.tsx
'use client';

import { usePathname } from 'next/navigation';
import { BottomNav } from './BottomNav';
import { SideNav } from './SideNav';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { PWAInstallPrompt } from './PWAInstallPrompt';
import { useAuth } from '@/lib/auth/AuthContext';
import { VerificationBanner } from './VerificationBanner';
import { MobileAccountBar } from './MobileAccountBar';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  const pathname = usePathname();
  const isKarigar = currentUser?.role === 'karigar';
  const isPlainRoute =
    pathname === '/auth' || pathname === '/login' || pathname === '/setup' ||
    pathname.startsWith('/track') || pathname.startsWith('/admin') || pathname.startsWith('/pricing') ||
    pathname.startsWith('/about') || pathname.startsWith('/privacy-policy') ||
    pathname.startsWith('/terms-of-service') || pathname.startsWith('/contact') ||
    pathname.startsWith('/terms-and-conditions') || pathname.startsWith('/refund-policy');

  if (isPlainRoute) return <>{children}</>;

  return (
    <AuthGuard>
      <div className="flex min-h-dvh overflow-x-clip bg-slate-100">
        {!isKarigar && (
          <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 lg:z-40">
            <SideNav />
          </aside>
        )}
        <div className={`min-w-0 flex-1 ${!isKarigar ? 'lg:pl-64' : ''}`}>
          <div className="min-h-dvh bg-white shadow-xl lg:hidden relative overflow-x-clip">
            <MobileAccountBar />
            <VerificationBanner />
            {children}
            {!isKarigar && <BottomNav />}
          </div>
          <div className="hidden min-h-dvh bg-white lg:block">
            <VerificationBanner />
            <div className="mx-auto w-full max-w-screen-2xl px-6 py-8 xl:px-8 2xl:px-10">{children}</div>
          </div>
        </div>
      </div>
      <PWAInstallPrompt />
    </AuthGuard>
  );
}
