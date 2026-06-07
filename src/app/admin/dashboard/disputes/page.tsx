"use client";

import { useState, useEffect, useCallback } from "react";
import {
  RefreshCw, AlertCircle, CheckCircle2,
  Store, DollarSign, Calendar, MessageCircle,
} from "lucide-react";

interface PaymentWithShop {
  id: string;
  shop_id: string;
  plan: string;
  billing_cycle: string;
  amount_pkr: number;
  method: string;
  status: string;
  paid_at: string;
  receipt_data?: Record<string, unknown>;
  shops?: { id: string; shop_name: string; owner_phone: string; city?: string } | null;
}

function formatDate(value?: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-PK", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function formatRupees(value?: number | null): string {
  if (value == null) return "—";
  return `Rs. ${Number(value).toLocaleString()}`;
}

export default function AdminDisputesPage() {
  const [payments, setPayments] = useState<PaymentWithShop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/data?type=disputes&limit=100");
      if (res.status === 401) { window.location.href = "/admin/login"; return; }
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setPayments(data.data ?? []);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Disputes & Refunds</h1>
          <p className="text-slate-400 text-sm mt-0.5">{payments.length} refunded payments</p>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-semibold px-3 py-2 rounded-xl disabled:opacity-50"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
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

      {/* List */}
      {!loading && payments.length === 0 && (
        <div className="text-center py-12">
          <CheckCircle2 size={32} className="text-green-700 mx-auto mb-3" />
          <p className="text-slate-500 font-semibold">No disputes or refunds</p>
          <p className="text-slate-600 text-xs mt-1">All payments are in good standing</p>
        </div>
      )}

      {!loading && payments.length > 0 && (
        <div className="space-y-2">
          {payments.map(p => (
            <div key={p.id}
              className="bg-slate-800/40 border border-slate-700 rounded-2xl p-4"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-red-900/40 rounded-xl flex items-center justify-center shrink-0">
                  <DollarSign size={16} className="text-red-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-white text-sm">
                      {p.shops?.shop_name ?? p.shop_id.slice(0, 8)}
                    </span>
                    <span className="text-[10px] bg-red-900 text-red-300 font-bold px-2 py-0.5 rounded-full">
                      Refunded
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500 mt-1">
                    <span>{p.plan} ({p.billing_cycle})</span>
                    <span className="font-mono">{formatRupees(p.amount_pkr)}</span>
                    <span>{p.method}</span>
                    <span>Paid: {formatDate(p.paid_at)}</span>
                  </div>
                  {(p.receipt_data?.refund_reason as string) && (
                    <div className="mt-2 bg-red-900/20 border border-red-800/50 rounded-lg px-3 py-1.5">
                      <p className="text-[10px] text-red-300">
                        <span className="font-semibold">Refund reason:</span> {String(p.receipt_data?.refund_reason)}
                      </p>
                    </div>
                  )}
                  {p.shops?.owner_phone && (
                    <a href={`https://wa.me/92${p.shops.owner_phone.replace(/^0/, "").replace(/\D/g, "")}`}
                      target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-2 text-[10px] text-green-400 hover:text-green-300"
                    >
                      <MessageCircle size={10} /> WhatsApp Owner
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
