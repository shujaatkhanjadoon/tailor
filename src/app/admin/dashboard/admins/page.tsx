'use client'

import { useState, useEffect } from 'react'
import type { LucideIcon } from 'lucide-react'
import { UserPlus, RefreshCw, Shield, ShieldAlert, ShieldCheck, ToggleLeft, ToggleRight } from 'lucide-react'

const ROLE_ICONS: Record<string, LucideIcon> = {
  super_admin: ShieldAlert,
  finance: ShieldCheck,
  support: Shield,
}

const ROLE_COLORS: Record<string, string> = {
  super_admin: 'text-red-400 bg-red-900/30',
  finance: 'text-blue-400 bg-blue-900/30',
  support: 'text-green-400 bg-green-900/30',
}

interface AdminAccount {
  id: string
  username: string
  role: string
  is_active: boolean
  last_login?: string
  created_at?: string
  created_by?: string
}

export default function AdminsPage() {
  const [admins, setAdmins] = useState<AdminAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ username: '', password: '', role: 'support' as string })
  const [createTotp, setCreateTotp] = useState('')
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [toggleTotp, setToggleTotp] = useState('')

  const load = async () => {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/admin/admins')
      if (res.status === 401) { window.location.href = '/admin/login'; return }
      const d = await res.json()
      if (d.error) throw new Error(d.error)
      setAdmins(d.data)
    } catch (e) { setError(String(e)) } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    if (!form.username || !form.password) return
    if (!createTotp || createTotp.length !== 6) { setError('TOTP code required'); return }
    setError('')
    try {
      const res = await fetch('/api/admin/action', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_admin', username: form.username, password: form.password, role: form.role, totpCode: createTotp }),
      })
      const d = await res.json()
      if (d.error && d.requiresTOTP) { setError('TOTP code required for this action'); return }
      if (d.error) throw new Error(d.error)
      setShowCreate(false); setForm({ username: '', password: '', role: 'support' }); setCreateTotp('')
      load()
    } catch (e) { setError(String(e)) }
  }

  const handleToggle = async (admin: AdminAccount) => {
    if (!toggleTotp || toggleTotp.length !== 6) { setError('TOTP code required'); return }
    setTogglingId(admin.id)
    setError('')
    try {
      const res = await fetch('/api/admin/action', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: admin.is_active ? 'deactivate_admin' : 'activate_admin', targetId: admin.id, totpCode: toggleTotp }),
      })
      const d = await res.json()
      if (d.error && d.requiresTOTP) { setError('TOTP code required'); return }
      if (d.error) throw new Error(d.error)
      setToggleTotp('')
      load()
    } catch (e) { setError(String(e)) } finally { setTogglingId(null) }
  }

  return (
    <div className="max-w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <ShieldAlert size={18} /> Admin Accounts
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">Manage sub-admin accounts & roles</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors">
            <UserPlus size={12} /> New Admin
          </button>
          <button onClick={load} disabled={loading} className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-semibold px-4 py-2 rounded-xl disabled:opacity-50 transition-colors">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {error && <div className="bg-red-900/30 border border-red-800 rounded-xl px-4 py-3 text-red-400 text-sm mb-4">{error}</div>}

      {showCreate && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 mb-4">
          <h3 className="text-sm font-bold text-white mb-3">Create New Admin</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            <input placeholder="Username" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              className="bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none focus:border-blue-500" />
            <input type="password" placeholder="Password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              className="bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none focus:border-blue-500" />
            <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
              className="bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-blue-500">
              <option value="support">Support</option>
              <option value="finance">Finance</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>
          <input placeholder="TOTP Code" value={createTotp} onChange={e => setCreateTotp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none focus:border-blue-500 mb-3" />
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={createTotp.length !== 6} className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors disabled:opacity-50">Create</button>
            <button onClick={() => { setShowCreate(false); setCreateTotp('') }} className="bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-semibold px-4 py-2 rounded-xl transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {loading && <div className="flex justify-center py-16"><RefreshCw size={24} className="animate-spin text-slate-500" /></div>}

      {!loading && admins.length === 0 && (
        <div className="text-center py-16 text-slate-500 text-sm">No admin accounts yet</div>
      )}

      <div className="space-y-2">
        {admins.map(admin => {
          const RoleIcon = ROLE_ICONS[admin.role] || Shield
          return (
            <div key={admin.id} className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${ROLE_COLORS[admin.role] || 'bg-slate-700 text-slate-400'}`}>
                  <RoleIcon size={16} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{admin.username}</p>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${ROLE_COLORS[admin.role] || ''}`}>
                      {admin.role.replace('_', ' ')}
                    </span>
                    {admin.last_login && <span>Last login: {new Date(admin.last_login).toLocaleDateString()}</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {togglingId === admin.id && (
                  <input type="number" inputMode="numeric" pattern="[0-9]*" maxLength={6} placeholder="TOTP"
                    value={toggleTotp} onChange={e => setToggleTotp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-20 bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-xs text-white placeholder:text-slate-500 outline-none focus:border-blue-500 text-center" />
                )}
                <button onClick={() => {
                  if (togglingId === admin.id) { handleToggle(admin) }
                  else { setTogglingId(admin.id); setToggleTotp('') }
                }} className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors ${
                  admin.is_active ? 'text-green-400 hover:bg-green-900/30' : 'text-slate-500 hover:bg-slate-700'
                }`}>
                  {admin.is_active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                  {admin.is_active ? 'Active' : 'Inactive'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
