// src/components/reports/OrderStatusChart.tsx
'use client'

import {
  PieChart, Pie, Cell, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { ORDER_STATUS_CONFIG } from '@/types'


const STATUS_COLORS: Record<string, string> = {
  received:  '#f59e0b',
  cutting:   '#f97316',
  stitching: '#3b82f6',
  finishing: '#8b5cf6',
  ready:     '#22c55e',
  delivered: '#64748b',
  cancelled: '#ef4444',
}

interface StatusItem {
  status: string
  count:  number
}

interface OrderStatusChartProps {
  data:   StatusItem[]
  total:  number
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  const d   = payload[0].payload
  const cfg = ORDER_STATUS_CONFIG[d.status as keyof typeof ORDER_STATUS_CONFIG]
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-lg text-xs">
      <p className="font-bold text-slate-700">
        {cfg?.emoji} {cfg?.label ?? d.status}
      </p>
      <p className="text-slate-500">{d.count} orders</p>
    </div>
  )
}

export function OrderStatusChart({ data, total }: OrderStatusChartProps) {
  if (data.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <h3 className="font-bold text-slate-800 mb-4">Order Status</h3>
        <div className="flex items-center justify-center h-40 text-slate-300">
          <p className="text-sm">Koi data nahi</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 min-w-0">
      <h3 className="font-bold text-slate-800 mb-1">Order Status</h3>
      <p className="text-xs text-slate-400 mb-4">{total} total orders</p>

      <div className="flex flex-col lg:flex-row items-center gap-4 min-w-0">
        {/* Donut */}
        <div className="w-full lg:w-48 h-48 shrink-0 min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="count"
                nameKey="status"
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={3}
                strokeWidth={0}
              >
                {data.map((entry) => (
                  <Cell
                    key={entry.status}
                    fill={STATUS_COLORS[entry.status] ?? '#94a3b8'}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend list */}
        <div className="flex-1 w-full space-y-2">
          {[...data]
            .sort((a, b) => b.count - a.count)
            .map(item => {
              const cfg = ORDER_STATUS_CONFIG[item.status as keyof typeof ORDER_STATUS_CONFIG]
              const pct = total > 0 ? Math.round((item.count / total) * 100) : 0
              return (
                <div key={item.status} className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: STATUS_COLORS[item.status] ?? '#94a3b8' }}
                  />
                  <span className="text-xs text-slate-500 flex-1">
                    {cfg?.emoji} {cfg?.label ?? item.status}
                  </span>
                  <span className="text-xs font-bold text-slate-700">
                    {item.count}
                  </span>
                  <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width:      `${pct}%`,
                        background: STATUS_COLORS[item.status] ?? '#94a3b8',
                      }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 w-7 text-right">
                    {pct}%
                  </span>
                </div>
              )
            })}
        </div>
      </div>
    </div>
  )
}
