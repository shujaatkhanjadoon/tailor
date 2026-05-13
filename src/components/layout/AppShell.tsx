// src/components/layout/AppShell.tsx
'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { BottomNav } from './BottomNav';
import { SideNav } from './SideNav';
import { OfflineBanner } from './OfflineBanner';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { PWAInstallPrompt } from './PWAInstallPrompt';
import { useAuth } from '@/lib/auth/AuthContext';
import { syncService } from '@/lib/supabase/sync-service';
import { subscribeToShop } from '@/lib/supabase/realtime';
import { VerificationBanner } from './VerificationBanner';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { currentUser, shopId } = useAuth();
  const pathname = usePathname();
  const isKarigar = currentUser?.role === 'karigar';
  const isPlainRoute =
    pathname === '/' || pathname === '/auth' || pathname === '/login' || pathname === '/setup' ||
    pathname.startsWith('/track') || pathname.startsWith('/admin') || pathname.startsWith('/pricing') ||
    pathname.startsWith('/about') || pathname.startsWith('/privacy-policy') ||
    pathname.startsWith('/terms-of-service') || pathname.startsWith('/contact') ||
    pathname.startsWith('/terms-and-conditions') || pathname.startsWith('/refund-policy');

  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (cleanupRef.current) { cleanupRef.current(); cleanupRef.current = null; }
    if (!shopId || isPlainRoute) return;
    syncService.pushAll(shopId).catch(console.error);
    syncService.pullAll(shopId).catch(console.error);
    let rt: { unsubscribe: () => void } | null = null;
    try { rt = subscribeToShop(shopId, () => {}); } catch (e) { console.error(e); }
    const interval = setInterval(() => { if (navigator.onLine) syncService.pushAll(shopId).catch(console.error); }, 60_000);
    const onVisible = () => { if (document.visibilityState === 'visible' && navigator.onLine) { syncService.pushAll(shopId).catch(console.error); syncService.pullAll(shopId).catch(console.error); } };
    const onOnline = () => { console.log('[AppShell] Back online — syncing'); syncService.pushAll(shopId).catch(console.error); syncService.pullAll(shopId).catch(console.error); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    cleanupRef.current = () => { clearInterval(interval); document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('online', onOnline); rt?.unsubscribe(); };
    return () => { if (cleanupRef.current) { cleanupRef.current(); cleanupRef.current = null; } };
  }, [shopId, isPlainRoute]);

  if (isPlainRoute) return <>{children}</>;

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-slate-100">
        {!isKarigar && (
          <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 lg:z-40">
            <SideNav />
          </aside>
        )}
        <div className={`flex-1 ${!isKarigar ? 'lg:pl-64' : ''}`}>
          {/* Mobile layout - added overflow-x-hidden for safety */}
          <div className="lg:hidden min-h-screen max-w-107.5 mx-auto bg-white shadow-xl relative overflow-x-hidden">
            <VerificationBanner />
            <OfflineBanner />
            {children}
            {!isKarigar && <BottomNav />}
          </div>
          {/* Desktop layout - unchanged */}
          <div className="hidden lg:block min-h-screen bg-white">
            <VerificationBanner />
            <OfflineBanner />
            <div className="max-w-6xl mx-auto px-8 py-8">{children}</div>
          </div>
        </div>
      </div>
      <PWAInstallPrompt />
    </AuthGuard>
  );
}