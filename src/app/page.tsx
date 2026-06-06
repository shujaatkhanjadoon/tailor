// src/app/page.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { DashboardSkeleton } from '@/components/ui/Skeleton'
import {
  ClipboardList,
  CheckCircle2,
  AlertCircle,
  Wallet,
  Plus,
  UserPlus,
  TrendingUp,
} from "lucide-react";

import { StatsCard } from "@/components/dashboard/StatsCard";
import { DueOrdersAlert } from "@/components/dashboard/DueOrdersAlert";
import { RecentOrderCard } from "@/components/dashboard/RecentOrderCard";
import { useAuth } from "@/lib/auth/AuthContext";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { AdminDashboardNotifications } from "@/components/notifications/AdminDashboardNotifications";
import { NotificationPermissionCard } from "@/components/notifications/NotificationPermissionCard";
import { PlanBadge } from "@/components/billing/PlanBadge";
import { TrialBanner } from "@/components/billing/TrialBanner";
import { ExpiryReminderBanner } from '@/components/billing/ExpiryReminderBanner'
import { useOrders } from "@/hooks/useOrders";
import { usePayments } from "@/hooks/usePayments";
import { shopOps } from "@/lib/db/operations";
import type { ShopRecord } from "@/lib/db/schema";
import { karachiDateString } from "@/lib/time";
import { AppFooter } from "@/components/layout/AppFooter";
import { SubscriptionInfo } from "@/components/billing/SubscriptionInfo";

export default function DashboardPage() {
  const router = useRouter();
  const { shopId, isOwner, currentUser } = useAuth();

  const [shop, setShop] = useState<ShopRecord | undefined>()
  const today = karachiDateString();
  const todayStr = today;
  const { orders: allOrders, isLoading } = useOrders(shopId, currentUser?.role === 'karigar' ? 'karigar' : 'owner', currentUser?.id)
  const { payments: allPayments } = usePayments(shopId, { orders: allOrders })

  useEffect(() => {
    if (!shopId) return
    shopOps.get(shopId).then(setShop).catch(() => setShop(undefined))
  }, [shopId])

  const greeting = 'Assalam o Alaikum'

  // ── DERIVED STATS (memoized) ────────────────────────────────────
  const { stats, recent, overdueOrders } = useMemo(() => {
    const safe = allOrders.filter(o => !["delivered", "cancelled"].includes(o.status));
    const todayPay = allPayments.filter(p => p.paidAt.startsWith(today));
    const overdueOrders = safe.filter((o) => o.dueDate < today);
    const readyOrders = safe.filter((o) => o.status === "ready");
    const todaysNewOrders = safe.filter((o) => o.createdAt.startsWith(today));
    const incomeToday = todayPay.reduce((sum, p) => sum + p.amount, 0);
    const pendingBalance = safe.reduce(
      (sum, o) => sum + Math.max(0, o.totalPrice - o.amountPaid),
      0,
    );
    return {
      stats: {
        totalOrdersToday: todaysNewOrders.length,
        readyOrders: readyOrders.length,
        overdueOrders: overdueOrders.length,
        incomeToday,
        pendingBalance,
      },
      recent: [...allOrders].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5),
      overdueOrders,
    }
  }, [allOrders, allPayments, today]);

  if (isLoading || !shopId) return <DashboardSkeleton />
  return (
    <div className="overflow-x-clip pb-24 lg:pb-0">
      {/* HEADER */}
      <header
        className="bg-linear-to-br from-blue-900 to-blue-700 text-white
                   px-4 pt-4 pb-2 lg:pb-6 sm:px-5 lg:rounded-2xl lg:mb-6 lg:pt-8"
      >
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-blue-200 text-sm font-medium">{greeting} 👋</p>
            <h1 className="mt-0.5 truncate text-2xl font-bold">{shop?.shopName || "Meradarzi"}</h1>
            <p className="text-blue-300 text-xs mt-1">
              {todayStr || <span className="opacity-0">—</span>}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <PlanBadge />
            <div className="hidden lg:block">
              <NotificationBell />
            </div>
          </div>
        </div>
      </header>

      <div className="px-4 lg:px-0 space-y-5">
        <TrialBanner />
        <ExpiryReminderBanner />
        <AdminDashboardNotifications shopId={shopId} />
        <NotificationPermissionCard />

        {/* STATS GRID */}
        <section className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2 xl:grid-cols-4 mt-3">
          <StatsCard
            icon={ClipboardList}
            label="Aaj Ke Orders"
            value={stats.totalOrdersToday}
            subLabel="naye orders aaj"
            variant="info"
            onClick={() => router.push("/orders?filter=today")}
          />
          <StatsCard
            icon={CheckCircle2}
            label="Tayyar Hain"
            value={stats.readyOrders}
            subLabel="lene ke intezaar mein"
            variant="success"
            onClick={() => router.push("/orders?filter=ready")}
          />
          <StatsCard
            icon={Wallet}
            label="Aaj Ki Amdani"
            value={`Rs. ${stats.incomeToday.toLocaleString()}`}
            subLabel="aaj mila paisa"
            variant="default"
            onClick={() => router.push("/payments")}
          />
          <StatsCard
            icon={AlertCircle}
            label="Deri Wale"
            value={stats.overdueOrders}
            subLabel={stats.overdueOrders > 0 ? "turant dhyan dein" : "sab theek hai"}
            variant={stats.overdueOrders > 0 ? "danger" : "default"}
            onClick={() => router.push("/orders?filter=overdue")}
          />
        </section>

        {/* DESKTOP 2-col */}
        <div className="xl:grid xl:grid-cols-3 xl:gap-6">
          <div className="space-y-5 xl:col-span-2">
            {/* Baaki strip */}
            {stats.pendingBalance > 0 && (
              <button
                onClick={() => router.push("/payments")}
                className="w-full flex items-center justify-between bg-blue-50 border
                           border-blue-200 rounded-2xl px-4 py-3 text-left
                           transition-transform active:scale-[0.98]"
              >
                <div className="flex items-center gap-2">
                  <TrendingUp size={16} className="text-blue-600" />
                  <span className="text-sm font-medium text-blue-700">
                    Total Baaki Raqam
                  </span>
                </div>
                <span className="text-base font-bold text-blue-800">
                  Rs. {stats.pendingBalance.toLocaleString()}
                </span>
              </button>
            )}

            <div className="block xl:hidden">
              <SubscriptionInfo />
            </div>

            <DueOrdersAlert orders={overdueOrders} />

            {/* Quick actions — responsive wrap */}
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => router.push("/orders/new")}
                className="flex-1 min-w-35 flex items-center justify-center gap-2 bg-blue-600
                           text-white font-semibold py-4 rounded-2xl
                           transition-colors active:scale-95 shadow-md shadow-blue-200"
              >
                <Plus size={20} strokeWidth={2.5} />
                Naya Order
              </button>
              {isOwner && (
                <button
                  onClick={() => router.push("/customers/new")}
                  className="flex-1 min-w-35 flex items-center justify-center gap-2 bg-white
                             border-2 border-slate-200 text-slate-700 font-semibold
                             py-4 rounded-2xl transition-colors active:scale-95"
                >
                  <UserPlus size={20} strokeWidth={2} />
                  Naya Gahak
                </button>
              )}
            </div>

            {/* Recent orders */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-bold text-slate-800">
                  Recent Orders
                </h2>
                <button
                  onClick={() => router.push("/orders")}
                  className="text-xs font-medium text-blue-600"
                >
                  Sab Dekhein →
                </button>
              </div>

              {recent.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                  <div className="text-4xl mb-3">🧵</div>
                  <p className="font-medium">Koi order nahi abhi tak</p>
                  <p className="text-sm mt-1">Naya order add karein</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recent.map((o) => (
                    <RecentOrderCard key={o.id} order={o} />
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Desktop sidebar */}
          <div className="hidden lg:block space-y-4">
            <SubscriptionInfo />
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
              <h3 className="text-sm font-bold text-slate-700 mb-3">
                Order Status
              </h3>
              {[
                { label: "Kapra Mila", emoji: "📋", color: "text-amber-700" },
                { label: "Katai", emoji: "✂️", color: "text-orange-700" },
                { label: "Silai", emoji: "🧵", color: "text-blue-700" },
                { label: "Finishing", emoji: "✨", color: "text-purple-700" },
                { label: "Tayyar", emoji: "✅", color: "text-green-700" },
                { label: "De Diya", emoji: "📦", color: "text-slate-600" },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-2 py-1.5">
                  <span className="text-base w-6 text-center">{s.emoji}</span>
                  <span className={`text-sm font-medium ${s.color}`}>
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
              <h3 className="text-sm font-bold text-blue-800 mb-2">💡 Tip</h3>
              <p className="text-xs text-blue-600 leading-relaxed">
                Tayyar orders ke liye WhatsApp button se seedha gahak ko message
                karein.
              </p>
            </div>
          </div>
        </div>
        <AppFooter />
      </div>
    </div>
  );
}
