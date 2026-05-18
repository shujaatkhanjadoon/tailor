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
} from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { SettingsRow } from "@/components/settings/SettingsRow";
import { DangerZone } from "@/components/settings/DangerZone";
import { cn } from "@/lib/utils";
import { Image } from "lucide-react";
import { usePlan } from "@/hooks/usePlan";
import { PLANS } from "@/lib/billing/plans";
import { supabase } from "@/lib/supabase/client";
import { shopOps } from "@/lib/db/operations";
import type { ShopRecord } from "@/lib/db/schema";

export default function SettingsPage() {
  const router = useRouter();
  const { currentUser, shopId, logout, isOwner } = useAuth();
  const myPlan = usePlan();

  const [memberCount, setMemberCount] = useState(0);
  const [orderCount, setOrderCount] = useState(0);
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [photoStats] = useState({ count: 0, totalKB: 0 });
  const [shop, setShop] = useState<ShopRecord | undefined>();

  const shopName = shop?.shopName ?? "";

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
          (supabase as any)
          .from("team_members")
          .select("id", { count: "exact", head: true })
          .eq("shop_id", shopId)
          .eq("is_active", true)
          .is("deleted_at", null),
          (supabase as any)
            .from("orders")
            .select("id", { count: "exact", head: true })
            .eq("shop_id", shopId)
            .is("deleted_at", null),
        ]);
        setMemberCount(members ?? 0);
        setOrderCount(orders ?? 0);
      }
    };
    load();
  }, [shopId]);

  const handleLogout = () => {
    logout();
    router.replace("/auth");
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 pb-20 lg:pb-8">
      {/* â”€â”€ HEADER â”€â”€ */}
      <header className="bg-white border-b border-slate-100 px-5 pt-12 lg:pt-6 pb-5">
        <h1 className="text-xl font-bold text-slate-800">Settings</h1>
        <p className="text-xs text-slate-400 mt-0.5">
          App aur account manage karein
        </p>
      </header>

      <div className="flex-1 px-4 pt-5 space-y-4">
        {/* â”€â”€ PROFILE CARD â”€â”€ */}
        <div className="bg-linear-to-br from-blue-700 to-blue-600 rounded-2xl p-5">
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 bg-white/20 rounded-full flex items-center
                            justify-center font-bold text-xl text-white border border-white/30"
            >
              {currentUser?.name?.charAt(0)?.toUpperCase() ?? "?"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-white text-base truncate">
                {currentUser?.name ?? "—"}
              </p>
              <p className="text-blue-200 text-xs mt-0.5">
                {currentUser?.phone}
              </p>
              <div className="flex items-center gap-2 mt-1.5">
                <span
                  className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded-full",
                    currentUser?.role === "owner"
                      ? "bg-white/25 text-white"
                      : "bg-green-400/30 text-green-100",
                  )}
                >
                  {currentUser?.role === "owner"
                    ? "⭐ Ustad / Owner"
                    : "✂️ Karigar"}
                </span>
                <span
                  className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1",
                    isOnline
                      ? "bg-green-400/30 text-green-100"
                      : "bg-slate-400/30 text-slate-200",
                  )}
                >
                  {isOnline ? (
                    <>
                      <Wifi size={9} /> Online
                    </>
                  ) : (
                    <>
                      <Wifi size={9} /> No connection
                    </>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Shop name */}
          <div className="mt-4 pt-4 border-t border-white/20 flex items-center gap-2">
            <Scissors size={14} className="text-blue-200" />
            <span className="text-blue-100 text-sm font-medium">
              {shopName}
            </span>
          </div>
        </div>

        {/* â”€â”€ DUKAAN (Shop) â€” owner only â”€â”€ */}
        {isOwner && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-4 pt-3 pb-2">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Dukaan Ki Maloomat
              </p>
            </div>
            <SettingsRow
              icon={Store}
              iconBg="bg-blue-100"
              iconColor="text-blue-600"
              label="Dukaan Edit Karein"
              sublabel={shopName || "Naam, sheher, WhatsApp"}
              onClick={() => router.push("/settings/shop")}
            />
            <SettingsRow
              icon={Users}
              iconBg="bg-green-100"
              iconColor="text-green-600"
              label="Hamare Karigar"
              sublabel="Add, remove, ya dekho"
              badge={String(memberCount)}
              onClick={() => router.push("/settings/team")}
              last
            />
          </div>
        )}

        {/* â”€â”€ ACCOUNT â”€â”€ */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-4 pt-3 pb-2">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Mera Account
            </p>
          </div>
          <SettingsRow
            icon={Lock}
            iconBg="bg-purple-100"
            iconColor="text-purple-600"
            label="PIN Badlein"
            sublabel={currentUser?.role === "karigar" ? "Apna 4-digit PIN change karein" : "Apna 6-digit PIN change karein"}
            onClick={() => router.push("/settings/change-pin")}
            last
          />
          <SettingsRow
            icon={CreditCard}
            iconBg="bg-blue-100"
            iconColor="text-blue-600"
            label="Billing & Plan"
            sublabel={`${PLANS[myPlan.plan].name} Â· ${myPlan.isTrial ? `Trial: ${myPlan.daysLeft} din baaki` : myPlan.isActive ? "Active" : "Expired"}`}
            badge={myPlan.isTrial ? "Trial" : undefined}
            onClick={() => router.push("/billing")}
          />
        </div>

        {/* â”€â”€ Photos Uploaded â”€â”€ */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-4 pt-3 pb-2">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Photos Uploaded
            </p>
          </div>
          <SettingsRow
            icon={Image}
            iconBg="bg-purple-100"
            iconColor="text-purple-600"
            label="Photos"
            sublabel={`${photoStats?.count ?? 0} photos stored`}
            value={
              photoStats
                ? photoStats.totalKB > 1024
                  ? `${(photoStats.totalKB / 1024).toFixed(1)} MB`
                  : `${photoStats.totalKB} KB`
                : "—”"
            }
            last
          />
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-4 pt-3 pb-2">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Data
            </p>
          </div>
          <SettingsRow
            icon={Wifi}
            iconBg={isOnline ? "bg-green-100" : "bg-slate-100"}
            iconColor={isOnline ? "text-green-600" : "text-slate-400"}
            label={isOnline ? "Connected to Supabase" : "No internet connection"}
            sublabel={
              isOnline
                ? "All app data is saved in Supabase"
                : "Internet wapas aane par app use karein"
            }
            value="Cloud"
            last
          />
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-4 pt-3 pb-2">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              App Info
            </p>
          </div>
          <SettingsRow
            icon={Info}
            iconBg="bg-slate-100"
            iconColor="text-slate-500"
            label="App Info"
            sublabel="Meradarzi"
            value={`${orderCount} orders`}
            last
          />
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-4 pt-3 pb-2">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              App Info
            </p>
          </div>
          <SettingsRow
            icon={Bell}
            iconBg="bg-amber-100"
            iconColor="text-amber-600"
            label="Notifications"
            sublabel="Due orders ki yaad dahi set karein"
            onClick={() => router.push("/settings/notifications")}
          />
        </div>
        {/* â”€â”€ DANGER ZONE â€” owner only â”€â”€ */}
        {isOwner && (
          <div className="bg-white rounded-2xl border border-red-200 overflow-hidden">
            <div className="px-4 pt-3 pb-2">
              <p className="text-[11px] font-bold text-red-400 uppercase tracking-wider">
                Danger Zone
              </p>
            </div>
            <DangerZone />
          </div>
        )}

        {/* â”€â”€ LOGOUT â”€â”€ */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          {!showLogoutConfirm ? (
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="w-full flex items-center gap-3 px-4 py-4 text-left
                         active:bg-slate-50 transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center">
                <LogOut size={17} className="text-red-600" />
              </div>
              <p className="text-sm font-semibold text-red-600">Logout</p>
            </button>
          ) : (
            <div className="px-4 py-4">
              <p className="text-sm font-semibold text-slate-700 mb-3">
                Kiya aap logout karna chahte hain?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 py-3 rounded-xl border-2 border-slate-200
                             text-slate-600 font-semibold text-sm"
                >
                  Nahi
                </button>
                <button
                  onClick={handleLogout}
                  className="flex-1 py-3 rounded-xl bg-red-600 text-white
                             font-semibold text-sm active:bg-red-700"
                >
                  Haan, Logout
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-400 pb-2">
          © {new Date().getFullYear()} Meradarzi • Made with ❤️ for Pakistan 🇵🇰
        </p>
      </div>

    </div>
  );
}
