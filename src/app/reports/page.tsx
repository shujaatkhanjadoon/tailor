"use client";

import { useState } from "react";
import { BarChart3, Download, RefreshCw, Calendar } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { useReports, ReportPeriod } from "@/hooks/useReports";
import { SummaryCards } from "@/components/reports/SummaryCards";
import { TopCustomers } from "@/components/reports/TopCustomers";
import { GarmentBreakdown } from "@/components/reports/GarmentBreakdown";
import { cn } from "@/lib/utils";
import { FeatureGate } from "@/components/billing/FeatureGate";
import { ReportSkeleton } from "@/components/ui/Skeleton";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { AccessNotice } from "@/components/billing/AccessNotice";
import { usePlan } from "@/hooks/usePlan";
import { formatRupees } from "@/lib/format/currency";
import dynamic from "next/dynamic";
import { exportCSV, exportPrintablePDF } from "@/lib/export/download";
import { useTranslation } from "react-i18next";

const IncomeChart = dynamic(
  () => import("@/components/reports/IncomeChart").then((m) => m.IncomeChart),
  {
    loading: () => <div className="border border-slate-200 rounded-2xl p-5 h-70 animate-pulse bg-slate-100" />,
    ssr: false,
  },
);

const OrderStatusChart = dynamic(
  () => import("@/components/reports/OrderStatusChart").then((m) => m.OrderStatusChart),
  {
    loading: () => <div className="h-40 animate-pulse bg-slate-100 rounded-2xl" />,
    ssr: false,
  },
);

const PERIODS: { key: ReportPeriod; label: string }[] = [
  { key: "7d", label: "7d" },
  { key: "30d", label: "30d" },
  { key: "90d", label: "90d" },
  { key: "365d", label: "1y" },
  { key: "all", label: "all" },
];

export default function ReportsPage() {
  const { shopId, isOwner } = useAuth();
  const plan = usePlan();
  const { t } = useTranslation();

  if (!isOwner) {
    return (
      <AccessNotice
        icon="role"
        title={t('reports.ownerAccess')}
        message={t('reports.ownerAccessDesc')}
      />
    );
  }

  if (plan.isLoading) {
    return (
      <div className="px-4 pt-4 min-h-100">
        <ReportSkeleton />
      </div>
    );
  }

  if (!plan.canUseAnalytics) {
    return (
      <AccessNotice
        title={t('reports.locked')}
        message={t('reports.lockedDesc')}
        requiredPlan="professional"
      />
    );
  }

  return <ReportsContent shopId={shopId} showPayReports={plan.plan === "business" && plan.isActive} />;
}

function ReportsContent({
  shopId,
  showPayReports,
}: {
  shopId: string | null
  showPayReports: boolean
}) {
  const [activeTab, setActiveTab] = useState<"overview" | "customers" | "team">("overview");
  const { t } = useTranslation();

  const {
    period, setPeriod, summary, monthlyIncome, weeklyIncome, statusDistribution,
    garmentBreakdown, topCustomers, karigarStats, paymentMethods, paymentSummary,
    dailyActivity, isLoading,
  } = useReports(shopId);

  const handleExport = () => {
    const rows = topCustomers.map(c => ({ name: c.name, orders: c.orders, revenue: c.revenue, paid: c.paid, balance: c.revenue - c.paid }))
    exportCSV(rows, "darzi-customers-report");
  };

  const handlePdfExport = () => {
    const rows = topCustomers.map(c => ({ name: c.name, orders: c.orders, revenue: c.revenue, paid: c.paid, balance: c.revenue - c.paid }))
    exportPrintablePDF("MeraDarzi Customers Report", rows, "darzi-customers-report")
  };

  if (isLoading) {
    return (
      <div className="px-4 pt-4 min-h-100">
        <ReportSkeleton />
      </div>
    );
  }

  const periodLabels: Record<string, string> = {
    "7d": t('reports.periods.7d'),
    "30d": t('reports.periods.30d'),
    "90d": t('reports.periods.90d'),
    "365d": t('reports.periods.365d'),
    "all": t('reports.periods.all'),
  };

  return (
    <FeatureGate feature="analytics" mode="blur">
      <div className="flex min-h-dvh flex-col overflow-x-clip bg-slate-50 pb-24 lg:pb-8">
        <header className="bg-white border-b border-slate-100 px-4 pt-2 lg:pt-0 pb-4 sticky top-14 lg:top-1 z-10">
          <div className="mb-4 flex min-w-0 items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <BarChart3 size={20} className="text-blue-600" />
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-slate-800">{t('reports.title')}</h1>
                <p className="text-xs text-slate-400 mt-0.5">{t('reports.subtitle')}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleExport}
                className="flex items-center gap-1.5 bg-slate-100 text-slate-700 text-xs font-semibold px-3 py-2 rounded-xl hover:bg-slate-200 transition-colors">
                <Download size={13} /> {t('reports.export')}
              </button>
              <button onClick={handlePdfExport}
                className="flex items-center gap-1.5 bg-slate-100 text-slate-700 text-xs font-semibold px-3 py-2 rounded-xl hover:bg-slate-200 transition-colors">
                <Download size={13} /> {t('reports.pdf')}
              </button>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {PERIODS.map((p) => (
              <button key={p.key} onClick={() => setPeriod(p.key)}
                className={cn("shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold border transition-colors",
                  period === p.key ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300")}>
                <Calendar size={11} />
                {periodLabels[p.key] || p.key}
              </button>
            ))}
          </div>
        </header>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <RefreshCw size={24} className="text-blue-600 animate-spin" />
              <p className="text-sm text-slate-400">{t('reports.loading')}</p>
            </div>
          </div>
        ) : (
          <main className="flex-1 px-4 pt-4 space-y-5 min-h-100">
            <SummaryCards summary={summary} />

            <div className="flex bg-slate-100 rounded-2xl p-1">
              {[
                { key: "overview", label: t('reports.tabs.overview') },
                { key: "customers", label: t('reports.tabs.customers') },
                { key: "team", label: t('reports.tabs.team') },
              ].map((tab) => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
                  className={cn("flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all",
                    activeTab === tab.key ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700")}>
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === "overview" && (
              <div className="space-y-4 pb-4">
                <ErrorBoundary><IncomeChart monthly={monthlyIncome} weekly={weeklyIncome} /></ErrorBoundary>

                <div className="lg:grid lg:grid-cols-2 lg:gap-4 space-y-4 lg:space-y-0">
                  <ErrorBoundary><OrderStatusChart data={statusDistribution} total={summary.totalOrders} /></ErrorBoundary>

                  <div className="bg-white border border-slate-200 rounded-2xl p-5">
                    <h3 className="font-bold text-slate-800 mb-1">{t('reports.paymentMethods.title')}</h3>
                    <p className="text-xs text-slate-400 mb-4">{t('reports.paymentMethods.subtitle')}</p>
                    {paymentMethods.length === 0 ? (
                      <p className="text-sm text-slate-400 text-center py-6">{t('reports.paymentMethods.noPayments')}</p>
                    ) : (
                      <div className="space-y-3">
                        {paymentMethods.map((m) => (
                          <div key={m.method}>
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <span className="text-base">
                                  {m.method === "cash" ? "💵" : m.method === "easypaisa" ? "📱" : m.method === "jazzcash" ? "📲" : m.method === "bank" ? "🏦" : "💳"}
                                </span>
                                <span className="text-sm font-semibold text-slate-700 capitalize">{m.method}</span>
                              </div>
                              <div className="flex items-center gap-2 text-xs">
                                <span className="text-slate-400">{m.pct}%</span>
                                <span className="font-bold text-slate-700">Rs. {m.amount.toLocaleString()}</span>
                              </div>
                            </div>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{
                                width: `${m.pct}%`,
                                background: m.method === "cash" ? "#22c55e" : m.method === "easypaisa" ? "#14b8a6" : m.method === "jazzcash" ? "#ef4444" : m.method === "bank" ? "#3b82f6" : "#94a3b8",
                              }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-3">
                  {[
                    { label: t('reports.paymentSummary.orderPayments'), value: paymentSummary.applied, color: "text-blue-700", bg: "bg-blue-50" },
                    { label: t('reports.paymentSummary.tips'), value: paymentSummary.tips, color: "text-amber-700", bg: "bg-amber-50" },
                    { label: t('reports.paymentSummary.extra'), value: paymentSummary.overpayments, color: "text-violet-700", bg: "bg-violet-50" },
                  ].map(item => (
                    <div key={item.label} className={cn("rounded-2xl border border-slate-200 p-4", item.bg)}>
                      <p className={cn("text-lg font-bold", item.color)}>Rs. {item.value.toLocaleString()}</p>
                      <p className="mt-1 text-xs font-medium text-slate-500">{item.label}</p>
                    </div>
                  ))}
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-5">
                  <h3 className="font-bold text-slate-800 mb-1">{t('reports.activity.title')}</h3>
                  <p className="text-xs text-slate-400 mb-4">{t('reports.activity.subtitle')}</p>
                  <div className="overflow-x-auto">
                    <div className="flex gap-1 min-w-max">
                      {dailyActivity.map((day) => {
                        const maxInc = Math.max(...dailyActivity.map(d => d.income), 1)
                        const pct = Math.round((day.income / maxInc) * 100)
                        const hasOrders = day.orders > 0
                        return (
                          <div key={day.date} className="flex flex-col items-center gap-1 group relative">
                            <div className="w-5 h-16 bg-slate-100 rounded-lg overflow-hidden flex items-end">
                              <div className="w-full rounded-t-sm transition-all" style={{
                                height: `${Math.max(pct, day.income > 0 ? 8 : 0)}%`,
                                background: pct > 70 ? "#1d4ed8" : pct > 30 ? "#3b82f6" : "#93c5fd",
                              }} />
                            </div>
                            <div className={cn("w-2 h-2 rounded-full", hasOrders ? "bg-amber-400" : "bg-transparent")} />
                            {dailyActivity.indexOf(day) % 7 === 0 && (
                              <span className="text-[8px] text-slate-400 rotate-45 origin-left mt-1">{day.label}</span>
                            )}
                            <div className="absolute bottom-full mb-2 bg-slate-900 text-white text-[10px] rounded-lg px-2 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 left-1/2 -translate-x-1/2">
                              <p className="font-bold">{day.label}</p>
                              <p>{t('reports.activity.orders', { count: day.orders })}</p>
                              <p>Rs. {day.income.toLocaleString()}</p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <div className="flex items-center gap-4 mt-3 text-[10px] text-slate-400">
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-blue-400 rounded-sm" /> {t('reports.legendIncome')}
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-amber-400 rounded-full" /> {t('reports.legendOrders')}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "customers" && (
              <div className="space-y-4 pb-4">
                <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-3">
                  {[
                    { label: t('reports.customersTab.total'), value: summary.totalCustomers, color: "text-blue-700", bg: "bg-blue-50" },
                    { label: t('reports.customersTab.active'), value: topCustomers.length, color: "text-green-700", bg: "bg-green-50" },
                    { label: t('reports.customersTab.avgRevenue'), value: summary.totalCustomers > 0 ? formatRupees(Math.round(summary.totalRevenue / summary.totalCustomers)) : "—", color: "text-purple-700", bg: "bg-purple-50" },
                  ].map((s) => (
                    <div key={s.label} className={cn("rounded-2xl p-3.5 text-center", s.bg)}>
                      <p className={cn("text-xl font-bold", s.color)}>{s.value}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>
                <TopCustomers customers={topCustomers} />
              </div>
            )}

            {activeTab === "team" && (
              <div className="space-y-4 pb-4">
                {karigarStats.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
                    <p className="text-2xl mb-3">✂️</p>
                    <p className="font-semibold text-slate-600">{t('reports.teamTab.noKarigar')}</p>
                    <p className="text-sm text-slate-400 mt-1">{t('reports.teamTab.noKarigarDesc')}</p>
                  </div>
                ) : (
                  <GarmentBreakdown garments={garmentBreakdown} karigars={karigarStats}
                    totalOrders={summary.totalOrders} showPayReports={showPayReports} />
                )}
              </div>
            )}

            {summary.totalOrders === 0 && !isLoading && (
              <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
                <BarChart3 size={40} className="text-slate-200 mx-auto mb-4" />
                <p className="font-semibold text-slate-500">{t('reports.noData')}</p>
                <p className="text-sm text-slate-400 mt-1">{t('reports.noDataDesc')}</p>
              </div>
            )}
          </main>
        )}
      </div>
    </FeatureGate>
  );
}
