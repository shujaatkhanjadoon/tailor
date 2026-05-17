// src/components/reports/TopCustomers.tsx
'use client'

import { useRouter } from 'next/navigation'
import { Trophy, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Customer {
  id:      string
  name:    string
  orders:  number
  revenue: number
  paid:    number
}

const RANK_COLORS = ['text-amber-500', 'text-slate-400', 'text-orange-600']
const RANK_BG     = ['bg-amber-50',    'bg-slate-50',    'bg-orange-50']

export function TopCustomers({ customers }: { customers: Customer[] }) {
  const router  = useRouter()
  const maxRev  = Math.max(...customers.map(c => c.revenue), 1)

  if (customers.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <h3 className="font-bold text-slate-800 mb-4">Top Customers</h3>
        <p className="text-sm text-slate-400 text-center py-8">Koi data nahi</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div>
          <h3 className="font-bold text-slate-800">Top Customers</h3>
          <p className="text-xs text-slate-400 mt-0.5">Revenue se sorted</p>
        </div>
        <Trophy size={18} className="text-amber-500" />
      </div>

      <div className="divide-y divide-slate-100">
        {customers.map((c, i) => {
          const pct      = Math.round((c.revenue / maxRev) * 100)
          const balance  = c.revenue - c.paid
          const isTop3   = i < 3

          return (
            <button
              key={c.id}
              onClick={() => router.push(`/customers/${c.id}`)}
              className="w-full flex items-center gap-3 px-5 py-3.5
                         hover:bg-slate-50 text-left transition-colors active:bg-slate-100"
            >
              {/* Rank */}
              <div className={cn(
                'w-8 h-8 rounded-xl flex items-center justify-center shrink-0 font-bold text-sm',
                isTop3 ? RANK_BG[i] : 'bg-slate-100'
              )}>
                <span className={isTop3 ? RANK_COLORS[i] : 'text-slate-500'}>
                  {i + 1}
                </span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold text-slate-800 truncate">
                    {c.name}
                  </p>
                  <p className="text-sm font-bold text-slate-800 ml-2 shrink-0">
                    Rs. {c.revenue.toLocaleString()}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full',
                        isTop3 ? 'bg-amber-400' : 'bg-blue-400'
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 shrink-0">
                    {c.orders} orders
                  </span>
                  {balance > 0 && (
                    <span className="text-[10px] text-red-500 font-semibold shrink-0">
                      Rs. {balance.toLocaleString()} baaki
                    </span>
                  )}
                </div>
              </div>

              <ChevronRight size={13} className="text-slate-300 shrink-0" />
            </button>
          )
        })}
      </div>
    </div>
  )
}