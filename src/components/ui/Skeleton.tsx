// src/components/ui/Skeleton.tsx
import { cn } from '@/lib/utils'

// Base shimmer skeleton
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'animate-pulse bg-slate-200 rounded-xl',
        className
      )}
      {...props}
    />
  )
}

// ── Dashboard skeleton ───────────────────────────────────────────
export function DashboardSkeleton() {
  return (
    <div className="flex flex-col min-h-screen bg-slate-50 pb-20">
      {/* Header */}
      <div className="bg-linear-to-br from-blue-900 to-blue-700 px-5 pt-12 pb-6">
        <div className="flex items-start justify-between">
          <div>
            <Skeleton className="h-4 w-24 mb-2 bg-blue-700" />
            <Skeleton className="h-7 w-40 bg-blue-700" />
            <Skeleton className="h-3 w-32 mt-2 bg-blue-800" />
          </div>
          <Skeleton className="w-10 h-10 rounded-full bg-blue-700" />
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-4 border border-slate-200">
              <Skeleton className="h-8 w-8 rounded-xl mb-3" />
              <Skeleton className="h-7 w-12 mb-1" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>

        {/* Balance strip */}
        <Skeleton className="h-14 w-full rounded-2xl" />

        {/* Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-14 rounded-2xl" />
          <Skeleton className="h-14 rounded-2xl" />
        </div>

        {/* Orders */}
        <div>
          <div className="flex justify-between mb-3">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-20" />
          </div>
          {Array.from({ length: 3 }).map((_, i) => (
            <OrderCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Order card skeleton ──────────────────────────────────────────
export function OrderCardSkeleton() {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-3">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-xl" />
          <div>
            <Skeleton className="h-4 w-32 mb-1.5" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <Skeleton className="h-2 w-full rounded-full mb-2" />
      <div className="flex justify-between">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  )
}

// ── Customer card skeleton ───────────────────────────────────────
export function CustomerCardSkeleton() {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-3
                    flex items-center gap-3">
      <Skeleton className="w-12 h-12 rounded-full shrink-0" />
      <div className="flex-1">
        <Skeleton className="h-4 w-32 mb-1.5" />
        <Skeleton className="h-3 w-24" />
      </div>
      <div className="text-right">
        <Skeleton className="h-4 w-8 mb-1" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  )
}

// ── Payment card skeleton ───────────────────────────────────────
export function PaymentCardSkeleton() {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-3">
      <div className="flex items-start gap-3 mb-3">
        <Skeleton className="w-11 h-11 rounded-xl shrink-0" />
        <div className="flex-1">
          <Skeleton className="h-4 w-36 mb-1.5" />
          <Skeleton className="h-3 w-24 mb-1" />
          <Skeleton className="h-3 w-20" />
        </div>
        <div className="text-right">
          <Skeleton className="h-6 w-16 mb-1" />
          <Skeleton className="h-3 w-10" />
        </div>
      </div>
      <Skeleton className="h-1.5 w-full rounded-full" />
    </div>
  )
}

// ── Report card skeleton ─────────────────────────────────────────
export function ReportSkeleton() {
  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-2xl p-4">
            <Skeleton className="h-8 w-8 rounded-xl mb-3" />
            <Skeleton className="h-6 w-20 mb-1" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
      {/* Chart */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <Skeleton className="h-5 w-32 mb-4" />
        <div className="flex items-end gap-2 h-40">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton
              key={i}
              className="flex-1 rounded-t-lg"
              style={{ height: `${20 + Math.random() * 80}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Settings skeleton ─────────────────────────────────────────────
export function SettingsSkeleton() {
  return (
    <div className="space-y-4 px-4 pt-4">
      {Array.from({ length: 3 }).map((_, g) => (
        <div key={g} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <Skeleton className="h-8 mx-4 mt-4 w-24 mb-3" />
          {Array.from({ length: 3 }).map((_, r) => (
            <div key={r} className="flex items-center gap-3 px-4 py-4 border-t border-slate-100">
              <Skeleton className="w-9 h-9 rounded-xl shrink-0" />
              <div className="flex-1">
                <Skeleton className="h-4 w-32 mb-1.5" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="w-5 h-5 rounded" />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// ── Billing page skeleton ─────────────────────────────────────────
export function BillingSkeleton() {
  return (
    <div className="space-y-4 px-4 pt-4">
      {/* Plan card */}
      <Skeleton className="h-32 w-full rounded-2xl" />
      {/* Usage meters */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-4">
        <Skeleton className="h-5 w-32" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i}>
            <div className="flex justify-between mb-1.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
        ))}
      </div>
      {/* History */}
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-white border border-slate-200 rounded-2xl p-4
                                flex items-center gap-3">
          <Skeleton className="w-9 h-9 rounded-xl shrink-0" />
          <div className="flex-1">
            <Skeleton className="h-4 w-32 mb-1.5" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-5 w-20" />
        </div>
      ))}
    </div>
  )
}

export { Skeleton }