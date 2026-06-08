"use client";

import { useRef } from "react";
import { SHOP_PIN_LENGTH } from "@/lib/security/pin";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

export function PINInput({
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
