"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

export function OTPInput({
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
