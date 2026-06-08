"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { validatePakistaniPhone } from "@/lib/security/phone";
import { SHOP_PIN_LENGTH, validatePIN, getPINStrength } from "@/lib/security/pin";
import { useTranslation } from "react-i18next";
import { PAKISTAN_STATE_CITIES } from "@/lib/locations/pakistan";

export type AuthStep =
  | "phone"
  | "pin_login"
  | "setup_email"
  | "setup_otp"
  | "setup_name"
  | "setup_shop"
  | "setup_pin"
  | "setup_confirm_pin"
  | "setup_verify_request";

export type AuthWizard = ReturnType<typeof useAuthWizard>;

export function useAuthWizard() {
  const searchParams = useSearchParams();
  const rawRedirect = searchParams.get("redirect") ?? "/";
  const { t } = useTranslation();

  const redirectTo = (
    rawRedirect.startsWith('/auth') ||
    rawRedirect.startsWith('/login') ||
    rawRedirect.startsWith('/setup') ||
    rawRedirect.startsWith('/admin') ||
    rawRedirect.startsWith('/dashboard')
  ) ? '/' : rawRedirect;

  const { currentUser, isLoading: authLoading, setupShop } = useAuth();

  const [step, setStep] = useState<AuthStep>("phone");
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
          const diffSec = Math.ceil((end.getTime() - Date.now()) / 1000)
          setError(t('auth.lockoutMessage', { minutes: Math.floor(diffSec / 60), seconds: diffSec % 60 }))
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
  const ADMIN_WA = process.env.NEXT_PUBLIC_ADMIN_WHATSAPP ?? "";
  const adminWhatsAppLink = ADMIN_WA
    ? `https://wa.me/${ADMIN_WA}?text=${encodeURIComponent(`Assalam o Alaikum, nayi shop registration verify kar dein.\n\nShop: ${shopName.trim()}\nOwner: ${ownerName.trim()}\nPhone: ${phone.replace(/\D/g, "")}\nCity: ${city.trim() || "N/A"}`)}`
    : null;

  return {
    t,
    step, setStep,
    phone, setPhone,
    email, setEmail,
    otp, setOtp,
    pin, setPin,
    confirmPin, setConfirmPin,
    ownerName, setOwnerName,
    shopName, setShopName,
    city, setCity,
    stateProvince, setStateProvince,
    cityQuery, setCityQuery,
    cityDropdownOpen, setCityDropdownOpen,
    showPin, setShowPin,
    loading, setLoading,
    error, setError,
    pinError, setPinError,
    maskedEmail, setMaskedEmail,
    shopDisplay, setShopDisplay,
    loginPinLength, setLoginPinLength,
    lockoutEnd, setLockoutEnd,
    lockoutSeconds,
    newShopId, setNewShopId,
    isOnline,
    selectedState,
    filteredCities,
    canAddTypedCity,
    pinStrength,
    adminWhatsAppLink,
    redirectTo,
    handlePhoneSubmit,
    handlePINLogin,
    handleSendOTP,
    handleVerifyOTP,
    handleSetPin,
    handleConfirmPin,
    handleVerifyRequest,
  };
}
