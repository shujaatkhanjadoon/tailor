// src/app/dashboard/page.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
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
import { BottomNav } from "@/components/layout/BottomNav";
import { useAuth } from "@/lib/auth/AuthContext";
import { db, OrderRecord } from "@/lib/db/schema";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { NotificationPermissionCard } from "@/components/notifications/NotificationPermissionCard";
import { PlanBadge } from "@/components/billing/PlanBadge";
import { TrialBanner } from "@/components/billing/TrialBanner";
import { ExpiryReminderBanner } from '@/components/billing/ExpiryReminderBanner'

export default function DashboardPage() {
  const router = useRouter();
  const { shopId, isOwner } = useAuth();

  const [greeting, setGreeting] = useState("Assalam o Alaikum");
  const [todayStr, setTodayStr] = useState("");
  const cleanupDoneRef = useRef(false);

  useEffect(() => {
    if (!shopId) return;
    if (cleanupDoneRef.current) return; // ← run only once per session
    cleanupDoneRef.current = true;

    const cleanup = async () => {
      // Remove corrupt orders (missing required fields)
      const corrupt = await db.orders
        .where("shopId")
        .equals(shopId)
        .filter((o) => !o.customerId || !o.garmentType || !o.dueDate)
        .toArray();

      if (corrupt.length > 0) {
        console.warn(
          `[Cleanup] Soft-deleting ${corrupt.length} corrupt orders`,
        );
        await Promise.all(
          corrupt.map((o) =>
            db.orders.update(o.id, { _deleted: 1, _synced: 1 }),
          ),
        );
      }

      // Backfill tracking codes for orders missing them
      const withoutCode = await db.orders
        .where("shopId")
        .equals(shopId)
        .filter((o) => o._deleted === 0 && !o.trackingCode)
        .toArray();

      if (withoutCode.length > 0) {
        const shop = await db.shop.toCollection().first();
        const { generateTrackingCode } = await import("@/lib/tracking");
        await Promise.all(
          withoutCode.map((o) =>
            db.orders.update(o.id, {
              trackingCode: generateTrackingCode(shop?.shopName ?? "DZ"),
              _synced: 0,
            }),
          ),
        );
        console.log(
          `[Cleanup] Added tracking codes to ${withoutCode.length} orders`,
        );
      }
    };

    cleanup().catch(console.error);
  }, [shopId]);

  const today = new Date().toISOString().split("T")[0];
  const shop = useLiveQuery(async () => {
    if (!shopId) return null
    return db.shop.get(shopId)
  }, [shopId])

  // ── LIVE QUERIES — all from IndexedDB ──────────────────────────

  const allActiveOrders = useLiveQuery(async (): Promise<OrderRecord[]> => {
    if (!shopId) return [];
    return db.orders
      .where("shopId")
      .equals(shopId)
      .filter(
        (o) =>
          o._deleted === 0 && !["delivered", "cancelled"].includes(o.status),
      )
      .toArray();
  }, [shopId]);

  const todayPayments = useLiveQuery(async () => {
    if (!shopId) return [];
    return db.payments
      .where("shopId")
      .equals(shopId)
      .filter((p) => p.paidAt.startsWith(today))
      .toArray();
  }, [shopId, today]);

  const recentOrders = useLiveQuery(async (): Promise<OrderRecord[]> => {
    if (!shopId) return [];
    const orders = await db.orders
      .where("shopId")
      .equals(shopId)
      .filter((o) => o._deleted === 0)
      .toArray();
    return orders
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 5);
  }, [shopId]);

  // ── DERIVED STATS ───────────────────────────────────────────────
  const safe = allActiveOrders ?? [];
  const todayPay = todayPayments ?? [];
  const recent = recentOrders ?? [];

  const overdueOrders = safe.filter((o) => o.dueDate < today);
  const readyOrders = safe.filter((o) => o.status === "ready");
  const todaysNewOrders = safe.filter((o) => o.createdAt.startsWith(today));
  const incomeToday = todayPay.reduce((sum, p) => sum + p.amount, 0);
  const pendingBalance = safe.reduce(
    (sum, o) => sum + Math.max(0, o.totalPrice - o.amountPaid),
    0,
  );

  const stats = {
    totalOrdersToday: todaysNewOrders.length,
    readyOrders: readyOrders.length,
    overdueOrders: overdueOrders.length,
    incomeToday,
    pendingBalance,
  };

  const isLoading = allActiveOrders === undefined;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }
if (isLoading || !shopId) return <DashboardSkeleton />
  return (
    <div className="pb-20 lg:pb-0 overflow-x-hidden">
      {/* HEADER */}
      <header
        className="bg-linear-to-br from-blue-900 to-blue-700 text-white
                   px-5 pt-12 pb-6 lg:rounded-2xl lg:mb-6 lg:pt-8"
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-blue-200 text-sm font-medium">{greeting} 👋</p>
            <h1 className="text-2xl font-bold mt-0.5">{shop?.shopName || "DarziHub"}</h1>
            <p className="text-blue-300 text-xs mt-1">
              {todayStr || <span className="opacity-0">—</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <PlanBadge />
            <NotificationBell />
          </div>
        </div>
      </header>

      <div className="px-4 lg:px-0 space-y-5">
        <TrialBanner />
        <ExpiryReminderBanner />
        <NotificationPermissionCard />

        {/* STATS GRID */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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
        <div className="lg:grid lg:grid-cols-3 lg:gap-6">
          <div className="lg:col-span-2 space-y-5">
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
      </div>

      <BottomNav />
    </div>
  );
}
