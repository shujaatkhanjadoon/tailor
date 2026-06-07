'use client'

import { useState, useEffect } from 'react'
import { Activity, CheckCircle, XCircle, Clock, AlertTriangle, Shield, RefreshCw } from 'lucide-react'

const CRON_NAMES: Record<string, string> = {
  'expire-subscriptions': 'Expire Subscriptions',
  'send-reminders': 'Send Reminders',
  'reset-usage': 'Reset Usage',
  'cleanup-photos': 'Cleanup Photos',
}

export default function HealthPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/admin/health')
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
          <h1 className="text-lg font-bold text-white">System Health</h1>
          <p className="text-xs text-slate-400 mt-0.5">Cron jobs & system status</p>
        </div>
        <button onClick={load} disabled={loading} className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-semibold px-4 py-2 rounded-xl disabled:opacity-50 transition-colors">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {loading && !data && (
        <div className="flex items-center justify-center py-16">
          <RefreshCw size={24} className="animate-spin text-slate-500" />
        </div>
      )}

      {error && <div className="bg-red-900/30 border border-red-800 rounded-xl px-4 py-3 text-red-400 text-sm mb-4">{error}</div>}

      {data && (
        <div className="space-y-6">
          <div>
            <h2 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
              <Clock size={14} /> Cron Job Status
            </h2>
            <div className="grid gap-3">
              {data.cron.map((job: any) => (
                <div key={job.name} className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {job.lastRun?.status === 'success' ? <CheckCircle size={14} className="text-green-500" /> :
                       job.lastRun?.status === 'failed' ? <XCircle size={14} className="text-red-500" /> :
                       <Activity size={14} className="text-slate-500" />}
                      <span className="text-sm font-semibold text-white">{CRON_NAMES[job.name] || job.name}</span>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      job.lastRun?.status === 'success' ? 'bg-green-900/50 text-green-400' :
                      job.lastRun?.status === 'failed' ? 'bg-red-900/50 text-red-400' :
                      'bg-slate-700 text-slate-400'
                    }`}>
                      {job.lastRun?.status ?? 'No runs'}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-[11px] text-slate-500">
                    {job.lastRun?.startedAt && <span>Last: {new Date(job.lastRun.startedAt).toLocaleString()}</span>}
                    {job.lastRun?.durationMs && <span>{(job.lastRun.durationMs / 1000).toFixed(1)}s</span>}
                    <span>{job.totalRuns} total runs</span>
                  </div>
                  {job.lastRun?.error && (
                    <div className="mt-2 bg-red-900/20 border border-red-800/50 rounded-lg px-3 py-2 text-red-400 text-[11px] font-mono">
                      {job.lastRun.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <h2 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
              <AlertTriangle size={14} /> Subscription Alerts
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-700/50 rounded-lg p-3">
                <p className="text-2xl font-bold text-yellow-400">{data.subscriptions.grace}</p>
                <p className="text-[11px] text-slate-400">Grace Period</p>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-3">
                <p className="text-2xl font-bold text-green-400">{data.subscriptions.activeExpiring}</p>
                <p className="text-[11px] text-slate-400">Active Subscriptions</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield size={14} className="text-blue-400" />
              <h2 className="text-sm font-bold text-slate-300">System Info</h2>
            </div>
            <p className="text-xs text-slate-500">
              Last updated: {new Date(data.lastUpdated).toLocaleString()}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
