"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Store,
  Users,
  Lock,
  LogOut,
  Info,
  Wifi,
  Bell,
  Scissors,
  CreditCard,
  Globe,
} from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { SettingsRow } from "@/components/settings/SettingsRow";
import { DangerZone } from "@/components/settings/DangerZone";
import { cn } from "@/lib/utils";
import NextImage from "next/image";
import { usePlan } from "@/hooks/usePlan";
import { PLANS } from "@/lib/billing/plans";
import { supabase } from "@/lib/supabase/client";
import { shopOps } from "@/lib/db/operations";
import type { ShopRecord } from "@/lib/db/schema";
import { useTranslation } from "react-i18next";
import { useLocale } from "@/lib/i18n/LocaleContext";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";

export default function SettingsPage() {
  const router = useRouter();
  const { currentUser, shopId, logout, isOwner } = useAuth();
  const myPlan = usePlan();
  const { t } = useTranslation();
  const { locale, setLocale } = useLocale();

  const [memberCount, setMemberCount] = useState(0);
  const [orderCount, setOrderCount] = useState(0);
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [photoStats] = useState({ count: 0, totalKB: 0 });
  const [shop, setShop] = useState<ShopRecord | undefined>();

  const shopName = shop?.shopName ?? "";
  const initials = (currentUser?.name ?? "User")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part.charAt(0).toUpperCase())
    .join("") || "?";

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    const load = async () => {
      if (shopId) {
        shopOps.get(shopId).then(setShop).catch(() => setShop(undefined));
        const [{ count: members }, { count: orders }] = await Promise.all([
          supabase.from("team_members").select("id", { count: "exact" })
            .eq("shop_id", shopId).eq("is_active", true).is("deleted_at", null),
          supabase.from("orders").select("id", { count: "exact" })
            .eq("shop_id", shopId).is("deleted_at", null),
        ]);
        setMemberCount(members ?? 0);
        setOrderCount(orders ?? 0);
      }
    };
    load();
  }, [shopId]);

  const handleLogout = async () => {
    await logout();
    router.replace("/auth");
  };

  const toggleLanguage = () => {
    setLocale(locale === 'ur' ? 'en' : 'ur');
  };

  return (
    <ErrorBoundary>
    <div className="flex flex-col min-h-screen bg-slate-50 pb-20 lg:pb-8">
      <header className="bg-white border-b border-slate-100 px-5 pt-2 lg:pt-0 pb-5">
        <h1 className="text-xl font-bold text-slate-800">{t('settings.title')}</h1>
        <p className="text-xs text-slate-400 mt-0.5">{t('settings.subtitle')}</p>
      </header>

      <div className="flex-1 px-4 pt-5 space-y-4">
        {/* PROFILE CARD */}
        <div className="bg-linear-to-br from-blue-700 to-blue-600 rounded-2xl p-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center overflow-hidden font-bold text-xl text-white border border-white/30">
              {shop?.brandLogoUrl ? (
                <NextImage src={shop.brandLogoUrl} alt="" width={56} height={56} className="h-full w-full object-cover" />
              ) : (initials)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-white text-base truncate">{currentUser?.name ?? "—"}</p>
              <p className="text-blue-200 text-xs mt-0.5">{currentUser?.phone}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full",
                  currentUser?.role === "owner" ? "bg-white/25 text-white" : "bg-green-400/30 text-green-100")}>
                  {currentUser?.role === "owner" ? t('settings.profile.roleOwner') : t('settings.profile.roleKarigar')}
                </span>
                <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1",
                  isOnline ? "bg-green-400/30 text-green-100" : "bg-slate-400/30 text-slate-200")}>
                  <Wifi size={9} />
                  {isOnline ? t('settings.profile.online') : t('settings.profile.offline')}
                </span>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-white/20 flex items-center gap-2">
            <Scissors size={14} className="text-blue-200" />
            <span className="text-blue-100 text-sm font-medium">{shopName}</span>
          </div>
        </div>

        {/* LANGUAGE TOGGLE */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <SettingsRow
            icon={Globe}
            iconBg="bg-indigo-100"
            iconColor="text-indigo-600"
            label={t('settings.language')}
            sublabel={t('settings.languageDesc')}
            value={t('settings.languageValue')}
            onClick={toggleLanguage}
          />
        </div>

        {/* SHOP - owner only */}
        {isOwner && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-4 pt-3 pb-2">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t('settings.shop.section')}</p>
            </div>
            <SettingsRow icon={Store} iconBg="bg-blue-100" iconColor="text-blue-600"
              label={t('settings.shop.editShop')} sublabel={t('settings.shop.editShopDesc')}
              onClick={() => router.push("/settings/shop")} />
            <SettingsRow icon={Users} iconBg="bg-green-100" iconColor="text-green-600"
              label={t('settings.shop.team')} sublabel={t('settings.shop.teamDesc')}
              badge={String(memberCount)} onClick={() => router.push("/settings/team")} last />
          </div>
        )}

        {/* ACCOUNT */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-4 pt-3 pb-2">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t('settings.account.section')}</p>
          </div>
          <SettingsRow icon={Lock} iconBg="bg-purple-100" iconColor="text-purple-600"
            label={t('settings.account.changePin')}
            sublabel={currentUser?.role === "karigar" ? t('settings.account.changePinKarigar') : t('settings.account.changePinOwner')}
            onClick={() => router.push("/settings/change-pin")} />
          <SettingsRow icon={CreditCard} iconBg="bg-blue-100" iconColor="text-blue-600"
            label={t('settings.account.billing')}
            sublabel={`${PLANS[myPlan.plan].name} · ${myPlan.isTrial ? `Trial: ${myPlan.daysLeft} ${t('billing.days')}` : myPlan.isActive ? t('billing.active') : t('billing.expired')}`}
            badge={myPlan.isTrial ? t('billing.trial') : undefined}
            onClick={() => router.push("/billing")} last />
        </div>

        {/* PHOTOS */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-4 pt-3 pb-2">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t('settings.photoSection')}</p>
          </div>
          <SettingsRow icon={Info} iconBg="bg-purple-100" iconColor="text-purple-600"
            label="Photos"
            sublabel={t('settings.photosStored', { count: photoStats?.count ?? 0 })}
            value={photoStats ? (photoStats.totalKB > 1024 ? `${(photoStats.totalKB / 1024).toFixed(1)} MB` : `${photoStats.totalKB} KB`) : "—"}
            last />
        </div>

        {/* DATA */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-4 pt-3 pb-2">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t('settings.dataSection')}</p>
          </div>
          <SettingsRow icon={Wifi} iconBg={isOnline ? "bg-green-100" : "bg-slate-100"}
            iconColor={isOnline ? "text-green-600" : "text-slate-400"}
            label={isOnline ? t('settings.connectionStatus') : t('settings.connectionStatusOff')}
            sublabel={isOnline ? t('settings.dataSaved') : t('settings.dataSavedOff')}
            value={t('settings.account.cloud')} last />
        </div>

        {/* APP INFO */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-4 pt-3 pb-2">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t('settings.appInfoSection')}</p>
          </div>
          <SettingsRow icon={Info} iconBg="bg-slate-100" iconColor="text-slate-500"
            label={t('settings.appInfo')} sublabel={t('settings.appInfoDesc')}
            value={t('settings.ordersCount', { count: orderCount })} last />
        </div>

        {/* NOTIFICATIONS */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-4 pt-3 pb-2">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t('settings.notificationsSection')}</p>
          </div>
          <SettingsRow icon={Bell} iconBg="bg-amber-100" iconColor="text-amber-600"
            label={t('settings.account.notifications')} sublabel={t('settings.notificationsDesc')}
            onClick={() => router.push("/settings/notifications")} last />
        </div>

        {/* DANGER ZONE - owner only */}
        {isOwner && (
          <div className="bg-white rounded-2xl border border-red-200 overflow-hidden">
            <div className="px-4 pt-3 pb-2">
              <p className="text-[11px] font-bold text-red-400 uppercase tracking-wider">{t('settings.danger.section')}</p>
            </div>
            <DangerZone />
          </div>
        )}

        {/* LOGOUT */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          {!showLogoutConfirm ? (
            <button onClick={() => setShowLogoutConfirm(true)}
              className="w-full flex items-center gap-3 px-4 py-4 text-left active:bg-slate-50 transition-colors">
              <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center">
                <LogOut size={17} className="text-red-600" />
              </div>
              <p className="text-sm font-semibold text-red-600">{t('settings.logout.button')}</p>
            </button>
          ) : (
            <div className="px-4 py-4">
              <p className="text-sm font-semibold text-slate-700 mb-3">{t('settings.logout.confirm')}</p>
              <div className="flex gap-2">
                <button onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 py-3 rounded-xl border-2 border-slate-200 text-slate-600 font-semibold text-sm">
                  {t('settings.logout.no')}
                </button>
                <button onClick={handleLogout}
                  className="flex-1 py-3 rounded-xl bg-red-600 text-white font-semibold text-sm active:bg-red-700">
                  {t('settings.logout.yes')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-400 pb-2">
          {t('settings.footer', { year: new Date().getFullYear() })}
        </p>
      </div>
    </div>
    </ErrorBoundary>
  );
}
