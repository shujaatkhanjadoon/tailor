// src/app/customers/new/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Phone,
  User,
  CheckCircle2,
  MessageCircle,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { customerOps } from "@/lib/db/operations";
import { useAuth } from "@/lib/auth/AuthContext";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Gender = "male" | "female" | "child";

const GENDER_OPTIONS: {
  key: Gender;
  label: string;
  emoji: string;
  desc: string;
}[] = [
  { key: "male", label: "Mard", emoji: "👨", desc: "Gents kapre" },
  { key: "female", label: "Aurat", emoji: "👩", desc: "Ladies kapre" },
  { key: "child", label: "Bachcha", emoji: "👦", desc: "Bachon ke kapre" },
];

export default function NewCustomerPage() {
  const router = useRouter();
  const { shopId, isLoading: authLoading } = useAuth();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [sameAsPhone, setSameAsPhone] = useState(true);
  const [gender, setGender] = useState<Gender>("male");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [savedName, setSavedName] = useState("");
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Naam zaroor chahiye";
    if (phone.length < 10) e.phone = "Sahi phone number daalein (11 digits)";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handlePhoneChange = (val: string) => {
    const cleaned = val.replace(/\D/g, "").slice(0, 11);
    setPhone(cleaned);
    if (sameAsPhone) setWhatsapp(cleaned);
    if (errors.phone) setErrors((e) => ({ ...e, phone: "" }));
  };

  const handleSave = async () => {
    if (!validate()) return;

    // Guard: shopId must be available
    if (!shopId) {
      setError("Shop setup nahi hua. Pehle /setup par jayein.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const customer = await customerOps.add(shopId, {
        name: name.trim(),
        phone,
        whatsapp: sameAsPhone ? phone : whatsapp || undefined,
        gender,
      });

      // Also save notes if entered (update after add)
      if (notes.trim()) {
        await customerOps.update(customer.id, { notes: notes.trim() });
      }

      setSavedId(customer.id);
      setSavedName(customer.name);
      toast.success("Gahak Add Ho Gaya!", {
      description: customer.name,
    });
    } catch (e) {
      console.error("Customer save error:", e);
      setError("Save nahi hua. Dobara try karein.");
    } finally {
      setSaving(false);
    }
  };

  // ── Loading auth ────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-blue-600" />
      </div>
    );
  }

  // ── No shopId — setup not done ──────────────────────────────────
  if (!shopId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <AlertCircle size={40} className="text-amber-500 mb-4" />
        <h2 className="text-lg font-bold text-slate-800 mb-2">
          Setup Pehle Karein
        </h2>
        <p className="text-slate-500 text-sm mb-6">
          Gahak add karne se pehle dukaan ka setup zaroor karein.
        </p>
        <button
          onClick={() => router.push("/setup")}
          className="bg-blue-600 text-white font-semibold px-6 py-3 rounded-xl"
        >
          Setup Shuru Karein →
        </button>
      </div>
    );
  }

  // ── Success screen ──────────────────────────────────────────────
  if (savedId) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4">
          <CheckCircle2 size={36} className="text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-1">
          {savedName} — Save Ho Gaya!
        </h2>
        <p className="text-slate-500 text-sm mb-8">
          Gahak ki details save ho gayi hain
        </p>

        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            onClick={() => router.push(`/customers/${savedId}`)}
            className="w-full bg-blue-600 text-white font-semibold py-4 rounded-2xl"
          >
            Profile Dekhein →
          </button>
          <button
            onClick={() => router.push(`/orders/new?customerId=${savedId}`)}
            className="w-full bg-green-600 text-white font-semibold py-4 rounded-2xl"
          >
            Is Gahak Ka Order Banao
          </button>
          <button
            onClick={() => {
              setSavedId(null);
              setSavedName("");
              setName("");
              setPhone("");
              setWhatsapp("");
              setGender("male");
              setNotes("");
              setErrors({});
            }}
            className="w-full text-slate-400 font-medium py-3"
          >
            + Aur Gahak Add Karein
          </button>
        </div>
      </div>
    );
  }

  // ── Main form ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white flex flex-col pb-8">
      <header className="px-4 pt-12 lg:pt-6 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100"
          >
            <ArrowLeft size={18} className="text-slate-600" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-slate-800">Naya Gahak</h1>
            <p className="text-xs text-slate-400">
              Customer ki details bharein
            </p>
          </div>
        </div>
      </header>

      <div className="flex-1 px-4 pt-6 space-y-5">
        {/* Gender */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-3">
            Gahak kaun hai? <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-3 gap-3">
            {GENDER_OPTIONS.map(({ key, label, emoji, desc }) => (
              <button
                key={key}
                onClick={() => setGender(key)}
                className={cn(
                  "flex flex-col items-center gap-2 py-4 rounded-2xl border-2 transition-all active:scale-95",
                  gender === key
                    ? "border-blue-500 bg-blue-50"
                    : "border-slate-200 bg-white",
                )}
              >
                <span className="text-3xl">{emoji}</span>
                <span
                  className={cn(
                    "text-sm font-semibold",
                    gender === key ? "text-blue-700" : "text-slate-600",
                  )}
                >
                  {label}
                </span>
                <span className="text-[10px] text-slate-400">{desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Name */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Naam <span className="text-red-500">*</span>
          </label>
          <div
            className={cn(
              "flex items-center gap-2 bg-slate-50 border-2 rounded-xl px-4 py-3.5 transition-colors",
              errors.name
                ? "border-red-400 bg-red-50"
                : "border-slate-200 focus-within:border-blue-500 focus-within:bg-white",
            )}
          >
            <User size={16} className="text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Poora naam likhein"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors((er) => ({ ...er, name: "" }));
              }}
              className="flex-1 text-sm bg-transparent outline-none
                         text-slate-800 placeholder:text-slate-400"
            />
          </div>
          {errors.name && (
            <p className="text-xs text-red-500 mt-1 ml-1">{errors.name}</p>
          )}
        </div>

        {/* Phone */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Phone Number <span className="text-red-500">*</span>
          </label>
          <div
            className={cn(
              "flex items-center gap-2 bg-slate-50 border-2 rounded-xl px-4 py-3.5 transition-colors",
              errors.phone
                ? "border-red-400 bg-red-50"
                : "border-slate-200 focus-within:border-blue-500 focus-within:bg-white",
            )}
          >
            <span className="text-slate-500 text-sm font-medium shrink-0">
              +92
            </span>
            <div className="w-px h-4 bg-slate-300" />
            <Phone size={14} className="text-slate-400 shrink-0" />
            <input
              type="tel"
              inputMode="numeric"
              placeholder="03XX-XXXXXXX"
              value={phone}
              onChange={(e) => handlePhoneChange(e.target.value)}
              className="flex-1 text-sm bg-transparent outline-none
                         text-slate-800 placeholder:text-slate-400 font-mono"
            />
            {phone.length >= 10 && (
              <CheckCircle2
                size={15}
                className="text-green-500 shrink-0"
              />
            )}
          </div>
          {errors.phone && (
            <p className="text-xs text-red-500 mt-1 ml-1">{errors.phone}</p>
          )}
        </div>

        {/* WhatsApp */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
              <MessageCircle size={14} className="text-green-500" />
              WhatsApp Number
            </label>
            <button
              onClick={() => {
                setSameAsPhone((v) => !v);
                if (!sameAsPhone) setWhatsapp(phone);
              }}
              className="flex items-center gap-1.5 text-xs font-medium"
            >
              <div
                className={cn(
                  "w-8 h-4 rounded-full transition-colors relative",
                  sameAsPhone ? "bg-green-500" : "bg-slate-300",
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform",
                    sameAsPhone ? "translate-x-4" : "translate-x-0.5",
                  )}
                />
              </div>
              <span className="text-slate-500">Phone jaisa</span>
            </button>
          </div>

          {sameAsPhone ? (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
              <MessageCircle size={14} className="text-green-500" />
              <span className="text-sm text-green-700">
                {phone || "03XX-XXXXXXX"} — same as phone
              </span>
            </div>
          ) : (
            <div
              className="flex items-center gap-2 bg-slate-50 border-2 border-slate-200
                            rounded-xl px-4 py-3.5 focus-within:border-green-400 focus-within:bg-white transition-colors"
            >
              <MessageCircle
                size={14}
                className="text-green-500 shrink-0"
              />
              <input
                type="tel"
                inputMode="numeric"
                placeholder="WhatsApp number (agar alag ho)"
                value={whatsapp}
                onChange={(e) =>
                  setWhatsapp(e.target.value.replace(/\D/g, "").slice(0, 11))
                }
                className="flex-1 text-sm bg-transparent outline-none placeholder:text-slate-400 font-mono"
              />
            </div>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Note (Optional)
          </label>
          <textarea
            placeholder="Jaise: ghar ka pata, khaas pasand..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl
                       text-sm outline-none focus:border-blue-500 focus:bg-white
                       resize-none placeholder:text-slate-400 transition-colors"
          />
        </div>

        {/* Global error */}
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <AlertCircle size={16} className="text-red-500 shrink-0" />
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
      </div>

      {/* Save button */}
      <div className="px-4 pt-4">
        <button
          onClick={handleSave}
          disabled={saving || !name.trim() || phone.length < 10}
          className="w-full bg-blue-600 disabled:bg-slate-300 text-white font-bold
                     py-4 rounded-2xl text-base transition-colors active:scale-[0.98]
                     flex items-center justify-center gap-2"
        >
          {saving ? (
            <>
              <Loader2 size={18} className="animate-spin" /> Save ho raha hai...
            </>
          ) : name ? (
            `${name} Ko Save Karein ✓`
          ) : (
            "Gahak Save Karein"
          )}
        </button>
      </div>
    </div>
  );
}
