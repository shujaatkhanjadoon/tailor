"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus, RefreshCw, CheckCircle2, AlertCircle, Trash2,
  Percent, Calendar, ToggleLeft, ToggleRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ConfirmModal } from "@/components/admin/ConfirmModal";

interface Coupon {
  id: string;
  code: string;
  discount_pct: number;
  max_uses: number;
  used_count: number;
  max_uses_per_shop: number;
  min_amount_pkr?: number | null;
  applies_to_plan?: string | null;
  expires_at: string;
  is_active: boolean;
  created_at: string;
}

interface Redemption {
  coupon_id: string;
  shop_id: string;
  discounted_amount: number;
  redeemed_at: string;
}

function formatDate(value?: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-PK", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function CouponForm({ onClose, onSaved }: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [code, setCode] = useState("");
  const [discountPct, setDiscountPct] = useState("10");
  const [maxUses, setMaxUses] = useState("100");
  const [maxUsesPerShop, setMaxUsesPerShop] = useState("1");
  const [minAmountPkr, setMinAmountPkr] = useState("");
  const [appliesToPlan, setAppliesToPlan] = useState("");
  const [expiresAt, setExpiresAt] = useState(() =>
    new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!code.trim() || !discountPct) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim(),
          discountPct: Number(discountPct),
          maxUses: Number(maxUses),
          maxUsesPerShop: Number(maxUsesPerShop),
          minAmountPkr: minAmountPkr ? Number(minAmountPkr) : null,
          appliesToPlan: appliesToPlan || null,
          expiresAt: new Date(expiresAt).toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      onSaved();
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4">
        <h3 className="text-white font-bold text-sm">Create Coupon</h3>
        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-xl px-3 py-2">
            <p className="text-red-300 text-xs">{error}</p>
          </div>
        )}
        <div className="space-y-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Code</label>
            <input type="text" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="SUMMER25"
              className="w-full bg-slate-800 border border-slate-600 text-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-500 font-mono" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Discount %</label>
              <input type="number" value={discountPct} onChange={(e) => setDiscountPct(e.target.value)}
                min={1} max={100}
                className="w-full bg-slate-800 border border-slate-600 text-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Max Uses</label>
              <input type="number" value={maxUses} onChange={(e) => setMaxUses(e.target.value)}
                min={1}
                className="w-full bg-slate-800 border border-slate-600 text-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Per Shop Limit</label>
              <input type="number" value={maxUsesPerShop} onChange={(e) => setMaxUsesPerShop(e.target.value)}
                min={1}
                className="w-full bg-slate-800 border border-slate-600 text-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Min Amount (Rs.)</label>
              <input type="number" value={minAmountPkr} onChange={(e) => setMinAmountPkr(e.target.value)}
                placeholder="Optional"
                className="w-full bg-slate-800 border border-slate-600 text-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Applies To Plan</label>
            <select value={appliesToPlan} onChange={(e) => setAppliesToPlan(e.target.value)}
              className="w-full bg-slate-800 border border-slate-600 text-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-500"
            >
              <option value="">All Plans</option>
              <option value="professional">Professional</option>
              <option value="business">Business</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Expires At</label>
            <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)}
              className="w-full bg-slate-800 border border-slate-600 text-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-500" />
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <button onClick={onClose}
            className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-semibold py-2.5 rounded-xl transition-colors">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={saving || !code.trim()}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [success, setSuccess] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<Coupon | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/coupons");
      if (res.status === 401) { window.location.href = "/admin/login"; return; }
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setCoupons(data.data ?? []);
      setRedemptions(data.redemptions ?? []);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleActive = async (coupon: Coupon) => {
    try {
      const res = await fetch("/api/admin/coupons", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: coupon.id, isActive: !coupon.is_active }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Failed");
      setCoupons(prev => prev.map(c => c.id === coupon.id ? { ...c, is_active: !c.is_active } : c));
      setSuccess(`Coupon ${coupon.is_active ? "deactivated" : "activated"}`);
      setTimeout(() => setSuccess(""), 3000);
    } catch (e) {
      setError(String(e));
    }
  };

  const deleteCoupon = async (coupon: Coupon) => {
    try {
      const res = await fetch(`/api/admin/coupons?id=${coupon.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Failed");
      setCoupons(prev => prev.filter(c => c.id !== coupon.id));
    } catch (e) {
      setError(String(e));
    } finally {
      setConfirmDelete(null);
    }
  };

  const getRedemptionCount = (couponId: string) => redemptions.filter(r => r.coupon_id === couponId).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Coupons & Discounts</h1>
          <p className="text-slate-400 text-sm mt-0.5">{coupons.length} coupons · {redemptions.length} total redemptions</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} disabled={loading}
            className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-semibold px-3 py-2 rounded-xl disabled:opacity-50">
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-xl">
            <Plus size={12} /> New Coupon
          </button>
        </div>
      </div>

      {/* Feedback */}
      {error && (
        <div className="flex items-center gap-2 bg-red-900/30 border border-red-700 rounded-xl px-3 py-2.5">
          <AlertCircle size={14} className="text-red-400" />
          <p className="text-red-300 text-xs">{error}</p>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 bg-green-900/30 border border-green-700 rounded-xl px-3 py-2.5">
          <CheckCircle2 size={14} className="text-green-400" />
          <p className="text-green-300 text-xs font-semibold">{success}</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-slate-800 border border-slate-700 rounded-2xl h-20 p-4 animate-pulse" />
          ))}
        </div>
      )}

      {/* Coupons list */}
      {!loading && coupons.length === 0 && (
        <div className="text-center py-12">
          <Percent size={32} className="text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500 font-semibold">No coupons yet</p>
          <p className="text-slate-600 text-xs mt-1">Create your first coupon code</p>
        </div>
      )}

      {!loading && coupons.length > 0 && (
        <div className="space-y-2">
          {coupons.map(coupon => {
            const isExpired = new Date(coupon.expires_at) < new Date();
            const usagePct = Math.round((coupon.used_count / coupon.max_uses) * 100);
            const redCount = getRedemptionCount(coupon.id);
            return (
              <div key={coupon.id}
                className={cn(
                  "bg-slate-800/40 border rounded-2xl p-4",
                  !coupon.is_active ? "border-slate-700 opacity-60" :
                  isExpired ? "border-red-900/50" : "border-slate-700",
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                    coupon.is_active ? "bg-green-900/50" : "bg-slate-700",
                  )}>
                    <Percent size={16} className={coupon.is_active ? "text-green-400" : "text-slate-500"} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-white text-sm font-mono">{coupon.code}</span>
                      <span className="text-sm font-bold text-green-400">{coupon.discount_pct}% OFF</span>
                      {!coupon.is_active && (
                        <span className="text-[10px] bg-slate-700 text-slate-400 font-bold px-2 py-0.5 rounded-full">Disabled</span>
                      )}
                      {isExpired && coupon.is_active && (
                        <span className="text-[10px] bg-red-900 text-red-300 font-bold px-2 py-0.5 rounded-full">Expired</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500 mt-1">
                      <span>Uses: {redCount}/{coupon.max_uses}</span>
                      {coupon.applies_to_plan && <span>Plan: {coupon.applies_to_plan}</span>}
                      {coupon.min_amount_pkr && <span>Min: Rs.{coupon.min_amount_pkr}</span>}
                      <span>Expires: {formatDate(coupon.expires_at)}</span>
                      <span>Per shop: {coupon.max_uses_per_shop}x</span>
                    </div>
                    {/* Usage bar */}
                    <div className="mt-2 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          usagePct >= 90 ? "bg-red-500" : usagePct >= 70 ? "bg-amber-500" : "bg-green-500",
                        )}
                        style={{ width: `${Math.min(usagePct, 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <button onClick={() => toggleActive(coupon)}
                      className={cn(
                        "flex items-center gap-1 border text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors",
                        coupon.is_active
                          ? "border-amber-700 text-amber-400 hover:bg-amber-900/30"
                          : "border-green-700 text-green-400 hover:bg-green-900/30",
                      )}
                    >
                      {coupon.is_active ? <ToggleRight size={12} /> : <ToggleLeft size={12} />}
                      {coupon.is_active ? "Disable" : "Enable"}
                    </button>
                    <button onClick={() => setConfirmDelete(coupon)}
                      className="flex items-center gap-1 border border-red-800 text-red-400 text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-red-900/30 transition-colors">
                      <Trash2 size={12} /> Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create form modal */}
      {showForm && <CouponForm onClose={() => setShowForm(false)} onSaved={load} />}

      <ConfirmModal
        open={confirmDelete !== null}
        title="Delete Coupon"
        message={`Delete coupon "${confirmDelete?.code}"? This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={() => confirmDelete && deleteCoupon(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
