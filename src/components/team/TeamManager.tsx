// src/components/team/TeamManager.tsx
'use client'

import { useState, useEffect } from 'react'
import { UserPlus, Trash2, Star, Scissors, Phone } from 'lucide-react'
import { TeamMemberRecord } from '@/lib/db/schema'
import { teamOps } from '@/lib/db/operations'
import { useAuth } from '@/lib/auth/AuthContext'
import { cn } from '@/lib/utils'

const SPECIALITIES = [
  'Shalwar Kameez', 'Shirt', 'Trouser', 'Sherwani', 'Coat', 'Sab Kuch',
]

const PAY_TYPES = [
  { key: 'per_order', label: 'Per Order'  },
  { key: 'daily',     label: 'Daily'      },
  { key: 'monthly',   label: 'Monthly'    },
] as const

export function TeamManager() {
  const { shopId } = useAuth()
  const [members,     setMembers]     = useState<TeamMemberRecord[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [saving,      setSaving]      = useState(false)

  const [form, setForm] = useState({
    name: '', phone: '', pin: '', confirmPin: '',
    speciality: 'Sab Kuch',
    payRateType: 'per_order' as 'daily' | 'per_order' | 'monthly',
    payRate: '',
  })

  useEffect(() => {
    if (!shopId) return
    teamOps.getAll(shopId).then(setMembers)
  }, [shopId])

  const handleAdd = async () => {
    if (!shopId) return
    if (form.pin !== form.confirmPin) {
      alert('PIN match nahi kiya!')
      return
    }
    if (form.pin.length !== 4) {
      alert('PIN 4 numbers ka hona chahiye')
      return
    }
    setSaving(true)
    try {
      const member = await teamOps.add(shopId, {
        name:        form.name,
        phone:       form.phone,
        role:        'karigar',
        pin:         form.pin,
        speciality:  form.speciality,
        payRateType: form.payRateType,
        payRate:     Number(form.payRate) || 0,
      })
      setMembers(prev => [...prev, member])
      setShowAddForm(false)
      setForm({ name: '', phone: '', pin: '', confirmPin: '', speciality: 'Sab Kuch', payRateType: 'per_order', payRate: '' })
    } finally {
      setSaving(false)
    }
  }

  const handleDeactivate = async (id: string) => {
    if (!confirm('Kya aap yaqeen se is karigar ko hatana chahte hain?')) return
    await teamOps.deactivate(id)
    setMembers(prev => prev.filter(m => m.id !== id))
  }

  return (
    <div className="space-y-4">

      {/* Add karigar button */}
      <button
        onClick={() => setShowAddForm(v => !v)}
        className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white
                   font-semibold py-3.5 rounded-2xl transition-colors active:scale-95"
      >
        <UserPlus size={18} />
        Naya Karigar Add Karein
      </button>

      {/* Add form */}
      {showAddForm && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
          <p className="font-semibold text-slate-700">Karigar Ki Details</p>

          <input
            placeholder="Naam *"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-500"
          />

          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-3">
            <Phone size={14} className="text-slate-400" />
            <input
              type="tel"
              placeholder="Phone number *"
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value.replace(/\D/g, '').slice(0, 11) }))}
              className="flex-1 text-sm outline-none"
            />
          </div>

          {/* PIN */}
          <div className="grid grid-cols-2 gap-2">
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              placeholder="4-digit PIN *"
              value={form.pin}
              onChange={e => setForm(f => ({ ...f, pin: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
              className="px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-500 text-center tracking-widest"
            />
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              placeholder="PIN dobara *"
              value={form.confirmPin}
              onChange={e => setForm(f => ({ ...f, confirmPin: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
              className={cn(
                'px-4 py-3 bg-white border rounded-xl text-sm outline-none text-center tracking-widest',
                form.confirmPin && form.pin !== form.confirmPin
                  ? 'border-red-400 bg-red-50'
                  : 'border-slate-200 focus:border-blue-500'
              )}
            />
          </div>

          {/* Speciality */}
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1.5">Kaam mein mahir:</p>
            <div className="flex flex-wrap gap-2">
              {SPECIALITIES.map(s => (
                <button
                  key={s}
                  onClick={() => setForm(f => ({ ...f, speciality: s }))}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                    form.speciality === s
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-600 border-slate-200'
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Pay rate */}
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1.5">Pay tarika (optional):</p>
            <div className="flex gap-2 mb-2">
              {PAY_TYPES.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setForm(f => ({ ...f, payRateType: key }))}
                  className={cn(
                    'flex-1 py-2 text-xs font-semibold rounded-xl border transition-colors',
                    form.payRateType === key
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-600 border-slate-200'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-3">
              <span className="text-slate-400 text-sm">Rs.</span>
              <input
                type="number"
                inputMode="numeric"
                placeholder="Amount"
                value={form.payRate}
                onChange={e => setForm(f => ({ ...f, payRate: e.target.value }))}
                className="flex-1 text-sm outline-none"
              />
            </div>
          </div>

          <button
            onClick={handleAdd}
            disabled={!form.name || !form.phone || !form.pin || saving}
            className="w-full bg-green-600 disabled:bg-slate-300 text-white font-semibold
                       py-3 rounded-xl text-sm transition-colors"
          >
            {saving ? 'Save ho raha hai...' : 'Karigar Save Karein ✓'}
          </button>
        </div>
      )}

      {/* Team list */}
      <div className="space-y-3">
        {members.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <Scissors size={32} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm">Abhi koi karigar nahi hai</p>
          </div>
        ) : (
          members.map(member => (
            <div
              key={member.id}
              className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-3"
            >
              {/* Avatar */}
              <div className={cn(
                'w-11 h-11 rounded-full flex items-center justify-center font-bold text-base shrink-0',
                member.role === 'owner'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-green-100 text-green-700'
              )}>
                {member.name.charAt(0).toUpperCase()}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-slate-800 truncate">{member.name}</p>
                  {member.role === 'owner' && (
                    <Star size={12} className="text-amber-500 shrink-0" fill="currentColor" />
                  )}
                </div>
                <p className="text-xs text-slate-400">{member.phone}</p>
                {member.speciality && (
                  <p className="text-xs text-blue-600 mt-0.5">✂️ {member.speciality}</p>
                )}
                {member.payRate && member.payRate > 0 && (
                  <p className="text-xs text-green-600">
                    Rs. {member.payRate.toLocaleString()} / {member.payRateType === 'per_order' ? 'order' : member.payRateType}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className={cn(
                  'text-[10px] font-bold px-2 py-1 rounded-full',
                  member.role === 'owner'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-green-100 text-green-700'
                )}>
                  {member.role === 'owner' ? 'Ustad' : 'Karigar'}
                </span>
                {member.role !== 'owner' && (
                  <button
                    aria-label={`Remove ${member.name}`}
                    onClick={() => handleDeactivate(member.id)}
                    className="w-11 h-11 flex items-center justify-center rounded-full
                               hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
