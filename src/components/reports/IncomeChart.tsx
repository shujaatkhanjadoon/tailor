// src/components/reports/IncomeChart.tsx
'use client'

import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { cn } from '@/lib/utils'

interface DataPoint {
  label:   string
  income:  number
  cash?:   number
  digital?: number
}

interface IncomeChartProps {
  monthly: DataPoint[]
  weekly:  DataPoint[]
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 shadow-lg text-xs">
      <p className="font-bold text-slate-700 mb-1">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.fill }} />
          <span className="text-slate-500">{p.name}:</span>
          <span className="font-semibold text-slate-800">
            Rs. {Number(p.value).toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  )
}

export function IncomeChart({ monthly, weekly }: IncomeChartProps) {
  const [view, setView] = useState<'monthly' | 'weekly'>('monthly')
  const [breakdown, setBreakdown] = useState(false)

  const data    = (view === 'monthly' ? monthly : weekly).map(item => ({ ...item }))
  const maxVal  = Math.max(...data.map(d => d.income), 1)

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h3 className="font-bold text-slate-800">Income</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Rs. {data.reduce((s,d) => s + d.income, 0).toLocaleString()} total
          </p>
        </div>
        <div className="flex gap-2">
          {/* View toggle */}
          <div className="flex bg-slate-100 rounded-xl p-0.5">
            {(['monthly', 'weekly'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                  view === v
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500'
                )}
              >
                {v === 'monthly' ? 'Monthly' : 'Weekly'}
              </button>
            ))}
          </div>
          {/* Breakdown toggle (monthly only) */}
          {view === 'monthly' && (
            <button
              onClick={() => setBreakdown(v => !v)}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors',
                breakdown
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-600 border-slate-200'
              )}
            >
              Cash / Digital
            </button>
          )}
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => v >= 1000 ? `${v/1000}k` : v}
          />
          <Tooltip content={<CustomTooltip />} />

          {view === 'monthly' && breakdown ? (
            <>
              <Legend
                formatter={v => <span className="text-xs text-slate-500">{v}</span>}
              />
              <Bar dataKey="cash"    name="Cash"    fill="#22c55e" radius={[4,4,0,0]} stackId="a" />
              <Bar dataKey="digital" name="Digital" fill="#3b82f6" radius={[4,4,0,0]} stackId="a" />
            </>
          ) : (
            <Bar dataKey="income" name="Income" fill="#3b82f6" radius={[6,6,0,0]}>
              {data.map((entry, i) => (
                <rect key={i} fill={
                  entry.income === maxVal ? '#1d4ed8' : '#3b82f6'
                } />
              ))}
            </Bar>
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
