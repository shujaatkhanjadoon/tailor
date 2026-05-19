// src/app/admin/setup-totp/page.tsx
"use client";

import { useState } from "react";
import { Scissors, Loader2, Copy, Check, Eye, EyeOff } from "lucide-react";

export default function SetupTOTPPage() {
  const [adminSecret, setAdminSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [qrData, setQrData] = useState(""); // base64 PNG
  const [uri, setUri] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleVerify = async () => {
    if (!adminSecret.trim() || loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/totp-uri", {
        method: "GET",
        headers: {
          "x-admin-secret": adminSecret.trim(),
          "Content-Type": "application/json",
        },
        cache: "no-store",
      });
      console.log("[Setup TOTP] Response status:", res.status);
      const data = await res.json();
      console.log("[Setup TOTP] Response data:", data);

      if (!res.ok) {
        setError(data.error ?? `Error ${res.status} — check ADMIN_SECRET`);
        return;
      }
      setQrData(data.qrData);
      setUri(data.uri);
      setAuthorized(true);
    } catch (e) {
      console.error("[Setup TOTP] Fetch error:", e);
      setError("Server se connect nahi ho saka");
    } finally {
      setLoading(false);
    }
  };

  const copyUri = () => {
    navigator.clipboard.writeText(uri);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div
            className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center
                          justify-center mx-auto mb-4 shadow-lg"
          >
            <Scissors size={26} className="text-white" strokeWidth={1.5} />
          </div>
          <h1 className="text-xl font-bold text-slate-800">
            Google Authenticator Setup
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Sirf ek baar karni hai — phir har login pe code use hoga
          </p>
        </div>

        {/* Step 1 — Verify admin secret */}
        {!authorized && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600 text-center">
              Setup ke liye admin secret verify karein
            </p>

            <div
              className={`flex items-center gap-2 border-2 rounded-2xl px-4 py-3.5
                             transition-all ${
                               error
                                 ? "border-red-400 bg-red-50"
                                 : "border-slate-200 bg-slate-50 focus-within:border-blue-500 focus-within:bg-white"
                             }`}
            >
              <input
                type={showSecret ? "text" : "password"}
                placeholder="Admin secret..."
                value={adminSecret}
                onChange={(e) => {
                  setAdminSecret(e.target.value);
                  setError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                autoFocus
                className="flex-1 text-sm font-mono bg-transparent outline-none
                           text-slate-800 placeholder:text-slate-400 placeholder:font-sans"
              />
              <button
                onClick={() => setShowSecret((v) => !v)}
                className="text-slate-400 hover:text-slate-600"
              >
                {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {error && (
              <p className="text-red-500 text-xs text-center">{error}</p>
            )}

            <button
              onClick={handleVerify}
              disabled={!adminSecret.trim() || loading}
              className="w-full bg-blue-600 disabled:bg-slate-300 text-white
                         font-bold py-4 rounded-2xl flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> Verifying...
                </>
              ) : (
                "Verify & Get QR Code →"
              )}
            </button>
          </div>
        )}

        {/* Step 2 — Show QR */}
        {authorized && (
          <div className="space-y-5">
            {/* QR Code */}
            <div className="flex flex-col items-center">
              {qrData && (
                <div
                  className="bg-white p-3 rounded-2xl border-2 border-slate-200
                                shadow-sm mb-3"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrData} alt="TOTP QR Code" className="w-52 h-52" />
                </div>
              )}
              <p className="text-xs text-slate-500 text-center max-w-xs leading-relaxed">
                Google Authenticator ya Authy mein yeh QR scan karein
              </p>
            </div>

            {/* Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
              <p className="text-xs font-bold text-blue-800 mb-2">
                📱 Setup Steps:
              </p>
              <ol className="text-xs text-blue-700 space-y-1.5 list-decimal list-inside leading-relaxed">
                <li>
                  Google Authenticator install karein{" "}
                  <a
                    href="https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline font-semibold"
                  >
                    (Android)
                  </a>
                  {" / "}
                  <a
                    href="https://apps.apple.com/app/google-authenticator/id388497605"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline font-semibold"
                  >
                    (iPhone)
                  </a>
                </li>
                <li>App mein "+" button → "Scan QR code"</li>
                <li>Upar wala QR scan karein</li>
                <li>"MeraDarzi Admin" entry dikh jayegi</li>
                <li>Ab har login mein 6-digit code use karein</li>
              </ol>
            </div>

            {/* Manual URI copy */}
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                Manual Entry (agar QR kaam na kare)
              </p>
              <div className="flex items-start gap-2 bg-slate-100 rounded-xl p-3">
                <p
                  className="flex-1 text-[10px] font-mono text-slate-600
                               break-all leading-relaxed"
                >
                  {uri.slice(0, 100)}
                  {uri.length > 100 ? "..." : ""}
                </p>
                <button
                  onClick={copyUri}
                  className="shrink-0 p-1.5 hover:bg-slate-200 rounded-lg
                             transition-colors"
                >
                  {copied ? (
                    <Check size={14} className="text-green-500" />
                  ) : (
                    <Copy size={14} className="text-slate-500" />
                  )}
                </button>
              </div>
            </div>

            {/* Warning */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <p className="text-xs text-amber-700 leading-relaxed">
                ⚠️ <strong>Important:</strong> Is QR ka screenshot le lein.
                ADMIN_TOTP_SECRET env variable save hai — isko kabhi delete mat
                karein. Agar delete kiya to phir se setup karna hoga.
              </p>
            </div>

            {/* Go to login */}
            <a
              href="/admin/login"
              className="block w-full text-center bg-green-600 hover:bg-green-700
                         text-white font-bold py-4 rounded-2xl transition-colors"
            >
              Setup Complete — Login Karein ✓
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
