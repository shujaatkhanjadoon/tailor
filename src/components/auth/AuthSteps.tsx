"use client";

import {
  Phone, Mail, ShieldCheck, User, Store,
  Lock, Eye, EyeOff, Loader2, AlertCircle,
  ArrowLeft, MapPin, MessageCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SHOP_PIN_LENGTH } from "@/lib/security/pin";
import { PINInput } from "@/components/auth/PINInput";
import { PAKISTAN_STATE_CITIES } from "@/lib/locations/pakistan";
import { OTPInput } from "@/components/auth/OTPInput";
import type { AuthStep, AuthWizard } from "@/lib/auth/useAuthWizard";

type Wizard = AuthWizard;

export function PhoneStep({ w }: { w: Wizard }) {
  return (
    <div>
      <h2 className="text-lg font-bold text-slate-800 mb-1">{w.t('auth.start')}</h2>
      <p className="text-slate-400 text-sm mb-5">{w.t('auth.phonePrompt')}</p>

      {!w.isOnline && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 mb-4">
          <AlertCircle size={14} className="text-amber-600 shrink-0" />
          <p className="text-amber-700 text-xs">{w.t('auth.internetRequired')}</p>
        </div>
      )}

      <div className={cn("flex items-center gap-2 border-2 rounded-2xl px-4 py-3.5 mb-4 transition-all",
        w.error ? "border-red-400 bg-red-50" : "border-slate-200 bg-slate-50 focus-within:border-blue-500 focus-within:bg-white")}>
        <Phone size={17} className="text-slate-400 shrink-0" />
        <input type="tel" inputMode="numeric" placeholder={w.t('auth.phonePlaceholder')}
          value={w.phone} onChange={(e) => { const val = e.target.value.replace(/\D/g, "").slice(0, 11); w.setPhone(val); w.setError(""); }}
          maxLength={11} onKeyDown={(e) => e.key === "Enter" && w.handlePhoneSubmit()} autoFocus
          className="flex-1 text-sm bg-transparent outline-none text-slate-800 placeholder:text-slate-400" />
      </div>

      {w.error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 mb-4">
          <AlertCircle size={13} className="text-red-500 shrink-0" />
          <p className="text-red-600 text-xs">{w.error}</p>
        </div>
      )}

      <button onClick={w.handlePhoneSubmit} disabled={w.loading || w.phone.replace(/\D/g, "").length < 11 || w.lockoutSeconds > 0}
        className="w-full bg-blue-600 disabled:bg-slate-300 text-white font-bold py-4 rounded-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-2">
        {w.loading ? <><Loader2 size={18} className="animate-spin" /> {w.t('auth.checking')}</> : w.t('auth.continue')}
      </button>
    </div>
  );
}

export function PinLoginStep({ w }: { w: Wizard }) {
  return (
    <div>
      <button onClick={() => { w.setStep("phone"); w.setPin(""); w.setPinError(""); }}
        className="flex items-center gap-1.5 text-slate-400 text-sm mb-4 hover:text-slate-600 transition-colors">
        <ArrowLeft size={14} /> {w.t('auth.back')}
      </button>

      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 bg-blue-100 rounded-2xl flex items-center justify-center shrink-0">
          <Store size={18} className="text-blue-600" />
        </div>
        <div>
          <p className="font-bold text-slate-800 text-sm">{w.shopDisplay || w.t('auth.yourShop')}</p>
          <p className="text-slate-400 text-xs">{w.phone}</p>
        </div>
      </div>

      {w.lockoutEnd && w.lockoutSeconds > 0 ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-center">
          <Lock size={24} className="text-red-500 mx-auto mb-2" />
          <p className="font-bold text-red-700">{w.t('auth.accountLocked')}</p>
          <p className="text-red-500 text-sm mt-1">
            {w.t('auth.lockoutMessage', { minutes: Math.floor(w.lockoutSeconds / 60), seconds: w.lockoutSeconds % 60 })}
          </p>
        </div>
      ) : (
        <div>
          <PINInput value={w.pin} onChange={(v) => { w.setPin(v); w.setPinError(""); }}
            length={w.loginPinLength}
            label={w.t('auth.pinDigit', { digit: w.loginPinLength })}
            error={w.pinError || undefined} disabled={w.loading} />

          {w.loading && (
            <div className="flex items-center justify-center gap-2 mt-3 text-blue-600">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-sm">{w.t('auth.verifying')}</span>
            </div>
          )}

          <div className="mt-4 text-center">
            {process.env.NEXT_PUBLIC_ADMIN_WHATSAPP ? (
              <a href={`https://wa.me/${process.env.NEXT_PUBLIC_ADMIN_WHATSAPP}?text=${encodeURIComponent(`Assalam o Alaikum! Mera MeraDarzi account ka PIN bhool gaye hoon. ${w.phone ? `Phone: ${w.phone}` : ''}. Please mera PIN reset kar dein.`)}`}
                target="_blank" rel="noopener noreferrer"
                className="text-xs text-slate-400 hover:text-green-500 underline transition-colors">
                PIN bhool gaye? Admin se WhatsApp karein
              </a>
            ) : (
              <span className="text-xs text-slate-500">PIN bhool gaye? Admin se contact karein.</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function SetupEmailStep({ w }: { w: Wizard }) {
  return (
    <div>
      <button onClick={() => { w.setStep("phone"); w.setError(""); }}
        className="flex items-center gap-1.5 text-slate-400 text-sm mb-4">
        <ArrowLeft size={14} /> {w.t('auth.back')}
      </button>

      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 bg-blue-100 rounded-2xl flex items-center justify-center shrink-0">
          <Mail size={18} className="text-blue-600" />
        </div>
        <div>
          <h2 className="font-bold text-slate-800">{w.t('auth.emailLabel')}</h2>
          <p className="text-slate-400 text-xs">{w.t('auth.emailDescription')}</p>
        </div>
      </div>

      <p className="text-slate-500 text-sm mb-4 leading-relaxed">{w.t('auth.emailDetail')}</p>

      <div className={cn("flex items-center gap-2 border-2 rounded-2xl px-4 py-3.5 mb-4",
        w.error ? "border-red-400 bg-red-50" : "border-slate-200 bg-slate-50 focus-within:border-blue-500 focus-within:bg-white")}>
        <Mail size={16} className="text-slate-400 shrink-0" />
        <input type="email" inputMode="email" placeholder={w.t('auth.emailPlaceholder')}
          value={w.email} onChange={(e) => { w.setEmail(e.target.value); w.setError(""); }}
          onKeyDown={(e) => e.key === "Enter" && w.handleSendOTP()} autoFocus
          className="flex-1 text-sm bg-transparent outline-none text-slate-800 placeholder:text-slate-400" />
      </div>

      {w.error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 mb-4">
          <AlertCircle size={13} className="text-red-500 shrink-0" />
          <p className="text-red-600 text-xs">{w.error}</p>
        </div>
      )}

      <button onClick={w.handleSendOTP} disabled={w.loading || !w.email.includes("@")}
        className="w-full bg-blue-600 disabled:bg-slate-300 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2">
        {w.loading ? <><Loader2 size={18} className="animate-spin" /> {w.t('auth.sending')}</> : w.t('auth.sendOtp')}
      </button>
    </div>
  );
}

export function SetupOtpStep({ w }: { w: Wizard }) {
  return (
    <div>
      <button onClick={() => { w.setStep("setup_email"); w.setOtp(""); w.setError(""); }}
        className="flex items-center gap-1.5 text-slate-400 text-sm mb-4">
        <ArrowLeft size={14} /> {w.t('auth.back')}
      </button>

      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 bg-green-100 rounded-2xl flex items-center justify-center shrink-0">
          <ShieldCheck size={18} className="text-green-600" />
        </div>
        <div>
          <h2 className="font-bold text-slate-800">{w.t('auth.otpTitle')}</h2>
          <p className="text-slate-400 text-xs">{w.t('auth.otpSentTo', { email: w.maskedEmail })}</p>
        </div>
      </div>

      <p className="text-slate-500 text-sm mb-4">{w.t('auth.otpDescription')}</p>

      <OTPInput value={w.otp} onChange={(v) => { w.setOtp(v); w.setError(""); }}
        error={w.error || undefined} disabled={w.loading} />

      {w.loading && (
        <div className="flex items-center justify-center gap-2 mt-3 text-blue-600">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-sm">{w.t('auth.verifying')}</span>
        </div>
      )}

      <button onClick={() => { w.setOtp(""); w.handleSendOTP(); }}
        className="w-full text-center text-blue-600 text-sm font-semibold mt-4">
        {w.t('auth.otpResend')}
      </button>
    </div>
  );
}

export function SetupNameStep({ w }: { w: Wizard }) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 bg-blue-100 rounded-2xl flex items-center justify-center shrink-0">
          <User size={18} className="text-blue-600" />
        </div>
        <div>
          <h2 className="font-bold text-slate-800">{w.t('auth.yourName')}</h2>
          <p className="text-slate-400 text-xs">{w.t('auth.ownerName')}</p>
        </div>
      </div>

      <input type="text" placeholder={w.t('auth.namePlaceholder')}
        value={w.ownerName}
        onChange={(e) => { w.setOwnerName(e.target.value); w.setError(""); }}
        onKeyDown={(e) => { if (e.key === "Enter" && w.ownerName.trim().length >= 2) w.setStep("setup_shop"); }}
        autoFocus
        className="w-full px-4 py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-sm font-medium text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all placeholder:text-slate-400" />

      {w.error && <p className="text-red-500 text-xs mt-2">{w.error}</p>}

      <button onClick={() => {
        if (w.ownerName.trim().length < 2) { w.setError(w.t('auth.nameTooShort')); return; }
        w.setError(""); w.setStep("setup_shop");
      }} disabled={w.ownerName.trim().length < 2}
        className="w-full bg-blue-600 disabled:bg-slate-300 text-white font-bold py-4 rounded-2xl mt-4 transition-all">
        {w.t('auth.continue')}
      </button>
    </div>
  );
}

export function SetupShopStep({ w }: { w: Wizard }) {
  return (
    <div>
      <button onClick={() => w.setStep("setup_name")}
        className="flex items-center gap-1.5 text-slate-400 text-sm mb-4">
        <ArrowLeft size={14} /> {w.t('auth.back')}
      </button>

      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 bg-purple-100 rounded-2xl flex items-center justify-center shrink-0">
          <Store size={18} className="text-purple-600" />
        </div>
        <div>
          <h2 className="font-bold text-slate-800">{w.t('auth.shopName')}</h2>
          <p className="text-slate-400 text-xs">{w.t('auth.shopDescription')}</p>
        </div>
      </div>

      <input type="text" placeholder={w.t('auth.shopPlaceholder')}
        value={w.shopName} onChange={(e) => { w.setShopName(e.target.value); w.setError(""); }}
        autoFocus
        className="w-full px-4 py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-sm font-medium text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all placeholder:text-slate-400 mb-3" />

      <label className="mb-4 block">
        <span className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <MapPin size={13} /> {w.t('auth.stateProvince')}
        </span>
        <select value={w.stateProvince} onChange={(e) => { w.setStateProvince(e.target.value); w.setCity(""); w.setCityQuery(""); w.setCityDropdownOpen(false); }}
          className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-800 outline-none transition-all focus:border-blue-500 focus:bg-white">
          <option value="">{w.t('auth.selectState')}</option>
          {PAKISTAN_STATE_CITIES.map((group) => (
            <option key={group.state} value={group.state}>{group.state}</option>
          ))}
        </select>
      </label>

      {w.stateProvince && (
        <div className="mb-4">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">{w.t('auth.city')}</span>
          <input type="text" value={w.cityQuery} onFocus={() => w.setCityDropdownOpen(true)}
            onChange={(e) => { w.setCityQuery(e.target.value); w.setCityDropdownOpen(true); }}
            placeholder={w.city || w.t('auth.citySearch')}
            className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-800 outline-none transition-all focus:border-blue-500 focus:bg-white" />
          {w.cityDropdownOpen && (
            <div className="mt-2 max-h-40 overflow-y-auto rounded-2xl border border-slate-200 bg-white">
              {w.city && (
                <button type="button" onClick={() => { w.setCity(""); w.setCityQuery(""); w.setCityDropdownOpen(false); }}
                  className="w-full border-b border-slate-100 px-4 py-2.5 text-left text-xs font-semibold text-slate-400">
                  {w.t('auth.selectedCity', { city: w.city })}
                </button>
              )}
              {w.filteredCities.map((item) => (
                <button key={`${w.stateProvince}-${item}`} type="button"
                  onClick={() => { w.setCity(item); w.setCityQuery(""); w.setCityDropdownOpen(false); }}
                  className={cn("w-full border-b border-slate-100 px-4 py-3 text-left text-sm transition-colors last:border-0 hover:bg-slate-50",
                    w.city === item ? "bg-blue-50 font-semibold text-blue-700" : "text-slate-700")}>
                  {item}
                </button>
              ))}
              {w.canAddTypedCity && (
                <button type="button" onClick={() => { w.setCity(w.cityQuery.trim()); w.setCityQuery(""); w.setCityDropdownOpen(false); }}
                  className="w-full px-4 py-3 text-left text-sm font-semibold text-blue-700 hover:bg-blue-50">
                  {w.t('auth.addCity', { city: w.cityQuery.trim() })}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {w.error && <p className="text-red-500 text-xs mb-3">{w.error}</p>}

      <button onClick={() => {
        if (w.shopName.trim().length < 3) { w.setError(w.t('auth.shopTooShort')); return; }
        w.setError(""); w.setStep("setup_pin");
      }} disabled={w.shopName.trim().length < 3}
        className="w-full bg-blue-600 disabled:bg-slate-300 text-white font-bold py-4 rounded-2xl transition-all">
        {w.t('auth.continue')}
      </button>
    </div>
  );
}

export function SetupPinStep({ w }: { w: Wizard }) {
  const pinStrengthLabels: Record<string, string> = {
    weak: w.t('auth.pinStrengthWeak'),
    fair: w.t('auth.pinStrengthFair'),
    good: w.t('auth.pinStrengthGood'),
    strong: w.t('auth.pinStrengthStrong'),
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
    <div>
      <button onClick={() => { w.setStep("setup_shop"); w.setPin(""); w.setPinError(""); }}
        className="flex items-center gap-1.5 text-slate-400 text-sm mb-4">
        <ArrowLeft size={14} /> {w.t('auth.back')}
      </button>

      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 bg-green-100 rounded-2xl flex items-center justify-center shrink-0">
          <Lock size={18} className="text-green-600" />
        </div>
        <div>
          <h2 className="font-bold text-slate-800">{w.t('auth.createPin', { digit: SHOP_PIN_LENGTH })}</h2>
          <p className="text-slate-400 text-xs">{w.t('auth.createPinDescription')}</p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3 mb-4">
        <p className="text-blue-700 text-xs leading-relaxed">{w.t('auth.pinTip')}</p>
      </div>

      <PINInput value={w.pin} onChange={(v) => { w.setPin(v); w.setPinError(""); }}
        masked={!w.showPin} label={w.t('auth.newPin')}
        error={w.pinError || undefined} disabled={w.loading} length={SHOP_PIN_LENGTH} />

      {w.pin.length === SHOP_PIN_LENGTH && w.pinStrength.score > 0 && (
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-500">{w.t('auth.pinStrength')}</span>
            <span className={cn("text-xs font-bold", pinStrengthColors[w.pinStrength.label] || 'text-slate-500')}>
              {pinStrengthLabels[w.pinStrength.label as keyof typeof pinStrengthLabels] || w.pinStrength.label}
            </span>
          </div>
          <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div className={cn("h-full rounded-full transition-all", pinStrengthBg(w.pinStrength.score))}
              style={{ width: `${(w.pinStrength.score / 4) * 100}%` }} />
          </div>
        </div>
      )}

      <button onClick={() => w.setShowPin((v) => !v)}
        className="flex items-center gap-1.5 text-slate-400 text-xs mt-3">
        {w.showPin ? <EyeOff size={12} /> : <Eye size={12} />}
        {w.showPin ? w.t('auth.hidePin') : w.t('auth.showPin')}
      </button>
    </div>
  );
}

export function SetupConfirmPinStep({ w }: { w: Wizard }) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 bg-green-100 rounded-2xl flex items-center justify-center shrink-0">
          <ShieldCheck size={18} className="text-green-600" />
        </div>
        <div>
          <h2 className="font-bold text-slate-800">{w.t('auth.confirmPin')}</h2>
          <p className="text-slate-400 text-xs">{w.t('auth.confirmDesc')}</p>
        </div>
      </div>

      <PINInput value={w.confirmPin} onChange={(v) => { w.setConfirmPin(v); w.setPinError(""); }}
        label={w.t('auth.confirmPinInput')} error={w.pinError || undefined}
        disabled={w.loading} length={SHOP_PIN_LENGTH} />

      {w.loading && (
        <div className="flex items-center justify-center gap-2 mt-4 text-blue-600">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-sm">{w.t('auth.creatingAccount')}</span>
        </div>
      )}
    </div>
  );
}

export function SetupVerifyRequestStep({ w }: { w: Wizard }) {
  return (
    <div className="text-center">
      <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <ShieldCheck size={32} className="text-amber-600" />
      </div>

      <h2 className="text-xl font-bold text-slate-800 mb-2">{w.t('auth.accountCreated')}</h2>
      <p className="text-slate-500 text-sm leading-relaxed mb-5">{w.t('auth.accountCreatedDesc')}</p>

      <div className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-4 mb-5 text-left space-y-2">
        {[
          { label: "Shop", value: w.shopName },
          { label: "Owner", value: w.ownerName },
          { label: "Phone", value: w.phone },
          { label: "Email", value: w.email },
        ].map(({ label, value }) => (
          <div key={label} className="flex justify-between text-sm">
            <span className="text-slate-500">{label}</span>
            <span className="font-semibold text-slate-800">{value}</span>
          </div>
        ))}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 mb-5 space-y-3">
        <p className="text-amber-700 text-xs leading-relaxed">{w.t('auth.verificationInProgress')}</p>
        <p className="text-amber-700 text-xs leading-relaxed">{w.t('auth.verificationWhatsApp')}</p>
        {w.adminWhatsAppLink && (
          <a href={w.adminWhatsAppLink} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 bg-green-600 text-white text-sm font-bold py-3 rounded-xl">
            <MessageCircle size={15} /> {w.t('auth.contactAdmin')}
          </a>
        )}
      </div>

      <button onClick={w.handleVerifyRequest} disabled={w.loading}
        className="w-full bg-blue-600 disabled:bg-slate-300 text-white font-bold py-4 rounded-2xl mb-3 flex items-center justify-center gap-2">
        {w.loading ? <><Loader2 size={18} className="animate-spin" /> {w.t('auth.sending')}</> : w.t('auth.allSet')}
      </button>

      <p className="text-slate-400 text-xs">{w.t('auth.checkEmail', { email: w.email })}</p>
    </div>
  );
}

export function StepProgress({ w, steps }: { w: Wizard; steps: string[] }) {
  const current = steps.indexOf(w.step);
  return (
    <div className="flex items-center gap-1 mt-5">
      {steps.map((s, i) => (
        <div key={s} className={cn("h-1 flex-1 rounded-full transition-all", i <= current ? "bg-blue-600" : "bg-slate-200")} />
      ))}
    </div>
  );
}
