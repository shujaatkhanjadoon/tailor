// src/components/team/TeamManager.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  UserPlus, Trash2, Star, Scissors, Phone,
  Pencil, X, Eye, EyeOff, AlertCircle, CheckCircle2, Loader2,
  ShieldAlert, ArrowUpRight,
} from 'lucide-react'
import { TeamMemberRecord }    from '@/lib/db/schema'
import { teamOps }             from '@/lib/db/operations'
import { useAuth }             from '@/lib/auth/AuthContext'
import { toast } from 'sonner'
import { cn }                  from '@/lib/utils'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { usePlan }             from '@/hooks/usePlan'
import { KARIGAR_PIN_LENGTH, validateKarigarPIN, getPINStrength } from '@/lib/security/pin'
import { validatePakistaniPhone } from '@/lib/security/phone'
import { supabase }            from '@/lib/supabase/client'
import { formatKarigarSkills, KARIGAR_SKILLS, parseKarigarSkills } from '@/lib/team/karigar-skills'

// ── Constants ─────────────────────────────────────────────────────
const PIN_LENGTH = KARIGAR_PIN_LENGTH

const PAY_TYPES = [
  { key: 'per_order', label: 'Per Order' },
  { key: 'daily',     label: 'Daily'     },
  { key: 'monthly',   label: 'Monthly'   },
] as const

// ── PIN Input Component ───────────────────────────────────────────
function PINInput({
  value,
  onChange,
  placeholder,
  error,
  showToggle = true,
}: {
  value:       string
  onChange:    (v: string) => void
  placeholder?: string
  error?:      string
  showToggle?: boolean
}) {
  const [show, setShow] = useState(false)

  return (
    <div>
      <div className={cn(
        'flex items-center gap-2 bg-white border rounded-xl px-3 py-2.5 transition-colors',
        error ? 'border-red-400 bg-red-50' : 'border-slate-200 focus-within:border-blue-500'
      )}>
        <input
          type={show ? 'text' : 'password'}
          inputMode="numeric"
          maxLength={PIN_LENGTH}
          placeholder={placeholder ?? `${PIN_LENGTH}-digit PIN`}
          value={value}
          onChange={e => onChange(e.target.value.replace(/\D/g, '').slice(0, PIN_LENGTH))}
          className="flex-1 text-sm bg-transparent outline-none tracking-widest font-mono"
        />
        {showToggle && (
          <button
            type="button"
            onClick={() => setShow(v => !v)}
            className="text-slate-400 hover:text-slate-600"
          >
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        )}
      </div>
      {error && (
        <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
          <AlertCircle size={11} />
          {error}
        </p>
      )}
    </div>
  )
}

// ── Karigar limit warning for downgrade scenarios ─────────────────
function OverLimitWarning({
  current,
  limit,
  planName,
}: {
  current:  number
  limit:    number
  planName: string
}) {
  if (current <= limit) return null
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
      <div className="flex items-start gap-2">
        <ShieldAlert size={16} className="text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-amber-800">
            Plan limit se zyada karigars!
          </p>
          <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
            Aapke {current} karigar hain lekin {planName} plan mein sirf {limit} allowed hain.
            Naye karigar add nahi ho sakte. Barah-e-karam {current - limit} karigar
            deactivate karein.
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────
export function TeamManager() {
  const { shopId, currentUser } = useAuth()
  const plan                    = usePlan()

  const canUsePayReports = plan.plan === 'business' && plan.isActive

  const [members,      setMembers]      = useState<TeamMemberRecord[]>([])
  const [loadingList,  setLoadingList]  = useState(true)
  const [showAddForm,  setShowAddForm]  = useState(false)
  const [editingId,    setEditingId]    = useState<string | null>(null)
  const [saving,       setSaving]       = useState(false)
  const [pinChanged,   setPinChanged]   = useState(false)
  const [deactivateTarget, setDeactivateTarget] = useState<TeamMemberRecord | null>(null)

  const [form, setForm] = useState({
    name:        '',
    phone:       '',
    pin:         '',
    confirmPin:  '',
    speciality:  'Sab Kuch',
    payRateType: 'per_order' as 'daily' | 'per_order' | 'monthly',
    payRate:     '',
  })

  const [errors, setErrors] = useState({
    name:       '',
    phone:      '',
    pin:        '',
    confirmPin: '',
    general:    '',
  })

  // ── Load members — always sorted: owner first ─────────────────
  useEffect(() => {
    if (!shopId) return
    setLoadingList(true)
    teamOps.getAll(shopId)
      .then(all => {
        // Owner always at top, then karigars alphabetically
        const sorted = [...all].sort((a, b) => {
          if (a.role === 'owner' && b.role !== 'owner') return -1
          if (a.role !== 'owner' && b.role === 'owner') return 1
          return a.name.localeCompare(b.name)
        })
        setMembers(sorted)
      })
      .finally(() => setLoadingList(false))
  }, [shopId])

  // ── Plan-based karigar counts ─────────────────────────────────
  const activeKarigars   = members.filter(m => m.role === 'karigar').length
  const karigarLimit     = plan.karigarLimit    // 0, 3, or 999
  const isOverLimit      = karigarLimit !== 999 && activeKarigars > karigarLimit
  const isAtLimit        = karigarLimit !== 999 && activeKarigars >= karigarLimit
  const canAddKarigar    = plan.canAddKarigar && !isAtLimit

  // ── Helpers ──────────────────────────────────────────────────
  const resetForm = useCallback(() => {
    setForm({
      name: '', phone: '', pin: '', confirmPin: '',
      speciality: 'Sab Kuch', payRateType: 'per_order', payRate: '',
    })
    setErrors({ name: '', phone: '', pin: '', confirmPin: '', general: '' })
    setEditingId(null)
    setPinChanged(false)
  }, [])

  const clearError = (field: keyof typeof errors) => {
    setErrors(e => ({ ...e, [field]: '' }))
  }

  // ── Validate form ─────────────────────────────────────────────
  const validate = async (): Promise<boolean> => {
    const newErrors = { name: '', phone: '', pin: '', confirmPin: '', general: '' }
    let valid = true

    // Name
    if (form.name.trim().length < 2) {
      newErrors.name = 'Naam kam se kam 2 letters ka hona chahiye'
      valid = false
    }

    // Phone
    const phoneResult = validatePakistaniPhone(form.phone)
    if (!phoneResult.valid) {
      newErrors.phone = phoneResult.error!
      valid = false
    } else if (shopId) {
      // Check globally unique (same shop → show name, other shop → generic)
      const existing = await supabase
        .from('team_members')
        .select('id, name, role, shop_id')
        .eq('phone', phoneResult.cleaned)
        .eq('is_active', true)
        .limit(1)

      const member = existing.data?.[0]
      if (member && member.id !== editingId) {
        if (member.shop_id === shopId) {
          newErrors.phone = `Yeh number pehle se registered hai (${member.name} — ${member.role})`
        } else {
          newErrors.phone = `Yeh number pehle se kisi aur dukaan par registered hai`
        }
        valid = false
      }
    }

    // PIN — only validate if it's a new entry or PIN was changed
    if (!editingId || pinChanged) {
      if (!form.pin) {
        newErrors.pin = 'PIN daalein'
        valid = false
      } else {
        const pinResult = validateKarigarPIN(form.pin)
        if (!pinResult.valid) {
          newErrors.pin = pinResult.error!
          valid = false
        } else if (form.pin !== form.confirmPin) {
          newErrors.confirmPin = 'PIN match nahi kiya!'
          valid = false
        }
      }
    }

    setErrors(newErrors)
    return valid
  }

  // ── Add / Edit karigar ────────────────────────────────────────
  const handleSave = async () => {
    if (!shopId || !currentUser) return
    if (!editingId && !canAddKarigar) {
      setErrors(e => ({
        ...e,
        general: `Is plan mein ${karigarLimit === 0 ? 'karigar accounts' : `sirf ${karigarLimit} karigar`} allowed hain.`,
      }))
      return
    }

    setSaving(true)
    try {
      const isValid = await validate()
      if (!isValid) return

      const phoneResult = validatePakistaniPhone(form.phone)
      const cleanPhone  = phoneResult.cleaned

      // ── Write to Supabase via API ────────────────────────────
      // Send raw PIN — the API validates and hashes it server-side
      const payload = {
        id: editingId ?? undefined,
        name: form.name.trim(),
        phone: cleanPhone,
        pin: (!editingId || pinChanged) ? form.pin : undefined,
        speciality: formatKarigarSkills(form.speciality.split(',')),
        payRateType: canUsePayReports ? form.payRateType : undefined,
        payRate: canUsePayReports ? Number(form.payRate) || 0 : 0,
      }

      const res = await fetch('/api/team/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json()
        setErrors(e => ({ ...e, general: err.error ?? 'Save failed' }))
        return
      }

      const result = await res.json()

      if (editingId) {
        // Existing member: optimistically update local state with form data
        const updatedData = {
          name: form.name.trim(),
          phone: cleanPhone,
          speciality: formatKarigarSkills(form.speciality.split(',')),
          payRateType: canUsePayReports ? form.payRateType : undefined,
          payRate: canUsePayReports ? Number(form.payRate) || 0 : 0,
        }
        await teamOps.update(editingId, updatedData)
        setMembers(prev => {
          const updated = prev.map(m => m.id === editingId
            ? { ...m, ...updatedData, _synced: 1 as const }
            : m
          )
          return updated.sort((a, b) => {
            if (a.role === 'owner') return -1
            if (b.role === 'owner') return 1
            return a.name.localeCompare(b.name)
          })
        })
      } else {
        // API already created the member — use the returned data directly
        // instead of calling teamOps.addWithId (which would double-insert)
        const newMember = result.data as TeamMemberRecord
        setMembers(prev => {
          const updated = [...prev, { ...newMember, _synced: 1 as const }]
          return updated.sort((a, b) => {
            if (a.role === 'owner') return -1
            if (b.role === 'owner') return 1
            return a.name.localeCompare(b.name)
          })
        })
      }

      setShowAddForm(false)
      resetForm()
    } catch (e) {
      console.error('[TeamManager] Save error:', e)
      setErrors(err => ({ ...err, general: String(e) }))
    } finally {
      setSaving(false)
    }
  }

  // ── Start editing ─────────────────────────────────────────────
  const startEdit = (member: TeamMemberRecord) => {
    setEditingId(member.id)
    setPinChanged(false)   // don't require PIN re-entry unless changed
    setForm({
      name:        member.name,
      phone:       member.phone,
      pin:         '',            // don't pre-fill hash
      confirmPin:  '',
      speciality:  member.speciality  ?? 'Sab Kuch',
      payRateType: member.payRateType ?? 'per_order',
      payRate:     member.payRate ? String(member.payRate) : '',
    })
    setErrors({ name: '', phone: '', pin: '', confirmPin: '', general: '' })
    setShowAddForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ── Deactivate karigar ────────────────────────────────────────
  const handleDeactivate = async () => {
    const member = deactivateTarget
    if (!member) return
    setDeactivateTarget(null)

    try {
      await teamOps.deactivate(member.id)
      setMembers(prev => prev.filter(m => m.id !== member.id))
      toast.success(`${member.name} ko hata diya gaya`)
    } catch (e) {
      toast.error(`Error: ${String(e)}`)
    }
  }

  // ── PIN strength ──────────────────────────────────────────────
  const strength = getPINStrength(form.pin)

  return (
    <div className="space-y-4">

      {/* Over-limit warning (downgrade scenario) */}
      {isOverLimit && (
        <OverLimitWarning
          current={activeKarigars}
          limit={karigarLimit}
          planName={plan.plan === 'starter' ? 'Starter' : 'Professional'}
        />
      )}

      {/* Plan limit info */}
      {!canAddKarigar && !showAddForm && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
          <div className="flex items-start justify-between gap-3">
          <p className="text-xs text-amber-800 font-medium">
            {karigarLimit === 0
              ? '💡 Karigar accounts Professional plan se unlock hotay hain.'
              : `📊 ${plan.plan === 'professional' ? 'Professional' : 'Business'} plan mein ${karigarLimit} karigar limit. Business plan mein unlimited hain.`
            }
          </p>
          <button
            type="button"
            onClick={() => plan.upgrade(karigarLimit === 0 ? 'professional' : 'business')}
            className="shrink-0 inline-flex items-center gap-1 rounded-xl bg-amber-600 px-3 py-2 text-xs font-bold text-white shadow-sm active:scale-95"
          >
            Upgrade Plan
            <ArrowUpRight size={12} />
          </button>
          </div>
        </div>
      )}

      {/* Add/cancel button */}
      <button
        onClick={() => {
          if (showAddForm) {
            resetForm()
            setShowAddForm(false)
          } else {
            if (!canAddKarigar) return
            setShowAddForm(true)
          }
        }}
        disabled={!canAddKarigar && !showAddForm}
        className="w-full flex items-center justify-center gap-2 bg-blue-600
                   disabled:bg-slate-300 text-white font-semibold py-3.5
                   rounded-2xl transition-colors active:scale-95"
      >
        {showAddForm
          ? <><X size={18} /> Form Band Karein</>
          : <><UserPlus size={18} /> Naya Karigar Add Karein</>
        }
      </button>

      {/* ── Add / Edit Form ── */}
      {showAddForm && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-4">
          <p className="font-bold text-slate-700 text-sm">
            {editingId ? '✏️ Karigar Edit Karein' : '➕ Naya Karigar'}
          </p>

          {/* General error */}
          {errors.general && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200
                            rounded-xl px-3 py-2.5">
              <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
              <p className="text-red-600 text-xs">{errors.general}</p>
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-500
                               uppercase tracking-wide mb-1.5">
              Naam *
            </label>
            <input
              placeholder="Karigar ka poora naam"
              value={form.name}
              onChange={e => { setForm(f => ({ ...f, name: e.target.value })); clearError('name') }}
              className={cn(
                'w-full px-4 py-3 bg-white border rounded-xl text-sm outline-none',
                'focus:border-blue-500 transition-colors',
                errors.name ? 'border-red-400 bg-red-50' : 'border-slate-200'
              )}
            />
            {errors.name && (
              <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                <AlertCircle size={11} /> {errors.name}
              </p>
            )}
          </div>

          {/* Phone */}
          <div>
            <label className="block text-xs font-semibold text-slate-500
                               uppercase tracking-wide mb-1.5">
              Phone Number *
            </label>
            <div className={cn(
              'flex items-center gap-2 bg-white border rounded-xl px-3 py-2.5',
              'transition-colors focus-within:border-blue-500',
              errors.phone ? 'border-red-400 bg-red-50' : 'border-slate-200'
            )}>
              <Phone size={14} className="text-slate-400 shrink-0" />
              <input
                type="tel"
                inputMode="numeric"
                placeholder="03XX-XXXXXXX"
                value={form.phone}
                onChange={e => {
                  setForm(f => ({
                    ...f,
                    phone: e.target.value.replace(/\D/g, '').slice(0, 11),
                  }))
                  clearError('phone')
                }}
                className="flex-1 text-sm bg-transparent outline-none"
              />
            </div>
            {errors.phone && (
              <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                <AlertCircle size={11} /> {errors.phone}
              </p>
            )}
            {!errors.phone && (
              <p className="text-slate-400 text-[10px] mt-1">
                Har karigar ka phone number unique hona chahiye
              </p>
            )}
          </div>

          {/* PIN section */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                {editingId ? 'Naya PIN (optional)' : 'PIN *'}
              </label>
              {editingId && !pinChanged && (
                <button
                  type="button"
                  onClick={() => { setPinChanged(true); setForm(f => ({ ...f, pin: '', confirmPin: '' })) }}
                  className="text-xs text-blue-600 font-semibold"
                >
                  PIN Badlein
                </button>
              )}
            </div>

            {/* Edit mode: show "PIN not changed" until clicked */}
            {editingId && !pinChanged ? (
              <div className="flex items-center gap-2 bg-slate-100 border border-slate-200
                              rounded-xl px-4 py-3">
                <CheckCircle2 size={14} className="text-green-500" />
                <span className="text-sm text-slate-500">PIN unchanged (existing hash)</span>
              </div>
            ) : (
              <div className="space-y-2">
                <PINInput
                  value={form.pin}
                  onChange={v => { setForm(f => ({ ...f, pin: v })); clearError('pin') }}
                  placeholder={`Naya ${PIN_LENGTH}-digit PIN`}
                  error={errors.pin}
                />
                <PINInput
                  value={form.confirmPin}
                  onChange={v => { setForm(f => ({ ...f, confirmPin: v })); clearError('confirmPin') }}
                  placeholder="PIN confirm karein"
                  error={errors.confirmPin}
                />

                {/* PIN strength */}
                {form.pin.length > 0 && (
                  <div>
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="text-slate-400">PIN Strength</span>
                      {strength.label && (
                        <span className={cn(
                          'font-bold',
                          strength.score >= 4 ? 'text-green-600' :
                          strength.score >= 3 ? 'text-amber-600' : 'text-red-500'
                        )}>
                          {strength.label}
                        </span>
                      )}
                    </div>
                    <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all', strength.color)}
                        style={{ width: `${(strength.score / 4) * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                <p className="text-slate-400 text-[10px]">
                  💡 Karigar ko yeh PIN batayein — woh isi se login karenge
                </p>
              </div>
            )}
          </div>

          {/* Speciality */}
          <div>
            <label className="block text-xs font-semibold text-slate-500
                               uppercase tracking-wide mb-1.5">
              Kaam
            </label>
            <div className="flex flex-wrap gap-2">
              {KARIGAR_SKILLS.map(s => {
                const selectedSkills = parseKarigarSkills(form.speciality)
                const selected = selectedSkills.includes(s)
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setForm(f => {
                        const current = parseKarigarSkills(f.speciality)
                        const next = s === 'Sab Kuch'
                          ? ['Sab Kuch']
                          : selected
                            ? current.filter(skill => skill !== s && skill !== 'Sab Kuch')
                            : [...current.filter(skill => skill !== 'Sab Kuch'), s]
                        return { ...f, speciality: formatKarigarSkills(next) }
                      })
                    }}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                      selected
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                    )}
                  >
                    {s}
                  </button>
                )
              })}
            </div>
            <p className="mt-1.5 text-[10px] text-slate-400">
              Aik se zyada kaam select kar sakte hain.
            </p>
          </div>

          {/* Pay rate — Business plan only */}
          {canUsePayReports && (
            <div>
              <label className="block text-xs font-semibold text-slate-500
                                 uppercase tracking-wide mb-1.5">
                Pay Tarika (Optional)
              </label>
              <div className="flex gap-2 mb-2">
                {PAY_TYPES.map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
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
              <div className="flex items-center gap-2 bg-white border border-slate-200
                              rounded-xl px-4 py-3 focus-within:border-blue-500 transition-colors">
                <span className="text-slate-400 text-sm">Rs.</span>
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="Amount"
                  value={form.payRate}
                  onChange={e => setForm(f => ({ ...f, payRate: e.target.value }))}
                  className="flex-1 text-sm bg-transparent outline-none"
                />
              </div>
            </div>
          )}

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={!form.name.trim() || !form.phone || saving}
            className="w-full bg-green-600 disabled:bg-slate-300 text-white
                       font-bold py-3.5 rounded-xl text-sm transition-colors
                       flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            {saving
              ? <><Loader2 size={16} className="animate-spin" /> Save ho raha hai...</>
              : editingId
              ? '✓ Changes Save Karein'
              : '✓ Karigar Add Karein'
            }
          </button>
        </div>
      )}

      {/* ── Team List ── */}
      <div className="space-y-3">
        {loadingList ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-2xl
                                      p-4 h-16 animate-pulse" />
            ))}
          </div>
        ) : members.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <Scissors size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm font-medium">Abhi koi member nahi</p>
          </div>
        ) : (
          members.map((member) => (
            <div
              key={member.id}
              className={cn(
                'bg-white border rounded-2xl p-4 flex items-center gap-3',
                member.role === 'owner'
                  ? 'border-blue-200 bg-blue-50/30'
                  : 'border-slate-200'
              )}
            >
              {/* Avatar */}
              <div className={cn(
                'w-11 h-11 rounded-full flex items-center justify-center',
                'font-bold text-base shrink-0',
                member.role === 'owner'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-green-100 text-green-700'
              )}>
                {member.name.charAt(0).toUpperCase()}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-slate-800 truncate text-sm">
                    {member.name}
                  </p>
                  {member.role === 'owner' && (
                    <Star size={12} className="text-amber-500 shrink-0"
                      fill="currentColor" />
                  )}
                </div>
                <p className="text-xs text-slate-400 font-mono">{member.phone}</p>
                {member.speciality && (
                  <p className="text-xs text-blue-600 mt-0.5">
                    ✂️ {member.speciality}
                  </p>
                )}
                {canUsePayReports && member.payRate && member.payRate > 0 && (
                  <p className="text-xs text-green-600">
                    Rs. {member.payRate.toLocaleString()} /&nbsp;
                    {member.payRateType === 'per_order' ? 'order'
                      : member.payRateType ?? 'month'}
                  </p>
                )}
              </div>

              {/* Role + actions */}
              <div className="flex items-center gap-1.5 shrink-0">
                <span className={cn(
                  'text-[10px] font-bold px-2 py-1 rounded-full',
                  member.role === 'owner'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-green-100 text-green-700'
                )}>
                  {member.role === 'owner' ? 'Ustad' : 'Karigar'}
                </span>

                {member.role !== 'owner' && (
                  <>
                    <button
                      aria-label={`Edit ${member.name}`}
                      onClick={() => startEdit(member)}
                      className="w-9 h-9 flex items-center justify-center rounded-full
                                 hover:bg-blue-50 text-slate-300 hover:text-blue-500
                                 transition-colors"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      aria-label={`Remove ${member.name}`}
                      onClick={() => setDeactivateTarget(member)}
                      className="w-9 h-9 flex items-center justify-center rounded-full
                                 hover:bg-red-50 text-slate-300 hover:text-red-500
                                 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Karigar count badge */}
      {activeKarigars > 0 && (
        <p className="text-center text-xs text-slate-400">
          {activeKarigars} karigar
          {karigarLimit !== 999
            ? ` · plan limit: ${karigarLimit}`
            : ' · unlimited plan'
          }
        </p>
      )}

      <ConfirmDialog
        open={deactivateTarget !== null}
        onOpenChange={(open) => { if (!open) setDeactivateTarget(null) }}
        title={`${deactivateTarget?.name ?? ''} ko hatana chahte hain?`}
        description="Woh login nahi kar sakenge. Unke assigned orders unassigned ho jayenge."
        confirmLabel="Remove"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleDeactivate}
      />
    </div>
  )
}
