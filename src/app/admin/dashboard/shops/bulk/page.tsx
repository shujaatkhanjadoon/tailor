'use client'

import { useState, useEffect } from 'react'
import { Layers, RefreshCw, Send, CalendarDays, DollarSign, Smartphone } from 'lucide-react'

const PLANS = [
  { value: 'starter', label: 'Starter', price: 0 },
  { value: 'professional', label: 'Professional', price: 1500 },
  { value: 'business', label: 'Business', price: 3000 },
]

const BILLING_CYCLES = ['monthly', 'yearly', 'lifetime']

export default function BulkOperationsPage() {
  const [shops, setShops] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [selectAll, setSelectAll] = useState(false)
  const [action, setAction] = useState<'plan' | 'expiry' | 'notification'>('plan')
  const [plan, setPlan] = useState('professional')
  const [cycle, setCycle] = useState('monthly')
  const [days, setDays] = useState(30)
  const [notifMsg, setNotifMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState('')
  const [bulkTotp, setBulkTotp] = useState('')

  const load = async () => {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/admin/data?type=shops&limit=200')
      if (res.status === 401) { window.location.href = '/admin/login'; return }
      const d = await res.json()
      if (d.error) throw new Error(d.error)
      setShops(d.data)
    } catch (e) { setError(String(e)) } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const toggleShop = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selectAll) { setSelected(new Set()); setSelectAll(false) }
    else { setSelected(new Set(shops.map(s => s.id))); setSelectAll(true) }
  }

  const handleApply = async () => {
    if (selected.size === 0) { setError('Select at least one shop'); return }
    setBusy(true); setError(''); setResult('')
    try {
      let actionType = ''
      const body: Record<string, unknown> = { shopIds: Array.from(selected) }

      if (action === 'plan') { actionType = 'bulk_set_plan'; body.plan = plan; body.cycle = cycle }
      else if (action === 'expiry') { actionType = 'bulk_extend_expiry'; body.days = days }
      else if (action === 'notification') {
        if (!notifMsg.trim()) { throw new Error('Notification message required') }
        actionType = 'bulk_send_notification'; body.reason = notifMsg.trim()
      }

      const res = await fetch('/api/admin/action', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: actionType, ...body, totpCode: bulkTotp || undefined }),
      })
      const d = await res.json()
      if (d.error && d.requiresTOTP) { setError('TOTP code chahiye — neeche enter karein'); return }
      if (d.error) throw new Error(d.error)
      setResult(`Applied to ${selected.size} shop(s) successfully`)
      setSelected(new Set()); setSelectAll(false)
    } catch (e) { setError(String(e)) } finally { setBusy(false) }
  }

  return (
    <div className="max-w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <Layers size={18} /> Bulk Operations
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">Apply actions to multiple shops at once</p>
        </div>
        <button onClick={load} disabled={loading} className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-semibold px-4 py-2 rounded-xl disabled:opacity-50 transition-colors">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {error && <div className="bg-red-900/30 border border-red-800 rounded-xl px-4 py-3 text-red-400 text-sm mb-4">{error}</div>}
      {result && <div className="bg-green-900/30 border border-green-800 rounded-xl px-4 py-3 text-green-400 text-sm mb-4">{result}</div>}

      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 mb-4">
        <div className="flex flex-wrap gap-2 mb-4">
          {(['plan', 'expiry', 'notification'] as const).map(a => (
            <button key={a} onClick={() => setAction(a)}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl transition-colors ${
                action === a ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}>
              {a === 'plan' ? <DollarSign size={12} /> : a === 'expiry' ? <CalendarDays size={12} /> : <Send size={12} />}
              {a === 'plan' ? 'Change Plan' : a === 'expiry' ? 'Extend Expiry' : 'Send Notification'}
            </button>
          ))}
        </div>

        {action === 'plan' && (
          <div className="flex gap-3">
            <select value={plan} onChange={e => setPlan(e.target.value)}
              className="bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-blue-500">
              {PLANS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            <select value={cycle} onChange={e => setCycle(e.target.value)}
              className="bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-blue-500">
              {BILLING_CYCLES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}

        {action === 'expiry' && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Extend by</span>
            <input type="number" min={1} max={365} value={days} onChange={e => setDays(parseInt(e.target.value) || 30)}
              className="w-20 bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-blue-500" />
            <span className="text-xs text-slate-400">days</span>
          </div>
        )}

        {action === 'notification' && (
          <input placeholder="Notification message..." value={notifMsg} onChange={e => setNotifMsg(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none focus:border-blue-500" />
        )}

        <div className="flex items-center gap-2 mt-3">
          <div className="flex items-center gap-2 bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5">
            <Smartphone size={13} className="text-slate-500" />
            <input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6}
              placeholder="TOTP code" value={bulkTotp}
              onChange={(e) => setBulkTotp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="w-24 bg-transparent text-slate-200 text-xs font-mono outline-none placeholder:text-slate-600"
            />
          </div>
          <p className="text-[10px] text-slate-600">Required for bulk actions</p>
        </div>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden mb-4">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
            <input type="checkbox" checked={selectAll} onChange={toggleAll} className="rounded border-slate-600" />
            Select All ({shops.length} shops)
          </label>
          <span className="text-xs text-slate-500">{selected.size} selected</span>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {shops.map(shop => (
            <label key={shop.id} className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
              selected.has(shop.id) ? 'bg-blue-900/20' : 'hover:bg-slate-700/30'
            }`}>
              <input type="checkbox" checked={selected.has(shop.id)} onChange={() => toggleShop(shop.id)}
                className="rounded border-slate-600" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{shop.shop_name}</p>
                <p className="text-[11px] text-slate-500">{shop.owner_phone} · {shop.city || 'N/A'}</p>
              </div>
              <span className="text-[10px] font-medium text-slate-400 uppercase">{shop.plan}</span>
            </label>
          ))}
        </div>
      </div>

      <button onClick={handleApply} disabled={selected.size === 0 || busy}
        className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white font-bold py-3 rounded-2xl transition-all flex items-center justify-center gap-2 disabled:opacity-50">
        {busy ? <RefreshCw size={16} className="animate-spin" /> : <Layers size={16} />}
        {busy ? 'Applying...' : `Apply to ${selected.size} Shop(s)`}
      </button>
    </div>
  )
}
