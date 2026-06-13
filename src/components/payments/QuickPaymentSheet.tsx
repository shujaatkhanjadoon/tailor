// src/components/payments/QuickPaymentSheet.tsx
"use client";

import { useState } from "react";
import { X, Search, Loader2, CheckCircle2 } from "lucide-react";
import type { OrderRecord } from "@/lib/db/schema";
import { paymentOps } from "@/lib/db/operations";
import { useAuth } from "@/lib/auth/AuthContext";
import { GARMENT_LABELS } from "@/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { orderBalance, orderPaymentProgress } from "@/lib/payments/calculations";
import { useOrders } from "@/hooks/useOrders";
import { formatAmount, formatRupees } from "@/lib/format/currency";

const METHODS = [
  { key: "cash", label: "Cash", emoji: "💵" },
  { key: "easypaisa", label: "Easypaisa", emoji: "📱" },
  { key: "jazzcash", label: "JazzCash", emoji: "📲" },
  { key: "bank", label: "Bank", emoji: "🏦" },
] as const;

interface Props {
  onClose: () => void;
  onSaved: () => void;
  preOrder?: OrderRecord; // if opened from a specific order
  customerId?: string;    // filter orders to this customer
}

export function QuickPaymentSheet({ onClose, onSaved, preOrder, customerId }: Props) {
  const { shopId, currentUser } = useAuth();
  const [selectedOrder, setSelected] = useState<OrderRecord | null>(
    preOrder ?? null,
  );
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<
    "cash" | "easypaisa" | "jazzcash" | "bank"
  >("cash");
  const [notes, setNotes] = useState("");
  const [surplusKind, setSurplusKind] = useState<"tip" | "overpayment" | "auto_transfer">("auto_transfer");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [search, setSearch] = useState("");
  const [step, setStep] = useState<"pick" | "amount">(
    preOrder ? "amount" : "pick",
  );

  const { orders } = useOrders(shopId, "owner", currentUser?.id);
  const pendingOrders = orders
    .filter(o => o.status !== "cancelled" && orderBalance(o) > 0 && (!customerId || o.customerId === customerId))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const filteredOrders = pendingOrders.filter((o) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      o.customerName.toLowerCase().includes(q) ||
      String(o.orderNumber).includes(q)
    );
  });

  const balance = selectedOrder ? orderBalance(selectedOrder) : 0;
  const enteredAmount = parseInt(amount || "0");
  const surplus = selectedOrder ? Math.max(0, enteredAmount - balance) : 0;
  const appliedToSelected = selectedOrder ? Math.min(enteredAmount, balance) : 0;
  const transferTargets = pendingOrders
    .filter((o) =>
      selectedOrder &&
      o.id !== selectedOrder.id &&
      o.customerId === selectedOrder.customerId &&
          orderBalance(o) > 0
    )
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const handleSave = async () => {
    const amt = parseInt(amount);
    if (!amt || amt <= 0 || !selectedOrder || !currentUser || !shopId) return;
    setSaving(true);
    try {
      const shouldTransfer = surplus > 0 && surplusKind === "auto_transfer";

      if (appliedToSelected > 0) {
        await paymentOps.add(shopId, {
          orderId: selectedOrder.id,
          amount: appliedToSelected,
          method,
          recordedBy: currentUser.id,
          kind: "order_payment",
          appliedToBalance: appliedToSelected,
          notes: [
            notes.trim(),
            surplus > 0
              ? `Received ${formatRupees(amt)}; ${formatRupees(appliedToSelected)} applied to this order.`
              : "",
          ].filter(Boolean).join(" · ") || undefined,
        });
      }

      if (surplus > 0) {
        let remaining = surplus;
        if (shouldTransfer) for (const target of transferTargets) {
          if (remaining <= 0) break;
          const targetBalance = orderBalance(target);
          const applied = Math.min(remaining, targetBalance);
          if (applied <= 0) continue;

          await paymentOps.add(shopId, {
            orderId: target.id,
            amount: applied,
            method,
            recordedBy: currentUser.id,
            kind: "order_payment",
            appliedToBalance: applied,
            notes: [
              notes.trim(),
              `Auto-adjusted from order #${String(selectedOrder.orderNumber).padStart(3, "0")}.`,
            ].filter(Boolean).join(" · "),
          });
          remaining -= applied;
        }

        if (remaining > 0) {
          const finalKind = surplusKind === "tip" ? "tip" : "overpayment";
          await paymentOps.add(shopId, {
            orderId: selectedOrder.id,
            amount: remaining,
            method,
            recordedBy: currentUser.id,
            kind: finalKind,
            appliedToBalance: 0,
            notes: [
              notes.trim(),
              finalKind === "tip"
                ? `Tip: Rs. ${remaining.toLocaleString()}.`
                : `Unallocated overpayment: Rs. ${remaining.toLocaleString()}.`,
            ].filter(Boolean).join(" · "),
          });
        }
      }
      setSaved(true);
      toast.success("Payment Record Ho Gayi! 💰", {
        description: `Rs. ${parseInt(amount).toLocaleString()} save ho gaya`,
      });
      setTimeout(() => {
        onSaved();
        onClose();
      }, 1000);
    } catch (e) {
      console.error(e);
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center lg:items-center"
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      <div
        className="mb-16 lg:mb-0 relative z-10 flex max-h-[80dvh] lg:max-h-[90dvh] w-full max-w-[min(100vw,34rem)] flex-col bg-white shadow-2xl rounded-t-3xl lg:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mt-3 mb-1 shrink-0 lg:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h3 className="font-bold text-slate-800">Payment Record Karein</h3>
            {selectedOrder && step === "amount" && (
              <p className="text-xs text-slate-400 mt-0.5">
                #{String(selectedOrder.orderNumber).padStart(3, "0")} ·{" "}
                {selectedOrder.customerName}
              </p>
            )}
          </div>
          <button
            aria-label="Close payment sheet"
            onClick={onClose}
            className="w-11 h-11 flex items-center justify-center rounded-full bg-slate-100"
          >
            <X size={15} className="text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* ── SUCCESS ── */}
          {saved && (
            <div className="flex flex-col items-center py-10 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-3">
                <CheckCircle2 size={32} className="text-green-600" />
              </div>
              <p className="font-bold text-slate-800">Payment Save Ho Gayi!</p>
              <p className="text-sm text-slate-400 mt-1">
                Rs. {parseInt(amount).toLocaleString()} record ho gaya
              </p>
            </div>
          )}

          {/* ── STEP 1: Pick Order ── */}
          {!saved && step === "pick" && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Kaun se order ka payment?
              </p>

              {/* Search */}
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  placeholder="Naam ya order # dhundein..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-4 py-2.5 bg-slate-100 rounded-xl text-sm
                             outline-none focus:bg-white border-2 border-transparent
                             focus:border-blue-500 transition-all"
                />
              </div>

              {filteredOrders.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                  <p className="text-2xl mb-2">✅</p>
                  <p className="text-sm font-medium">
                    Sab payments complete hain!
                  </p>
                  <p className="text-xs mt-1">Koi baaki order nahi</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredOrders.map((o) => {
                    const gc =
                      GARMENT_LABELS[
                        o.garmentType as keyof typeof GARMENT_LABELS
                      ];
                    const bal = orderBalance(o);
                    const pct = orderPaymentProgress(o);

                    return (
                      <button
                        key={o.id}
                        onClick={() => {
                          setSelected(o);
                          setStep("amount");
                        }}
                        className="w-full flex items-center gap-3 p-4 bg-slate-50
                                   border border-slate-200 rounded-2xl text-left
                                   hover:border-blue-400 hover:bg-blue-50 transition-all
                                   active:scale-[0.98]"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <p className="font-semibold text-slate-800 truncate text-sm">
                              {o.customerName}
                            </p>
                            <span className="text-xs font-bold text-slate-500 ml-2 shrink-0">
                              #{String(o.orderNumber).padStart(3, "0")}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mb-2">
                            {gc?.emoji} {gc?.label}
                          </p>
                          <div className="h-1 bg-slate-200 rounded-full overflow-hidden mb-1">
                            <div
                              className="h-full bg-blue-500 rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-[10px]">
                            <span className="text-slate-400">
                              Rs. {o.amountPaid.toLocaleString()} diya
                            </span>
                            <span className="text-red-600 font-semibold">
                              Rs. {bal.toLocaleString()} baaki
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── STEP 2: Amount + Method ── */}
          {!saved && step === "amount" && selectedOrder && (
            <div className="space-y-5">
              {/* Order summary */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                <div className="flex justify-between items-center mb-3">
                  <div>
                    <p className="font-bold text-slate-800">
                      {selectedOrder.customerName}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Order #
                      {String(selectedOrder.orderNumber).padStart(3, "0")} ·
                      Total Rs. {selectedOrder.totalPrice.toLocaleString()}
                    </p>
                  </div>
                  {!preOrder && (
                    <button
                      onClick={() => {
                        setSelected(null);
                        setStep("pick");
                      }}
                      className="text-xs text-blue-600 font-semibold"
                    >
                      Badlein
                    </button>
                  )}
                </div>
                <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden mb-2">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{
                      width: `${orderPaymentProgress(selectedOrder)}%`,
                    }}
                  />
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">
                    Diya: Rs. {selectedOrder.amountPaid.toLocaleString()}
                  </span>
                  <span className="text-red-600 font-bold">
                    Baaki: Rs. {balance.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Amount input */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  Kitna Mila? <span className="text-red-500">*</span>
                </label>
                <div
                  className="flex items-center gap-3 bg-slate-50 border-2 border-slate-200
                                rounded-2xl px-4 py-4 focus-within:border-blue-500 focus-within:bg-white transition-colors"
                >
                  <span className="text-slate-400 font-semibold shrink-0">
                    Rs.
                  </span>
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    autoFocus
                    className="flex-1 text-2xl font-bold text-slate-800 bg-transparent outline-none"
                  />
                </div>

                {/* Quick amounts */}
                <div className="mt-2 grid grid-cols-2 gap-2 min-[380px]:grid-cols-4">
                  {[500, 1000, balance > 0 ? balance : 2000, 2000]
                    .filter((v, i, arr) => arr.indexOf(v) === i && v > 0)
                    .slice(0, 4)
                    .map((amt) => (
                      <button
                        key={amt}
                        onClick={() => setAmount(String(amt))}
                        className={cn(
                          "py-2 text-xs font-bold rounded-xl border-2 transition-colors",
                          parseInt(amount) === amt
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-white text-slate-600 border-slate-200",
                        )}
                      >
                        {amt === balance
                          ? "Sab Baaki"
                          : amt >= 1000
                            ? formatAmount(amt)
                            : formatAmount(amt)}
                      </button>
                    ))}
                </div>
                {surplus > 0 && (
                  <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3">
                    <p className="text-xs font-semibold text-amber-800">
                      {formatRupees(surplus)} zyada receive hua. Isay kaise handle karein?
                    </p>
                    <div className="mt-2 rounded-xl bg-white/70 px-3 py-2 text-[11px] font-medium text-amber-800">
                      {formatRupees(appliedToSelected)} is order par apply hoga
                      {surplus > 0 ? ` · ${formatRupees(surplus)} extra hai` : ""}
                    </div>
                    <div className="mt-2 grid grid-cols-1 gap-2 min-[380px]:grid-cols-3">
                      {[
                        {
                          key: "auto_transfer",
                          label: transferTargets.length > 0 ? "Auto adjust" : "Overpay",
                        },
                        { key: "overpayment", label: "Keep extra" },
                        { key: "tip", label: "Tip" },
                      ].map((opt) => (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => setSurplusKind(opt.key as "tip" | "overpayment" | "auto_transfer")}
                          className={cn(
                            "rounded-xl border py-2 text-xs font-bold",
                            surplusKind === opt.key
                              ? "border-amber-600 bg-amber-600 text-white"
                              : "border-amber-200 bg-white text-amber-800",
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    {surplusKind === "auto_transfer" && transferTargets.length > 0 && (
                      <p className="mt-2 text-[10px] text-amber-700">
                        Extra amount isi customer ke purane pending orders par due-date order mein lag jayegi.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Payment method */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  Kaise Mila?
                </label>
                <div className="grid grid-cols-2 gap-2 min-[380px]:grid-cols-4">
                  {METHODS.map((m) => (
                    <button
                      key={m.key}
                      onClick={() => setMethod(m.key)}
                      className={cn(
                        "flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-all",
                        method === m.key
                          ? "border-blue-500 bg-blue-50"
                          : "border-slate-200 bg-white hover:border-slate-300",
                      )}
                    >
                      <span className="text-xl">{m.emoji}</span>
                      <span className="text-[10px] font-bold text-slate-600">
                        {m.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  Note (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Jaise: advance diya, baaki baad mein..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl
                             text-sm outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer button */}
        {!saved && step === "amount" && (
          <div className="px-5 py-4 border-t border-slate-100 shrink-0">
            <button
              onClick={handleSave}
              disabled={!amount || parseInt(amount) <= 0 || saving}
              className="w-full bg-green-600 disabled:bg-slate-300 text-white font-bold
                         py-4 rounded-2xl transition-colors active:scale-[0.98]
                         flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> Save ho raha
                  hai...
                </>
              ) : (
                <>
                  Rs. {parseInt(amount || "0").toLocaleString()} Record Karein ✓
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
