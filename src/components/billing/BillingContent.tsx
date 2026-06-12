"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Calendar, MessageCircle, RefreshCw } from "lucide-react";
import { usePlan } from "@/hooks/usePlan";
import { useAuth } from "@/lib/auth/AuthContext";
import { PLANS } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useSearchParams } from "next/navigation";
import { BillingHistory } from "@/components/billing/BillingHistory";
import { BillingSkeleton } from '@/components/ui/Skeleton'

const ADMIN_WA = process.env.NEXT_PUBLIC_ADMIN_WHATSAPP ?? "923135634667";

function BillingContentInner() {
  const router = useRouter();
  const { shopId } = useAuth();
  const plan = usePlan();
  const planDef = PLANS[plan.plan];
  const searchParams = useSearchParams();
  const paymentSubmitted = searchParams.get("payment") === "submitted";
  const paymentSubmittedAt = searchParams.get("t");
  const [paymentVerified, setPaymentVerified] = useState(false);
  const [pollingActive, setPollingActive] = useState(false);

  const checkPaymentStatus = useCallback(async () => {
    if (!shopId) return
    try {
      const res = await fetch(`/api/billing/subscription-status?shopId=${shopId}`)
      const data = await res.json()
      const latestPayment = data.latestPayment
      // Verify the latest payment was created AFTER our submission timestamp
      // AND its status is no longer 'pending' — ensures we track the right payment
      if (latestPayment && latestPayment.status !== 'pending') {
        const paymentTime = new Date(latestPayment.paid_at).getTime()
        const submittedTime = paymentSubmittedAt ? parseInt(paymentSubmittedAt) : 0
        if (!isNaN(paymentTime) && paymentTime >= submittedTime) {
          window.location.href = '/billing'
          return true
        }
      }
    } catch { /* ignore */ }
    return false
  }, [shopId, paymentSubmittedAt])

  useEffect(() => {
    if (paymentSubmitted && shopId) {
      // If latest payment is already processed, redirect immediately
      checkPaymentStatus().then(done => {
        if (!done) {
          setPollingActive(true)
          const interval = setInterval(async () => {
            const d = await checkPaymentStatus()
            if (d) clearInterval(interval)
          }, 10000)
          return () => clearInterval(interval)
        }
      })
    }
  }, [paymentSubmitted, shopId, paymentSubmittedAt, checkPaymentStatus])

  const adminWhatsAppLink = `https://wa.me/${ADMIN_WA}?text=${encodeURIComponent(
    `Assalam o Alaikum, meri subscription payment request submit ho gayi hai. Please verify kar dein.\n\nPlan: ${plan.plan}\nShop ID: ${shopId ?? "N/A"}`,
  )}`;

  if (plan.isLoading) return <BillingSkeleton />

  return (
    <div className="min-h-screen bg-slate-50 pb-20 lg:pb-8">
      <header className="bg-white border-b border-slate-100 px-4 pt-12 lg:pt-6 pb-4 flex items-center gap-3">
        <button
          aria-label="Go back"
          onClick={() => router.back()}
          className="w-11 h-11 flex items-center justify-center rounded-full bg-slate-100"
        >
          <ArrowLeft size={18} className="text-slate-600" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-slate-800">Billing & Plan</h1>
          <p className="text-xs text-slate-400 mt-0.5">Aapka subscription</p>
        </div>
      </header>

      {paymentSubmitted && !paymentVerified && (
        <div className="mx-4 mt-4 bg-green-50 border border-green-200 rounded-2xl px-4 py-4">
          <p className="font-bold text-green-800 text-sm mb-1">
            ✓ Payment Request Submit Ho Gayi!
          </p>
          <p className="text-green-600 text-xs leading-relaxed">
            Hum aapki payment 24 ghante mein verify kar ke plan activate kar
            denge. Koi masla ho to WhatsApp karein.
          </p>
          {pollingActive && (
            <div className="mt-3 flex items-center gap-2 text-xs text-amber-600">
              <RefreshCw size={12} className="animate-spin" />
              Payment verification check ho raha hai...
            </div>
          )}
          <a
            href={adminWhatsAppLink}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-green-600
                       px-4 py-2.5 text-xs font-bold text-white"
          >
            <MessageCircle size={13} />
            Admin Ko WhatsApp Karein
          </a>
        </div>
      )}

      {paymentVerified && (
        <div className="mx-4 mt-4 bg-green-50 border border-green-200 rounded-2xl px-4 py-4">
          <p className="font-bold text-green-800 text-sm mb-1">
            ✓ Payment Verified! Plan Active Hai
          </p>
          <p className="text-green-600 text-xs leading-relaxed">
            Aapka payment verify ho gaya hai aur plan activate hai.
            Mubarak ho! 🎉
          </p>
        </div>
      )}

      <div className="px-4 pt-5 space-y-4">
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
                  : plan.inGrace
                    ? "bg-orange-100 text-orange-700"
                    : plan.isExpired
                      ? "bg-red-100 text-red-700"
                      : plan.status === "cancelled" && plan.isActive
                        ? "bg-slate-200 text-slate-600"
                        : plan.isActive && plan.plan === "starter"
                          ? "bg-green-100 text-green-700"
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
                    : plan.status === "cancelled" && plan.isActive
                      ? "⏸️ Cancelled"
                      : "✓ Active"}
            </div>
          </div>

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

        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-4">
          <h3 className="font-bold text-slate-800 text-sm">Usage This Month</h3>
          {[
            { label: 'Orders', used: plan.ordersThisMonth, limit: plan.ordersLimit, color: 'bg-blue-500' },
            { label: 'Customers', used: plan.customersTotal, limit: plan.customersLimit, color: 'bg-green-500' },
            { label: 'Karigar', used: plan.karigarCount, limit: plan.karigarLimit >= 999 ? null : plan.karigarLimit, color: 'bg-purple-500', disallowed: plan.karigarLimit === 0 },
          ].map(m => {
            const pct = m.limit && m.limit > 0 ? Math.min(100, Math.round((m.used / m.limit) * 100)) : 0
            const isNearLimit = m.limit && m.limit > 0 && pct >= 80
            return (
              <div key={m.label}>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-sm font-medium text-slate-600">{m.label}</span>
                  <span className={cn('text-xs font-bold', m.disallowed ? 'text-slate-400' : isNearLimit ? 'text-amber-600' : m.limit === null ? 'text-green-600' : 'text-slate-700')}>
                    {m.disallowed ? 'Not allowed on this plan' : m.limit === null ? `${m.used} (unlimited)` : `${m.used} / ${m.limit}`}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {plan.plan !== "business" && (
          <button
            onClick={() => plan.upgrade()}
            className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl text-base transition-colors active:scale-[0.98]"
          >
            Upgrade Karein →
          </button>
        )}

        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <h3 className="font-bold text-slate-800 text-sm mb-3">Aapke Plan Mein Hai:</h3>
          <div className="space-y-2">
            {planDef.highlights.map((h) => (
              <div key={h} className="flex items-center gap-2 text-sm text-slate-700">
                <CheckCircle2 size={15} className="text-green-500 shrink-0" />
                {h}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3">
          <p className="text-xs text-slate-500 text-center">
            Billing ka koi masla hai?{" "}
            <a href="https://wa.me/923135634667" className="text-blue-600 font-semibold underline">WhatsApp karein</a>
          </p>
        </div>

        <BillingHistory />
        <button
          onClick={() => router.push("/billing/history")}
          className="w-full flex items-center justify-center gap-2 bg-slate-100 text-slate-600 font-semibold py-3 rounded-2xl text-sm"
        >
          Payment History Dekhein →
        </button>
      </div>

      {plan.plan !== "starter" && plan.isActive && !plan.isTrial && plan.status !== "cancelled" && (
        <button
          onClick={() => router.push("/billing/cancel")}
          className="w-full text-slate-400 text-xs font-medium py-3 underline"
        >
          Subscription cancel karna chahte hain?
        </button>
      )}
      {plan.status === "cancelled" && plan.isActive && (
        <div className="text-center py-4">
          <p className="text-xs text-slate-400">
            Subscription cancelled. {plan.expiresAt && <>Access until {format(plan.expiresAt, "d MMM yyyy")}.</>}
          </p>
          <button
            onClick={() => router.push("/billing/upgrade")}
            className="mt-2 text-xs font-semibold text-blue-600 underline"
          >
            Dobara activate karein →
          </button>
        </div>
      )}
    </div>
  );
}

export function BillingContent() {
  return (
    <Suspense fallback={<BillingSkeleton />}>
      <BillingContentInner />
    </Suspense>
  );
}
