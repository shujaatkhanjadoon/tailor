// src/components/reports/GarmentBreakdown.tsx
'use client'

import { GARMENT_LABELS } from '@/types'
import { Scissors, Star } from 'lucide-react'
import { cn } from '@/lib/utils'

interface GarmentItem {
  type:    string
  count:   number
  revenue: number
}

interface KarigarItem {
  id:             string
  name:           string
  speciality?:    string
  payRateType?:   string
  payRate?:       number
  totalAssigned:  number
  completed:      number
  pending:        number
  revenue:        number
  completionRate: number
}

interface Props {
  garments: GarmentItem[]
  karigars: KarigarItem[]
  totalOrders: number
  showPayReports?: boolean
}

export function GarmentBreakdown({ garments, karigars, totalOrders, showPayReports = false }: Props) {
  const maxCount = Math.max(...garments.map(g => g.count), 1)

  return (
    <div className="space-y-4">

      {/* Garment types */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <h3 className="font-bold text-slate-800 mb-1">Kapron Ka Hisaab</h3>
        <p className="text-xs text-slate-400 mb-4">Garment types by order count</p>

        {garments.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">Koi data nahi</p>
        ) : (
          <div className="space-y-3">
            {garments.map((g, i) => {
              const gc  = GARMENT_LABELS[g.type as keyof typeof GARMENT_LABELS]
              const pct = Math.round((g.count / maxCount) * 100)
              const orderPct = totalOrders > 0
                ? Math.round((g.count / totalOrders) * 100)
                : 0

              return (
                <div key={g.type}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{gc?.emoji ?? '📌'}</span>
                      <span className="text-sm font-semibold text-slate-700">
                        {gc?.label ?? g.type}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-slate-400">{orderPct}%</span>
                      <span className="font-bold text-slate-700">
                        {g.count} orders
                      </span>
                      <span className="text-green-600 font-semibold">
                        Rs. {g.revenue.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        i === 0 ? 'bg-blue-500' :
                        i === 1 ? 'bg-green-500' :
                        i === 2 ? 'bg-amber-500' : 'bg-slate-400'
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Karigar productivity */}
      {karigars.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 pt-5 pb-3">
            <Scissors size={16} className="text-slate-600" />
            <div>
              <h3 className="font-bold text-slate-800">Karigar Performance</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Orders assigned aur complete kiye
              </p>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {karigars.map((k, i) => (
              <div key={k.id} className="px-5 py-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center',
                      'font-bold text-base',
                      i === 0 ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                    )}>
                      {k.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="font-semibold text-slate-800 text-sm">{k.name}</p>
                        {i === 0 && (
                          <Star size={12} className="text-amber-500" fill="currentColor" />
                        )}
                      </div>
                      {k.speciality && (
                        <p className="text-xs text-blue-600">✂️ {k.speciality}</p>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-800">
                      {k.completionRate}%
                    </p>
                    <p className="text-[10px] text-slate-400">completion</p>
                  </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {[
                    { label:'Assigned', value: k.totalAssigned, col:'text-slate-700' },
                    { label:'Done',     value: k.completed,     col:'text-green-600' },
                    { label:'Pending',  value: k.pending,       col: k.pending > 0 ? 'text-amber-600' : 'text-slate-400' },
                  ].map(s => (
                    <div key={s.label} className="bg-slate-50 rounded-xl px-3 py-2 text-center">
                      <p className={cn('text-base font-bold', s.col)}>{s.value}</p>
                      <p className="text-[10px] text-slate-400">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Completion bar */}
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-2">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all"
                    style={{ width: `${k.completionRate}%` }}
                  />
                </div>

                {/* Pay rate */}
                {showPayReports && k.payRate && k.payRate > 0 && (
                  <p className="text-xs text-slate-400">
                    💰 Rs. {k.payRate.toLocaleString()}/
                    {k.payRateType === 'per_order' ? 'order'
                     : k.payRateType === 'daily'   ? 'day'
                     : 'month'}
                    {k.payRateType === 'per_order' && k.completed > 0 && (
                      <span className="text-green-600 font-semibold ml-2">
                        = Rs. {(k.payRate * k.completed).toLocaleString()} earned
                      </span>
                    )}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
