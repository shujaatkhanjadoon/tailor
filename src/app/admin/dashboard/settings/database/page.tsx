'use client'

import { useState, useEffect } from 'react'
import { Database, Trash2, AlertTriangle, RefreshCw, CheckCircle2, XCircle, KeyRound, Calendar } from 'lucide-react'

type TableCounts = Record<string, number>

const TABLES = [
  { key: 'order_photos', label: 'Order Photos' },
  { key: 'payments', label: 'Payments' },
  { key: 'measurements', label: 'Measurements' },
  { key: 'orders', label: 'Orders' },
  { key: 'customers', label: 'Customers' },
  { key: 'team_members', label: 'Team Members' },
]

export default function DatabaseSettingsPage() {
  const [counts, setCounts] = useState<TableCounts | null>(null)
  const [loading, setLoading] = useState(true)
  const [purging, setPurging] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const [daysOld, setDaysOld] = useState(0)
  const [selectedTables, setSelectedTables] = useState<string[]>(TABLES.map(t => t.key))
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ results?: TableCounts; errors?: string[] } | null>(null)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const params = daysOld > 0 ? `?days=${daysOld}` : ''
      const res = await fetch(`/api/admin/deleted-counts${params}`)
      if (res.status === 401) { window.location.href = '/admin/login'; return }
      const d = await res.json()
      if (d.error) throw new Error(d.error)
      setCounts(d.counts ?? {})
    } catch (e) { setError(String(e)) } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [daysOld])

  const totalDeleted = counts
    ? Object.entries(counts).filter(([k]) => selectedTables.includes(k)).filter(([, v]) => v > 0).reduce((a, [, v]) => a + v, 0)
    : 0

  const handlePurge = async () => {
    if (confirmText !== 'PURGE') return
    setPurging(true)
    setError('')
    setResult(null)
    try {
      const res = await fetch('/api/admin/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'purge_deleted',
          totpCode,
          days: daysOld > 0 ? daysOld : undefined,
          purgeTables: selectedTables,
        }),
      })
      const d = await res.json()
      if (!d.success) throw new Error(d.error || 'Purge failed')
      setResult(d)
      setConfirmText('')
      setTotpCode('')
      setShowConfirm(false)
      setDaysOld(0)
      await load()
    } catch (e) { setError(String(e)) } finally { setPurging(false) }
  }

  const hasDeleted = totalDeleted > 0
  const allSelected = selectedTables.length === TABLES.length

  return (
    <div className="max-w-full space-y-6">
      <div>
        <h1 className="text-lg font-bold text-white">Database Cleanup</h1>
        <p className="text-xs text-slate-400 mt-0.5">Purge soft-deleted (orphaned) records permanently</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-900/30 border border-red-800 rounded-xl px-4 py-3 text-red-400 text-sm">
          <XCircle size={14} className="shrink-0" /> {error}
        </div>
      )}

      {result && (
        <div className="bg-green-900/30 border border-green-700 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-green-400 font-semibold text-sm">
            <CheckCircle2 size={14} /> Purge Complete
          </div>
          <div className="text-xs text-green-300">{result.summary || 'No records found'}</div>
          {result.results && (
            <div className="grid grid-cols-2 gap-1.5 text-xs text-slate-300 mt-2">
              {Object.entries(result.results).filter(([, v]) => v >= 0).map(([table, count]) => (
                <div key={table} className="flex items-center justify-between bg-green-900/20 rounded-lg px-2.5 py-1.5">
                  <span className="text-slate-400">{table}</span>
                  <span className="font-bold text-green-400">{count}</span>
                </div>
              ))}
            </div>
          )}
          {result.errors?.length > 0 && (
            <div className="bg-red-900/20 border border-red-800/50 rounded-lg px-3 py-2 text-red-400 text-[11px] font-mono mt-2">
              {result.errors.map((e, i) => <div key={i}>{e}</div>)}
            </div>
          )}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-16">
          <RefreshCw size={24} className="animate-spin text-slate-500" />
        </div>
      )}

      {counts && !result && (
        <>
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-slate-300 flex items-center gap-2">
                <Database size={14} /> Soft-Deleted Records
              </h2>
              <div className="flex items-center gap-2">
                <Calendar size={12} className="text-slate-500" />
                <select
                  value={daysOld}
                  onChange={e => setDaysOld(Number(e.target.value))}
                  className="bg-slate-700 border border-slate-600 text-slate-200 text-xs rounded-lg px-2 py-1.5 outline-none focus:border-blue-500"
                >
                  <option value={0}>All time</option>
                  <option value={7}>Older than 7 days</option>
                  <option value={14}>Older than 14 days</option>
                  <option value={30}>Older than 30 days</option>
                  <option value={60}>Older than 60 days</option>
                  <option value={90}>Older than 90 days</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-3 pb-3 border-b border-slate-700">
              <input
                type="checkbox"
                id="select-all"
                checked={allSelected}
                onChange={() => setSelectedTables(allSelected ? [] : TABLES.map(t => t.key))}
                className="accent-blue-500"
              />
              <label htmlFor="select-all" className="text-xs font-bold text-slate-400 cursor-pointer select-none">
                {allSelected ? 'Deselect All' : 'Select All'}
              </label>
            </div>

            <div className="grid gap-2">
              {TABLES.map(({ key, label }) => {
                const count = counts[key]
                return (
                  <label
                    key={key}
                    className="flex items-center gap-3 bg-slate-700/50 rounded-lg px-3 py-2.5 cursor-pointer hover:bg-slate-700/70 transition-colors select-none"
                  >
                    <input
                      type="checkbox"
                      checked={selectedTables.includes(key)}
                      onChange={() => setSelectedTables(prev =>
                        prev.includes(key) ? prev.filter(t => t !== key) : [...prev, key]
                      )}
                      className="accent-blue-500 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-200">{label}</p>
                      <p className="text-[10px] text-slate-500">{key}</p>
                    </div>
                    <span className="text-lg font-bold text-white shrink-0">
                      {count > 0 ? count : count === 0 ? 0 : '—'}
                    </span>
                  </label>
                )
              })}
            </div>

            <div className="mt-3 bg-slate-700/50 rounded-lg p-3">
              <p className="text-base font-bold text-white">{totalDeleted}</p>
              <p className="text-[10px] text-slate-400">
                Total {daysOld > 0 ? `(deleted >${daysOld}d ago)` : 'soft-deleted'} records in selected tables
              </p>
            </div>
          </div>

          {hasDeleted && !showConfirm && (
            <button
              onClick={() => setShowConfirm(true)}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
            >
              <Trash2 size={14} /> Purge Selected ({totalDeleted} records)
            </button>
          )}

          {!hasDeleted && (
            <div className="flex items-center gap-2 bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-slate-400 text-sm">
              <CheckCircle2 size={14} className="text-green-500" /> No records found for selected age filter.
            </div>
          )}

          {showConfirm && (
            <div className="bg-slate-800/80 border border-red-700 rounded-xl p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-red-900/50 flex items-center justify-center shrink-0">
                  <AlertTriangle size={18} className="text-red-400" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">Danger Zone: Permanent Deletion</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Yeh action <strong className="text-red-400">permanently</strong>{' '}
                    {daysOld > 0 ? `records deleted more than ${daysOld} days ago ko` : 'sab soft-deleted records ko'}{' '}
                    in tables: <strong className="text-slate-300">{selectedTables.join(', ')}</strong>{' '}
                    hard-delete kar dega. Yeh action <strong className="text-red-400">wapas nahi kiya ja sakta.</strong>
                  </p>
                </div>
              </div>

              <div className="space-y-3 bg-slate-900/50 rounded-xl p-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">
                    Type <span className="text-red-400 font-mono">PURGE</span> to confirm
                  </label>
                  <input
                    type="text"
                    value={confirmText}
                    onChange={e => setConfirmText(e.target.value)}
                    placeholder="PURGE"
                    className="w-full bg-slate-700 border border-slate-600 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-red-500 font-mono placeholder:text-slate-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1 flex items-center gap-1">
                    <KeyRound size={10} /> Google Authenticator Code
                  </label>
                  <input
                    type="text"
                    value={totpCode}
                    onChange={e => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    maxLength={6}
                    className="w-full bg-slate-700 border border-slate-600 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-red-500 font-mono placeholder:text-slate-600"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => { setShowConfirm(false); setConfirmText(''); setTotpCode('') }}
                  className="bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePurge}
                  disabled={confirmText !== 'PURGE' || totpCode.length !== 6 || purging}
                  className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 disabled:bg-slate-700 text-white disabled:text-slate-500 text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50"
                >
                  {purging ? <RefreshCw size={12} className="animate-spin" /> : <Trash2 size={12} />}
                  {purging ? 'Purging...' : 'Permanently Purge'}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {counts && result && (
        <button
          onClick={() => { setResult(null); load() }}
          className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-semibold px-4 py-2 rounded-xl transition-colors"
        >
          <RefreshCw size={12} /> Refresh Counts
        </button>
      )}
    </div>
  )
}
