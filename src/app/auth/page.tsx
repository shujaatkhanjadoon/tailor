"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import Image from "next/image";
import { useAuthWizard } from "@/lib/auth/useAuthWizard";
import {
  PhoneStep, PinLoginStep, SetupEmailStep, SetupOtpStep,
  SetupNameStep, SetupShopStep, SetupPinStep, SetupConfirmPinStep,
  SetupVerifyRequestStep, StepProgress,
} from "@/components/auth/AuthSteps";

function AuthContent() {
  const w = useAuthWizard();

  const SETUP_STEPS = ["setup_email", "setup_otp", "setup_name", "setup_shop", "setup_pin", "setup_confirm_pin"];

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
          <p className="text-slate-400 text-sm mt-1">{w.t('app.tagline')}</p>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-2xl shadow-black/30">
          {w.step === "phone" && <PhoneStep w={w} />}
          {w.step === "pin_login" && <PinLoginStep w={w} />}
          {w.step === "setup_email" && <SetupEmailStep w={w} />}
          {w.step === "setup_otp" && <SetupOtpStep w={w} />}
          {w.step === "setup_name" && <SetupNameStep w={w} />}
          {w.step === "setup_shop" && <SetupShopStep w={w} />}
          {w.step === "setup_pin" && <SetupPinStep w={w} />}
          {w.step === "setup_confirm_pin" && <SetupConfirmPinStep w={w} />}
          {w.step === "setup_verify_request" && <SetupVerifyRequestStep w={w} />}

          {!["phone", "pin_login", "setup_verify_request"].includes(w.step) && (
            <StepProgress w={w} steps={SETUP_STEPS} />
          )}
        </div>

        <p className="text-center text-slate-600 text-xs mt-5">
          MeraDarzi · {w.t('app.secure')}
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
