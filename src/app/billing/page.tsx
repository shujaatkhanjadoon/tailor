// src/app/billing/page.tsx
"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Calendar } from "lucide-react";
import { usePlan } from "@/hooks/usePlan";
import { PLANS } from "@/lib/billing/plans";
import { BottomNav } from "@/components/layout/BottomNav";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useSearchParams } from "next/navigation";
import { BillingHistory } from "@/components/billing/BillingHistory";

export default function BillingPage() {
  const router = useRouter();
  const plan = usePlan();
  const planDef = PLANS[plan.plan];
  const searchParams = useSearchParams();
  const paymentSubmitted = searchParams.get("payment") === "submitted";

  return (
    <div className="min-h-screen bg-slate-50 pb-20 lg:pb-8">
      <header className="bg-white border-b border-slate-100 px-4 pt-12 lg:pt-6 pb-4 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100"
        >
          <ArrowLeft size={18} className="text-slate-600" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-slate-800">Billing & Plan</h1>
          <p className="text-xs text-slate-400 mt-0.5">Aapka subscription</p>
        </div>
      </header>

      {paymentSubmitted && (
        <div className="mx-4 mt-4 bg-green-50 border border-green-200 rounded-2xl px-4 py-4">
          <p className="font-bold text-green-800 text-sm mb-1">
            ✓ Payment Request Submit Ho Gayi!
          </p>
          <p className="text-green-600 text-xs leading-relaxed">
            Hum aapki payment 24 ghante mein verify kar ke plan activate kar
            denge. Koi masla ho to WhatsApp karein.
          </p>
        </div>
      )}

      <div className="px-4 pt-5 space-y-4">
        {/* Current plan card */}
        <div
          className={cn(
            "rounded-2xl p-5 border-2",
            plan.plan === "business"
              ? "bg-purple-600 border-purple-600"
              : plan.plan === "professional"
                ? "bg-blue-600 border-blue-600"
                : "bg-slate-100 border-slate-200",
          )}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <p
                className={cn(
                  "text-sm font-medium",
                  plan.plan === "starter" ? "text-slate-500" : "text-white/70",
                )}
              >
                Current Plan
              </p>
              <h2
                className={cn(
                  "text-2xl font-bold mt-0.5",
                  plan.plan === "starter" ? "text-slate-800" : "text-white",
                )}
              >
                {planDef.emoji} {planDef.name}
              </h2>
            </div>
            <div
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-bold",
                plan.isTrial
                  ? "bg-white/20 text-white"
                  : plan.isActive
                    ? "bg-white/20 text-white"
                    : "bg-red-100 text-red-700",
              )}
            >
              {plan.isTrial
                ? "✨ Trial"
                : plan.inGrace
                  ? "⚠️ Grace"
                  : plan.isExpired
                    ? "🔴 Expired"
                    : "✓ Active"}
            </div>
          </div>

          {/* Trial/expiry info */}
          {(plan.isTrial || plan.expiresAt) && (
            <div
              className={cn(
                "flex items-center gap-2 text-sm",
                plan.plan === "starter" ? "text-slate-500" : "text-white/80",
              )}
            >
              <Calendar size={14} />
              {plan.isTrial && plan.trialEndsAt
                ? `Trial ends: ${format(plan.trialEndsAt, "d MMM yyyy")} (${plan.daysLeft} din baaki)`
                : plan.expiresAt
                  ? `Renews: ${format(plan.expiresAt, "d MMM yyyy")}`
                  : "No expiry"}
            </div>
          )}
        </div>

        {/* Usage meters */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-4">
          <h3 className="font-bold text-slate-800 text-sm">Usage This Month</h3>

          {[
            {
              label: "Orders",
              used: plan.ordersThisMonth,
              limit: plan.ordersLimit,
              color: "bg-blue-500",
            },
            {
              label: "Customers",
              used: plan.customersTotal,
              limit: plan.customersLimit,
              color: "bg-green-500",
            },
            {
              label: "Karigar",
              used: plan.karigarCount,
              limit: plan.karigarLimit === 999 ? null : plan.karigarLimit,
              color: "bg-purple-500",
            },
          ].map((m) => {
            const pct = m.limit
              ? Math.min(100, Math.round((m.used / m.limit) * 100))
              : 0;
            const isNearLimit = m.limit && pct >= 80;
            return (
              <div key={m.label}>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="font-medium text-slate-600">{m.label}</span>
                  <span
                    className={cn(
                      "font-bold",
                      isNearLimit ? "text-amber-600" : "text-slate-700",
                    )}
                  >
                    {m.used}
                    {m.limit ? ` / ${m.limit}` : " (unlimited)"}
                  </span>
                </div>
                {m.limit && (
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        isNearLimit ? "bg-amber-500" : m.color,
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Upgrade CTA for non-business */}
        {plan.plan !== "business" && (
          <button
            onClick={() => plan.upgrade()}
            className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl
                       text-base transition-colors active:scale-[0.98]"
          >
            Upgrade Karein →
          </button>
        )}

        {/* Features list */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <h3 className="font-bold text-slate-800 text-sm mb-3">
            Aapke Plan Mein Hai:
          </h3>
          <div className="space-y-2">
            {planDef.highlights.map((h) => (
              <div
                key={h}
                className="flex items-center gap-2 text-sm text-slate-700"
              >
                <CheckCircle2 size={15} className="text-green-500 shrink-0" />
                {h}
              </div>
            ))}
          </div>
        </div>

        {/* Contact for billing issues */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3">
          <p className="text-xs text-slate-500 text-center">
            Billing ka koi masla hai?{" "}
            <a
              href="https://wa.me/923135931459"
              className="text-blue-600 font-semibold underline"
            >
              WhatsApp karein
            </a>
          </p>
        </div>
      </div>

      <BillingHistory />

      {/* Cancel link — only for paid active plans */}
      {plan.plan !== "starter" && plan.isActive && !plan.isTrial && (
        <button
          onClick={() => router.push("/billing/cancel")}
          className="w-full text-slate-400 text-xs font-medium py-3 underline"
        >
          Subscription cancel karna chahte hain?
        </button>
      )}

      {/* History link */}
      <button
        onClick={() => router.push("/billing/history")}
        className="w-full flex items-center justify-center gap-2 bg-slate-100
             text-slate-600 font-semibold py-3 rounded-2xl text-sm"
      >
        Payment History Dekhein →
      </button>

      <BottomNav />
    </div>
  );
}
