// src/app/auth/page.tsx
"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Scissors,
  Phone,
  CheckCircle2,
  ArrowLeft,
  Store,
  Loader2,
  AlertCircle,
  MessageCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { syncService } from "@/lib/supabase/sync-service";
import { useAuth } from "@/lib/auth/AuthContext";
import { PinPad } from "@/components/auth/PinPad";
import { db } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

type Step =
  | "phone"
  | "pin_login"
  | "setup_name"
  | "setup_pin"
  | "setup_confirm";

const OWNER_DEACTIVATED_MESSAGE =
  "The shop account associated with this number has been deactivated.";
const KARIGAR_DEACTIVATED_MESSAGE =
  "This shop has been deactivated. Please contact your shop admin or support.";
const ADMIN_WHATSAPP =
  process.env.NEXT_PUBLIC_ADMIN_WHATSAPP?.replace(/\D/g, "") || "923135931459";

export default function AuthPage() {
  const {
    login,
    setupShop,
    reinitialize,
    currentUser,
    isLoading: authLoading,
  } = useAuth();

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [shopName, setShopName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [blockedWhatsapp, setBlockedWhatsapp] = useState(false);
  const [shopDisplay, setShopDisplay] = useState("");

  const isSubmittingRef = useRef(false);
  const hasRedirected = useRef(false)

  const redirectOnce = useCallback((target: string) => {
    if (hasRedirected.current) return
    hasRedirected.current = true
    window.location.replace(target)
  }, [])

  const getRedirectTarget = useCallback((fallback: string) => {
    if (typeof window === "undefined") return fallback;

    const requested = new URLSearchParams(window.location.search).get("redirect");
    if (!requested) return fallback;

    try {
      const parsed = new URL(requested, window.location.origin);
      const target = `${parsed.pathname}${parsed.search}${parsed.hash}`;

      if (
        parsed.origin !== window.location.origin ||
        parsed.pathname === "/auth" ||
        parsed.pathname === "/login" ||
        parsed.pathname === "/setup" ||
        parsed.pathname.startsWith("/admin")
      ) {
        return fallback;
      }

      return target;
    } catch {
      return fallback;
    }
  }, []);

  // Already logged in -> redirect
  useEffect(() => {
    if (authLoading) return
    if (!currentUser) return
    if (hasRedirected.current) return

    const fallback = currentUser.role === 'karigar' ? '/karigar' : '/dashboard'
    const dest = getRedirectTarget(fallback)

    redirectOnce(dest)
  }, [currentUser, authLoading, getRedirectTarget, redirectOnce])

  // Step 1: Check phone

  const handlePhoneSubmit = useCallback(async () => {
    if (loading) return;
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length < 10) {
      setError("Sahi phone number daalein (10-11 digits)");
      return;
    }

     // Require internet for all auth operations.
    // This prevents duplicate accounts on multiple devices
    if (!navigator.onLine) {
      setError(
        "Account ke liye internet zaroor hai. WiFi ya mobile data on karein.",
      );
      return;
    }

    setLoading(true);
    setError("");
    setBlockedWhatsapp(false);

    try {
      // Always check Supabase first (source of truth).
      // Never trust local IndexedDB alone for account existence
      const { data: remoteMembers, error: fetchError } = await (supabase as any)
        .from("team_members")
        .select("id, name, role, shop_id, pin_hash, phone")
        .eq("phone", cleaned)
        .eq("is_active", true)
        .limit(1);

      if (fetchError) {
        setError("Server se connect nahi ho saka. Dobara try karein.");
        setLoading(false);
        return;
      }

      if (remoteMembers && remoteMembers.length > 0) {
        // Existing user: pull data and show PIN screen.
        const remoteMember = remoteMembers[0];

        // Get shop details
        const { data: shopRow, error: shopError } = await (supabase as any)
          .from("shops")
          .select("*")
          .eq("id", remoteMember.shop_id)
          .single();

        if (shopError || !shopRow) {
          setError("Shop record nahi mila. Support se contact karein.");
          setLoading(false);
          return;
        }

        if (shopRow.is_active === false) {
          setError(
            remoteMember.role === "owner"
              ? OWNER_DEACTIVATED_MESSAGE
              : KARIGAR_DEACTIVATED_MESSAGE,
          );
          setBlockedWhatsapp(remoteMember.role === "owner");
          setLoading(false);
          return;
        }

        if (shopRow) {
          setShopDisplay(shopRow.shop_name);

          // Pull to local IndexedDB so offline works after login
          await db.shop.put({
            id: shopRow.id,
            shopName: shopRow.shop_name,
            ownerPhone: shopRow.owner_phone,
            whatsappNumber: shopRow.whatsapp_number ?? undefined,
            city: shopRow.city ?? undefined,
            brandName: shopRow.brand_name ?? undefined,
            brandColor: shopRow.brand_color ?? undefined,
            brandLogoUrl: shopRow.brand_logo_url ?? undefined,
            isActive: shopRow.is_active === false ? 0 : 1,
            createdAt: shopRow.created_at,
            updatedAt: shopRow.updated_at,
            _synced: 1,
            _deleted: 0,
          });

          await db.appSettings.put({
            key: "shopId",
            value: JSON.stringify(shopRow.id),
          });
        }

        // Pull all team members for this shop
        const { data: allMembers } = await (supabase as any)
          .from("team_members")
          .select("*")
          .eq("shop_id", remoteMember.shop_id)
          .eq("is_active", true);

        if (allMembers) {
          await db.teamMembers.bulkPut(
            allMembers.map((m: any) => ({
              id: m.id,
              shopId: m.shop_id,
              name: m.name,
              phone: m.phone,
              role: m.role,
              pin: m.pin_hash,
              speciality: m.speciality ?? undefined,
              payRateType: m.pay_rate_type ?? undefined,
              payRate: m.pay_rate ?? undefined,
              isActive: m.is_active ? 1 : 0,
              joinedAt: m.joined_at,
              createdAt: m.created_at,
              _synced: 1,
              _deleted: 0,
            })),
          );
        }

        // Pull orders/customers in background
        if (remoteMember.shop_id) {
          syncService.pullAll(remoteMember.shop_id).catch(console.error);
        }

        await reinitialize();
        setStep("pin_login");
      } else {
        // New user: phone does not exist anywhere, safe to create a new account.
        setStep("setup_name");
      }
    } catch (e) {
      console.error("[Auth] Phone check error:", e);
      setError("Kuch masla hua. Internet check karein aur dobara try karein.");
    } finally {
      setLoading(false);
    }
  }, [phone, loading, reinitialize]);

  // Step 2a: PIN login
  const handlePinLogin = useCallback(
    async (enteredPin: string) => {
      if (loading) return;
      setLoading(true);
      setPinError("");

      const cleaned = phone.replace(/\D/g, "");
      const success = await login(cleaned, enteredPin);

      setLoading(false);

      if (success) {
        redirectOnce(getRedirectTarget("/dashboard"))
      } else {
        setPinError("Galat PIN! Dobara try karein.");
      }
    },
    [phone, login, loading, getRedirectTarget, redirectOnce],
  );

  // Step 2b: New user setup
  const handleSetupNameNext = useCallback(() => {
    if (shopName.trim().length < 2) {
      setError("Dukaan ka naam daalein");
      return;
    }
    if (ownerName.trim().length < 2) {
      setError("Apna naam daalein");
      return;
    }
    setError("");
    setStep("setup_pin");
  }, [shopName, ownerName]);

  const handleSetupPin = useCallback((enteredPin: string) => {
    setPin(enteredPin);
    setPinError("");
    setStep("setup_confirm");
  }, []);

  const handleSetupConfirm = useCallback(
    async (enteredConfirm: string) => {
      if (isSubmittingRef.current) return;

      // Require internet for account creation.
      if (!navigator.onLine) {
        setPinError("Naya account banane ke liye internet chahiye.");
        return;
      }

      if (enteredConfirm !== pin) {
        setPinError("PIN match nahi kiya! Dobara try karein.");
        setStep("setup_pin");
        setPin("");
        return;
      }

      // Final duplicate check before creating.
      // Prevents race condition where two devices hit setup simultaneously
      const cleaned = phone.replace(/\D/g, "");
      try {
        const { data: existing } = await (supabase as any)
          .from("team_members")
          .select("id")
          .eq("phone", cleaned)
          .eq("is_active", true)
          .limit(1)
          .maybeSingle();

        if (existing) {
          // Account was just created on another device!
          setPinError(
            "Yeh phone number pehle se registered hai. Login karein.",
          );
          setStep("phone");
          setPin("");
          return;
        }
      } catch (e) {
        // If check fails, still allow creation (better UX than blocking)
        console.warn("[Auth] Duplicate check failed:", e);
      }

      isSubmittingRef.current = true;
      setLoading(true);

      try {
        await setupShop(shopName.trim(), cleaned, pin, ownerName.trim());
        redirectOnce(getRedirectTarget("/dashboard"));
      } catch (e) {
        console.error("[Auth] Setup error:", e);
        setPinError("Setup fail ho gaya. Dobara try karein.");
        setStep("setup_pin");
        isSubmittingRef.current = false;
      } finally {
        setLoading(false);
      }
    },
    [pin, shopName, ownerName, phone, setupShop, getRedirectTarget, redirectOnce],
  );

  const goBack = useCallback(() => {
    setPinError("");
    setError("");
    if (step === "pin_login") setStep("phone");
    if (step === "setup_name") setStep("phone");
    if (step === "setup_pin") setStep("setup_name");
    if (step === "setup_confirm") setStep("setup_pin");
  }, [step]);

  // Loading while auth context initializes.
  if (authLoading) {
    return (
      <div
        className="min-h-screen bg-linear-to-br from-slate-900 to-blue-950
                      flex items-center justify-center"
      >
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center
                          justify-center shadow-xl shadow-blue-900/50"
          >
            <Scissors size={26} className="text-white" strokeWidth={1.5} />
          </div>
          <div
            className="w-6 h-6 border-2 border-blue-400 border-t-transparent
                          rounded-full animate-spin"
          />
        </div>
      </div>
    );
  }

  const isSetup = step.startsWith("setup");

  return (
    <div
      className="min-h-screen bg-linear-to-br from-slate-900 via-blue-950 to-slate-900
                    flex flex-col"
    >
      {/* Brand header */}
      <div className="relative shrink-0 pt-14 pb-6 px-6 text-center">
        <div
          className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center
                        mx-auto mb-4 shadow-xl shadow-blue-900/50 border border-blue-500/30"
        >
          <Scissors size={28} className="text-white" strokeWidth={1.5} />
        </div>
        <h1 className="text-2xl font-bold text-white">DarziHub</h1>
        <p className="text-blue-300 text-sm mt-1">
          {isSetup ? "Naya account banayein" : "Apne account mein jayein"}
        </p>
      </div>

      {/* Main card */}
      <div className="relative flex-1 flex flex-col min-h-0">
        <div
          className="flex-1 bg-white rounded-t-3xl px-5 pt-7 pb-10
                        overflow-y-auto shadow-2xl sm:mx-auto sm:mb-10
                        sm:w-full sm:max-w-md sm:rounded-3xl sm:px-6"
        >
          {/* Back button */}
          {step !== "phone" && (
            <button
              onClick={goBack}
              className="flex items-center gap-1.5 text-slate-400 hover:text-slate-700
                         text-sm font-medium mb-6 transition-colors active:scale-95"
            >
              <ArrowLeft size={15} />
              Wapas
            </button>
          )}

          {/* Phone entry */}
          {step === "phone" && (
            <div>
              <h2 className="text-xl font-bold text-slate-800 mb-1">
                Phone Number Daalein
              </h2>
              <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                Existing account mein login karein ya naya account banayein -
                sab kuch automatic hai.
              </p>

              <div
                className={cn(
                  "flex items-center gap-2 border-2 rounded-2xl px-4 py-4 mb-2",
                  "transition-all duration-200",
                  error
                    ? "border-red-400 bg-red-50"
                    : "border-slate-200 bg-slate-50 focus-within:border-blue-500 focus-within:bg-white",
                )}
              >
                <span className="text-xl shrink-0">🇵🇰</span>
                <span className="text-slate-400 font-semibold text-sm shrink-0">
                  +92
                </span>
                <div className="w-px h-5 bg-slate-300 shrink-0" />
                <input
                  type="tel"
                  inputMode="numeric"
                  placeholder="03XX-XXXXXXX"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value.replace(/\D/g, "").slice(0, 11));
                    setError("");
                    setBlockedWhatsapp(false);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handlePhoneSubmit()}
                  autoFocus
                  className="flex-1 text-xl font-bold text-slate-800 bg-transparent
                             outline-none placeholder:text-slate-300 font-mono tracking-wider"
                />
                {phone.replace(/\D/g, "").length >= 10 && (
                  <CheckCircle2 size={20} className="text-green-500 shrink-0" />
                )}
              </div>

              {error && (
                <div className="mb-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
                    <p className="text-red-600 text-xs font-semibold leading-relaxed">
                      {error}
                    </p>
                  </div>
                  {blockedWhatsapp && (
                    <a
                      href={`https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent("Assalam o Alaikum, my shop account has been deactivated. Please help.")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-green-700"
                    >
                      <MessageCircle size={16} />
                      Contact Super Admin on WhatsApp
                    </a>
                  )}
                </div>
              )}

              {/* Offline warning */}
              {typeof window !== "undefined" && !navigator.onLine && (
                <div
                  className="flex items-center gap-2 bg-amber-50 border border-amber-200
                    rounded-2xl px-4 py-3 mb-3"
                >
                  <span className="text-amber-600 text-sm">📡</span>
                  <p className="text-amber-700 text-xs font-medium">
                    Internet nahi hai - account create karne ke liye internet
                    chahiye
                  </p>
                </div>
              )}

              <button
                onClick={handlePhoneSubmit}
                disabled={loading || phone.replace(/\D/g, "").length < 10}
                className="w-full bg-blue-600 disabled:bg-slate-300 text-white font-bold
                           py-4 rounded-2xl text-base transition-all active:scale-[0.98]
                           flex items-center justify-center gap-2 mt-2
                           shadow-lg shadow-blue-200 disabled:shadow-none"
              >
                {loading ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <>
                    <Phone size={18} />
                    Aage Barein
                  </>
                )}
              </button>

              {/* Info */}
              <div className="mt-6 bg-slate-50 border border-slate-200 rounded-2xl p-4">
                <p className="text-xs text-slate-500 leading-relaxed text-center">
                  Pehli baar? <strong>Naya account</strong> automatic ban
                  jayega. Wapas aa rahe hain? <strong>PIN se login</strong> ho
                  jayega.
                </p>
              </div>
            </div>
          )}

          {/* PIN login */}
          {step === "pin_login" && (
            <div className="flex flex-col items-center">
              {/* Shop + phone badge */}
              <div
                className="flex items-center gap-3 bg-blue-50 border border-blue-200
                              rounded-2xl px-4 py-3 mb-7 w-full"
              >
                <div
                  className="w-10 h-10 bg-blue-600 rounded-xl flex items-center
                                justify-center shrink-0"
                >
                  <Store size={18} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-800 text-sm truncate">
                    {shopDisplay}
                  </p>
                  <p className="text-xs text-slate-500 font-mono">
                    +92{phone.replace(/^0/, "")}
                  </p>
                </div>
                <button
                  onClick={() => setStep("phone")}
                  className="text-xs text-blue-600 font-semibold shrink-0"
                >
                  Badlein
                </button>
              </div>

              <h2 className="text-xl font-bold text-slate-800 mb-1 text-center">
                PIN Daalein
              </h2>
              <p className="text-slate-400 text-sm mb-7 text-center">
                Apna 4-digit PIN enter karein
              </p>

              <PinPad
                onComplete={handlePinLogin}
                disabled={loading}
                error={pinError}
                onClear={() => setPinError("")}
                label="4-digit PIN"
              />

              {loading && (
                <div className="flex items-center gap-2 mt-5 text-blue-600">
                  <Loader2 size={16} className="animate-spin" />
                  <span className="text-sm font-medium">
                    Login ho raha hai...
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Setup: shop name */}
          {step === "setup_name" && (
            <div>
              {/* Progress */}
              <div className="flex gap-2 mb-6">
                {["Dukaan", "PIN", "Confirm"].map((label, i) => (
                  <div key={label} className="flex-1">
                    <div
                      className={cn(
                        "h-1.5 rounded-full mb-1.5",
                        i === 0 ? "bg-blue-600" : "bg-slate-200",
                      )}
                    />
                    <p
                      className={cn(
                        "text-[10px] font-semibold text-center",
                        i === 0 ? "text-blue-600" : "text-slate-400",
                      )}
                    >
                      {label}
                    </p>
                  </div>
                ))}
              </div>

              <h2 className="text-xl font-bold text-slate-800 mb-1">
                Naya Account
              </h2>
              <p className="text-slate-400 text-sm mb-6">
                <span className="font-mono text-slate-600">
                  +92{phone.replace(/^0/, "")}
                </span>{" "}
                se naya account ban raha hai
              </p>

              <div className="space-y-3 mb-6">
                <div>
                  <label
                    className="block text-xs font-semibold text-slate-500
                                    uppercase tracking-wide mb-2"
                  >
                    Dukaan Ka Naam *
                  </label>
                  <input
                    type="text"
                    placeholder="Jaise: Ahmed Tailor House"
                    value={shopName}
                    onChange={(e) => {
                      setShopName(e.target.value);
                      setError("");
                    }}
                    autoFocus
                    className="w-full px-4 py-4 bg-slate-50 border-2 border-slate-200
                               rounded-2xl text-sm font-medium text-slate-800 outline-none
                               focus:border-blue-500 focus:bg-white transition-all
                               placeholder:text-slate-400"
                  />
                </div>
                <div>
                  <label
                    className="block text-xs font-semibold text-slate-500
                                    uppercase tracking-wide mb-2"
                  >
                    Aapka Naam *
                  </label>
                  <input
                    type="text"
                    placeholder="Jaise: Ahmed Bhai"
                    value={ownerName}
                    onChange={(e) => {
                      setOwnerName(e.target.value);
                      setError("");
                    }}
                    className="w-full px-4 py-4 bg-slate-50 border-2 border-slate-200
                               rounded-2xl text-sm font-medium text-slate-800 outline-none
                               focus:border-blue-500 focus:bg-white transition-all
                               placeholder:text-slate-400"
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle size={13} className="text-red-500" />
                  <p className="text-red-500 text-xs">{error}</p>
                </div>
              )}

              <button
                onClick={handleSetupNameNext}
                disabled={
                  shopName.trim().length < 2 || ownerName.trim().length < 2
                }
                className="w-full bg-blue-600 disabled:bg-slate-300 text-white font-bold
                           py-4 rounded-2xl text-base transition-all active:scale-[0.98]"
              >
                PIN Set Karein
              </button>
            </div>
          )}

          {/* Setup: set PIN */}
          {step === "setup_pin" && (
            <div className="flex flex-col items-center">
              <div className="flex gap-2 mb-6 w-full">
                {["Dukaan", "PIN", "Confirm"].map((label, i) => (
                  <div key={label} className="flex-1">
                    <div
                      className={cn(
                        "h-1.5 rounded-full mb-1.5",
                        i <= 1 ? "bg-blue-600" : "bg-slate-200",
                      )}
                    />
                    <p
                      className={cn(
                        "text-[10px] font-semibold text-center",
                        i === 1
                          ? "text-blue-600"
                          : i < 1
                            ? "text-green-600"
                            : "text-slate-400",
                      )}
                    >
                      {label}
                    </p>
                  </div>
                ))}
              </div>

              <h2 className="text-xl font-bold text-slate-800 mb-1 text-center">
                Apna PIN Banayein
              </h2>
              <p className="text-slate-400 text-sm mb-7 text-center">
                4 numbers ka secret code - yaad rakhein!
              </p>

              <PinPad
                onComplete={handleSetupPin}
                error={pinError}
                onClear={() => setPinError("")}
                label="Naya 4-digit PIN"
                sublabel="Koi bhi 4 numbers"
              />
            </div>
          )}

          {/* Setup: confirm PIN */}
          {step === "setup_confirm" && (
            <div className="flex flex-col items-center">
              <div className="flex gap-2 mb-6 w-full">
                {["Dukaan", "PIN", "Confirm"].map((label, i) => (
                  <div key={label} className="flex-1">
                    <div
                      className={cn("h-1.5 rounded-full mb-1.5", "bg-blue-600")}
                    />
                    <p
                      className={cn(
                        "text-[10px] font-semibold text-center",
                        i === 2 ? "text-blue-600" : "text-green-600",
                      )}
                    >
                      {i === 2 ? label : "Done"}
                    </p>
                  </div>
                ))}
              </div>

              <h2 className="text-xl font-bold text-slate-800 mb-1 text-center">
                PIN Confirm Karein
              </h2>
              <p className="text-slate-400 text-sm mb-7 text-center">
                Wahi PIN dobara daalein
              </p>

              <PinPad
                onComplete={handleSetupConfirm}
                disabled={loading}
                error={pinError}
                onClear={() => setPinError("")}
                label="PIN dobara daalein"
              />

              {loading && (
                <div className="flex items-center gap-2 mt-5 text-blue-600">
                  <Loader2 size={16} className="animate-spin" />
                  <span className="text-sm font-medium">
                    Account ban raha hai...
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
