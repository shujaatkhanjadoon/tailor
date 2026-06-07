"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Store, ArrowLeft, RefreshCw, CheckCircle2, XCircle, AlertCircle,
  Clock, MessageCircle, Power, ShieldCheck, ShieldX, ShieldAlert,
  Trash2, LogIn, CreditCard, Package, Users, FileText,
  Phone, Mail, MapPin, Hash, Calendar, DollarSign,
  Activity, Clock3, ChevronRight, X, Save, Smartphone,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ShopDetail {
  id: string;
  shop_name: string;
  owner_phone: string;
  owner_email?: string;
  owner_name?: string;
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
  brand_name?: string;
  brand_color?: string;
  brand_logo_url?: string;
  subscriptions?: {
    id: string;
    plan: string;
    status: string;
    billing_cycle?: string | null;
    expires_at?: string | null;
    trial_ends_at?: string | null;
    grace_ends_at?: string | null;
    amount_pkr?: number | null;
    created_at?: string;
    updated_at: string;
  }[];
  subscription_payments?: {
    id: string;
    plan: string;
    billing_cycle: string;
    amount_pkr: number;
    method: string;
    status: string;
    paid_at: string;
    receipt_data?: Record<string, unknown>;
  }[];
  orders?: {
    id: string;
    order_number: number;
    customer_name: string;
    status: string;
    total_price: number;
    amount_paid: number;
    due_date: string;
    created_at: string;
    deleted_at?: string;
  }[];
  payments?: {
    id: string;
    order_id: string;
    amount: number;
    method: string;
    paid_at: string;
    notes?: string;
  }[];
  team_members?: {
    id: string;
    name: string;
    phone: string;
    role: string;
    is_active: boolean;
    speciality?: string;
  }[];
  order_status_history?: {
    id: string;
    order_id: string;
    old_status: string;
    new_status: string;
    changed_by: string;
    changed_at: string;
  }[];
  shop_usage?: {
    orders_this_month: number;
    customers_total: number;
    karigar_count: number;
  }[];
  audit_logs?: {
    id: string;
    action: string;
    target_type: string;
    details?: Record<string, unknown>;
    performed_at: string;
  }[];
  order_stats?: {
    total: number;
    active: number;
    delivered: number;
    total_value: number;
    received: number;
  };
}

function formatDate(value?: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-PK", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-PK", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatRupees(value?: number | null): string {
  if (value == null) return "—";
  return `Rs. ${Number(value).toLocaleString()}`;
}

function InfoRow({ icon: Icon, label, value, href }: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
  href?: string;
}) {
  const content = (
    <div className="flex items-center gap-2 bg-slate-800/50 rounded-xl px-3 py-2.5">
      <Icon size={14} className="text-slate-500 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold uppercase text-slate-500">{label}</p>
        <p className="text-xs text-slate-300 font-medium truncate">{value}</p>
      </div>
    </div>
  );
  if (href) {
    return <a href={href} target="_blank" rel="noopener noreferrer">{content}</a>;
  }
  return content;
}

function StatusBadge({ status, config }: {
  status: string;
  config: Record<string, { label: string; color: string }>;
}) {
  const cfg = config[status] ?? { label: status, color: "bg-slate-800 text-slate-400" };
  return (
    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", cfg.color)}>
      {cfg.label}
    </span>
  );
}

const SUB_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active:    { label: "Active",    color: "bg-green-900 text-green-400" },
  trialing:  { label: "Trial",     color: "bg-blue-900 text-blue-400" },
  expired:   { label: "Expired",   color: "bg-red-900 text-red-400" },
  grace:     { label: "Grace",     color: "bg-amber-900 text-amber-400" },
  cancelled: { label: "Cancelled", color: "bg-slate-800 text-slate-500" },
};

const VERIF_CONFIG: Record<string, { label: string; color: string }> = {
  pending:  { label: "Pending",  color: "bg-amber-900 text-amber-300" },
  approved: { label: "Verified", color: "bg-green-900 text-green-300" },
  rejected: { label: "Rejected", color: "bg-red-900 text-red-300" },
};

const ORDER_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending:    { label: "Pending",    color: "bg-slate-700 text-slate-300" },
  in_progress: { label: "In Progress", color: "bg-blue-900 text-blue-300" },
  cutting:    { label: "Cutting",    color: "bg-indigo-900 text-indigo-300" },
  stitching:  { label: "Stitching",  color: "bg-purple-900 text-purple-300" },
  finishing:  { label: "Finishing",  color: "bg-amber-900 text-amber-300" },
  delivered:  { label: "Delivered",  color: "bg-green-900 text-green-400" },
  cancelled:  { label: "Cancelled",  color: "bg-red-900 text-red-300" },
};

function Section({ title, icon: Icon, children }: {
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-slate-800/40 border border-slate-700 rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700 bg-slate-800/60">
        <Icon size={15} className="text-slate-400" />
        <h2 className="text-sm font-bold text-slate-200">{title}</h2>
      </div>
      <div className="p-4">
        {children}
      </div>
    </div>
  );
}

export default function ShopDetailPage() {
  const params = useParams();
  const router = useRouter();
  const shopId = params.id as string;

  const [shop, setShop] = useState<ShopDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<string>("info");
  const [showImpersonateModal, setShowImpersonateModal] = useState(false);
  const [impersonateTotp, setImpersonateTotp] = useState("");
  const [impersonateLoading, setImpersonateLoading] = useState(false);
  const [impersonateError, setImpersonateError] = useState("");
  const [adjustDays, setAdjustDays] = useState("30");
  const [customExpiry, setCustomExpiry] = useState("");
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustError, setAdjustError] = useState("");
  const [adjustSuccess, setAdjustSuccess] = useState("");
  const [adjustTotp, setAdjustTotp] = useState("");

  const load = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/data?type=shop_detail&id=${shopId}`);
      if (res.status === 401) { window.location.href = "/admin/login"; return; }
      if (res.status === 404) { setError("Shop not found"); return; }
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setShop(data.data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-slate-400 hover:text-white">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">Loading...</h1>
          </div>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-slate-800 border border-slate-700 rounded-2xl h-20 p-4 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !shop) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-slate-400 hover:text-white">
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-xl font-bold text-white">Shop Details</h1>
        </div>
        <div className="bg-red-900/30 border border-red-700 rounded-2xl p-4">
          <p className="text-red-300 text-sm">{error || "Shop not found"}</p>
          <button onClick={load} className="mt-2 text-red-400 text-xs underline">Retry</button>
        </div>
      </div>
    );
  }

  const sub = shop.subscriptions?.[0];
  const usage = shop.shop_usage?.[0];
  const orderStats = shop.order_stats;
  const isActive = shop.is_active !== false;
  const isVerified = shop.verification_status === "approved";

  const tabs = [
    { key: "info", label: "Info", icon: Store },
    { key: "orders", label: "Orders", icon: Package },
    { key: "payments", label: "Payments", icon: CreditCard },
    { key: "subscription", label: "Subscription", icon: Activity },
    { key: "team", label: "Team", icon: Users },
    { key: "logs", label: "Activity Log", icon: FileText },
  ];

  const handleImpersonateConfirm = useCallback(async () => {
    if (!shopId || impersonateLoading || impersonateTotp.length !== 6) return;
    setImpersonateLoading(true);
    setImpersonateError("");
    try {
      const res = await fetch("/api/admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopId, totpCode: impersonateTotp }),
      });
      const data = await res.json();
      if (res.status === 401 && data.requiresTOTP) { setImpersonateError(data.error ?? "TOTP required"); return; }
      if (!data.success) { setImpersonateError(data.error ?? "Failed"); return; }
      window.location.href = "/orders";
    } catch { setImpersonateError("Server error"); }
    finally { setImpersonateLoading(false); }
  }, [shopId, impersonateTotp, impersonateLoading]);

  const handleExtendExpiry = async () => {
    if (!shopId || !adjustDays) return;
    setAdjustError(""); setAdjustSuccess("");
    try {
      const res = await fetch("/api/admin/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "extend_expiry", shopId, days: Number(adjustDays), totpCode: adjustTotp || undefined }),
      });
      const data = await res.json();
      if (res.status === 401 && data.requiresTOTP) { setAdjustError("TOTP code chahiye — neeche enter karein"); return; }
      if (!data.success) throw new Error(data.error ?? "Failed");
      setAdjustSuccess(`Expiry extended by ${adjustDays} days`);
      setTimeout(() => setAdjustSuccess(""), 3000);
      await load();
    } catch (e) { setAdjustError(String(e)); }
  };

  const handleSetCustomExpiry = async () => {
    if (!shopId || !customExpiry) return;
    setAdjustError(""); setAdjustSuccess("");
    try {
      const res = await fetch("/api/admin/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_custom_expiry", shopId, expiresAt: new Date(customExpiry).toISOString(), totpCode: adjustTotp || undefined }),
      });
      const data = await res.json();
      if (res.status === 401 && data.requiresTOTP) { setAdjustError("TOTP code chahiye — neeche enter karein"); return; }
      if (!data.success) throw new Error(data.error ?? "Failed");
      setAdjustSuccess("Custom expiry set");
      setTimeout(() => setAdjustSuccess(""), 3000);
      await load();
    } catch (e) { setAdjustError(String(e)); }
  };

  const handleUpdateAmount = async () => {
    if (!shopId || !adjustAmount) return;
    setAdjustError(""); setAdjustSuccess("");
    try {
      const res = await fetch("/api/admin/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_subscription_amount", shopId, amountPkr: Number(adjustAmount), totpCode: adjustTotp || undefined }),
      });
      const data = await res.json();
      if (res.status === 401 && data.requiresTOTP) { setAdjustError("TOTP code chahiye — neeche enter karein"); return; }
      if (!data.success) throw new Error(data.error ?? "Failed");
      setAdjustSuccess("Amount updated");
      setTimeout(() => setAdjustSuccess(""), 3000);
      await load();
    } catch (e) { setAdjustError(String(e)); }
  };

  const handleToggleActive = useCallback(async () => {
    if (!shopId) return;
    setAdjustError("");
    const action = isActive ? "deactivate_shop" : "activate_shop";
    try {
      const res = await fetch("/api/admin/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, shopId, reason: "Quick action from shop detail" }),
      });
      const data = await res.json();
      if (res.status === 401 && data.requiresTOTP) { setAdjustError("TOTP code required"); return; }
      if (!data.success) throw new Error(data.error ?? "Failed");
      await load();
    } catch (e) { setAdjustError(String(e)); }
  }, [shopId, isActive, load]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <button onClick={() => router.back()} className="mt-1 text-slate-400 hover:text-white">
            <ArrowLeft size={18} />
          </button>
          <div className="w-10 h-10 bg-slate-700 rounded-xl flex items-center justify-center shrink-0">
            <Store size={18} className="text-slate-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-white">{shop.shop_name}</h1>
              <StatusBadge status={isActive ? (sub?.status ?? "active") : "inactive"} config={{
                ...SUB_STATUS_CONFIG,
                inactive: { label: "Inactive", color: "bg-red-900 text-red-300" },
              }} />
              <StatusBadge status={shop.verification_status ?? "pending"} config={VERIF_CONFIG} />
            </div>
            <p className="text-slate-500 text-xs font-mono mt-0.5">{shop.owner_phone}</p>
            <p className="text-slate-600 text-[10px] mt-0.5">ID: {shop.id}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => { setShowImpersonateModal(true); setImpersonateTotp(""); setImpersonateError(""); }}
            className="flex items-center gap-1.5 border border-blue-800 bg-blue-950/30
                       text-blue-400 hover:bg-blue-900/50 text-xs font-semibold px-3 py-2 rounded-xl"
          >
            <LogIn size={12} /> Login as Shop
          </button>
          <button onClick={load} disabled={loading}
            className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600
                       text-slate-300 text-xs font-semibold px-3 py-2 rounded-xl disabled:opacity-50"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: "Plan", value: shop.plan, icon: Activity, color: "text-blue-400" },
          { label: "Orders (Total)", value: orderStats?.total ?? 0, icon: Package, color: "text-green-400" },
          { label: "Active Orders", value: orderStats?.active ?? 0, icon: Clock, color: "text-amber-400" },
          { label: "Revenue", value: formatRupees(orderStats?.received), icon: DollarSign, color: "text-purple-400" },
        ].map(stat => (
          <div key={stat.label} className="bg-slate-800/50 border border-slate-700 rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <stat.icon size={12} className={stat.color} />
              <p className="text-[10px] font-bold uppercase text-slate-500">{stat.label}</p>
            </div>
            <p className="text-sm font-bold text-white">{String(stat.value)}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-xl bg-slate-900 p-1 [scrollbar-width:thin]">
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all",
              activeTab === tab.key ? "bg-slate-700 text-white" : "text-slate-500 hover:text-slate-300",
            )}
          >
            <tab.icon size={12} /> {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "info" && (
        <div className="space-y-4">
          <Section title="Shop Information" icon={Store}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              <InfoRow icon={Store} label="Shop Name" value={shop.shop_name} />
              <InfoRow icon={Phone} label="Phone" value={shop.owner_phone} href={`tel:${shop.owner_phone}`} />
              <InfoRow icon={Mail} label="Email" value={shop.owner_email ?? "—"} href={shop.owner_email ? `mailto:${shop.owner_email}` : undefined} />
              <InfoRow icon={Calendar} label="Member Since" value={formatDate(shop.created_at)} />
              <InfoRow icon={Hash} label="PIN" value={shop.owner_pin_available ? (shop.owner_pin ?? "Available") : "Reset required"} />
              <InfoRow icon={ShieldCheck} label="Verification" value={shop.verification_status ?? "—"} />
            </div>
          </Section>

          <Section title="Address" icon={MapPin}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              <InfoRow icon={MapPin} label="Address" value={shop.address_line ?? "—"} />
              <InfoRow icon={MapPin} label="City" value={shop.city ?? "—"} />
              <InfoRow icon={MapPin} label="State/Province" value={shop.state_province ?? "—"} />
              <InfoRow icon={MapPin} label="Postal Code" value={shop.postal_code ?? "—"} />
            </div>
          </Section>

          {shop.brand_name && (
            <Section title="Branding" icon={Store}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <InfoRow icon={Store} label="Brand Name" value={shop.brand_name} />
                {shop.brand_color && (
                  <div className="flex items-center gap-2 bg-slate-800/50 rounded-xl px-3 py-2.5">
                    <div className="w-4 h-4 rounded shrink-0" style={{ backgroundColor: shop.brand_color }} />
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-500">Brand Color</p>
                      <p className="text-xs text-slate-300">{shop.brand_color}</p>
                    </div>
                  </div>
                )}
              </div>
            </Section>
          )}

          <Section title="Usage" icon={Activity}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: "Orders/Month", value: usage?.orders_this_month ?? 0 },
                { label: "Total Customers", value: usage?.customers_total ?? 0 },
                { label: "Karigars", value: usage?.karigar_count ?? 0 },
                { label: "Usage", value: usage ? `${usage.orders_this_month} / ${usage.customers_total}` : "—" },
              ].map(item => (
                <div key={item.label} className="rounded-xl border border-slate-700 bg-slate-900/40 p-3">
                  <p className="text-[10px] font-bold uppercase text-slate-500">{item.label}</p>
                  <p className="text-xs font-semibold text-slate-300 mt-0.5">{String(item.value)}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Quick Actions" icon={Activity}>
            <div className="flex flex-wrap gap-2">
              {shop.owner_phone && (
                <a href={`https://wa.me/92${shop.owner_phone.replace(/^0/, "").replace(/\D/g, "")}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 bg-green-900/40 border border-green-800 text-green-400 text-xs font-semibold px-3 py-2 rounded-xl hover:bg-green-900/60">
                  <MessageCircle size={12} /> WhatsApp
                </a>
              )}
              <button onClick={handleToggleActive}
                className="flex items-center gap-1.5 bg-red-900/40 border border-red-800 text-red-400 text-xs font-semibold px-3 py-2 rounded-xl hover:bg-red-900/60">
                <Power size={12} /> {isActive ? "Deactivate" : "Activate"}
              </button>
            </div>
          </Section>
        </div>
      )}

      {activeTab === "orders" && (
        <Section title={`Orders (${shop.orders?.filter(o => !o.deleted_at).length ?? 0})`} icon={Package}>
          {(!shop.orders || shop.orders.length === 0) ? (
            <p className="text-slate-500 text-xs text-center py-6">No orders yet</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-2 text-[10px] font-bold text-slate-500 uppercase px-2 pb-1">
                <span>#</span><span>Customer</span><span>Status</span><span>Total</span><span>Date</span>
              </div>
              {shop.orders.filter(o => !o.deleted_at).map(order => (
                <div key={order.id}
                  className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-2 items-center
                             bg-slate-800/30 rounded-xl px-3 py-2 text-xs"
                >
                  <span className="text-slate-400 font-mono">#{order.order_number}</span>
                  <span className="text-slate-300 truncate">{order.customer_name}</span>
                  <StatusBadge status={order.status} config={ORDER_STATUS_CONFIG} />
                  <span className="text-slate-300 font-medium">{formatRupees(order.total_price)}</span>
                  <span className="text-slate-500 text-[10px]">{formatDate(order.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {activeTab === "payments" && (
        <div className="space-y-4">
          <Section title={`Subscription Payments (${shop.subscription_payments?.length ?? 0})`} icon={CreditCard}>
            {(!shop.subscription_payments || shop.subscription_payments.length === 0) ? (
              <p className="text-slate-500 text-xs text-center py-6">No payments yet</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 text-[10px] font-bold text-slate-500 uppercase px-2 pb-1">
                  <span>Plan</span><span>Amount</span><span>Status</span><span>Date</span>
                </div>
                {shop.subscription_payments.map(p => (
                  <div key={p.id}
                    className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center
                               bg-slate-800/30 rounded-xl px-3 py-2 text-xs"
                  >
                    <span className="text-slate-300">{p.plan} ({p.billing_cycle})</span>
                    <span className="text-slate-300 font-medium">{formatRupees(p.amount_pkr)}</span>
                    <StatusBadge status={p.status} config={{
                      pending: { label: "Pending", color: "bg-amber-900 text-amber-300" },
                      completed: { label: "Completed", color: "bg-green-900 text-green-400" },
                      failed: { label: "Failed", color: "bg-red-900 text-red-300" },
                      refunded: { label: "Refunded", color: "bg-purple-900 text-purple-300" },
                    }} />
                    <span className="text-slate-500 text-[10px]">{formatDate(p.paid_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title={`Order Payments (${shop.payments?.length ?? 0})`} icon={DollarSign}>
            {(!shop.payments || shop.payments.length === 0) ? (
              <p className="text-slate-500 text-xs text-center py-6">No order payments yet</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                <div className="grid grid-cols-[auto_1fr_auto_auto] gap-2 text-[10px] font-bold text-slate-500 uppercase px-2 pb-1">
                  <span>Amount</span><span>Method</span><span>Notes</span><span>Date</span>
                </div>
                {shop.payments.map(p => (
                  <div key={p.id}
                    className="grid grid-cols-[auto_1fr_auto_auto] gap-2 items-center
                               bg-slate-800/30 rounded-xl px-3 py-2 text-xs"
                  >
                    <span className="text-slate-300 font-medium">{formatRupees(p.amount)}</span>
                    <span className="text-slate-400">{p.method}</span>
                    <span className="text-slate-500 truncate">{p.notes ?? "—"}</span>
                    <span className="text-slate-500 text-[10px]">{formatDate(p.paid_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
      )}

      {activeTab === "subscription" && (
        <div className="space-y-4">
          <Section title={`Subscription Timeline (${shop.subscriptions?.length ?? 0} entries)`} icon={Activity}>
            {(!shop.subscriptions || shop.subscriptions.length === 0) ? (
              <p className="text-slate-500 text-xs text-center py-6">No subscription history</p>
            ) : (
              <div className="space-y-2">
                {shop.subscriptions.map(s => (
                  <div key={s.id}
                    className="bg-slate-800/30 rounded-xl px-4 py-3 space-y-2"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-slate-200">{s.plan}</span>
                      <StatusBadge status={s.status} config={SUB_STATUS_CONFIG} />
                      {s.billing_cycle && (
                        <span className="text-[10px] text-slate-500 bg-slate-700 px-2 py-0.5 rounded-full">
                          {s.billing_cycle}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[10px]">
                      {s.amount_pkr != null && (
                        <div>
                          <span className="text-slate-500">Amount: </span>
                          <span className="text-slate-300 font-medium">{formatRupees(s.amount_pkr)}</span>
                        </div>
                      )}
                      <div>
                        <span className="text-slate-500">Expires: </span>
                        <span className="text-slate-300">{formatDate(s.expires_at)}</span>
                      </div>
                      {s.trial_ends_at && (
                        <div>
                          <span className="text-slate-500">Trial Ends: </span>
                          <span className="text-slate-300">{formatDate(s.trial_ends_at)}</span>
                        </div>
                      )}
                      {s.grace_ends_at && (
                        <div>
                          <span className="text-slate-500">Grace Ends: </span>
                          <span className="text-slate-300">{formatDate(s.grace_ends_at)}</span>
                        </div>
                      )}
                      <div>
                        <span className="text-slate-500">Updated: </span>
                        <span className="text-slate-300">{formatDate(s.updated_at)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Manual Subscription Adjustment */}
          <Section title="Subscription Adjustment" icon={Activity}>
            <p className="text-xs text-slate-500 mb-3">
              Is shop ki subscription manually adjust karein. TOTP verification required.
            </p>
            {adjustError && (
              <div className="flex items-center gap-2 bg-red-900/30 border border-red-700 rounded-xl px-3 py-2 mb-3">
                <AlertCircle size={14} className="text-red-400" />
                <p className="text-red-300 text-xs">{adjustError}</p>
              </div>
            )}
            {adjustSuccess && (
              <div className="flex items-center gap-2 bg-green-900/30 border border-green-700 rounded-xl px-3 py-2 mb-3">
                <CheckCircle2 size={14} className="text-green-400" />
                <p className="text-green-300 text-xs font-semibold">{adjustSuccess}</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Extend by N days */}
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 space-y-2">
                <p className="text-[10px] font-bold uppercase text-slate-500">Extend Expiry (Days)</p>
                <div className="flex gap-2">
                  <input type="number" value={adjustDays}
                    onChange={(e) => setAdjustDays(e.target.value)}
                    min={1} max={365}
                    className="w-20 bg-slate-700 border border-slate-600 text-slate-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-blue-500"
                  />
                  <button onClick={handleExtendExpiry}
                    className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Save size={10} /> Extend
                  </button>
                </div>
              </div>

              {/* Set custom expiry */}
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 space-y-2">
                <p className="text-[10px] font-bold uppercase text-slate-500">Set Custom Expiry</p>
                <div className="flex gap-2">
                  <input type="date" value={customExpiry}
                    onChange={(e) => setCustomExpiry(e.target.value)}
                    className="flex-1 bg-slate-700 border border-slate-600 text-slate-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-blue-500"
                  />
                  <button onClick={handleSetCustomExpiry}
                    disabled={!customExpiry}
                    className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Save size={10} /> Set
                  </button>
                </div>
              </div>

              {/* Change amount */}
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 space-y-2">
                <p className="text-[10px] font-bold uppercase text-slate-500">Change Amount (Rs.)</p>
                <div className="flex gap-2">
                  <input type="number" value={adjustAmount}
                    onChange={(e) => setAdjustAmount(e.target.value)}
                    min={0}
                    placeholder="e.g. 999"
                    className="flex-1 bg-slate-700 border border-slate-600 text-slate-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-blue-500 placeholder:text-slate-600"
                  />
                  <button onClick={handleUpdateAmount}
                    disabled={!adjustAmount}
                    className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Save size={10} /> Save
                  </button>
                </div>
              </div>
            </div>

            {/* TOTP input for adjustment actions */}
            <div className="mt-3 flex items-center gap-3">
              <div className="flex items-center gap-2 bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-1.5">
                <Smartphone size={13} className="text-slate-500" />
                <input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6}
                  placeholder="TOTP code" value={adjustTotp}
                  onChange={(e) => setAdjustTotp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="w-24 bg-transparent text-slate-200 text-xs font-mono outline-none placeholder:text-slate-600"
                />
              </div>
              <p className="text-[10px] text-slate-600">
                TOTP code required for adjustment actions
              </p>
            </div>
          </Section>
        </div>
      )}

      {activeTab === "team" && (
        <Section title={`Team Members (${shop.team_members?.length ?? 0})`} icon={Users}>
          {(!shop.team_members || shop.team_members.length === 0) ? (
            <p className="text-slate-500 text-xs text-center py-6">No team members</p>
          ) : (
            <div className="space-y-2">
              {shop.team_members.map(m => (
                <div key={m.id}
                  className="flex items-center gap-3 bg-slate-800/30 rounded-xl px-4 py-3"
                >
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold",
                    m.role === "owner" ? "bg-blue-900/50 text-blue-300" : "bg-slate-700 text-slate-400",
                  )}>
                    {m.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-200">{m.name}</p>
                    <p className="text-xs text-slate-500">{m.phone}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-full",
                      m.role === "owner" ? "bg-blue-900 text-blue-300" : "bg-slate-700 text-slate-400",
                    )}>
                      {m.role}
                    </span>
                    <StatusBadge status={m.is_active ? "active" : "inactive"} config={{
                      active: { label: "Active", color: "bg-green-900 text-green-400" },
                      inactive: { label: "Inactive", color: "bg-slate-800 text-slate-500" },
                    }} />
                  </div>
                  {m.speciality && (
                    <span className="text-[10px] text-slate-500">{m.speciality}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {activeTab === "logs" && (
        <Section title={`Activity Log (${shop.audit_logs?.length ?? 0})`} icon={FileText}>
          {(!shop.audit_logs || shop.audit_logs.length === 0) ? (
            <p className="text-slate-500 text-xs text-center py-6">No activity logged</p>
          ) : (
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {shop.audit_logs.map(log => (
                <div key={log.id}
                  className="flex items-start gap-2 bg-slate-800/20 rounded-lg px-3 py-2 text-[10px]"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-600 mt-1.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-300 font-mono">{log.action}</p>
                    {log.details && (
                      <p className="text-slate-500 truncate">{JSON.stringify(log.details)}</p>
                    )}
                  </div>
                  <span className="text-slate-600 shrink-0">{formatDateTime(log.performed_at)}</span>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* Impersonate TOTP modal */}
      {showImpersonateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-bold text-sm">Login as Shop</h3>
              <button onClick={() => { setShowImpersonateModal(false); setImpersonateTotp(""); setImpersonateError(""); }}
                className="text-slate-500 hover:text-slate-300">
                <X size={16} />
              </button>
            </div>
            {impersonateError && (
              <div className="bg-red-900/30 border border-red-700 rounded-xl px-3 py-2">
                <p className="text-red-300 text-xs">{impersonateError}</p>
              </div>
            )}
            <input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6}
              placeholder="000000" autoFocus
              value={impersonateTotp}
              onChange={(e) => setImpersonateTotp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              onKeyDown={(e) => { if (e.key === "Enter") handleImpersonateConfirm(); }}
              disabled={impersonateLoading}
              className="w-full text-center text-2xl tracking-[0.5em] font-mono bg-slate-800
                         border border-slate-600 text-white rounded-xl px-4 py-3
                         outline-none focus:border-blue-500 disabled:opacity-50"
            />
            <button onClick={handleImpersonateConfirm}
              disabled={impersonateTotp.length !== 6 || impersonateLoading}
              className="w-full flex items-center justify-center gap-2 bg-blue-600
                         hover:bg-blue-700 text-white font-bold text-sm py-3 rounded-xl
                         transition-colors disabled:opacity-50"
            >
              {impersonateLoading ? <RefreshCw size={15} className="animate-spin" /> : <LogIn size={15} />}
              {impersonateLoading ? "Verifying..." : "Login as Shop"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
