// src/components/payments/PaymentSummaryStrip.tsx
import { TrendingUp, Calendar, CalendarDays, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  todayTotal:   number
  weekTotal:    number
  monthTotal:   number
  totalPending: number
  onFilterClick: (f: 'today' | 'this_week' | 'this_month') => void
  activeFilter:  string
}

export function PaymentSummaryStrip({
  todayTotal, weekTotal, monthTotal, totalPending,
  onFilterClick, activeFilter,
}: Props) {
  const cards = [
    {
      icon:    Calendar,
      label:   'Aaj',
      value:   todayTotal,
      filter:  'today' as const,
      bg:      'bg-blue-50',
      active:  'bg-blue-600',
      iconBg:  'bg-blue-100',
      iconCol: 'text-blue-600',
      valCol:  'text-blue-800',
    },
    {
      icon:    CalendarDays,
      label:   'Is Hafte',
      value:   weekTotal,
      filter:  'this_week' as const,
      bg:      'bg-green-50',
      active:  'bg-green-600',
      iconBg:  'bg-green-100',
      iconCol: 'text-green-600',
      valCol:  'text-green-800',
    },
    {
      icon:    TrendingUp,
      label:   'Is Mahine',
      value:   monthTotal,
      filter:  'this_month' as const,
      bg:      'bg-purple-50',
      active:  'bg-purple-600',
      iconBg:  'bg-purple-100',
      iconCol: 'text-purple-600',
      valCol:  'text-purple-800',
    },
  ]

  return (
    <div className="space-y-3">
      {/* Clickable stat cards */}
      <div className="grid grid-cols-3 gap-2">
        {cards.map(c => {
          const isActive = activeFilter === c.filter
          return (
            <button
              key={c.filter}
              onClick={() => onFilterClick(c.filter)}
              className={cn(
                'rounded-2xl p-3 text-left transition-all active:scale-95 border-2',
                isActive
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-transparent bg-slate-50 hover:bg-slate-100'
              )}
            >
              <div className={cn(
                'w-8 h-8 rounded-xl flex items-center justify-center mb-2',
                isActive ? 'bg-blue-600' : c.iconBg
              )}>
                <c.icon size={15} className={isActive ? 'text-white' : c.iconCol} />
              </div>
              <p className={cn(
                'text-base font-bold leading-tight',
                isActive ? 'text-blue-700' : c.valCol
              )}>
                {c.value >= 1000
                  ? `${(c.value / 1000).toFixed(1)}k`
                  : c.value.toLocaleString()}
              </p>
              <p className={cn(
                'text-[10px] font-medium mt-0.5',
                isActive ? 'text-blue-600' : 'text-slate-400'
              )}>
                {c.label}
              </p>
            </button>
          )
        })}
      </div>

      {/* Pending balance strip */}
      {totalPending > 0 && (
        <div className="flex items-center justify-between bg-red-50 border border-red-200
                        rounded-2xl px-4 py-3">
          <div className="flex items-center gap-2">
            <Wallet size={15} className="text-red-600" />
            <span className="text-sm font-semibold text-red-700">
              Baaki Wapas Leni Hai
            </span>
          </div>
          <span className="text-base font-bold text-red-700">
            Rs. {totalPending.toLocaleString()}
          </span>
        </div>
      )}
    </div>
  )
}