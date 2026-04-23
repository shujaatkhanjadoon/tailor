// src/components/dashboard/StatsCard.tsx
import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatsCardProps {
  icon: LucideIcon
  label: string               // Roman Urdu label
  value: string | number
  subLabel?: string           // small helper text below value
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info'
  onClick?: () => void
}

const VARIANT_STYLES = {
  default:  { card: 'bg-slate-50  border-slate-200',  icon: 'bg-slate-200  text-slate-600',  value: 'text-slate-800'  },
  success:  { card: 'bg-green-50  border-green-200',  icon: 'bg-green-200  text-green-700',  value: 'text-green-800'  },
  warning:  { card: 'bg-amber-50  border-amber-200',  icon: 'bg-amber-200  text-amber-700',  value: 'text-amber-800'  },
  danger:   { card: 'bg-red-50    border-red-200',    icon: 'bg-red-200    text-red-700',    value: 'text-red-800'    },
  info:     { card: 'bg-blue-50   border-blue-200',   icon: 'bg-blue-200   text-blue-700',   value: 'text-blue-800'   },
}

export function StatsCard({
  icon: Icon,
  label,
  value,
  subLabel,
  variant = 'default',
  onClick,
}: StatsCardProps) {
  const styles = VARIANT_STYLES[variant]

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left rounded-2xl border p-4 transition-transform active:scale-95',
        styles.card,
        onClick ? 'cursor-pointer' : 'cursor-default'
      )}
    >
      {/* Icon circle */}
      <div className={cn('w-10 h-10 rounded-full flex items-center justify-center mb-2', styles.icon)}>
        <Icon size={18} strokeWidth={2} />
      </div>

      {/* Value — BIG and prominent */}
      <p className={cn('text-2xl font-bold leading-none', styles.value)}>
        {value}
      </p>

      {/* Label */}
      <p className="text-xs font-medium text-slate-500 mt-1">{label}</p>

      {/* Optional sub-label */}
      {subLabel && (
        <p className="text-[10px] text-slate-400 mt-0.5">{subLabel}</p>
      )}
    </button>
  )
}