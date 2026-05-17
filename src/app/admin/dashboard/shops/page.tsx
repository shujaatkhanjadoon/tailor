// src/app/admin/dashboard/shops/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Search,
  RefreshCw,
  Store,
  ChevronDown,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  MessageCircle,
  Power,
  ShieldCheck,
  ShieldX,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Config ────────────────────────────────────────────────────────

const PLAN_OPTIONS = [
  { value: "starter|monthly", label: "🌱 Starter (Free)" },
  { value: "professional|monthly", label: "⭐ Professional Monthly (Rs.999)" },
  { value: "professional|yearly", label: "⭐ Professional Yearly (Rs.9,500)" },
  { value: "business|monthly", label: "👑 Business Monthly (Rs.2,499)" },
  { value: "business|yearly", label: "👑 Business Yearly (Rs.23,999)" },
];

type ShopTab =
  | "all"
  | "renewals"
  | "pending"
  | "inactive"
  | "starter"
  | "professional_monthly"
  | "professional_yearly"
  | "business_monthly"
  | "business_yearly";

const PLAN_TABS: { key: ShopTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "renewals", label: "Renewals" },
  { key: "starter", label: "Starter" },
  { key: "professional_monthly", label: "Pro Monthly" },
  { key: "professional_yearly", label: "Pro Yearly" },
  { key: "business_monthly", label: "Business Monthly" },
  { key: "business_yearly", label: "Business Yearly" },
  { key: "pending", label: "Unverified" },
  { key: "inactive", label: "Inactive" },
];

const SUB_STATUS_CONFIG: Record<
  string,
  {
    label: string;
    color: string;
    icon: LucideIcon;
  }
> = {
  active: {
    label: "Active",
    color: "bg-green-900 text-green-400",
    icon: CheckCircle2,
  },
  trialing: {
    label: "Trial",
    color: "bg-blue-900  text-blue-400",
    icon: Clock,
  },
  expired: {
    label: "Expired",
    color: "bg-red-900   text-red-400",
    icon: XCircle,
  },
  grace: {
    label: "Grace",
    color: "bg-amber-900 text-amber-400",
    icon: AlertCircle,
  },
  cancelled: {
    label: "Cancelled",
    color: "bg-slate-800 text-slate-500",
    icon: XCircle,
  },
};

const VERIF_CONFIG: Record<
  string,
  {
    label: string;
    color: string;
    icon: LucideIcon;
  }
> = {
  pending: {
    label: "Pending",
    color: "bg-amber-900 text-amber-300",
    icon: ShieldAlert,
  },
  approved: {
    label: "Verified",
    color: "bg-green-900 text-green-300",
    icon: ShieldCheck,
  },
  rejected: {
    label: "Rejected",
    color: "bg-red-900   text-red-300",
    icon: ShieldX,
  },
};

// ── Types ─────────────────────────────────────────────────────────

interface Shop {
  id: string;
  shop_name: string;
  owner_phone: string;
  owner_email?: string;
  owner_pin?: string | null;
  owner_pin_available?: boolean;
  state_province?: string;
  city?: string;
  address_line?: string;
  postal_code?: string;
  plan: string;
  is_active?: boolean;
  verification_status?: string;
  verified_at?: string;
  created_at: string;
  subscriptions?: {
    plan: string;
    status: string;
    billing_cycle?: string | null;
    expires_at?: string | null;
    trial_ends_at?: string | null;
    amount_pkr?: number | null;
  }[];
  shop_usage?: {
    orders_this_month: number;
    customers_total: number;
    karigar_count: number;
  }[];
  order_stats?: {
    total_orders: number;
    active_orders: number;
    delivered_orders: number;
    total_value: number;
    received: number;
  };
}

interface VerificationRequest {
  id: string;
  shop_id: string;
  owner_name: string;
  owner_phone: string;
  owner_email?: string;
  city?: string;
  status: string;
  requested_at: string;
  admin_note?: string;
  shop_name?: string;
}

// ── Helpers ───────────────────────────────────────────────────────

function formatDate(value?: string | null): string {
  if (!value) return "No expiry";
  return new Date(value).toLocaleDateString("en-PK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatCycle(value?: string | null): string {
  if (!value) return "Free";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getSubscription(shop: Shop) {
  return shop.subscriptions?.[0];
}

function getShopPlanKey(shop: Shop): ShopTab {
  const sub = getSubscription(shop);
  const plan = sub?.plan ?? shop.plan ?? "starter";
  const cycle = sub?.billing_cycle ?? (plan === "starter" ? null : "monthly");
  if (plan === "professional" && cycle === "yearly") return "professional_yearly";
  if (plan === "professional") return "professional_monthly";
  if (plan === "business" && cycle === "yearly") return "business_yearly";
  if (plan === "business") return "business_monthly";
  return "starter";
}

function getExpiryDays(shop: Shop): number | null {
  const sub = getSubscription(shop);
  const expiryDate = sub?.expires_at || sub?.trial_ends_at;
  if (!expiryDate) return null;
  return Math.ceil((new Date(expiryDate).getTime() - Date.now()) / 86400000);
}

function isRenewalSoon(shop: Shop): boolean {
  const sub = getSubscription(shop);
  const plan = sub?.plan ?? shop.plan ?? "starter";
  const days = getExpiryDays(shop);
  return plan !== "starter" && sub?.status === "active" && days !== null && days <= 7;
}

function buildExpiredWhatsApp(
  phone: string,
  shopName: string,
  daysLeft: number | null,
  expiryDate?: string | null,
): string {
  const clean = `92${phone.replace(/^0/, "").replace(/\D/g, "")}`;
  const dayTxt = daysLeft === 1 ? "1 din" : `${daysLeft} din`;
  const msg = encodeURIComponent(
    `Assalam o Alaikum ${shopName}!\n\n` +
      `Aapki Meradarzi subscription ${daysLeft !== null ? `${dayTxt} mein` : "jaldi"} expire ho rahi hai.` +
      (expiryDate ? `\nExpiry: ${formatDate(expiryDate)}` : "") +
      `\n\nService continue rakhne ke liye renewal karein:\n${process.env.NEXT_PUBLIC_APP_URL ?? "https://mydarzi.vercel.app"}/billing/upgrade\n\nShukriya!`,
  );
  return `https://wa.me/${clean}?text=${msg}`;
}

// ── Verification Request Card ─────────────────────────────────────

function VerificationCard({
  request,
  onAction,
}: {
  request: VerificationRequest;
  onAction: (
    shopId: string,
    status: "approved" | "rejected",
    note: string,
  ) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [note, setNote] = useState("");
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState<"approved" | "rejected" | null>(null);

  const waLink = `https://wa.me/92${request.owner_phone.replace(/^0/, "").replace(/\D/g, "")}?text=${encodeURIComponent(
    `Assalam o Alaikum ${request.owner_name}! Aapki Meradarzi shop (${request.shop_name ?? request.owner_phone}) ki verification request review ho rahi hai. Hum aapko jald batayenge. Shukriya!`,
  )}`;

  const handle = async (status: "approved" | "rejected") => {
    if (processing) return;
    setProcessing(true);
    try {
      await onAction(request.shop_id, status, note.trim());
      setDone(status);
    } catch (e) {
      alert(`Error: ${String(e)}`);
    } finally {
      setProcessing(false);
    }
  };

  if (done) {
    return (
      <div
        className={cn(
          "border rounded-2xl px-4 py-3 flex items-center gap-3",
          done === "approved"
            ? "bg-green-900/20 border-green-700"
            : "bg-slate-800 border-slate-700",
        )}
      >
        {done === "approved" ? (
          <ShieldCheck size={18} className="text-green-400 shrink-0" />
        ) : (
          <ShieldX size={18} className="text-slate-500 shrink-0" />
        )}
        <div>
          <p
            className={cn(
              "font-bold text-sm",
              done === "approved" ? "text-green-300" : "text-slate-400",
            )}
          >
            {done === "approved" ? "Approved ✓" : "Rejected"} —{" "}
            {request.owner_name}
          </p>
          <p className="text-slate-500 text-xs">{request.shop_name}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-amber-950/30 border-2 border-amber-700/60 rounded-2xl overflow-hidden">
      {/* Header */}
      <div
        className="flex items-start gap-3 p-4 cursor-pointer hover:bg-amber-900/10"
        onClick={() => setExpanded((v) => !v)}
      >
        <div
          className="w-9 h-9 bg-amber-900/50 rounded-xl flex items-center
                        justify-center shrink-0 mt-0.5"
        >
          <ShieldAlert size={16} className="text-amber-400" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-amber-200 text-sm">
              {request.owner_name}
            </p>
            <span
              className="text-[10px] bg-amber-900 text-amber-300 font-bold
                             px-2 py-0.5 rounded-full"
            >
              New Shop
            </span>
          </div>
          <p className="text-amber-400/70 text-xs font-mono mt-0.5">
            {request.owner_phone}
          </p>
          <p className="text-amber-400/50 text-[10px] mt-0.5">
            {new Date(request.requested_at).toLocaleDateString("en-PK", {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>

        <ChevronDown
          size={16}
          className={cn(
            "text-amber-600 shrink-0 mt-1 transition-transform",
            expanded && "rotate-180",
          )}
        />
      </div>

      {/* Expanded */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-amber-900/50 pt-3 space-y-3">
          {/* Details */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              { label: "Owner", value: request.owner_name },
              { label: "Phone", value: request.owner_phone },
              { label: "Email", value: request.owner_email ?? "—" },
              { label: "City", value: request.city ?? "—" },
            ].map(({ label, value }) => (
              <div key={label} className="bg-slate-800/50 rounded-xl px-3 py-2">
                <p className="text-slate-500 text-[10px] font-bold uppercase">
                  {label}
                </p>
                <p className="text-slate-300 font-medium mt-0.5 truncate">
                  {value}
                </p>
              </div>
            ))}
          </div>

          {/* Admin note */}
          <div>
            <label
              className="block text-[10px] font-bold text-slate-500
                               uppercase tracking-wide mb-1.5"
            >
              Admin Note (Optional)
            </label>
            <input
              type="text"
              placeholder="Rejection reason ya note..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full bg-slate-800 border border-slate-600 text-slate-200
                         rounded-xl px-3 py-2.5 text-sm outline-none
                         focus:border-blue-500 placeholder:text-slate-600"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={() => handle("approved")}
              disabled={processing}
              className="flex-1 bg-green-700 hover:bg-green-600 disabled:bg-slate-700
                         text-white font-bold py-3 rounded-xl text-sm
                         flex items-center justify-center gap-2 transition-colors"
            >
              {processing ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <ShieldCheck size={14} />
              )}
              Approve
            </button>
            <button
              onClick={() => handle("rejected")}
              disabled={processing}
              className="flex-1 bg-red-900/50 hover:bg-red-900/80 disabled:bg-slate-700
                         text-red-300 border border-red-800 font-bold py-3
                         rounded-xl text-sm flex items-center justify-center gap-2
                         transition-colors"
            >
              <ShieldX size={14} />
              Reject
            </button>
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 bg-green-900/40 border border-green-800
                         text-green-400 text-xs font-semibold px-3 rounded-xl
                         hover:bg-green-900/60 transition-colors"
            >
              <MessageCircle size={12} />
              WA
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Shop Card ─────────────────────────────────────────────────────

function ShopCard({
  shop,
  onPlanChange,
  onToggleActive,
  onVerifyAction,
  onDeleteShop,
}: {
  shop: Shop;
  onPlanChange: (
    shopId: string,
    planId: string,
    cycle: string,
  ) => Promise<void>;
  onToggleActive: (shop: Shop) => Promise<void>;
  onVerifyAction: (
    shopId: string,
    status: "approved" | "rejected",
  ) => Promise<void>;
  onDeleteShop: (shop: Shop) => Promise<void>;
}) {
  const sub = shop.subscriptions?.[0];
  const usage = shop.shop_usage?.[0];
  const status = sub?.status ?? "active";
  const plan = sub?.plan ?? shop.plan ?? "starter";
  const verif = shop.verification_status ?? "pending";
  const isVerified = verif === "approved";
  const isActive = shop.is_active !== false && isVerified;
  const billingCycle =
    sub?.billing_cycle ?? (plan === "starter" ? null : "monthly");
  const expiryDate = sub?.expires_at || sub?.trial_ends_at;

  const now = Date.now();
  const daysLeft = expiryDate
    ? Math.max(0, Math.ceil((new Date(expiryDate).getTime() - now) / 86400000))
    : null;

  const subCfg = SUB_STATUS_CONFIG[status] ?? SUB_STATUS_CONFIG.active;
  const SubIcon = isActive ? subCfg.icon : XCircle;
  const verifCfg = VERIF_CONFIG[verif] ?? VERIF_CONFIG.pending;
  const VerifIcon = verifCfg.icon;

  const warnExpiry =
    plan !== "starter" &&
    status === "active" &&
    daysLeft !== null &&
    daysLeft <= 5;

  const waLink = warnExpiry
    ? buildExpiredWhatsApp(
        shop.owner_phone,
        shop.shop_name,
        daysLeft,
        expiryDate,
      )
    : `https://wa.me/92${shop.owner_phone.replace(/^0/, "").replace(/\D/g, "")}`;

  const [changing, setChanging] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(false);

  const handlePlanSelect = async (value: string) => {
    if (!value) return;
    const [planId, cycle] = value.split("|");
    const confirmed = confirm(
      `Change ${shop.shop_name}\nFrom: ${plan}\nTo: ${planId} (${cycle})\n\nContinue?`,
    );
    if (!confirmed) return;

    setChanging(true);
    setError("");
    setSuccess(false);
    try {
      await onPlanChange(shop.id, planId, cycle);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e) {
      setError(String(e));
      setTimeout(() => setError(""), 5000);
    } finally {
      setChanging(false);
    }
  };

  return (
    <div
      className={cn(
        "bg-slate-800 border rounded-2xl overflow-hidden transition-all",
        success
          ? "border-green-600"
          : !isActive
            ? "border-red-900"
            : "border-slate-700",
      )}
    >
      {/* Header row */}
      <div
        className="flex items-start gap-3 p-4 cursor-pointer hover:bg-slate-700/50
                   transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Icon */}
        <div
          className={cn(
            "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5",
            isActive ? "bg-slate-700" : "bg-red-900/40",
          )}
        >
          <Store
            size={16}
            className={isActive ? "text-slate-400" : "text-red-500"}
          />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-slate-200 text-sm">{shop.shop_name}</p>

            {/* Active/inactive badge */}
            {!isActive && (
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full
                               bg-red-900 text-red-300"
              >
                {verif === "rejected" ? "Rejected" : "Inactive"}
              </span>
            )}

            {/* Subscription status */}
            {isActive && (
              <span
                className={cn(
                  "flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full",
                  subCfg.color,
                )}
              >
                <SubIcon size={9} />
                {subCfg.label}
                {daysLeft !== null && ` · ${daysLeft}d`}
              </span>
            )}

            {/* Plan badge */}
            <span
              className={cn(
                "text-[10px] font-bold px-2 py-0.5 rounded-full",
                plan === "professional"
                  ? "bg-blue-900   text-blue-300"
                  : plan === "business"
                    ? "bg-purple-900 text-purple-300"
                    : "bg-slate-700  text-slate-400",
              )}
            >
              {plan === "professional"
                ? "⭐"
                : plan === "business"
                  ? "👑"
                  : "🌱"}{" "}
              {plan}
            </span>

            {/* Verification badge */}
            <span
              className={cn(
                "flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full",
                verifCfg.color,
              )}
            >
              <VerifIcon size={9} />
              {verifCfg.label}
            </span>
          </div>

          {/* Phone */}
          <p className="text-slate-500 text-xs font-mono mt-0.5">
            {shop.owner_phone}
            {shop.city && (
              <span className="text-slate-600"> · {shop.city}</span>
            )}
          </p>

          {/* Email */}
          {shop.owner_email && (
            <p className="text-slate-600 text-[10px] mt-0.5">
              {shop.owner_email}
            </p>
          )}

          {/* Expiry */}
          <p className="text-[10px] mt-1">
            <span className="text-slate-600">Billing: </span>
            <span className="text-slate-400">{formatCycle(billingCycle)}</span>
            <span className="text-slate-600"> · Expiry: </span>
            <span
              className={cn(
                warnExpiry ? "text-amber-400 font-semibold" : "text-slate-400",
              )}
            >
              {formatDate(expiryDate)}
            </span>
          </p>

          {/* Usage */}
          {usage && (
            <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-600">
              <span>📋 {usage.orders_this_month}/mo</span>
              <span>👥 {usage.customers_total}</span>
              <span>✂️ {usage.karigar_count}</span>
              {sub?.amount_pkr ? (
                <span>💰 Rs.{Number(sub.amount_pkr).toLocaleString()}</span>
              ) : null}
            </div>
          )}
          {shop.order_stats && (
            <p className="mt-1 text-[10px] text-slate-500">
              Orders: {shop.order_stats.total_orders} · Active: {shop.order_stats.active_orders} · Received Rs.{shop.order_stats.received.toLocaleString()}
            </p>
          )}
        </div>

        <ChevronDown
          size={16}
          className={cn(
            "text-slate-500 shrink-0 mt-1 transition-transform",
            expanded && "rotate-180",
          )}
        />
      </div>

      {/* Expanded actions */}
      {expanded && (
        <div className="px-4 pb-4 pt-0 border-t border-slate-700 space-y-3">
          {/* Feedback */}
          {success && (
            <div
              className="flex items-center gap-2 bg-green-900/30 border border-green-700
                            rounded-xl px-3 py-2.5"
            >
              <CheckCircle2 size={14} className="text-green-400" />
              <p className="text-green-300 text-xs font-semibold">
                Updated successfully!
              </p>
            </div>
          )}
          {error && (
            <div
              className="flex items-center gap-2 bg-red-900/30 border border-red-700
                            rounded-xl px-3 py-2.5"
            >
              <AlertCircle size={14} className="text-red-400" />
              <p className="text-red-300 text-xs">{error}</p>
            </div>
          )}

          {/* Expiry warning */}
          {warnExpiry && (
            <div
              className="flex items-start gap-2 bg-amber-900/30 border border-amber-700
                            rounded-xl px-3 py-2.5"
            >
              <AlertCircle
                size={14}
                className="text-amber-400 mt-0.5 shrink-0"
              />
              <div>
                <p className="text-amber-300 text-xs font-semibold">
                  Subscription {daysLeft === 1 ? "kal" : `${daysLeft} din mein`}{" "}
                  expire ho rahi hai
                </p>
                <p className="text-amber-500/70 text-[10px] mt-0.5">
                  WhatsApp button renewal reminder ke saath ready hai
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 min-[520px]:grid-cols-4">
            {[
              { label: "Phone", value: shop.owner_phone },
              { label: "PIN", value: shop.owner_pin_available ? shop.owner_pin : "Reset required" },
              { label: "Email", value: shop.owner_email ?? "N/A" },
              { label: "Member Since", value: formatDate(shop.created_at) },
              { label: "Subscription", value: `${plan} · ${status}` },
              { label: "Expiry", value: formatDate(expiryDate) },
              { label: "Orders", value: shop.order_stats?.total_orders ?? 0 },
              { label: "Revenue", value: `Rs.${(shop.order_stats?.total_value ?? 0).toLocaleString()}` },
            ].map(item => (
              <div key={item.label} className="rounded-xl border border-slate-700 bg-slate-900/40 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{item.label}</p>
                <p className="mt-1 break-words text-xs font-semibold text-slate-300">{item.value}</p>
              </div>
            ))}
          </div>

          {(shop.address_line || shop.city || shop.state_province || shop.postal_code) && (
            <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Address</p>
              <p className="mt-1 text-xs text-slate-300">
                {[shop.address_line, shop.city, shop.state_province, shop.postal_code].filter(Boolean).join(", ")}
              </p>
            </div>
          )}

          {/* Plan change */}
          <div>
            <label
              className="block text-[10px] font-bold text-slate-500
                               uppercase tracking-wide mb-1.5"
            >
              Change Plan
            </label>
            <div className="flex gap-2">
              <select
                disabled={changing}
                defaultValue=""
                onChange={(e) => handlePlanSelect(e.target.value)}
                className="flex-1 bg-slate-700 text-slate-200 text-sm border border-slate-600
                           rounded-xl px-3 py-2.5 outline-none focus:border-blue-500
                           cursor-pointer disabled:opacity-50"
              >
                <option value="">Select plan...</option>
                {PLAN_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {changing && (
                <div className="w-10 flex items-center justify-center">
                  <RefreshCw size={15} className="text-blue-400 animate-spin" />
                </div>
              )}
            </div>
          </div>

          {/* Verification action — only for pending */}
          {verif === "pending" && (
            <div>
              <label
                className="block text-[10px] font-bold text-slate-500
                                 uppercase tracking-wide mb-1.5"
              >
                Verification
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => onVerifyAction(shop.id, "approved")}
                  className="flex-1 flex items-center justify-center gap-1.5
                             bg-green-900/40 border border-green-700 text-green-300
                             font-bold text-xs py-2.5 rounded-xl hover:bg-green-900/60
                             transition-colors"
                >
                  <ShieldCheck size={13} />
                  Verify
                </button>
                <button
                  onClick={() => onVerifyAction(shop.id, "rejected")}
                  className="flex-1 flex items-center justify-center gap-1.5
                             bg-red-900/30 border border-red-800 text-red-400
                             font-bold text-xs py-2.5 rounded-xl hover:bg-red-900/50
                             transition-colors"
                >
                  <ShieldX size={13} />
                  Reject
                </button>
              </div>
            </div>
          )}

          {/* Delete action — available after rejection */}
          {verif === "rejected" && (
            <div>
              <label
                className="block text-[10px] font-bold text-slate-500
                                 uppercase tracking-wide mb-1.5"
              >
                Rejected Account
              </label>
              <button
                type="button"
                disabled={changing}
                onClick={() => onDeleteShop(shop)}
                className="w-full flex items-center justify-center gap-1.5
                           bg-red-950/50 border border-red-800 text-red-300
                           font-bold text-xs py-2.5 rounded-xl hover:bg-red-950
                           transition-colors disabled:opacity-50"
              >
                <Trash2 size={13} />
                Delete Account
              </button>
            </div>
          )}

          {/* Quick action buttons */}
          <div className="flex flex-wrap gap-2">
            {/* WhatsApp */}
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "flex items-center gap-1.5 border text-xs font-semibold",
                "px-3 py-2 rounded-xl transition-colors",
                warnExpiry
                  ? "bg-amber-900/30 border-amber-700 text-amber-300 hover:bg-amber-900/50"
                  : "bg-green-900/30 border-green-800 text-green-400 hover:bg-green-900/50",
              )}
            >
              <MessageCircle size={12} />
              {warnExpiry ? "⚠️ WA Reminder" : "WhatsApp"}
            </a>

            {/* Activate / Deactivate */}
            {isVerified && (
              <button
                type="button"
                disabled={changing}
                onClick={() => onToggleActive(shop)}
                className={cn(
                  "flex items-center gap-1.5 border text-xs font-semibold",
                  "px-3 py-2 rounded-xl transition-colors disabled:opacity-50",
                  isActive
                    ? "bg-red-900/30 border-red-800 text-red-300 hover:bg-red-900/50"
                    : "bg-green-900/30 border-green-800 text-green-300 hover:bg-green-900/50",
                )}
              >
                <Power size={12} />
                {isActive ? "Deactivate" : "Activate"}
              </button>
            )}

            {/* Shop ID */}
            <span
              className="flex items-center ml-auto text-[10px] text-slate-600
                             font-mono"
            >
              {shop.id.slice(0, 8)}...
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────

export default function AdminShopsPage() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [pendingVerifications, setPendingVerifications] = useState<
    VerificationRequest[]
  >([]);
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<ShopTab>(
    "all",
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ── Load data ─────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [shopsRes, verifyRes] = await Promise.all([
        fetch("/api/admin/data?type=shops&limit=200"),
        fetch("/api/admin/data?type=pending_verifications"),
      ]);

      if (shopsRes.status === 401) {
        window.location.href = "/admin/login";
        return;
      }

      const [shopsData, verifyData] = await Promise.all([
        shopsRes.json(),
        verifyRes.json(),
      ]);

      if (shopsData.error) throw new Error(shopsData.error);

      setShops(shopsData.data ?? []);
      setPendingVerifications(verifyData.data ?? []);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ── Actions ───────────────────────────────────────────────────

  const handlePlanChange = useCallback(
    async (shopId: string, planId: string, cycle: string) => {
      const res = await fetch("/api/admin/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_plan", shopId, planId, cycle }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Plan change failed");

      // Optimistic update
      setShops((prev) =>
        prev.map((s) =>
          s.id !== shopId
            ? s
            : {
                ...s,
                plan: planId,
                subscriptions: [
                  {
                    ...(s.subscriptions?.[0] ?? {}),
                    plan: planId, // ← FIXED
                    status: "active",
                    billing_cycle: planId === "starter" ? null : cycle,
                  },
                ],
              },
        ),
      );
    },
    [],
  );

  const handleToggleActive = useCallback(async (shop: Shop) => {
    const active = shop.is_active !== false;
    const action = active ? "deactivate_shop" : "activate_shop";

    const confirmed = confirm(
      `${active ? "Deactivate" : "Activate"}: ${shop.shop_name}?\n\n` +
        (active
          ? "Owner login nahi kar payega. Data safe rahega."
          : "Owner dobara login kar sakta hai."),
    );
    if (!confirmed) return;

    const res = await fetch("/api/admin/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        shopId: shop.id,
        reason: "Manual admin toggle",
      }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error ?? "Toggle failed");

    setShops((prev) =>
      prev.map((s) => (s.id !== shop.id ? s : { ...s, is_active: !active })),
    );
  }, []);

  const handleVerifyAction = useCallback(
    async (shopId: string, status: "approved" | "rejected", note = "") => {
      const res = await fetch("/api/admin/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify_shop", shopId, status, note }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Verification failed");

      setShops((prev) =>
        prev.map((s) =>
          s.id !== shopId
            ? s
            : { ...s, verification_status: status, is_active: status === "approved" },
        ),
      );
      setPendingVerifications((prev) =>
        prev.filter((v) => v.shop_id !== shopId),
      );
    },
    [],
  );

  const handleDeleteShop = useCallback(async (shop: Shop) => {
    const confirmed = confirm(
      `Delete rejected account: ${shop.shop_name}?\n\n` +
        "Owner login band ho jayega aur shop admin list se hide ho jayegi. Audit log safe rahega.",
    );
    if (!confirmed) return;

    const res = await fetch("/api/admin/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "delete_shop",
        shopId: shop.id,
        reason: "Rejected account deleted by admin",
      }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error ?? "Delete failed");

    setShops((prev) => prev.filter((s) => s.id !== shop.id));
    setPendingVerifications((prev) =>
      prev.filter((v) => v.shop_id !== shop.id),
    );
  }, []);

  // ── Filter shops ──────────────────────────────────────────────
  const filtered = shops.filter((s) => {
    const matchQuery =
      !query.trim() ||
      s.shop_name.toLowerCase().includes(query.toLowerCase()) ||
      s.owner_phone.includes(query) ||
      (s.owner_email ?? "").toLowerCase().includes(query.toLowerCase());

    const matchTab =
      activeTab === "all"
        ? true
        : activeTab === "renewals"
          ? isRenewalSoon(s)
        : activeTab === "pending"
          ? (s.verification_status ?? "pending") === "pending"
        : activeTab === "inactive"
          ? s.is_active === false
          : getShopPlanKey(s) === activeTab;

    return matchQuery && matchTab;
  }).sort((a, b) => {
    const renewalA = isRenewalSoon(a) ? 0 : 1;
    const renewalB = isRenewalSoon(b) ? 0 : 1;
    if (renewalA !== renewalB) return renewalA - renewalB;
    const daysA = getExpiryDays(a) ?? Number.MAX_SAFE_INTEGER;
    const daysB = getExpiryDays(b) ?? Number.MAX_SAFE_INTEGER;
    if (daysA !== daysB) return daysA - daysB;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  // ── Counts for tab badges ─────────────────────────────────────
  const pendingCount = shops.filter(
    (s) => (s.verification_status ?? "pending") === "pending",
  ).length;
  const inactiveCount = shops.filter((s) => s.is_active === false).length;
  const tabCounts: Record<ShopTab, number> = {
    all: shops.length,
    renewals: shops.filter(isRenewalSoon).length,
    pending: pendingCount,
    inactive: inactiveCount,
    starter: shops.filter(s => getShopPlanKey(s) === "starter").length,
    professional_monthly: shops.filter(s => getShopPlanKey(s) === "professional_monthly").length,
    professional_yearly: shops.filter(s => getShopPlanKey(s) === "professional_yearly").length,
    business_monthly: shops.filter(s => getShopPlanKey(s) === "business_monthly").length,
    business_yearly: shops.filter(s => getShopPlanKey(s) === "business_yearly").length,
  };

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-white">
            All Shops
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {loading ? "Loading..." : `${shops.length} total shops`}
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700
                     text-slate-300 font-semibold px-3 py-2 rounded-xl text-sm
                     disabled:opacity-50 transition-colors"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* Pending verifications section */}
      {pendingVerifications.length > 0 && (
        <div
          className="bg-amber-950/20 border-2 border-amber-700/50
                        rounded-2xl overflow-hidden"
        >
          <div className="flex items-center gap-3 px-4 py-3 border-b border-amber-800/30">
            <ShieldAlert size={18} className="text-amber-400" />
            <div className="flex-1">
              <p className="font-bold text-amber-300 text-sm">
                {pendingVerifications.length} New Shop Verification
                {pendingVerifications.length > 1 ? "s" : ""} Pending
              </p>
              <p className="text-amber-500/70 text-xs">
                Naye account owners approve/reject karne ke liye
              </p>
            </div>
          </div>
          <div className="p-4 space-y-3">
            {pendingVerifications.map((req) => (
              <VerificationCard
                key={req.id}
                request={req}
                onAction={handleVerifyAction}
              />
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search
          size={15}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
        />
        <input
          type="text"
          placeholder="Shop name, phone ya email..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700
                     rounded-xl text-white text-sm outline-none focus:border-blue-500
                     placeholder:text-slate-600 transition-colors"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto bg-slate-900 rounded-2xl p-1">
        {PLAN_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex shrink-0 items-center justify-center gap-2",
              "py-2.5 rounded-xl text-xs font-semibold transition-all",
              "px-3",
              activeTab === tab.key
                ? "bg-slate-700 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-300",
            )}
          >
            {tab.label}
            {tabCounts[tab.key] > 0 && (
              <span
                className={cn(
                  "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                  activeTab === tab.key
                    ? tab.key === "pending"
                      ? "bg-amber-500 text-white"
                      : tab.key === "inactive"
                        ? "bg-red-500 text-white"
                        : "bg-blue-600 text-white"
                    : "bg-slate-700 text-slate-400",
                )}
              >
                {tabCounts[tab.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-2xl p-4">
          <p className="text-red-300 text-sm">{error}</p>
          <button
            onClick={load}
            className="mt-2 text-red-400 text-xs underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-slate-800 border border-slate-700 rounded-2xl
                         p-4 animate-pulse h-19"
            />
          ))}
        </div>
      )}

      {/* Shop list */}
      {!loading && !error && (
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="text-center py-12">
              <Store size={32} className="text-slate-700 mx-auto mb-3" />
              <p className="text-slate-500 font-semibold">Koi shop nahi mila</p>
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="text-blue-400 text-sm mt-2 underline"
                >
                  Search clear karein
                </button>
              )}
            </div>
          ) : (
            filtered.map((shop) => (
              <ShopCard
                key={shop.id}
                shop={shop}
                onPlanChange={handlePlanChange}
                onToggleActive={handleToggleActive}
                onVerifyAction={handleVerifyAction}
                onDeleteShop={handleDeleteShop}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
