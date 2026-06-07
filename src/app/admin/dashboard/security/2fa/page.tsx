'use client'

import { useState } from 'react'
import { Shield, KeyRound, LogOut, RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react'

export default function TwoFAPage() {
  const [totpCode, setTotpCode] = useState('')
  const [logoutTotp, setLogoutTotp] = useState('')
  const [loading, setLoading] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleResetTOTP = async () => {
    if (!totpCode || totpCode.length !== 6) { setError('Please enter a valid 6-digit TOTP code'); return }
    setLoading('totp'); setError(''); setSuccess('')
    try {
      const res = await fetch('/api/admin/action', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset_admin_totp', totpCode }),
      })
      const d = await res.json()
      if (d.error && d.requiresTOTP) { setError('Current TOTP code required'); return }
      if (d.error) throw new Error(d.error)
      setSuccess('TOTP secret reset successfully. Set up your new secret in Google Authenticator.')
      setTotpCode('')
    } catch (e) { setError(String(e)) } finally { setLoading('') }
  }

  const handleForceLogout = async () => {
    if (!logoutTotp || logoutTotp.length !== 6) { setError('Please enter a valid 6-digit TOTP code'); return }
    setLoading('logout'); setError(''); setSuccess('')
    try {
      const res = await fetch('/api/admin/action', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'force_logout_sessions', totpCode: logoutTotp }),
      })
      const d = await res.json()
      if (d.error && d.requiresTOTP) { setError('TOTP code required'); return }
      if (d.error) throw new Error(d.error)
      setSuccess('All admin sessions have been force-logged out.')
      setLogoutTotp('')
    } catch (e) { setError(String(e)) } finally { setLoading('') }
  }

  return (
    <div className="max-w-full">
      <div className="mb-6">
        <h1 className="text-lg font-bold text-white flex items-center gap-2">
          <Shield size={18} /> 2FA & Session Management
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">Manage two-factor authentication and admin sessions</p>
      </div>

      {error && <div className="flex items-center gap-2 bg-red-900/30 border border-red-800 rounded-xl px-4 py-3 text-red-400 text-sm mb-4"><AlertTriangle size={14} />{error}</div>}
      {success && <div className="flex items-center gap-2 bg-green-900/30 border border-green-800 rounded-xl px-4 py-3 text-green-400 text-sm mb-4"><CheckCircle size={14} />{success}</div>}

      <div className="space-y-4">
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-yellow-900/30 rounded-2xl flex items-center justify-center">
              <KeyRound size={18} className="text-yellow-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Reset TOTP Secret</h2>
              <p className="text-xs text-slate-400">Generate a new TOTP secret for Google Authenticator. You will need to scan the new QR code.</p>
            </div>
          </div>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs text-slate-500 font-medium mb-1">Current TOTP Code</label>
              <input type="number" inputMode="numeric" pattern="[0-9]*" maxLength={6} placeholder="000000"
                value={totpCode} onChange={e => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:border-blue-500" />
            </div>
            <button onClick={handleResetTOTP} disabled={loading === 'totp'}
              className="flex items-center gap-1.5 bg-yellow-600 hover:bg-yellow-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl disabled:opacity-50 transition-colors">
              {loading === 'totp' ? <RefreshCw size={12} className="animate-spin" /> : <KeyRound size={12} />}
              Reset Secret
            </button>
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-red-900/30 rounded-2xl flex items-center justify-center">
              <LogOut size={18} className="text-red-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Force Logout All Sessions</h2>
              <p className="text-xs text-slate-400">Invalidate all active admin sessions including your own. You will need to log in again.</p>
            </div>
          </div>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs text-slate-500 font-medium mb-1">TOTP Code</label>
              <input type="number" inputMode="numeric" pattern="[0-9]*" maxLength={6} placeholder="000000"
                value={logoutTotp} onChange={e => setLogoutTotp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:border-blue-500" />
            </div>
            <button onClick={handleForceLogout} disabled={loading === 'logout' || logoutTotp.length !== 6}
              className="flex items-center gap-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl disabled:opacity-50 transition-colors">
              {loading === 'logout' ? <RefreshCw size={12} className="animate-spin" /> : <LogOut size={12} />}
              Force Logout All Sessions
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
