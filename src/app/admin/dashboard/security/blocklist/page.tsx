'use client'

import { useState, useEffect } from 'react'
import { Ban, RefreshCw, Plus, Trash2, ShieldOff } from 'lucide-react'

export default function BlocklistPage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [newIp, setNewIp] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [blockTotp, setBlockTotp] = useState('')
  const [unblockingIp, setUnblockingIp] = useState<string | null>(null)
  const [unblockTotp, setUnblockTotp] = useState('')

  const load = async () => {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/admin/blocklist')
      if (res.status === 401) { window.location.href = '/admin/login'; return }
      const d = await res.json()
      if (d.error) throw new Error(d.error)
      setItems(d.data)
    } catch (e) { setError(String(e)) } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleAdd = async () => {
    if (!newIp.trim()) return
    if (!blockTotp || blockTotp.length !== 6) { setError('TOTP code required'); return }
    setError('')
    try {
      const res = await fetch('/api/admin/action', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'block_ip', ip: newIp.trim(), totpCode: blockTotp }),
      })
      const d = await res.json()
      if (d.error && d.requiresTOTP) { setError('TOTP code required'); return }
      if (d.error) throw new Error(d.error)
      setNewIp(''); setShowAdd(false); setBlockTotp(''); load()
    } catch (e) { setError(String(e)) }
  }

  const handleRemove = async (ip: string) => {
    if (!unblockTotp || unblockTotp.length !== 6) { setError('TOTP code required'); return }
    setError('')
    try {
      const res = await fetch('/api/admin/action', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unblock_ip', ip, totpCode: unblockTotp }),
      })
      const d = await res.json()
      if (d.error && d.requiresTOTP) { setError('TOTP code required'); return }
      if (d.error) throw new Error(d.error)
      setUnblockingIp(null); setUnblockTotp(''); load()
    } catch (e) { setError(String(e)) }
  }

  return (
    <div className="max-w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <Ban size={18} /> IP Blocklist
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">Blocked IP addresses</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors">
            <Plus size={12} /> Block IP
          </button>
          <button onClick={load} disabled={loading} className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-semibold px-4 py-2 rounded-xl disabled:opacity-50 transition-colors">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {error && <div className="bg-red-900/30 border border-red-800 rounded-xl px-4 py-3 text-red-400 text-sm mb-4">{error}</div>}

      {showAdd && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 mb-4">
          <h3 className="text-sm font-bold text-white mb-3">Block IP Address</h3>
          <div className="flex gap-2">
            <input placeholder="e.g. 192.168.1.1" value={newIp} onChange={e => setNewIp(e.target.value)}
              className="flex-1 bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none focus:border-blue-500" />
          </div>
          <div className="flex gap-2 mt-2">
            <input type="number" inputMode="numeric" pattern="[0-9]*" maxLength={6} placeholder="TOTP Code"
              value={blockTotp} onChange={e => setBlockTotp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="flex-1 bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none focus:border-blue-500" />
            <button onClick={handleAdd} disabled={blockTotp.length !== 6} className="bg-red-600 hover:bg-red-500 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors disabled:opacity-50">Block</button>
            <button onClick={() => { setShowAdd(false); setBlockTotp('') }} className="bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-semibold px-4 py-2 rounded-xl transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {loading && <div className="flex justify-center py-16"><RefreshCw size={24} className="animate-spin text-slate-500" /></div>}

      {!loading && items.length === 0 && (
        <div className="text-center py-16 text-slate-500 text-sm flex flex-col items-center gap-2">
          <ShieldOff size={32} className="text-slate-700" />
          No blocked IPs
        </div>
      )}

      <div className="space-y-2">
        {items.map(item => (
          <div key={item.id} className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Ban size={14} className="text-red-400" />
                <span className="text-sm font-mono font-semibold text-white">{item.ip}</span>
                {!item.is_active && <span className="text-[10px] text-slate-500 bg-slate-700 px-1.5 py-0.5 rounded">Inactive</span>}
              </div>
              <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5">
                {item.blocked_at && <span>Blocked: {new Date(item.blocked_at).toLocaleString()}</span>}
                {item.reason && <span>Reason: {item.reason}</span>}
              </div>
            </div>
            {item.is_active && (
              <div className="flex items-center gap-2">
                {unblockingIp === item.ip && (
                  <input type="number" inputMode="numeric" pattern="[0-9]*" maxLength={6} placeholder="TOTP"
                    value={unblockTotp} onChange={e => setUnblockTotp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-20 bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-xs text-white placeholder:text-slate-500 outline-none focus:border-blue-500 text-center" />
                )}
                <button onClick={() => {
                  if (unblockingIp === item.ip) { handleRemove(item.ip) }
                  else { setUnblockingIp(item.ip); setUnblockTotp('') }
                }}
                  className="flex items-center gap-1 text-slate-500 hover:text-red-400 text-xs font-semibold px-3 py-1.5 rounded-xl hover:bg-red-900/20 transition-colors">
                  <Trash2 size={12} /> Unblock
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
