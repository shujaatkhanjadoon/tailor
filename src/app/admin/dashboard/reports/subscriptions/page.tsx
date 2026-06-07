'use client'

import { useState, useEffect } from 'react'
import { RefreshCw, Users } from 'lucide-react'

export default function SubscriptionsReportPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/admin/reports?type=subscriptions')
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
            <Users size={18} /> Subscriptions Report
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">Active/churned/grace breakdown</p>
        </div>
        <button onClick={load} disabled={loading} className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-semibold px-4 py-2 rounded-xl disabled:opacity-50 transition-colors">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {loading && <div className="flex justify-center py-16"><RefreshCw size={24} className="animate-spin text-slate-500" /></div>}
      {error && <div className="bg-red-900/30 border border-red-800 rounded-xl px-4 py-3 text-red-400 text-sm mb-4">{error}</div>}

      {data && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
              <p className="text-2xl font-bold text-white">{data.total}</p>
              <p className="text-xs text-slate-400 mt-1">Total</p>
            </div>
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
              <p className="text-2xl font-bold text-green-400">{data.active}</p>
              <p className="text-xs text-slate-400 mt-1">Active</p>
            </div>
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
              <p className="text-2xl font-bold text-yellow-400">{data.grace}</p>
              <p className="text-xs text-slate-400 mt-1">Grace</p>
            </div>
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
              <p className="text-2xl font-bold text-red-400">{data.churned}</p>
              <p className="text-xs text-slate-400 mt-1">Churned</p>
            </div>
          </div>

          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <h2 className="text-sm font-bold text-slate-300 mb-3">By Plan</h2>
            <div className="grid grid-cols-3 gap-3">
              {Object.entries(data.byPlan).map(([plan, count]) => (
                <div key={plan} className="bg-slate-700/50 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-white capitalize">{plan}</p>
                  <p className="text-xs text-slate-400">{count as number}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <h2 className="text-sm font-bold text-slate-300 mb-1">MRR</h2>
            <p className="text-2xl font-bold text-blue-400">Rs. {data.monthlyRevenue.toLocaleString()}</p>
            <p className="text-xs text-slate-400 mt-1">Monthly Recurring Revenue</p>
          </div>
        </div>
      )}
    </div>
  )
}
