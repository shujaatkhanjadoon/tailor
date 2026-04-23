// src/components/settings/SettingsRow.tsx
import { ChevronRight, LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SettingsRowProps {
  icon:       LucideIcon
  iconBg:     string          // e.g. 'bg-blue-100'
  iconColor:  string          // e.g. 'text-blue-600'
  label:      string
  sublabel?:  string
  value?:     string          // right-side value text
  onClick?:   () => void
  danger?:    boolean
  badge?:     string          // small badge e.g. "3"
  last?:      boolean         // no bottom border
}

export function SettingsRow({
  icon: Icon,
  iconBg,
  iconColor,
  label,
  sublabel,
  value,
  onClick,
  danger  = false,
  badge,
  last    = false,
}: SettingsRowProps) {
  const Wrapper = onClick ? 'button' : 'div'

  return (
    <Wrapper
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-4 text-left transition-colors',
        onClick && 'active:bg-slate-50 cursor-pointer',
        !last && 'border-b border-slate-100'
      )}
    >
      {/* Icon */}
      <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0', iconBg)}>
        <Icon size={17} className={iconColor} strokeWidth={2} />
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-semibold', danger ? 'text-red-600' : 'text-slate-800')}>
          {label}
        </p>
        {sublabel && (
          <p className="text-xs text-slate-400 mt-0.5 truncate">{sublabel}</p>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {badge && (
          <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
            {badge}
          </span>
        )}
        {value && (
          <span className="text-xs text-slate-400 font-medium">{value}</span>
        )}
        {onClick && (
          <ChevronRight size={15} className={cn(danger ? 'text-red-300' : 'text-slate-300')} />
        )}
      </div>
    </Wrapper>
  )
}