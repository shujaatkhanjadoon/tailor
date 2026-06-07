'use client'

import { useState, useEffect } from 'react'
import { RefreshCw, Store } from 'lucide-react'

export default function ShopsReportPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/admin/reports?type=shops&months=12')
      if (res.status === 401) { window.location.href = '/admin/login'; return }
      const d = await res.json()
      if (d.error) throw new Error(d.error)
      setData(d.data)
    } catch (e) { setError(String(e)) } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  return (
    <div className="max-w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <Store size={18} /> Shops Report
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">Shop growth & city breakdown</p>
        </div>
        <button onClick={load} disabled={loading} className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-semibold px-4 py-2 rounded-xl disabled:opacity-50 transition-colors">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {loading && <div className="flex justify-center py-16"><RefreshCw size={24} className="animate-spin text-slate-500" /></div>}
      {error && <div className="bg-red-900/30 border border-red-800 rounded-xl px-4 py-3 text-red-400 text-sm mb-4">{error}</div>}

      {data && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
              <p className="text-2xl font-bold text-white">{data.total}</p>
              <p className="text-xs text-slate-400 mt-1">Total Shops</p>
            </div>
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
              <p className="text-2xl font-bold text-green-400">{data.active}</p>
              <p className="text-xs text-slate-400 mt-1">Active</p>
            </div>
          </div>

          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <h2 className="text-sm font-bold text-slate-300 mb-3">Monthly Growth</h2>
            {data.growth.length > 0 && (
              <div className="flex items-end gap-2 h-32">
                {data.growth.map((m: any) => {
                  const maxCount = Math.max(...data.growth.map((x: any) => x.newShops), 1)
                  const height = (m.newShops / maxCount) * 100
                  return (
                    <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[10px] text-slate-400 font-medium">{m.newShops}</span>
                      <div className="w-full bg-blue-500 rounded-t" style={{ height: `${height}%` }} />
                      <span className="text-[9px] text-slate-500 -rotate-45 origin-left whitespace-nowrap">{m.month.slice(5)}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <h2 className="text-sm font-bold text-slate-300 mb-3">Top Cities</h2>
            <div className="space-y-2">
              {data.cities.map(([city, count]: [string, number], i: number) => {
                const maxCityCount = Math.max(...data.cities.map((c: any) => c[1]), 1)
                const pct = (count / maxCityCount) * 100
                return (
                  <div key={city} className="flex items-center gap-3">
                    <span className="text-xs text-slate-400 w-24 truncate">{city}</span>
                    <div className="flex-1 bg-slate-700 rounded-full h-2.5">
                      <div className="bg-blue-500 h-2.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-slate-300 font-medium w-8 text-right">{count}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
