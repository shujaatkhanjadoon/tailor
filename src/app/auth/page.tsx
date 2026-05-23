// src/app/auth/page.tsx
"use client";

import { useState, useCallback, useEffect, useRef, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Phone,
  User,
  Store,
  Eye,
  EyeOff,
  Loader2,
  Mail,
  ShieldCheck,
  AlertCircle,
  ArrowLeft,
  MapPin,
  Lock,
  MessageCircle,
} from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { supabase } from "@/lib/supabase/client";
import { validatePakistaniPhone } from "@/lib/security/phone";
import { SHOP_PIN_LENGTH, KARIGAR_PIN_LENGTH, validatePIN, getPINStrength } from "@/lib/security/pin";
import { verifyPIN } from "@/lib/security/pin";
import { cn } from "@/lib/utils";
import { PAKISTAN_STATE_CITIES } from "@/lib/locations/pakistan";
import Image from "next/image";

const ADMIN_WA = process.env.NEXT_PUBLIC_ADMIN_WHATSAPP ?? "";

// ── Step Types ────────────────────────────────────────────────────
type Step =
  | "phone"
  | "pin_login"
  | "setup_email"
  | "setup_otp"
  | "setup_name"
  | "setup_shop"
  | "setup_pin"
  | "setup_confirm_pin"
  | "setup_verify_request";

// ── PIN Input Component ───────────────────────────────────────────
function PINInput({
  length = SHOP_PIN_LENGTH,
  value,
  onChange,
  masked = true,
  label,
  error,
  disabled = false,
}: {
  length?: number;
  value: string;
  onChange: (v: string) => void;
  masked?: boolean;
  label?: string;
  error?: string;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const chars = value.padEnd(length, "").split("").slice(0, length);

  return (
    <div>
      {label && (
        <label className="block text-sm font-semibold text-slate-700 mb-3">
          {label}
        </label>
      )}

      {/* Visual dots */}
      <div
        className="flex gap-2 justify-center mb-3 cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {Array.from({ length }).map((_, i) => {
          const filled = i < value.length;
          return (
            <div
              key={i}
              className={cn(
                "w-10 h-12 rounded-xl border-2 flex items-center justify-center",
                "text-xl font-bold transition-all",
                filled && !masked
                  ? "border-blue-500 bg-blue-50 text-blue-800"
                  : filled
                    ? "border-blue-500 bg-blue-600"
                    : value.length === i
                      ? "border-blue-500 bg-white scale-105 shadow-sm"
                      : "border-slate-200 bg-white",
              )}
            >
              {filled && !masked ? (
                chars[i]
              ) : filled ? (
                <div className="w-2.5 h-2.5 rounded-full bg-white" />
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Hidden input */}
      <input
        ref={inputRef}
        type="tel"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={length}
        value={value}
        onChange={(e) =>
          onChange(e.target.value.replace(/\D/g, "").slice(0, length))
        }
        disabled={disabled}
        autoFocus
        className="sr-only"
      />

      {/* Tap area */}
      <button
        type="button"
        onClick={() => inputRef.current?.focus()}
        className={cn(
          "w-full py-3 rounded-xl border-2 text-sm font-medium transition-colors",
          disabled ? "opacity-50 cursor-not-allowed" : "cursor-text",
          error
            ? "border-red-300 bg-red-50 text-red-500"
            : "border-slate-200 bg-slate-50 text-slate-400 hover:border-blue-400",
        )}
      >
        {error ?? `Tap karein aur ${length}-digit PIN daalein`}
      </button>
    </div>
  );
}

// ── OTP Input Component ───────────────────────────────────────────
function OTPInput({
  value,
  onChange,
  error,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  error?: string;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  return (
    <div>
      <div
        className="flex gap-2 justify-center mb-3 cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "w-11 h-14 rounded-xl border-2 flex items-center justify-center",
              "text-xl font-bold transition-all",
              i < value.length
                ? "border-blue-500 bg-blue-50 text-blue-800"
                : value.length === i
                  ? "border-blue-500 scale-105 shadow-sm bg-white"
                  : "border-slate-200 bg-white text-slate-300",
            )}
          >
            {value[i] ?? "·"}
          </div>
        ))}
      </div>

      <input
        ref={inputRef}
        type="tel"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={6}
        value={value}
        onChange={(e) =>
          onChange(e.target.value.replace(/\D/g, "").slice(0, 6))
        }
        disabled={disabled}
        autoFocus
        className="sr-only"
      />

      <button
        type="button"
        onClick={() => inputRef.current?.focus()}
        className={cn(
          "w-full py-3 rounded-xl border-2 text-sm font-medium transition-colors",
          error
            ? "border-red-300 bg-red-50 text-red-500"
            : "border-slate-200 bg-slate-50 text-slate-400 hover:border-blue-400",
        )}
      >
        {error ?? "Tap karein aur 6-digit code daalein"}
      </button>
    </div>
  );
}

// ── Main Auth Content ─────────────────────────────────────────────
function AuthContent() {
  const searchParams = useSearchParams();
  const rawRedirect = searchParams.get("redirect") ?? "/";

  const redirectTo = (
    rawRedirect.startsWith('/auth') ||
    rawRedirect.startsWith('/login') ||
    rawRedirect.startsWith('/setup') ||
    rawRedirect.startsWith('/admin') ||
    rawRedirect.startsWith('/dashboard')
  ) ? '/' : rawRedirect

  const {
    currentUser,
    isLoading: authLoading,
    setupShop,
  } = useAuth();

  // ── Form state ─────────────────────────────────────────────────
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [shopName, setShopName] = useState("");
  const [city, setCity] = useState("");
  const [stateProvince, setStateProvince] = useState("");
  const [cityQuery, setCityQuery] = useState("");
  const [cityDropdownOpen, setCityDropdownOpen] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pinError, setPinError] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [shopDisplay, setShopDisplay] = useState("");
  const [loginPinLength, setLoginPinLength] = useState(SHOP_PIN_LENGTH);
  const [lockoutEnd, setLockoutEnd] = useState<Date | null>(null);
  const [newShopId, setNewShopId] = useState("");

  const selectedState = useMemo(
    () => PAKISTAN_STATE_CITIES.find((group) => group.state === stateProvince),
    [stateProvince],
  );
  const filteredCities = useMemo(() => {
    const query = cityQuery.trim().toLowerCase();
    const cities = selectedState?.cities ?? [];
    return query
      ? cities.filter((item) => item.toLowerCase().includes(query))
      : cities;
  }, [cityQuery, selectedState]);
  const canAddTypedCity =
    cityQuery.trim().length > 1 &&
    !filteredCities.some(
      (item) => item.toLowerCase() === cityQuery.trim().toLowerCase(),
    );
  const isSubmittingRef = useRef(false);
  const [isOnline, setIsOnline] = useState(true);
  // ── Constants (put near top of file) ─────────────────────────────
  const SESSION_KEY = 'md_session_v2'
  const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000

  // ── Helper (put near top, inside component or outside) ───────────
  function saveSessionLocally(memberId: string, shopId: string) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      memberId,
      shopId,
      expiresAt: Date.now() + SESSION_TTL_MS,
    }))
  }

  // Redirect if already logged in
  useEffect(() => {
    if (authLoading) return
    if (!currentUser) return
    // Don't redirect during new account setup steps
    if (['setup_email', 'setup_otp', 'setup_name', 'setup_shop',
      'setup_pin', 'setup_confirm_pin', 'setup_verify_request'
    ].includes(step)) return
    window.location.href =
      currentUser.role === 'karigar' ? '/karigar' : '/'
  }, [currentUser, authLoading, step])

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  // ── Lockout countdown ─────────────────────────────────────────
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  useEffect(() => {
    if (!lockoutEnd) return;
    const interval = setInterval(() => {
      const secs = Math.max(
        0,
        Math.ceil((lockoutEnd.getTime() - Date.now()) / 1000),
      );
      setLockoutSeconds(secs);
      if (secs === 0) {
        setLockoutEnd(null);
        clearInterval(interval);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutEnd]);

  // ── Helper: log attempt ───────────────────────────────────────
  const logAttempt = useCallback(
    (success: boolean, reason?: string) => {
      fetch("/api/auth/log-attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, success, failureReason: reason }),
      }).catch(() => { });
    },
    [phone],
  );

  // ── STEP: Phone check ─────────────────────────────────────────
  const handlePhoneSubmit = useCallback(async () => {
    if (loading) return;
    const result = validatePakistaniPhone(phone);
    if (!result.valid) {
      setError(result.error!);
      return;
    }
    setLoading(true);
    setError("");

    try {
      // Check Supabase for existing account
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/team_members` +
        `?phone=eq.${result.cleaned}&is_active=eq.true&deleted_at=is.null` +
        `&select=id,name,role,shop_id,pin_hash,locked_until,failed_attempts`,
        {
          headers: {
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
          },
        },
      );
      const members: any[] = await res.json();

      if (members && members.length > 0) {
        const member = members[0];
        setLoginPinLength(member.role === 'karigar' ? KARIGAR_PIN_LENGTH : SHOP_PIN_LENGTH);

        // Check lockout
        if (member.locked_until && new Date(member.locked_until) > new Date()) {
          const end = new Date(member.locked_until);
          setLockoutEnd(end);
          setError(
            `Account lock hai. ${Math.ceil((end.getTime() - Date.now()) / 60000)} minute mein try karein.`,
          );
          setLoading(false);
          return;
        }

        // Get shop name for display
        if (member.shop_id) {
          const shopRes = await fetch(
            `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/shops?id=eq.${member.shop_id}&select=shop_name`,
            {
              headers: {
                apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
              },
            },
          );
          const shops: any[] = await shopRes.json();
          if (shops?.[0]) setShopDisplay(shops[0].shop_name);
        }

        setStep("pin_login");
      } else {
        // New user
        setStep("setup_email");
      }
    } catch {
      setError("Server se connect nahi ho saka. Dobara try karein.");
    } finally {
      setLoading(false);
    }
  }, [phone, loading]);

  // ── Replace handlePINLogin ────────────────────────────────────────
  const handlePINLogin = useCallback(async (enteredPin: string) => {
    if (enteredPin.length !== loginPinLength || loading) return
    setLoading(true)
    setPinError('')

    const cleaned = phone.replace(/\D/g, '')

    try {
      // ── 1. Fetch member from Supabase (fresh data) ──────────────
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/team_members` +
        `?phone=eq.${cleaned}&is_active=eq.true&select=*&limit=1`,
        {
          headers: {
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
          },
        }
      )
      const members: any[] = await res.json()
      const member = members?.[0]

      if (!member) {
        setPinError('Account nahi mila. Phone number check karein.')
        setLoading(false)
        return
      }

      // ── 2. Check account lockout ─────────────────────────────────
      if (member.locked_until && new Date(member.locked_until) > new Date()) {
        const minsLeft = Math.ceil(
          (new Date(member.locked_until).getTime() - Date.now()) / 60000
        )
        setPinError(`Account lock hai. ${minsLeft} minute mein dobara try karein.`)
        setLockoutEnd(new Date(member.locked_until))
        setPin('')
        setLoading(false)
        return
      }

      // ── 3. Verify PIN (supports bcrypt + legacy plaintext) ───────
      const { verifyPIN } = await import('@/lib/security/pin')
      const isValid = await verifyPIN(enteredPin, member.pin_hash)

      if (!isValid) {
        const newFailed = (member.failed_attempts ?? 0) + 1
        const shouldLock = newFailed >= 5
        const lockUntil = shouldLock
          ? new Date(Date.now() + 15 * 60 * 1000).toISOString()
          : null

        // Update failed attempts in Supabase (non-blocking)
        fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/team_members?id=eq.${member.id}`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
              'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
              'Prefer': 'return=minimal',
            },
            body: JSON.stringify({
              failed_attempts: newFailed,
              ...(lockUntil ? { locked_until: lockUntil } : {}),
            }),
          }
        ).catch(console.error)

        // Log failed attempt
        fetch('/api/auth/log-attempt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: cleaned,
            success: false,
            failureReason: `Wrong PIN (attempt ${newFailed})`,
          }),
        }).catch(console.error)

        if (shouldLock) {
          const end = new Date(Date.now() + 15 * 60 * 1000)
          setLockoutEnd(end)
          setPinError('5 baar galat PIN. Account 15 minute ke liye lock ho gaya.')
        } else {
          setPinError(`PIN galat hai. ${5 - newFailed} mauqa baaki hai.`)
        }
        setPin('')
        setLoading(false)
        return
      }

      // ── 4. PIN correct — reset failed attempts ───────────────────
      fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/team_members?id=eq.${member.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify({
            failed_attempts: 0,
            locked_until: null,
            last_login_at: new Date().toISOString(),
          }),
        }
      ).catch(console.error)

      // ── 5. Log successful attempt ────────────────────────────────
      fetch('/api/auth/log-attempt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleaned, success: true }),
      }).catch(console.error)

      // ── 6. Save session (httpOnly cookie + localStorage cache) ──
      saveSessionLocally(member.id, member.shop_id)
      const sessionRes = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ memberId: member.id, shopId: member.shop_id, pin: enteredPin }),
      })
      if (!sessionRes.ok) {
        const errData = await sessionRes.json().catch(() => ({}))
        console.error('[Login] Session creation failed:', sessionRes.status, errData)
        setPinError('Session create nahi ho saka. Dobara try karein.')
        setLoading(false)
        return
      }

      // ── 7. Redirect ──────────────────────────────────────────────
      const dest = member.role === 'karigar'
        ? '/karigar'
        : redirectTo === '/auth' || redirectTo.startsWith('/auth')
          ? '/'
          : redirectTo

      window.location.href = dest

    } catch (e) {
      console.error('[Login] Error:', e)
      setPinError('Login fail ho gaya. Dobara try karein.')
      setPin('')
    } finally {
      setLoading(false)
    }
  }, [phone, loading, redirectTo, loginPinLength])

  // Auto-submit PIN when the role-specific length is entered
  useEffect(() => {
    if (step === "pin_login" && pin.length === loginPinLength) {
      handlePINLogin(pin);
    }
  }, [pin, step, handlePINLogin, loginPinLength]);

  // ── STEP: Send OTP ────────────────────────────────────────────
  const handleSendOTP = useCallback(async () => {
    if (loading) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Sahi email address daalein (jaise: name@gmail.com)");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phone.replace(/\D/g, ""),
          email: email.trim().toLowerCase(),
          purpose: "signup",
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "OTP send nahi ho saka. Dobara try karein.");
        return;
      }

      setMaskedEmail(data.maskedEmail ?? email);
      setStep("setup_otp");
    } catch {
      setError("Server error. Dobara try karein.");
    } finally {
      setLoading(false);
    }
  }, [email, phone, loading]);

  // ── STEP: Verify OTP ──────────────────────────────────────────
  const handleVerifyOTP = useCallback(
    async (enteredOtp: string) => {
      if (enteredOtp.length !== 6 || loading) return;
      setLoading(true);
      setError("");

      try {
        const res = await fetch("/api/auth/verify-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: phone.replace(/\D/g, ""),
            otp: enteredOtp,
          }),
        });
        const data = await res.json();

        if (!res.ok) {
          setError(data.error ?? "Code galat hai.");
          setOtp("");
          return;
        }

        setStep("setup_name");
      } catch {
        setError("Server error. Dobara try karein.");
      } finally {
        setLoading(false);
      }
    },
    [phone, loading],
  );

  // Auto-submit OTP
  useEffect(() => {
    if (step === "setup_otp" && otp.length === 6) {
      handleVerifyOTP(otp);
    }
  }, [otp, step, handleVerifyOTP]);

  // ── STEP: Set PIN ─────────────────────────────────────────────
  const handleSetPin = useCallback(() => {
    if (pin.length !== SHOP_PIN_LENGTH) return;
    const validation = validatePIN(pin, SHOP_PIN_LENGTH);
    if (!validation.valid) {
      setPinError(validation.error!);
      setPin("");
      return;
    }
    setPinError("");
    setStep("setup_confirm_pin");
  }, [pin]);

  useEffect(() => {
    if (step === "setup_pin" && pin.length === SHOP_PIN_LENGTH) {
      handleSetPin();
    }
  }, [pin, step, handleSetPin]);

  // ── STEP: Confirm PIN & Create Shop ──────────────────────────
  const handleConfirmPin = useCallback(
    async (enteredConfirm: string) => {
      if (enteredConfirm.length !== SHOP_PIN_LENGTH || isSubmittingRef.current) return;

      if (enteredConfirm !== pin) {
        setPinError("PIN match nahi kiya! Pehla PIN dobara try karein.");
        setStep("setup_pin");
        setPin("");
        setConfirmPin("");
        return;
      }

      // Final duplicate check
      const cleaned = phone.replace(/\D/g, "");
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/team_members` +
          `?phone=eq.${cleaned}&is_active=eq.true&deleted_at=is.null&select=id&limit=1`,
          {
            headers: {
              apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
              Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
            },
          },
        );
        const existing: any[] = await res.json();
        if (existing?.length > 0) {
          setPinError("Yeh number pehle se registered hai. Login karein.");
          setStep("phone");
          return;
        }
      } catch {
        // Network error — continue (will fail at setup if duplicate)
      }

      isSubmittingRef.current = true;
      setLoading(true);
      setPinError("");

      try {
        const createdShopId = await setupShop(
          shopName.trim(),
          cleaned,
          pin,
          ownerName.trim(),
          email.trim().toLowerCase(),
          city.trim(),
          stateProvince.trim(),
        );
        setNewShopId(createdShopId);
        setStep("setup_verify_request");
      } catch (e) {
        console.error("[Auth] Setup error:", e);
        setPinError(
          e instanceof Error ? e.message : "Setup fail. Dobara try karein.",
        );
        isSubmittingRef.current = false;
      } finally {
        setLoading(false);
      }
    },
    [pin, phone, shopName, ownerName, email, city, stateProvince, setupShop],
  );

  // Auto-submit confirm PIN
  useEffect(() => {
    if (step === "setup_confirm_pin" && confirmPin.length === SHOP_PIN_LENGTH) {
      handleConfirmPin(confirmPin);
    }
  }, [confirmPin, step, handleConfirmPin]);

  // ── STEP: Submit verification request ────────────────────────
  const handleVerifyRequest = useCallback(async () => {
    setLoading(true)
    try {
      // Verification already submitted during setupShop server call
      // Just redirect to dashboard
      await fetch('/api/auth/shop-verify-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId: newShopId,
          shopName: shopName.trim(),
          ownerName: ownerName.trim(),
          ownerPhone: phone.replace(/\D/g, ''),
          ownerEmail: email.trim(),
          city: city.trim(),
        }),
      }).catch(console.error)   // non-blocking
    } finally {
      setLoading(false)
      window.location.href = '/'
    }
  }, [newShopId, shopName, ownerName, phone, email, city])

  // ── PIN strength indicator ────────────────────────────────────
  const pinStrength = getPINStrength(pin);
  const adminWhatsAppLink = ADMIN_WA
    ? `https://wa.me/${ADMIN_WA}?text=${encodeURIComponent(
      `Assalam o Alaikum, nayi shop registration verify kar dein.\n\nShop: ${shopName.trim()}\nOwner: ${ownerName.trim()}\nPhone: ${phone.replace(/\D/g, "")}\nCity: ${city.trim() || "N/A"}`,
    )}`
    : null;

  // ── Render ────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen bg-linear-to-br from-slate-900 via-blue-950
                    to-slate-900 flex flex-col items-center justify-center p-4"
    >
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-20 right-10 w-64 h-64 bg-blue-500/5
                        rounded-full blur-3xl"
        />
        <div
          className="absolute bottom-20 left-10 w-64 h-64 bg-indigo-500/5
                        rounded-full blur-3xl"
        />
      </div>

      {/* Card */}
      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-6">
          <div
            className="flex items-center
                          justify-center mx-auto mb-4"
          >
            <Image
              src="/icon.svg"
              alt="MeraDarzi"
              width={64}
              height={64}
              loading="eager"
            />
          </div>
          <h1 className="text-2xl font-bold text-white">MeraDarzi</h1>
          <p className="text-slate-400 text-sm mt-1">
            Pakistan ka Tailor Management App
          </p>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-2xl shadow-black/30">
          {/* ── PHONE STEP ── */}
          {step === "phone" && (
            <div>
              <h2 className="text-lg font-bold text-slate-800 mb-1">
                Shuru Karein
              </h2>
              <p className="text-slate-400 text-sm mb-5">
                Apna Pakistani mobile number daalein
              </p>

              {!isOnline && (
                <div
                  className="flex items-center gap-2 bg-amber-50 border border-amber-200
                  rounded-2xl px-4 py-3 mb-4"
                >
                  <AlertCircle size={14} className="text-amber-600 shrink-0" />
                  <p className="text-amber-700 text-xs">
                    Internet connection required hai
                  </p>
                </div>
              )}

              <div
                className={cn(
                  "flex items-center gap-2 border-2 rounded-2xl px-4 py-3.5 mb-4",
                  "transition-all",
                  error
                    ? "border-red-400 bg-red-50"
                    : "border-slate-200 bg-slate-50 focus-within:border-blue-500 focus-within:bg-white",
                )}
              >
                <Phone size={17} className="text-slate-400 shrink-0" />
                <input
                  type="tel"
                  inputMode="numeric"
                  placeholder="0300 1234567"
                  value={phone}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, 11);
                    setPhone(val);
                    setError("");
                  }}
                  maxLength={11}
                  onKeyDown={(e) => e.key === "Enter" && handlePhoneSubmit()}
                  autoFocus
                  className="flex-1 text-sm bg-transparent outline-none
                             text-slate-800 placeholder:text-slate-400"
                />
              </div>

              {error && (
                <div
                  className="flex items-center gap-2 bg-red-50 border border-red-200
                                rounded-xl px-3 py-2.5 mb-4"
                >
                  <AlertCircle size={13} className="text-red-500 shrink-0" />
                  <p className="text-red-600 text-xs">{error}</p>
                </div>
              )}

              <button
                onClick={handlePhoneSubmit}
                disabled={loading || phone.replace(/\D/g, "").length < 11}
                className="w-full bg-blue-600 disabled:bg-slate-300 text-white
                           font-bold py-4 rounded-2xl transition-all active:scale-[0.98]
                           flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" /> Check ho raha
                    hai...
                  </>
                ) : (
                  "Continue →"
                )}
              </button>
            </div>
          )}

          {/* ── PIN LOGIN STEP ── */}
          {step === "pin_login" && (
            <div>
              <button
                onClick={() => {
                  setStep("phone");
                  setPin("");
                  setPinError("");
                }}
                className="flex items-center gap-1.5 text-slate-400 text-sm mb-4
                           hover:text-slate-600 transition-colors"
              >
                <ArrowLeft size={14} /> Wapas
              </button>

              <div className="flex items-center gap-3 mb-5">
                <div
                  className="w-10 h-10 bg-blue-100 rounded-2xl flex items-center
                                justify-center shrink-0"
                >
                  <Store size={18} className="text-blue-600" />
                </div>
                <div>
                  <p className="font-bold text-slate-800 text-sm">
                    {shopDisplay || "Aapki Dukaan"}
                  </p>
                  <p className="text-slate-400 text-xs">{phone}</p>
                </div>
              </div>

              {lockoutEnd && lockoutSeconds > 0 ? (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-center">
                  <Lock size={24} className="text-red-500 mx-auto mb-2" />
                  <p className="font-bold text-red-700">Account Lock Hai</p>
                  <p className="text-red-500 text-sm mt-1">
                    {Math.floor(lockoutSeconds / 60)}m {lockoutSeconds % 60}s
                    baad try karein
                  </p>
                </div>
              ) : (
                <div>
                  <PINInput
                    value={pin}
                    onChange={(v) => {
                      setPin(v);
                      setPinError("");
                    }}
                    length={loginPinLength}
                    label={`${loginPinLength}-Digit PIN Daalein`}
                    error={pinError || undefined}
                    disabled={loading}
                  />

                  {loading && (
                    <div className="flex items-center justify-center gap-2 mt-3 text-blue-600">
                      <Loader2 size={16} className="animate-spin" />
                      <span className="text-sm">Verify ho raha hai...</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── SETUP: EMAIL ── */}
          {step === "setup_email" && (
            <div>
              <button
                onClick={() => {
                  setStep("phone");
                  setError("");
                }}
                className="flex items-center gap-1.5 text-slate-400 text-sm mb-4"
              >
                <ArrowLeft size={14} /> Wapas
              </button>

              <div className="flex items-center gap-3 mb-2">
                <div
                  className="w-10 h-10 bg-blue-100 rounded-2xl flex items-center
                                justify-center shrink-0"
                >
                  <Mail size={18} className="text-blue-600" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-800">Email Address</h2>
                  <p className="text-slate-400 text-xs">
                    OTP yahan bheja jayega
                  </p>
                </div>
              </div>

              <p className="text-slate-500 text-sm mb-4 leading-relaxed">
                Account verify karne ke liye OTP code aapki email par bheja
                jayega.
              </p>

              <div
                className={cn(
                  "flex items-center gap-2 border-2 rounded-2xl px-4 py-3.5 mb-4",
                  error
                    ? "border-red-400 bg-red-50"
                    : "border-slate-200 bg-slate-50 focus-within:border-blue-500 focus-within:bg-white",
                )}
              >
                <Mail size={16} className="text-slate-400 shrink-0" />
                <input
                  type="email"
                  inputMode="email"
                  placeholder="aapki@email.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError("");
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleSendOTP()}
                  autoFocus
                  className="flex-1 text-sm bg-transparent outline-none text-slate-800
                             placeholder:text-slate-400"
                />
              </div>

              {error && (
                <div
                  className="flex items-center gap-2 bg-red-50 border border-red-200
                                rounded-xl px-3 py-2.5 mb-4"
                >
                  <AlertCircle size={13} className="text-red-500 shrink-0" />
                  <p className="text-red-600 text-xs">{error}</p>
                </div>
              )}

              <button
                onClick={handleSendOTP}
                disabled={loading || !email.includes("@")}
                className="w-full bg-blue-600 disabled:bg-slate-300 text-white
                           font-bold py-4 rounded-2xl flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" /> Bhej raha
                    hai...
                  </>
                ) : (
                  "OTP Bhejein →"
                )}
              </button>
            </div>
          )}

          {/* ── SETUP: OTP ── */}
          {step === "setup_otp" && (
            <div>
              <button
                onClick={() => {
                  setStep("setup_email");
                  setOtp("");
                  setError("");
                }}
                className="flex items-center gap-1.5 text-slate-400 text-sm mb-4"
              >
                <ArrowLeft size={14} /> Wapas
              </button>

              <div className="flex items-center gap-3 mb-5">
                <div
                  className="w-10 h-10 bg-green-100 rounded-2xl flex items-center
                                justify-center shrink-0"
                >
                  <ShieldCheck size={18} className="text-green-600" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-800">OTP Code</h2>
                  <p className="text-slate-400 text-xs">
                    {maskedEmail} par bheja
                  </p>
                </div>
              </div>

              <p className="text-slate-500 text-sm mb-4">
                Aapki email par 6-digit code bheja gaya hai. Spam folder bhi
                check karein.
              </p>

              <OTPInput
                value={otp}
                onChange={(v) => {
                  setOtp(v);
                  setError("");
                }}
                error={error || undefined}
                disabled={loading}
              />

              {loading && (
                <div className="flex items-center justify-center gap-2 mt-3 text-blue-600">
                  <Loader2 size={16} className="animate-spin" />
                  <span className="text-sm">Verify ho raha hai...</span>
                </div>
              )}

              <button
                onClick={() => {
                  setOtp("");
                  handleSendOTP();
                }}
                className="w-full text-center text-blue-600 text-sm font-semibold mt-4"
              >
                Code nahi aaya? Dobara bhejein
              </button>
            </div>
          )}

          {/* ── SETUP: NAME ── */}
          {step === "setup_name" && (
            <div>
              <div className="flex items-center gap-3 mb-5">
                <div
                  className="w-10 h-10 bg-blue-100 rounded-2xl flex items-center
                                justify-center shrink-0"
                >
                  <User size={18} className="text-blue-600" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-800">Aapka Naam</h2>
                  <p className="text-slate-400 text-xs">Owner ka naam</p>
                </div>
              </div>

              <input
                type="text"
                placeholder="Jaise: Ahmed Khan"
                value={ownerName}
                onChange={(e) => {
                  setOwnerName(e.target.value);
                  setError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && ownerName.trim().length >= 2) {
                    setStep("setup_shop");
                  }
                }}
                autoFocus
                className="w-full px-4 py-4 bg-slate-50 border-2 border-slate-200
                           rounded-2xl text-sm font-medium text-slate-800
                           outline-none focus:border-blue-500 focus:bg-white
                           transition-all placeholder:text-slate-400"
              />

              {error && <p className="text-red-500 text-xs mt-2">{error}</p>}

              <button
                onClick={() => {
                  if (ownerName.trim().length < 2) {
                    setError("Naam kam se kam 2 letters ka hona chahiye");
                    return;
                  }
                  setError("");
                  setStep("setup_shop");
                }}
                disabled={ownerName.trim().length < 2}
                className="w-full bg-blue-600 disabled:bg-slate-300 text-white
                           font-bold py-4 rounded-2xl mt-4 transition-all"
              >
                Continue →
              </button>
            </div>
          )}

          {/* ── SETUP: SHOP ── */}
          {step === "setup_shop" && (
            <div>
              <button
                onClick={() => setStep("setup_name")}
                className="flex items-center gap-1.5 text-slate-400 text-sm mb-4"
              >
                <ArrowLeft size={14} /> Wapas
              </button>

              <div className="flex items-center gap-3 mb-5">
                <div
                  className="w-10 h-10 bg-purple-100 rounded-2xl flex items-center
                                justify-center shrink-0"
                >
                  <Store size={18} className="text-purple-600" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-800">Dukaan Ka Naam</h2>
                  <p className="text-slate-400 text-xs">
                    Gahak ko yahi naam dikhega
                  </p>
                </div>
              </div>

              <input
                type="text"
                placeholder="Jaise: Ahmed Tailor Gujranwala"
                value={shopName}
                onChange={(e) => {
                  setShopName(e.target.value);
                  setError("");
                }}
                autoFocus
                className="w-full px-4 py-4 bg-slate-50 border-2 border-slate-200
                           rounded-2xl text-sm font-medium text-slate-800
                           outline-none focus:border-blue-500 focus:bg-white
                           transition-all placeholder:text-slate-400 mb-3"
              />

              <label className="mb-4 block">
                <span className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <MapPin size={13} /> State / Province (Optional)
                </span>
                <select
                  value={stateProvince}
                  onChange={(e) => {
                    setStateProvince(e.target.value);
                    setCity("");
                    setCityQuery("");
                    setCityDropdownOpen(false);
                  }}
                  className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-800 outline-none transition-all focus:border-blue-500 focus:bg-white"
                >
                  <option value="">State/Province chunein...</option>
                  {PAKISTAN_STATE_CITIES.map((group) => (
                    <option key={group.state} value={group.state}>
                      {group.state}
                    </option>
                  ))}
                </select>
              </label>

              {stateProvince && (
                <div className="mb-4">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    City
                  </span>
                  <input
                    type="text"
                    value={cityQuery}
                    onFocus={() => setCityDropdownOpen(true)}
                    onChange={(e) => {
                      setCityQuery(e.target.value);
                      setCityDropdownOpen(true);
                    }}
                    placeholder={city || "Search city ya manually type karein"}
                    className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-800 outline-none transition-all focus:border-blue-500 focus:bg-white"
                  />
                  {cityDropdownOpen && (
                    <div className="mt-2 max-h-40 overflow-y-auto rounded-2xl border border-slate-200 bg-white">
                      {city && (
                        <button
                          type="button"
                          onClick={() => {
                            setCity("");
                            setCityQuery("");
                            setCityDropdownOpen(false);
                          }}
                          className="w-full border-b border-slate-100 px-4 py-2.5 text-left text-xs font-semibold text-slate-400"
                        >
                          Selected: {city} - clear
                        </button>
                      )}
                      {filteredCities.map((item) => (
                        <button
                          key={`${stateProvince}-${item}`}
                          type="button"
                          onClick={() => {
                            setCity(item);
                            setCityQuery("");
                            setCityDropdownOpen(false);
                          }}
                          className={cn(
                            "w-full border-b border-slate-100 px-4 py-3 text-left text-sm transition-colors last:border-0 hover:bg-slate-50",
                            city === item
                              ? "bg-blue-50 font-semibold text-blue-700"
                              : "text-slate-700",
                          )}
                        >
                          {item}
                        </button>
                      ))}
                      {canAddTypedCity && (
                        <button
                          type="button"
                          onClick={() => {
                            setCity(cityQuery.trim());
                            setCityQuery("");
                            setCityDropdownOpen(false);
                          }}
                          className="w-full px-4 py-3 text-left text-sm font-semibold text-blue-700 hover:bg-blue-50"
                        >
                          Add &quot;{cityQuery.trim()}&quot;
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {error && <p className="text-red-500 text-xs mb-3">{error}</p>}

              <button
                onClick={() => {
                  if (shopName.trim().length < 3) {
                    setError(
                      "Dukaan ka naam kam se kam 3 letters ka hona chahiye",
                    );
                    return;
                  }
                  setError("");
                  setStep("setup_pin");
                }}
                disabled={shopName.trim().length < 3}
                className="w-full bg-blue-600 disabled:bg-slate-300 text-white
                           font-bold py-4 rounded-2xl transition-all"
              >
                Continue →
              </button>
            </div>
          )}

          {/* ── SETUP: PIN ── */}
          {step === "setup_pin" && (
            <div>
              <button
                onClick={() => {
                  setStep("setup_shop");
                  setPin("");
                  setPinError("");
                }}
                className="flex items-center gap-1.5 text-slate-400 text-sm mb-4"
              >
                <ArrowLeft size={14} /> Wapas
              </button>

              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-10 h-10 bg-green-100 rounded-2xl flex items-center
                                justify-center shrink-0"
                >
                  <Lock size={18} className="text-green-600" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-800">
                    {SHOP_PIN_LENGTH}-Digit PIN Banayein
                  </h2>
                  <p className="text-slate-400 text-xs">
                    Login ke liye use hoga — yaad rakhein
                  </p>
                </div>
              </div>

              <div
                className="bg-blue-50 border border-blue-200 rounded-2xl
                              px-4 py-3 mb-4"
              >
                <p className="text-blue-700 text-xs leading-relaxed">
                  💡 <strong>Mazboot PIN ke liye:</strong> Alag alag numbers use
                  karein. Date of birth ya phone number use mat karein.
                </p>
              </div>

              <PINInput
                value={pin}
                onChange={(v) => {
                  setPin(v);
                  setPinError("");
                }}
                masked={!showPin}
                label="Naya PIN"
                error={pinError || undefined}
                disabled={loading}
                length={SHOP_PIN_LENGTH}
              />

              {/* PIN strength */}
              {pin.length === SHOP_PIN_LENGTH && pinStrength.score > 0 && (
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-500">PIN Strength</span>
                    <span
                      className={cn(
                        "text-xs font-bold",
                        pinStrength.score >= 4
                          ? "text-green-600"
                          : pinStrength.score >= 3
                            ? "text-amber-600"
                            : "text-red-500",
                      )}
                    >
                      {pinStrength.label}
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        pinStrength.color,
                      )}
                      style={{ width: `${(pinStrength.score / 4) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              <button
                onClick={() => setShowPin((v) => !v)}
                className="flex items-center gap-1.5 text-slate-400 text-xs mt-3"
              >
                {showPin ? <EyeOff size={12} /> : <Eye size={12} />}
                {showPin ? "PIN chupayein" : "PIN dikhayein"}
              </button>
            </div>
          )}

          {/* ── SETUP: CONFIRM PIN ── */}
          {step === "setup_confirm_pin" && (
            <div>
              <div className="flex items-center gap-3 mb-5">
                <div
                  className="w-10 h-10 bg-green-100 rounded-2xl flex items-center
                                justify-center shrink-0"
                >
                  <ShieldCheck size={18} className="text-green-600" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-800">
                    PIN Confirm Karein
                  </h2>
                  <p className="text-slate-400 text-xs">
                    Dobara wahi PIN daalein
                  </p>
                </div>
              </div>

              <PINInput
                value={confirmPin}
                onChange={(v) => {
                  setConfirmPin(v);
                  setPinError("");
                }}
                label="PIN Dobara Daalein"
                error={pinError || undefined}
                disabled={loading}
                length={SHOP_PIN_LENGTH}
              />

              {loading && (
                <div className="flex items-center justify-center gap-2 mt-4 text-blue-600">
                  <Loader2 size={16} className="animate-spin" />
                  <span className="text-sm">Account ban raha hai...</span>
                </div>
              )}
            </div>
          )}

          {/* ── SETUP: VERIFICATION REQUEST ── */}
          {step === "setup_verify_request" && (
            <div className="text-center">
              <div
                className="w-16 h-16 bg-amber-100 rounded-full flex items-center
                              justify-center mx-auto mb-4"
              >
                <ShieldCheck size={32} className="text-amber-600" />
              </div>

              <h2 className="text-xl font-bold text-slate-800 mb-2">
                Account Ban Gaya! 🎉
              </h2>
              <p className="text-slate-500 text-sm leading-relaxed mb-5">
                Aapka account successfully create ho gaya. Hum aapka account
                verify karenge — aapko email ya WhatsApp par bataya jayega.
              </p>

              <div
                className="bg-blue-50 border border-blue-200 rounded-2xl
                              px-4 py-4 mb-5 text-left space-y-2"
              >
                {[
                  { label: "Shop", value: shopName },
                  { label: "Owner", value: ownerName },
                  { label: "Phone", value: phone },
                  { label: "Email", value: email },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-slate-500">{label}</span>
                    <span className="font-semibold text-slate-800">
                      {value}
                    </span>
                  </div>
                ))}
              </div>

              <div
                className="bg-amber-50 border border-amber-200 rounded-2xl
                              px-4 py-3 mb-5 space-y-3"
              >
                <p className="text-amber-700 text-xs leading-relaxed">
                  ⏱️ Verification 24 ghante mein ho jati hai. Tab tak aap app
                  use kar sakte hain.
                </p>
                <p className="text-amber-700 text-xs leading-relaxed">
                  Admin ko WhatsApp par bhi bata dein ke nayi shop registration
                  aur verification request submit ho gayi hai.
                </p>
                {adminWhatsAppLink && (
                  <a
                    href={adminWhatsAppLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 bg-green-600
                               text-white text-sm font-bold py-3 rounded-xl"
                  >
                    <MessageCircle size={15} />
                    Admin Ko WhatsApp Karein
                  </a>
                )}
              </div>

              <button
                onClick={handleVerifyRequest}
                disabled={loading}
                className="w-full bg-blue-600 disabled:bg-slate-300 text-white
                           font-bold py-4 rounded-2xl mb-3 flex items-center
                           justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" /> Bhej raha
                    hai...
                  </>
                ) : (
                  "✓ Theek Hai — App Kholein"
                )}
              </button>

              <p className="text-slate-400 text-xs">
                Verification ke liye {email} check karein
              </p>
            </div>
          )}

          {/* ── Step progress ── */}
          {!["phone", "pin_login", "setup_verify_request"].includes(step) && (
            <div className="flex items-center gap-1 mt-5">
              {[
                "setup_email",
                "setup_otp",
                "setup_name",
                "setup_shop",
                "setup_pin",
                "setup_confirm_pin",
              ].map((s, i) => {
                const steps = [
                  "setup_email",
                  "setup_otp",
                  "setup_name",
                  "setup_shop",
                  "setup_pin",
                  "setup_confirm_pin",
                ];
                const current = steps.indexOf(step);
                return (
                  <div
                    key={s}
                    className={cn(
                      "h-1 flex-1 rounded-full transition-all",
                      i <= current ? "bg-blue-600" : "bg-slate-200",
                    )}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-slate-600 text-xs mt-5">
          MeraDarzi · Secure & Verified ✓
        </p>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-900 flex items-center justify-center">
          <Loader2 size={32} className="text-blue-500 animate-spin" />
        </div>
      }
    >

      <AuthContent />
    </Suspense>
  );
}
