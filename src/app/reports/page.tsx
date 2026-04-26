// src/app/reports/page.tsx
"use client";

import { useState } from "react";
import { BarChart3, Download, RefreshCw, Calendar } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { useReports, ReportPeriod } from "@/hooks/useReports";
import { SummaryCards } from "@/components/reports/SummaryCards";
import { IncomeChart } from "@/components/reports/IncomeChart";
import { OrderStatusChart } from "@/components/reports/OrderStatusChart";
import { TopCustomers } from "@/components/reports/TopCustomers";
import { GarmentBreakdown } from "@/components/reports/GarmentBreakdown";
import { BottomNav } from "@/components/layout/BottomNav";
import { cn } from "@/lib/utils";
import { FeatureGate } from "@/components/billing/FeatureGate";
import { ReportSkeleton } from "@/components/ui/Skeleton";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import dynamic from "next/dynamic";

const PERIODS: { key: ReportPeriod; label: string }[] = [
  { key: "7d", label: "7 Din" },
  { key: "30d", label: "30 Din" },
  { key: "90d", label: "3 Mahine" },
  { key: "365d", label: "1 Saal" },
  { key: "all", label: "Sab" },
];

// Simple CSV export
function exportCSV(data: object[], filename: string) {
  if (data.length === 0) return;
  const headers = Object.keys(data[0]);
  const rows = data.map((row) =>
    headers.map((h) => JSON.stringify((row as any)[h] ?? "")).join(","),
  );
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const { shopId, isOwner } = useAuth();
  const [activeTab, setActiveTab] = useState<"overview" | "customers" | "team">(
    "overview",
  );

  const IncomeChart = dynamic(
    () => import("@/components/reports/IncomeChart").then((m) => m.IncomeChart),
    {
      loading: () => (
        <div
          className="border border-slate-200 rounded-2xl p-5 h-70
                      animate-pulse bg-slate-100"
        />
      ),
      ssr: false, // recharts uses window — disable SSR
    },
  );

  const OrderStatusChart = dynamic(
    () =>
      import("@/components/reports/OrderStatusChart").then(
        (m) => m.OrderStatusChart,
      ),
    {
      loading: () => (
        <div className="h-40 animate-pulse bg-slate-100 rounded-2xl" />
      ),
      ssr: false,
    },
  );

  const {
    period,
    setPeriod,
    summary,
    monthlyIncome,
    weeklyIncome,
    statusDistribution,
    garmentBreakdown,
    topCustomers,
    karigarStats,
    paymentMethods,
    dailyActivity,
    isLoading,
  } = useReports(shopId);

  const handleExport = () => {
    exportCSV(
      topCustomers.map((c) => ({
        name: c.name,
        orders: c.orders,
        revenue: c.revenue,
        paid: c.paid,
        balance: c.revenue - c.paid,
      })),
      "darzi-customers-report",
    );
  };

  if (!isOwner) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-500 text-sm">
          Reports sirf Owner ke liye hain.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="px-4 pt-4 min-h-100">
        <ReportSkeleton />
      </div>
    );
  }

  return (
    <FeatureGate feature="analytics" mode="blur">
      <div className="flex flex-col min-h-screen bg-slate-50 pb-20 lg:pb-8">
        {/* ── HEADER ── */}
        <header className="bg-white border-b border-slate-100 px-4 pt-12 lg:pt-6 pb-4 sticky top-0 z-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 size={20} className="text-blue-600" />
              <div>
                <h1 className="text-xl font-bold text-slate-800">Reports</h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  Business analytics aur insights
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleExport}
                className="flex items-center gap-1.5 bg-slate-100 text-slate-700
                         text-xs font-semibold px-3 py-2 rounded-xl
                         hover:bg-slate-200 transition-colors"
              >
                <Download size={13} />
                Export
              </button>
            </div>
          </div>

          {/* Period filter */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={cn(
                  "shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl",
                  "text-xs font-semibold border transition-colors",
                  period === p.key
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-300",
                )}
              >
                <Calendar size={11} />
                {p.label}
              </button>
            ))}
          </div>
        </header>

        {/* ── LOADING ── */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <RefreshCw size={24} className="text-blue-600 animate-spin" />
              <p className="text-sm text-slate-400">
                Reports load ho rahi hain...
              </p>
            </div>
          </div>
        ) : (
          <main className="flex-1 px-4 pt-4 space-y-5 min-h-100">
            {/* Summary cards */}
            <SummaryCards summary={summary} />

            {/* Tab navigation */}
            <div className="flex bg-slate-100 rounded-2xl p-1">
              {[
                { key: "overview", label: "Overview" },
                { key: "customers", label: "Customers" },
                { key: "team", label: "Team" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  className={cn(
                    "flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all",
                    activeTab === tab.key
                      ? "bg-white text-slate-800 shadow-sm"
                      : "text-slate-500 hover:text-slate-700",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ── OVERVIEW TAB ── */}
            {activeTab === "overview" && (
              <div className="space-y-4 pb-4">
                {/* Income chart */}
                <ErrorBoundary>
                  <IncomeChart monthly={monthlyIncome} weekly={weeklyIncome} />
                </ErrorBoundary>

                {/* Status + Payment methods side by side on desktop */}
                <div className="lg:grid lg:grid-cols-2 lg:gap-4 space-y-4 lg:space-y-0">
                  <ErrorBoundary>
                    <OrderStatusChart
                      data={statusDistribution}
                      total={summary.totalOrders}
                    />
                  </ErrorBoundary>

                  {/* Payment methods */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-5">
                    <h3 className="font-bold text-slate-800 mb-1">
                      Payment Methods
                    </h3>
                    <p className="text-xs text-slate-400 mb-4">
                      Kaise payment aaya
                    </p>
                    {paymentMethods.length === 0 ? (
                      <p className="text-sm text-slate-400 text-center py-6">
                        Koi payment nahi
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {paymentMethods.map((m) => (
                          <div key={m.method}>
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <span className="text-base">
                                  {m.method === "cash"
                                    ? "💵"
                                    : m.method === "easypaisa"
                                      ? "📱"
                                      : m.method === "jazzcash"
                                        ? "📲"
                                        : m.method === "bank"
                                          ? "🏦"
                                          : "💳"}
                                </span>
                                <span className="text-sm font-semibold text-slate-700 capitalize">
                                  {m.method}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-xs">
                                <span className="text-slate-400">{m.pct}%</span>
                                <span className="font-bold text-slate-700">
                                  Rs. {m.amount.toLocaleString()}
                                </span>
                              </div>
                            </div>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${m.pct}%`,
                                  background:
                                    m.method === "cash"
                                      ? "#22c55e"
                                      : m.method === "easypaisa"
                                        ? "#14b8a6"
                                        : m.method === "jazzcash"
                                          ? "#ef4444"
                                          : m.method === "bank"
                                            ? "#3b82f6"
                                            : "#94a3b8",
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* 30-day activity heatmap */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5">
                  <h3 className="font-bold text-slate-800 mb-1">
                    30-Day Activity
                  </h3>
                  <p className="text-xs text-slate-400 mb-4">
                    Daily orders aur income
                  </p>
                  <div className="overflow-x-auto">
                    <div className="flex gap-1 min-w-max">
                      {dailyActivity.map((day) => {
                        const maxInc = Math.max(
                          ...dailyActivity.map((d) => d.income),
                          1,
                        );
                        const pct = Math.round((day.income / maxInc) * 100);
                        const hasOrders = day.orders > 0;

                        return (
                          <div
                            key={day.date}
                            className="flex flex-col items-center gap-1 group relative"
                          >
                            {/* Income bar */}
                            <div className="w-5 h-16 bg-slate-100 rounded-lg overflow-hidden flex items-end">
                              <div
                                className="w-full rounded-t-sm transition-all"
                                style={{
                                  height: `${Math.max(pct, day.income > 0 ? 8 : 0)}%`,
                                  background:
                                    pct > 70
                                      ? "#1d4ed8"
                                      : pct > 30
                                        ? "#3b82f6"
                                        : "#93c5fd",
                                }}
                              />
                            </div>

                            {/* Order dot */}
                            <div
                              className={cn(
                                "w-2 h-2 rounded-full",
                                hasOrders ? "bg-amber-400" : "bg-transparent",
                              )}
                            />

                            {/* Date label — every 7th */}
                            {dailyActivity.indexOf(day) % 7 === 0 && (
                              <span className="text-[8px] text-slate-400 rotate-45 origin-left mt-1">
                                {day.label}
                              </span>
                            )}

                            {/* Tooltip on hover */}
                            <div
                              className="absolute bottom-full mb-2 bg-slate-900 text-white
                                          text-[10px] rounded-lg px-2 py-1.5 opacity-0
                                          group-hover:opacity-100 transition-opacity
                                          pointer-events-none whitespace-nowrap z-10 left-1/2
                                          -translate-x-1/2"
                            >
                              <p className="font-bold">{day.label}</p>
                              <p>{day.orders} orders</p>
                              <p>Rs. {day.income.toLocaleString()}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Legend */}
                    <div className="flex items-center gap-4 mt-3 text-[10px] text-slate-400">
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-blue-400 rounded-sm" />
                        Income
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-amber-400 rounded-full" />
                        New orders
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── CUSTOMERS TAB ── */}
            {activeTab === "customers" && (
              <div className="space-y-4 pb-4">
                {/* Quick stats */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    {
                      label: "Total",
                      value: summary.totalCustomers,
                      color: "text-blue-700",
                      bg: "bg-blue-50",
                    },
                    {
                      label: "Active",
                      value: topCustomers.length,
                      color: "text-green-700",
                      bg: "bg-green-50",
                    },
                    {
                      label: "Avg Revenue",
                      value:
                        summary.totalCustomers > 0
                          ? `${Math.round(summary.totalRevenue / summary.totalCustomers / 1000)}k`
                          : "—",
                      color: "text-purple-700",
                      bg: "bg-purple-50",
                    },
                  ].map((s) => (
                    <div
                      key={s.label}
                      className={cn("rounded-2xl p-3.5 text-center", s.bg)}
                    >
                      <p className={cn("text-xl font-bold", s.color)}>
                        {s.value}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>

                <TopCustomers customers={topCustomers} />
              </div>
            )}

            {/* ── TEAM TAB ── */}
            {activeTab === "team" && (
              <div className="space-y-4 pb-4">
                {karigarStats.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
                    <p className="text-2xl mb-3">✂️</p>
                    <p className="font-semibold text-slate-600">
                      Koi karigar nahi
                    </p>
                    <p className="text-sm text-slate-400 mt-1">
                      Settings mein karigar add karein
                    </p>
                  </div>
                ) : (
                  <GarmentBreakdown
                    garments={garmentBreakdown}
                    karigars={karigarStats}
                    totalOrders={summary.totalOrders}
                  />
                )}
              </div>
            )}

            {/* No data state */}
            {summary.totalOrders === 0 && !isLoading && (
              <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
                <BarChart3 size={40} className="text-slate-200 mx-auto mb-4" />
                <p className="font-semibold text-slate-500">
                  Is period mein koi data nahi
                </p>
                <p className="text-sm text-slate-400 mt-1">
                  Alag period chunein ya orders add karein
                </p>
              </div>
            )}
          </main>
        )}

        <BottomNav />
      </div>
    </FeatureGate>
  );
}
