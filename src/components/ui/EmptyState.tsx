// src/components/ui/EmptyState.tsx
import { LucideIcon } from 'lucide-react'
import { cn }         from '@/lib/utils'

interface EmptyStateProps {
  icon?:       LucideIcon
  emoji?:      string
  title:       string
  description?: string
  action?:     {
    label:   string
    onClick: () => void
    icon?:   LucideIcon
  }
  secondaryAction?: {
    label:   string
    onClick: () => void
  }
  size?: 'sm' | 'md' | 'lg'
}

export function EmptyState({
  icon: Icon,
  emoji,
  title,
  description,
  action,
  secondaryAction,
  size = 'md',
}: EmptyStateProps) {
  const sizes = {
    sm: { wrap: 'py-10', iconBox: 'w-12 h-12', iconSize: 20, emoji: 'text-3xl' },
    md: { wrap: 'py-16', iconBox: 'w-16 h-16', iconSize: 26, emoji: 'text-4xl' },
    lg: { wrap: 'py-20', iconBox: 'w-20 h-20', iconSize: 32, emoji: 'text-5xl' },
  }

  const s = sizes[size]

  return (
    <div className={cn('flex flex-col items-center text-center px-6', s.wrap)}>
      {/* Icon or emoji */}
      {emoji ? (
        <p className={cn(s.emoji, 'mb-4')}>{emoji}</p>
      ) : Icon ? (
        <div className={cn(
          s.iconBox,
          'bg-slate-100 rounded-2xl flex items-center justify-center mb-4'
        )}>
          <Icon size={s.iconSize} className="text-slate-400" />
        </div>
      ) : null}

      {/* Title */}
      <h3 className="font-bold text-slate-700 text-base mb-1.5">{title}</h3>

      {/* Description */}
      {description && (
        <p className="text-slate-400 text-sm max-w-xs leading-relaxed mb-5">
          {description}
        </p>
      )}

      {/* Actions */}
      {(action || secondaryAction) && (
        <div className="flex flex-col gap-2 w-full max-w-50">
          {action && (
            <button
              onClick={action.onClick}
              className="flex items-center justify-center gap-2 bg-blue-600
                         text-white font-semibold px-5 py-3 rounded-xl text-sm
                         transition-colors hover:bg-blue-700 active:scale-95"
            >
              {action.icon && <action.icon size={15} />}
              {action.label}
            </button>
          )}
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              className="text-slate-400 font-medium text-sm py-2 hover:text-slate-600"
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Pre-built empty states ────────────────────────────────────────

export const EMPTY_STATES = {
  orders: {
    emoji:       '📋',
    title:       'Koi Order Nahi',
    description: 'Pehla order add karein aur kaam shuru karein',
  },
  customers: {
    emoji:       '👥',
    title:       'Koi Gahak Nahi',
    description: 'Pehle gahak ko register karein',
  },
  payments: {
    emoji:       '💰',
    title:       'Koi Payment Nahi',
    description: 'Jab payment aaye gi yahan dikhegi',
  },
  search: {
    emoji:       '🔍',
    title:       'Kuch Nahi Mila',
    description: 'Alag keywords se try karein',
  },
  reports: {
    emoji:       '📊',
    title:       'Data Nahi Hai',
    description: 'Orders add karein to reports dikhenge',
  },
  offline: {
    emoji:       '📡',
    title:       'Internet Nahi Hai',
    description: 'Connection check karein aur dobara try karein',
  },
}
