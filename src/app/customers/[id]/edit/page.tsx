'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, Save, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { customerOps } from '@/lib/db/operations'
import { cn } from '@/lib/utils'

export default function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    phone: '',
    whatsapp: '',
    gender: 'male' as 'male' | 'female' | 'child',
    notes: '',
    photoUrl: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    customerOps.get(id)
      .then(customer => {
        if (!customer || cancelled) return
        setForm({
          name: customer.name ?? '',
          phone: customer.phone ?? '',
          whatsapp: customer.whatsapp ?? '',
          gender: customer.gender ?? 'male',
          notes: customer.notes ?? '',
          photoUrl: customer.photoUrl ?? '',
        })
      })
      .catch(error => {
        console.error(error)
        toast.error('Customer load nahi hua')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [id])

  const validate = () => {
    const next: Record<string, string> = {}
    if (!form.name.trim()) next.name = 'Naam zaroori hai'
    if (form.phone.replace(/\D/g, '').length < 10) next.phone = 'Sahi phone number daalein'
    if (form.whatsapp && form.whatsapp.replace(/\D/g, '').length < 10) next.whatsapp = 'Sahi WhatsApp number daalein'
    if (form.photoUrl && !/^https?:\/\//i.test(form.photoUrl)) next.photoUrl = 'Image URL http/https se start hona chahiye'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const save = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      await customerOps.update(id, {
        name: form.name.trim(),
        phone: form.phone.replace(/\D/g, ''),
        whatsapp: form.whatsapp.trim() ? form.whatsapp.replace(/\D/g, '') : undefined,
        gender: form.gender,
        notes: form.notes.trim() || undefined,
        photoUrl: form.photoUrl.trim() || undefined,
      })
      toast.success('Profile update ho gayi')
      router.push(`/customers/${id}`)
      router.refresh()
    } catch (error) {
      console.error(error)
      toast.error('Profile save nahi hui. Dobara try karein.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24 lg:pb-8">
      <header className="sticky top-0 z-10 border-b border-slate-100 bg-white px-4 pt-12 pb-4 lg:pt-6">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <button
            aria-label="Go back"
            onClick={() => router.back()}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100"
          >
            <ArrowLeft size={16} className="text-slate-600" />
          </button>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-slate-800">Edit Profile</h1>
            <p className="text-xs text-slate-400">Customer information Supabase mein save hogi</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pt-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-blue-50 text-blue-700">
              {form.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.photoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <UserRound size={24} />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-800">{form.name || 'Customer'}</p>
              <p className="truncate text-xs text-slate-400">{form.phone || 'Phone number'}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Naam" error={errors.name}>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputClass(errors.name)} />
            </Field>
            <Field label="Phone" error={errors.phone}>
              <input value={form.phone} inputMode="tel" onChange={e => setForm({ ...form, phone: e.target.value.replace(/\D/g, '').slice(0, 11) })} className={inputClass(errors.phone)} />
            </Field>
            <Field label="WhatsApp" error={errors.whatsapp}>
              <input value={form.whatsapp} inputMode="tel" onChange={e => setForm({ ...form, whatsapp: e.target.value.replace(/\D/g, '').slice(0, 11) })} className={inputClass(errors.whatsapp)} placeholder="Optional" />
            </Field>
            <Field label="Profile Image URL" error={errors.photoUrl}>
              <input value={form.photoUrl} onChange={e => setForm({ ...form, photoUrl: e.target.value })} className={inputClass(errors.photoUrl)} placeholder="https://..." />
            </Field>
          </div>

          <div className="mt-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Type</p>
            <div className="grid grid-cols-3 gap-2">
              {(['male', 'female', 'child'] as const).map(gender => (
                <button
                  key={gender}
                  type="button"
                  onClick={() => setForm({ ...form, gender })}
                  className={cn(
                    'rounded-xl border-2 px-3 py-3 text-xs font-bold capitalize transition-colors',
                    form.gender === gender ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600'
                  )}
                >
                  {gender}
                </button>
              ))}
            </div>
          </div>

          <Field label="Notes" className="mt-4">
            <textarea
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              rows={4}
              className={`${inputClass()} resize-none`}
              placeholder="Customer ke notes..."
            />
          </Field>

          <button
            onClick={save}
            disabled={saving}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-4 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:bg-slate-300"
          >
            {saving ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
            {saving ? 'Save ho raha hai...' : 'Profile Save Karein'}
          </button>
        </div>
      </main>
    </div>
  )
}

function Field({
  label,
  error,
  className,
  children,
}: {
  label: string
  error?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <label className={className}>
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs font-semibold text-red-600">{error}</span>}
    </label>
  )
}

function inputClass(error?: string) {
  return cn(
    'w-full rounded-xl border-2 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:bg-white focus:ring-4',
    error ? 'border-red-300 focus:border-red-500 focus:ring-red-100' : 'border-slate-200 focus:border-blue-500 focus:ring-blue-100'
  )
}
