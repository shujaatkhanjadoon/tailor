// src/components/reports/SummaryCards.tsx
import {
  TrendingUp, TrendingDown, ShoppingBag,
  CheckCircle2, Users, Wallet, Minus,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface SummaryCardsProps {
  summary: {
    totalRevenue:    number
    totalOrders:     number
    completedOrders: number
    pendingBalance:  number
    avgOrderValue:   number
    completionRate:  number
    totalCustomers:  number
    revenueGrowth:   number | null
  }
}

export function SummaryCards({ summary }: SummaryCardsProps) {
  if (!summary || (summary.totalOrders === 0 && summary.totalRevenue === 0)) {
    return null
  }
  const cards = [
    {
      label:    'Total Income',
      value:    `Rs. ${summary.totalRevenue.toLocaleString()}`,
      sub:      summary.revenueGrowth !== null
        ? `${summary.revenueGrowth > 0 ? '+' : ''}${summary.revenueGrowth}% vs last period`
        : 'All time',
      icon:     TrendingUp,
      iconBg:   'bg-green-100',
      iconCol:  'text-green-600',
      valCol:   'text-green-800',
      growth:   summary.revenueGrowth,
    },
    {
      label:   'Total Orders',
      value:   summary.totalOrders,
      sub:     `${summary.completedOrders} delivered`,
      icon:    ShoppingBag,
      iconBg:  'bg-blue-100',
      iconCol: 'text-blue-600',
      valCol:  'text-blue-800',
      growth:  null,
    },
    {
      label:   'Avg Order Value',
      value:   `Rs. ${summary.avgOrderValue.toLocaleString()}`,
      sub:     `${summary.completionRate}% completion rate`,
      icon:    Wallet,
      iconBg:  'bg-purple-100',
      iconCol: 'text-purple-600',
      valCol:  'text-purple-800',
      growth:  null,
    },
    {
      label:   'Total Customers',
      value:   summary.totalCustomers,
      sub:     'registered customers',
      icon:    Users,
      iconBg:  'bg-amber-100',
      iconCol: 'text-amber-600',
      valCol:  'text-amber-800',
      growth:  null,
    },
    {
      label:   'Baaki Leni Hai',
      value:   `Rs. ${summary.pendingBalance.toLocaleString()}`,
      sub:     'outstanding balance',
      icon:    CheckCircle2,
      iconBg:  summary.pendingBalance > 0 ? 'bg-red-100' : 'bg-green-100',
      iconCol: summary.pendingBalance > 0 ? 'text-red-600' : 'text-green-600',
      valCol:  summary.pendingBalance > 0 ? 'text-red-700' : 'text-green-700',
      growth:  null,
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      {cards.map(card => (
        <div
          key={card.label}
          className="bg-white border border-slate-200 rounded-2xl p-4"
        >
          <div className={cn(
            'w-9 h-9 rounded-xl flex items-center justify-center mb-3',
            card.iconBg
          )}>
            <card.icon size={17} className={card.iconCol} />
          </div>
          <p className={cn('text-lg font-bold leading-tight', card.valCol)}>
            {card.value}
          </p>
          <p className="text-xs text-slate-400 mt-1 leading-tight">
            {card.label}
          </p>
          {/* Growth indicator */}
          {card.growth !== null && (
            <div className={cn(
              'flex items-center gap-0.5 mt-1.5 text-[10px] font-bold',
              card.growth > 0 ? 'text-green-600' :
              card.growth < 0 ? 'text-red-500' : 'text-slate-400'
            )}>
              {card.growth > 0
                ? <TrendingUp size={10} />
                : card.growth < 0
                ? <TrendingDown size={10} />
                : <Minus size={10} />
              }
              {card.sub}
            </div>
          )}
          {card.growth === null && (
            <p className="text-[10px] text-slate-400 mt-1">{card.sub}</p>
          )}
        </div>
      ))}
    </div>
  )
}