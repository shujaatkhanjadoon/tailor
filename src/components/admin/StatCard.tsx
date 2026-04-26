// src/components/admin/StatCard.tsx
import { LucideIcon } from 'lucide-react'
import { cn }         from '@/lib/utils'

interface StatCardProps {
  label:    string
  value:    string | number
  sub?:     string
  icon:     LucideIcon
  trend?:   { value: number; label: string }
  color?:   'blue' | 'green' | 'amber' | 'red' | 'purple' | 'slate'
}

const COLOR_MAP = {
  blue:   { bg: 'bg-blue-950',   icon: 'bg-blue-900 text-blue-400',   val: 'text-blue-100',   border: 'border-blue-800'   },
  green:  { bg: 'bg-green-950',  icon: 'bg-green-900 text-green-400', val: 'text-green-100',  border: 'border-green-800'  },
  amber:  { bg: 'bg-amber-950',  icon: 'bg-amber-900 text-amber-400', val: 'text-amber-100',  border: 'border-amber-800'  },
  red:    { bg: 'bg-red-950',    icon: 'bg-red-900 text-red-400',     val: 'text-red-100',    border: 'border-red-800'    },
  purple: { bg: 'bg-purple-950', icon: 'bg-purple-900 text-purple-400', val: 'text-purple-100', border: 'border-purple-800' },
  slate:  { bg: 'bg-slate-900',  icon: 'bg-slate-800 text-slate-400', val: 'text-slate-100',  border: 'border-slate-700'  },
}

export function StatCard({ label, value, sub, icon: Icon, trend, color = 'slate' }: StatCardProps) {
  const c = COLOR_MAP[color]

  return (
    <div className={cn('rounded-2xl border p-5', c.bg, c.border)}>
      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center mb-4', c.icon)}>
        <Icon size={18} />
      </div>
      <p className={cn('text-2xl font-bold mb-0.5', c.val)}>{value}</p>
      <p className="text-slate-500 text-xs font-medium">{label}</p>
      {sub && <p className="text-slate-600 text-[10px] mt-1">{sub}</p>}
      {trend && (
        <div className={cn(
          'flex items-center gap-1 mt-2 text-[10px] font-bold',
          trend.value >= 0 ? 'text-green-500' : 'text-red-500'
        )}>
          {trend.value >= 0 ? '↑' : '↓'}
          {Math.abs(trend.value)}% {trend.label}
        </div>
      )}
    </div>
  )
}