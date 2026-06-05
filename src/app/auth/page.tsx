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
import { validatePakistaniPhone } from "@/lib/security/phone";
import { SHOP_PIN_LENGTH, validatePIN, getPINStrength } from "@/lib/security/pin";
import { cn } from "@/lib/utils";
import { PAKISTAN_STATE_CITIES } from "@/lib/locations/pakistan";
import Image from "next/image";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
  const chars = value.padEnd(length, "").split("").slice(0, length);

  return (
    <div>
      {label && (
        <label className="block text-sm font-semibold text-slate-700 mb-3">
          {label}
        </label>
      )}

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
        {error ?? t('auth.pinPrompt', { digit: length })}
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
  const { t } = useTranslation();

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
        {error ?? t('auth.otpInput')}
      </button>
    </div>
  );
}

// ── Main Auth Content ─────────────────────────────────────────────
function AuthContent() {
  const searchParams = useSearchParams();
  const rawRedirect = searchParams.get("redirect") ?? "/";
  const { t } = useTranslation();

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
  useEffect(() => {
    if (authLoading) return
    if (!currentUser) return
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

  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  useEffect(() => {
    if (!lockoutEnd) return;
    const interval = setInterval(() => {
      const secs = Math.max(0, Math.ceil((lockoutEnd.getTime() - Date.now()) / 1000));
      setLockoutSeconds(secs);
      if (secs === 0) { setLockoutEnd(null); clearInterval(interval); }
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutEnd]);

  const handlePhoneSubmit = useCallback(async () => {
    if (loading) return;
    const result = validatePakistaniPhone(phone);
    if (!result.valid) { setError(result.error!); return; }
    setLoading(true);
    setError("");

    try {
      const res = await fetch('/api/auth/check-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: result.cleaned }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? t('auth.serverError'))
        return
      }

      if (data.found) {
        setLoginPinLength(SHOP_PIN_LENGTH)

        if (data.lockedUntil && new Date(data.lockedUntil) > new Date()) {
          const end = new Date(data.lockedUntil)
          setLockoutEnd(end)
          setError(t('auth.lockoutMessage', { minutes: Math.ceil((end.getTime() - Date.now()) / 60000) }))
          setLoading(false)
          return
        }

        setShopDisplay(data.shopName || '')
        setStep("pin_login")
      } else {
        setStep("setup_email")
      }
    } catch {
      setError(t('auth.serverError'))
    } finally {
      setLoading(false)
    }
  }, [phone, loading, t]);

  const handlePINLogin = useCallback(async (enteredPin: string) => {
    if (enteredPin.length !== loginPinLength || loading) return
    setLoading(true)
    setPinError('')

    const cleaned = phone.replace(/\D/g, '')

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleaned, pin: enteredPin }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        setPinError(errData.error ?? t('auth.loginFailed'))
        setPin('')
        setLoading(false)
        return
      }

      const data = await res.json()

      if (!data.success) {
        if (data.lockedUntil) {
          setLockoutEnd(new Date(data.lockedUntil))
          setPinError(t('auth.locked5Attempts'))
        } else {
          setPinError(data.error ?? t('auth.wrongPin', { remaining: 3 }))
        }
        setPin('')
        setLoading(false)
        return
      }

      const dest = data.role === 'karigar' ? '/karigar' : redirectTo === '/auth' || redirectTo.startsWith('/auth') ? '/' : redirectTo
      window.location.href = dest

    } catch (e) {
      console.error('[Login] Error:', e)
      setPinError(t('auth.loginFailed'))
      setPin('')
    } finally {
      setLoading(false)
    }
  }, [phone, loading, redirectTo, loginPinLength, t])

  useEffect(() => {
    if (step === "pin_login" && pin.length === loginPinLength) {
      handlePINLogin(pin);
    }
  }, [pin, step, handlePINLogin, loginPinLength]);

  const handleSendOTP = useCallback(async () => {
    if (loading) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) { setError(t('auth.emailInvalid')); return; }
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.replace(/\D/g, ""), email: email.trim().toLowerCase(), purpose: "signup" }),
      });
      const data = await res.json();

      if (!res.ok) { setError(data.error ?? t('auth.otpSendFail')); return; }
      setMaskedEmail(data.maskedEmail ?? email);
      setStep("setup_otp");
    } catch { setError(t('auth.otpServerError')); }
    finally { setLoading(false); }
  }, [email, phone, loading, t]);

  const handleVerifyOTP = useCallback(async (enteredOtp: string) => {
    if (enteredOtp.length !== 6 || loading) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.replace(/\D/g, ""), otp: enteredOtp }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? t('auth.otpWrong')); setOtp(""); return; }
      setStep("setup_name");
    } catch { setError(t('auth.serverError2')); }
    finally { setLoading(false); }
  }, [phone, loading, t]);

  useEffect(() => {
    if (step === "setup_otp" && otp.length === 6) { handleVerifyOTP(otp); }
  }, [otp, step, handleVerifyOTP]);

  const handleSetPin = useCallback(() => {
    if (pin.length !== SHOP_PIN_LENGTH) return;
    const validation = validatePIN(pin, SHOP_PIN_LENGTH);
    if (!validation.valid) { setPinError(validation.error!); setPin(""); return; }
    setPinError("");
    setStep("setup_confirm_pin");
  }, [pin]);

  useEffect(() => {
    if (step === "setup_pin" && pin.length === SHOP_PIN_LENGTH) { handleSetPin(); }
  }, [pin, step, handleSetPin]);

  const handleConfirmPin = useCallback(async (enteredConfirm: string) => {
    if (enteredConfirm.length !== SHOP_PIN_LENGTH || isSubmittingRef.current) return;
    if (enteredConfirm !== pin) {
      setPinError(t('auth.pinMismatch'));
      setStep("setup_pin"); setPin(""); setConfirmPin("");
      return;
    }

    const cleaned = phone.replace(/\D/g, "");
    isSubmittingRef.current = true;
    setLoading(true);
    setPinError("");

    try {
      const createdShopId = await setupShop(shopName.trim(), cleaned, pin, ownerName.trim(), email.trim().toLowerCase(), city.trim(), stateProvince.trim());
      setNewShopId(createdShopId);
      setStep("setup_verify_request");
    } catch (e) {
      console.error("[Auth] Setup error:", e);
      setPinError(e instanceof Error ? e.message : t('auth.setupFail'));
      isSubmittingRef.current = false;
    } finally { setLoading(false); }
  }, [pin, phone, shopName, ownerName, email, city, stateProvince, setupShop, t]);

  useEffect(() => {
    if (step === "setup_confirm_pin" && confirmPin.length === SHOP_PIN_LENGTH) { handleConfirmPin(confirmPin); }
  }, [confirmPin, step, handleConfirmPin]);

  const handleVerifyRequest = useCallback(async () => {
    setLoading(true)
    try {
      await fetch('/api/auth/shop-verify-request', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopId: newShopId, shopName: shopName.trim(), ownerName: ownerName.trim(), ownerPhone: phone.replace(/\D/g, ''), ownerEmail: email.trim(), city: city.trim() }),
      }).catch(console.error)
    } finally { setLoading(false); window.location.href = '/' }
  }, [newShopId, shopName, ownerName, phone, email, city])

  const pinStrength = getPINStrength(pin);
  const adminWhatsAppLink = ADMIN_WA
    ? `https://wa.me/${ADMIN_WA}?text=${encodeURIComponent(`Assalam o Alaikum, nayi shop registration verify kar dein.\n\nShop: ${shopName.trim()}\nOwner: ${ownerName.trim()}\nPhone: ${phone.replace(/\D/g, "")}\nCity: ${city.trim() || "N/A"}`)}`
    : null;

  const pinStrengthLabels = {
    weak: t('auth.pinStrengthWeak'),
    fair: t('auth.pinStrengthFair'),
    good: t('auth.pinStrengthGood'),
    strong: t('auth.pinStrengthStrong'),
  };

  const pinStrengthColors: Record<string, string> = {
    weak: 'text-red-500',
    fair: 'text-amber-600',
    good: 'text-green-600',
    strong: 'text-green-700',
  };

  const pinStrengthBg = (score: number) => {
    if (score >= 4) return 'bg-green-500';
    if (score >= 3) return 'bg-amber-500';
    if (score >= 2) return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-900 via-blue-950 to-slate-900 flex flex-col items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-10 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-10 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="flex items-center justify-center mx-auto mb-4">
            <Image src="/icon.svg" alt="MeraDarzi" width={64} height={64} loading="eager" />
          </div>
          <h1 className="text-2xl font-bold text-white">MeraDarzi</h1>
          <p className="text-slate-400 text-sm mt-1">{t('app.tagline')}</p>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-2xl shadow-black/30">
          {/* ── PHONE STEP ── */}
          {step === "phone" && (
            <div>
              <h2 className="text-lg font-bold text-slate-800 mb-1">{t('auth.start')}</h2>
              <p className="text-slate-400 text-sm mb-5">{t('auth.phonePrompt')}</p>

              {!isOnline && (
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 mb-4">
                  <AlertCircle size={14} className="text-amber-600 shrink-0" />
                  <p className="text-amber-700 text-xs">{t('auth.internetRequired')}</p>
                </div>
              )}

              <div className={cn("flex items-center gap-2 border-2 rounded-2xl px-4 py-3.5 mb-4 transition-all",
                error ? "border-red-400 bg-red-50" : "border-slate-200 bg-slate-50 focus-within:border-blue-500 focus-within:bg-white")}>
                <Phone size={17} className="text-slate-400 shrink-0" />
                <input type="tel" inputMode="numeric" placeholder={t('auth.phonePlaceholder')}
                  value={phone} onChange={(e) => { const val = e.target.value.replace(/\D/g, "").slice(0, 11); setPhone(val); setError(""); }}
                  maxLength={11} onKeyDown={(e) => e.key === "Enter" && handlePhoneSubmit()} autoFocus
                  className="flex-1 text-sm bg-transparent outline-none text-slate-800 placeholder:text-slate-400" />
              </div>

              {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 mb-4">
                  <AlertCircle size={13} className="text-red-500 shrink-0" />
                  <p className="text-red-600 text-xs">{error}</p>
                </div>
              )}

              <button onClick={handlePhoneSubmit} disabled={loading || phone.replace(/\D/g, "").length < 11}
                className="w-full bg-blue-600 disabled:bg-slate-300 text-white font-bold py-4 rounded-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-2">
                {loading ? <><Loader2 size={18} className="animate-spin" /> {t('auth.checking')}</> : t('auth.continue')}
              </button>
            </div>
          )}

          {/* ── PIN LOGIN STEP ── */}
          {step === "pin_login" && (
            <div>
              <button onClick={() => { setStep("phone"); setPin(""); setPinError(""); }}
                className="flex items-center gap-1.5 text-slate-400 text-sm mb-4 hover:text-slate-600 transition-colors">
                <ArrowLeft size={14} /> {t('auth.back')}
              </button>

              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 bg-blue-100 rounded-2xl flex items-center justify-center shrink-0">
                  <Store size={18} className="text-blue-600" />
                </div>
                <div>
                  <p className="font-bold text-slate-800 text-sm">{shopDisplay || t('auth.yourShop')}</p>
                  <p className="text-slate-400 text-xs">{phone}</p>
                </div>
              </div>

              {lockoutEnd && lockoutSeconds > 0 ? (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-center">
                  <Lock size={24} className="text-red-500 mx-auto mb-2" />
                  <p className="font-bold text-red-700">{t('auth.accountLocked')}</p>
                  <p className="text-red-500 text-sm mt-1">
                    {Math.floor(lockoutSeconds / 60)}m {lockoutSeconds % 60}s {t('auth.lockoutMinutes', { minutes: '' })}
                  </p>
                </div>
              ) : (
                <div>
                  <PINInput value={pin} onChange={(v) => { setPin(v); setPinError(""); }}
                    length={loginPinLength}
                    label={t('auth.pinDigit', { digit: loginPinLength })}
                    error={pinError || undefined} disabled={loading} />

                  {loading && (
                    <div className="flex items-center justify-center gap-2 mt-3 text-blue-600">
                      <Loader2 size={16} className="animate-spin" />
                      <span className="text-sm">{t('auth.verifying')}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── SETUP: EMAIL ── */}
          {step === "setup_email" && (
            <div>
              <button onClick={() => { setStep("phone"); setError(""); }}
                className="flex items-center gap-1.5 text-slate-400 text-sm mb-4">
                <ArrowLeft size={14} /> {t('auth.back')}
              </button>

              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-blue-100 rounded-2xl flex items-center justify-center shrink-0">
                  <Mail size={18} className="text-blue-600" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-800">{t('auth.emailLabel')}</h2>
                  <p className="text-slate-400 text-xs">{t('auth.emailDescription')}</p>
                </div>
              </div>

              <p className="text-slate-500 text-sm mb-4 leading-relaxed">{t('auth.emailDetail')}</p>

              <div className={cn("flex items-center gap-2 border-2 rounded-2xl px-4 py-3.5 mb-4",
                error ? "border-red-400 bg-red-50" : "border-slate-200 bg-slate-50 focus-within:border-blue-500 focus-within:bg-white")}>
                <Mail size={16} className="text-slate-400 shrink-0" />
                <input type="email" inputMode="email" placeholder={t('auth.emailPlaceholder')}
                  value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && handleSendOTP()} autoFocus
                  className="flex-1 text-sm bg-transparent outline-none text-slate-800 placeholder:text-slate-400" />
              </div>

              {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 mb-4">
                  <AlertCircle size={13} className="text-red-500 shrink-0" />
                  <p className="text-red-600 text-xs">{error}</p>
                </div>
              )}

              <button onClick={handleSendOTP} disabled={loading || !email.includes("@")}
                className="w-full bg-blue-600 disabled:bg-slate-300 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2">
                {loading ? <><Loader2 size={18} className="animate-spin" /> {t('auth.sending')}</> : t('auth.sendOtp')}
              </button>
            </div>
          )}

          {/* ── SETUP: OTP ── */}
          {step === "setup_otp" && (
            <div>
              <button onClick={() => { setStep("setup_email"); setOtp(""); setError(""); }}
                className="flex items-center gap-1.5 text-slate-400 text-sm mb-4">
                <ArrowLeft size={14} /> {t('auth.back')}
              </button>

              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 bg-green-100 rounded-2xl flex items-center justify-center shrink-0">
                  <ShieldCheck size={18} className="text-green-600" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-800">{t('auth.otpTitle')}</h2>
                  <p className="text-slate-400 text-xs">{t('auth.otpSentTo', { email: maskedEmail })}</p>
                </div>
              </div>

              <p className="text-slate-500 text-sm mb-4">{t('auth.otpDescription')}</p>

              <OTPInput value={otp} onChange={(v) => { setOtp(v); setError(""); }}
                error={error || undefined} disabled={loading} />

              {loading && (
                <div className="flex items-center justify-center gap-2 mt-3 text-blue-600">
                  <Loader2 size={16} className="animate-spin" />
                  <span className="text-sm">{t('auth.verifying')}</span>
                </div>
              )}

              <button onClick={() => { setOtp(""); handleSendOTP(); }}
                className="w-full text-center text-blue-600 text-sm font-semibold mt-4">
                {t('auth.otpResend')}
              </button>
            </div>
          )}

          {/* ── SETUP: NAME ── */}
          {step === "setup_name" && (
            <div>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 bg-blue-100 rounded-2xl flex items-center justify-center shrink-0">
                  <User size={18} className="text-blue-600" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-800">{t('auth.yourName')}</h2>
                  <p className="text-slate-400 text-xs">{t('auth.ownerName')}</p>
                </div>
              </div>

              <input type="text" placeholder={t('auth.namePlaceholder')}
                value={ownerName}
                onChange={(e) => { setOwnerName(e.target.value); setError(""); }}
                onKeyDown={(e) => { if (e.key === "Enter" && ownerName.trim().length >= 2) setStep("setup_shop"); }}
                autoFocus
                className="w-full px-4 py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-sm font-medium text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all placeholder:text-slate-400" />

              {error && <p className="text-red-500 text-xs mt-2">{error}</p>}

              <button onClick={() => {
                if (ownerName.trim().length < 2) { setError(t('auth.nameTooShort')); return; }
                setError(""); setStep("setup_shop");
              }} disabled={ownerName.trim().length < 2}
                className="w-full bg-blue-600 disabled:bg-slate-300 text-white font-bold py-4 rounded-2xl mt-4 transition-all">
                {t('auth.continue')}
              </button>
            </div>
          )}

          {/* ── SETUP: SHOP ── */}
          {step === "setup_shop" && (
            <div>
              <button onClick={() => setStep("setup_name")}
                className="flex items-center gap-1.5 text-slate-400 text-sm mb-4">
                <ArrowLeft size={14} /> {t('auth.back')}
              </button>

              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 bg-purple-100 rounded-2xl flex items-center justify-center shrink-0">
                  <Store size={18} className="text-purple-600" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-800">{t('auth.shopName')}</h2>
                  <p className="text-slate-400 text-xs">{t('auth.shopDescription')}</p>
                </div>
              </div>

              <input type="text" placeholder={t('auth.shopPlaceholder')}
                value={shopName} onChange={(e) => { setShopName(e.target.value); setError(""); }}
                autoFocus
                className="w-full px-4 py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-sm font-medium text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all placeholder:text-slate-400 mb-3" />

              <label className="mb-4 block">
                <span className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <MapPin size={13} /> {t('auth.stateProvince')}
                </span>
                <select value={stateProvince} onChange={(e) => { setStateProvince(e.target.value); setCity(""); setCityQuery(""); setCityDropdownOpen(false); }}
                  className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-800 outline-none transition-all focus:border-blue-500 focus:bg-white">
                  <option value="">{t('auth.selectState')}</option>
                  {PAKISTAN_STATE_CITIES.map((group) => (
                    <option key={group.state} value={group.state}>{group.state}</option>
                  ))}
                </select>
              </label>

              {stateProvince && (
                <div className="mb-4">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">{t('auth.city')}</span>
                  <input type="text" value={cityQuery} onFocus={() => setCityDropdownOpen(true)}
                    onChange={(e) => { setCityQuery(e.target.value); setCityDropdownOpen(true); }}
                    placeholder={city || t('auth.citySearch')}
                    className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-800 outline-none transition-all focus:border-blue-500 focus:bg-white" />
                  {cityDropdownOpen && (
                    <div className="mt-2 max-h-40 overflow-y-auto rounded-2xl border border-slate-200 bg-white">
                      {city && (
                        <button type="button" onClick={() => { setCity(""); setCityQuery(""); setCityDropdownOpen(false); }}
                          className="w-full border-b border-slate-100 px-4 py-2.5 text-left text-xs font-semibold text-slate-400">
                          {t('auth.selectedCity', { city })}
                        </button>
                      )}
                      {filteredCities.map((item) => (
                        <button key={`${stateProvince}-${item}`} type="button"
                          onClick={() => { setCity(item); setCityQuery(""); setCityDropdownOpen(false); }}
                          className={cn("w-full border-b border-slate-100 px-4 py-3 text-left text-sm transition-colors last:border-0 hover:bg-slate-50",
                            city === item ? "bg-blue-50 font-semibold text-blue-700" : "text-slate-700")}>
                          {item}
                        </button>
                      ))}
                      {canAddTypedCity && (
                        <button type="button" onClick={() => { setCity(cityQuery.trim()); setCityQuery(""); setCityDropdownOpen(false); }}
                          className="w-full px-4 py-3 text-left text-sm font-semibold text-blue-700 hover:bg-blue-50">
                          {t('auth.addCity', { city: cityQuery.trim() })}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {error && <p className="text-red-500 text-xs mb-3">{error}</p>}

              <button onClick={() => {
                if (shopName.trim().length < 3) { setError(t('auth.shopTooShort')); return; }
                setError(""); setStep("setup_pin");
              }} disabled={shopName.trim().length < 3}
                className="w-full bg-blue-600 disabled:bg-slate-300 text-white font-bold py-4 rounded-2xl transition-all">
                {t('auth.continue')}
              </button>
            </div>
          )}

          {/* ── SETUP: PIN ── */}
          {step === "setup_pin" && (
            <div>
              <button onClick={() => { setStep("setup_shop"); setPin(""); setPinError(""); }}
                className="flex items-center gap-1.5 text-slate-400 text-sm mb-4">
                <ArrowLeft size={14} /> {t('auth.back')}
              </button>

              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-green-100 rounded-2xl flex items-center justify-center shrink-0">
                  <Lock size={18} className="text-green-600" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-800">{t('auth.createPin', { digit: SHOP_PIN_LENGTH })}</h2>
                  <p className="text-slate-400 text-xs">{t('auth.createPinDescription')}</p>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3 mb-4">
                <p className="text-blue-700 text-xs leading-relaxed">{t('auth.pinTip')}</p>
              </div>

              <PINInput value={pin} onChange={(v) => { setPin(v); setPinError(""); }}
                masked={!showPin} label={t('auth.newPin')}
                error={pinError || undefined} disabled={loading} length={SHOP_PIN_LENGTH} />

              {pin.length === SHOP_PIN_LENGTH && pinStrength.score > 0 && (
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-500">{t('auth.pinStrength')}</span>
                    <span className={cn("text-xs font-bold", pinStrengthColors[pinStrength.label] || 'text-slate-500')}>
                      {pinStrengthLabels[pinStrength.label as keyof typeof pinStrengthLabels] || pinStrength.label}
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all", pinStrengthBg(pinStrength.score))}
                      style={{ width: `${(pinStrength.score / 4) * 100}%` }} />
                  </div>
                </div>
              )}

              <button onClick={() => setShowPin((v) => !v)}
                className="flex items-center gap-1.5 text-slate-400 text-xs mt-3">
                {showPin ? <EyeOff size={12} /> : <Eye size={12} />}
                {showPin ? t('auth.hidePin') : t('auth.showPin')}
              </button>
            </div>
          )}

          {/* ── SETUP: CONFIRM PIN ── */}
          {step === "setup_confirm_pin" && (
            <div>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 bg-green-100 rounded-2xl flex items-center justify-center shrink-0">
                  <ShieldCheck size={18} className="text-green-600" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-800">{t('auth.confirmPin')}</h2>
                  <p className="text-slate-400 text-xs">{t('auth.confirmDesc')}</p>
                </div>
              </div>

              <PINInput value={confirmPin} onChange={(v) => { setConfirmPin(v); setPinError(""); }}
                label={t('auth.confirmPinInput')} error={pinError || undefined}
                disabled={loading} length={SHOP_PIN_LENGTH} />

              {loading && (
                <div className="flex items-center justify-center gap-2 mt-4 text-blue-600">
                  <Loader2 size={16} className="animate-spin" />
                  <span className="text-sm">{t('auth.creatingAccount')}</span>
                </div>
              )}
            </div>
          )}

          {/* ── SETUP: VERIFICATION REQUEST ── */}
          {step === "setup_verify_request" && (
            <div className="text-center">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <ShieldCheck size={32} className="text-amber-600" />
              </div>

              <h2 className="text-xl font-bold text-slate-800 mb-2">{t('auth.accountCreated')}</h2>
              <p className="text-slate-500 text-sm leading-relaxed mb-5">{t('auth.accountCreatedDesc')}</p>

              <div className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-4 mb-5 text-left space-y-2">
                {[
                  { label: "Shop", value: shopName },
                  { label: "Owner", value: ownerName },
                  { label: "Phone", value: phone },
                  { label: "Email", value: email },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-slate-500">{label}</span>
                    <span className="font-semibold text-slate-800">{value}</span>
                  </div>
                ))}
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 mb-5 space-y-3">
                <p className="text-amber-700 text-xs leading-relaxed">{t('auth.verificationInProgress')}</p>
                <p className="text-amber-700 text-xs leading-relaxed">{t('auth.verificationWhatsApp')}</p>
                {adminWhatsAppLink && (
                  <a href={adminWhatsAppLink} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 bg-green-600 text-white text-sm font-bold py-3 rounded-xl">
                    <MessageCircle size={15} /> {t('auth.contactAdmin')}
                  </a>
                )}
              </div>

              <button onClick={handleVerifyRequest} disabled={loading}
                className="w-full bg-blue-600 disabled:bg-slate-300 text-white font-bold py-4 rounded-2xl mb-3 flex items-center justify-center gap-2">
                {loading ? <><Loader2 size={18} className="animate-spin" /> {t('auth.sending')}</> : t('auth.allSet')}
              </button>

              <p className="text-slate-400 text-xs">{t('auth.checkEmail', { email })}</p>
            </div>
          )}

          {/* ── Step progress ── */}
          {!["phone", "pin_login", "setup_verify_request"].includes(step) && (
            <div className="flex items-center gap-1 mt-5">
              {["setup_email", "setup_otp", "setup_name", "setup_shop", "setup_pin", "setup_confirm_pin"].map((s, i) => {
                const steps = ["setup_email", "setup_otp", "setup_name", "setup_shop", "setup_pin", "setup_confirm_pin"];
                const current = steps.indexOf(step);
                return (
                  <div key={s} className={cn("h-1 flex-1 rounded-full transition-all", i <= current ? "bg-blue-600" : "bg-slate-200")} />
                );
              })}
            </div>
          )}
        </div>

        <p className="text-center text-slate-600 text-xs mt-5">
          MeraDarzi · {t('app.secure')}
        </p>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 size={32} className="text-blue-500 animate-spin" />
      </div>
    }>
      <AuthContent />
    </Suspense>
  );
}
