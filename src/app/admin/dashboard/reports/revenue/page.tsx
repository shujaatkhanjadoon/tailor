'use client'

import { useState, useEffect } from 'react'
import { Download, RefreshCw, TrendingUp } from 'lucide-react'

export default function RevenueReportPage() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/admin/reports?type=revenue&months=12')
      if (res.status === 401) { window.location.href = '/admin/login'; return }
      const d = await res.json()
      if (d.error) throw new Error(d.error)
      setData(d.data)
    } catch (e) { setError(String(e)) } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const downloadCSV = async () => {
    const res = await fetch('/api/admin/reports?type=revenue&months=12&format=csv')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'revenue-report.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const totalRevenue = data.reduce((s, r) => s + r.revenue, 0)

  return (
    <div className="max-w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <TrendingUp size={18} /> Revenue Report
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">Monthly revenue breakdown (12 months)</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} disabled={loading} className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-semibold px-4 py-2 rounded-xl disabled:opacity-50 transition-colors">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button onClick={downloadCSV} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors">
            <Download size={12} /> CSV
          </button>
        </div>
      </div>

      {loading && <div className="flex justify-center py-16"><RefreshCw size={24} className="animate-spin text-slate-500" /></div>}
      {error && <div className="bg-red-900/30 border border-red-800 rounded-xl px-4 py-3 text-red-400 text-sm mb-4">{error}</div>}

      {data.length > 0 && (
        <>
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 mb-6">
            <p className="text-3xl font-bold text-white">Rs. {totalRevenue.toLocaleString()}</p>
            <p className="text-xs text-slate-400 mt-1">Total Revenue (12 months)</p>
          </div>

          <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400 text-xs">
                  <th className="text-left px-4 py-3 font-semibold">Month</th>
                  <th className="text-right px-4 py-3 font-semibold">Revenue</th>
                  <th className="text-right px-4 py-3 font-semibold">Transactions</th>
                  <th className="text-right px-4 py-3 font-semibold">Professional</th>
                  <th className="text-right px-4 py-3 font-semibold">Business</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row, i) => (
                  <tr key={row.month} className={i % 2 === 0 ? 'bg-slate-800/30' : ''}>
                    <td className="px-4 py-3 text-white font-medium">{row.month}</td>
                    <td className="px-4 py-3 text-right text-green-400 font-semibold">Rs. {row.revenue.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-slate-300">{row.count}</td>
                    <td className="px-4 py-3 text-right text-slate-300">Rs. {row.byPlan.professional.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-slate-300">Rs. {row.byPlan.business.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
