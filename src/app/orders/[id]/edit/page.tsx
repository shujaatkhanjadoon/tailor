'use client'

import { use, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save, UsersRound } from 'lucide-react'
import { toast } from 'sonner'
import { useOrder } from '@/hooks/useOrders'
import { useAuth } from '@/lib/auth/AuthContext'
import { orderOps } from '@/lib/db/operations'
import { AccessNotice } from '@/components/billing/AccessNotice'
import { GARMENT_LABELS, GarmentType, OrderRecipientRelation } from '@/types'
import { cn } from '@/lib/utils'
import { relationNeedsName } from '@/lib/order-recipient'
import type { OrderRecord } from '@/lib/db/schema'

const RECIPIENT_OPTIONS: { relation: OrderRecipientRelation; label: string; helper: string; gender: 'male' | 'female' | 'child' | 'same' | 'custom' }[] = [
  { relation: 'self', label: 'Self', helper: 'Gahak ke liye', gender: 'same' },
  { relation: 'wife', label: 'Wife', helper: 'Biwi ke liye', gender: 'female' },
  { relation: 'husband', label: 'Husband', helper: 'Shohar ke liye', gender: 'male' },
  { relation: 'son', label: 'Son', helper: 'Beta ke liye', gender: 'child' },
  { relation: 'daughter', label: 'Daughter', helper: 'Beti ke liye', gender: 'child' },
  { relation: 'brother', label: 'Brother', helper: 'Bhai ke liye', gender: 'male' },
  { relation: 'sister', label: 'Sister', helper: 'Behen ke liye', gender: 'female' },
  { relation: 'father', label: 'Father', helper: 'Abu ke liye', gender: 'male' },
  { relation: 'mother', label: 'Mother', helper: 'Ammi ke liye', gender: 'female' },
  { relation: 'other', label: 'Other', helper: 'Kisi aur ke liye', gender: 'custom' },
]

export default function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { isOwner } = useAuth()
  const { order } = useOrder(id)
  if (!isOwner) {
    return (
      <AccessNotice
        icon="role"
        title="Owner access required"
        message="Order edit sirf owner kar sakta hai."
      />
    )
  }

  if (!order) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    )
  }

  return <EditOrderForm key={order.id} order={order} />
}

function EditOrderForm({ order }: { order: OrderRecord }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    garmentType: order.garmentType as GarmentType,
    dueDate: order.dueDate,
    totalPrice: String(order.totalPrice || ''),
    isUrgent: order.isUrgent === 1,
    specialInstructions: order.specialInstructions ?? '',
    orderForRelation: (order.orderForRelation ?? 'self') as OrderRecipientRelation,
    orderForName: order.orderForName ?? '',
    recipientGender: (order.recipientGender ?? 'male') as 'male' | 'female' | 'child',
  })

  const handleSave = async () => {
    const totalPrice = Number(form.totalPrice)
    if (!form.dueDate || !Number.isFinite(totalPrice) || totalPrice <= 0) {
      toast.error('Due date aur qeemat zaroori hain.')
      return
    }

    setSaving(true)
    try {
      await orderOps.update(order.id, {
        garmentType: form.garmentType,
        dueDate: form.dueDate,
        totalPrice,
        isUrgent: form.isUrgent ? 1 : 0,
        specialInstructions: form.specialInstructions.trim() || undefined,
        orderForRelation: form.orderForRelation,
        orderForName: form.orderForName?.trim() || undefined,
        recipientGender: form.recipientGender,
      })
      toast.success('Order update ho gaya.')
      router.push(`/orders/${order.id}`)
    } catch (e) {
      toast.error('Order update nahi hua', {
        description: e instanceof Error ? e.message : 'Dobara try karein.',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <header className="sticky top-0 z-20 border-b border-slate-100 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <button
            aria-label="Go back"
            onClick={() => router.back()}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-600"
          >
            <ArrowLeft size={17} />
          </button>
          <div className="min-w-0 text-center">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Edit Order</p>
            <h1 className="truncate text-base font-black text-slate-900">
              #{String(order.orderNumber).padStart(3, '0')} · {order.customerName}
            </h1>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white disabled:bg-slate-300"
          >
            <Save size={15} />
            Save
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-4 pt-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-400">
            Kapra
          </label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {(Object.keys(GARMENT_LABELS) as GarmentType[]).map(type => {
              const cfg = GARMENT_LABELS[type]
              const selected = form.garmentType === type
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, garmentType: type }))}
                  className={cn(
                    'rounded-xl border px-3 py-2 text-left text-xs font-bold',
                    selected
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-200 bg-white text-slate-600'
                  )}
                >
                  {cfg.emoji} {cfg.label}
                </button>
              )
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <label className="mb-3 block text-xs font-bold uppercase tracking-wide text-slate-400">
            Order For
          </label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {RECIPIENT_OPTIONS.map(option => {
              const selected = form.orderForRelation === option.relation
              return (
                <button
                  key={option.relation}
                  type="button"
                  onClick={() => {
                    const gender = option.gender === 'same'
                      ? (order.recipientGender ?? 'male')
                      : option.gender === 'custom'
                        ? form.recipientGender
                        : option.gender
                    setForm(f => ({
                      ...f,
                      orderForRelation: option.relation,
                      recipientGender: gender as 'male' | 'female' | 'child',
                      orderForName: option.relation === 'self' ? '' : f.orderForName,
                    }))
                  }}
                  className={cn(
                    'rounded-xl border px-3 py-2 text-left text-xs font-bold',
                    selected
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-200 bg-white text-slate-600'
                  )}
                >
                  <UsersRound size={14} className="mb-1 inline-block" />
                  {' '}{option.label}
                </button>
              )
            })}
          </div>

          {relationNeedsName(form.orderForRelation) && (
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
                <input
                  type="text"
                  value={form.orderForName}
                  onChange={e => setForm(f => ({ ...f, orderForName: e.target.value }))}
                  placeholder={form.orderForRelation === 'other' ? 'Relation / Name' : 'Naam (optional)'}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-blue-500"
                />
                <div className="flex gap-2">
                  {(['male', 'female', 'child'] as const).map(g => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, recipientGender: g }))}
                      className={cn(
                        'rounded-xl border px-3 py-2 text-xs font-bold capitalize',
                        form.recipientGender === g
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-slate-200 bg-white text-slate-500'
                      )}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-400">
              Due Date
            </label>
            <input
              type="date"
              value={form.dueDate}
              onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-400">
              Kul Qeemat
            </label>
            <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 focus-within:border-blue-500">
              <span className="mr-2 text-sm font-bold text-slate-400">Rs.</span>
              <input
                type="number"
                inputMode="numeric"
                value={form.totalPrice}
                onChange={e => setForm(f => ({ ...f, totalPrice: e.target.value.replace(/\D/g, '') }))}
                className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none"
              />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <label className="flex items-center justify-between gap-3">
            <span>
              <span className="block text-sm font-bold text-slate-800">Urgent order</span>
              <span className="text-xs text-slate-400">Dashboard aur list mein urgent mark dikhega.</span>
            </span>
            <input
              type="checkbox"
              checked={form.isUrgent}
              onChange={e => setForm(f => ({ ...f, isUrgent: e.target.checked }))}
              className="h-5 w-5 accent-blue-600"
            />
          </label>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-400">
            Style / Note
          </label>
          <textarea
            value={form.specialInstructions}
            onChange={e => setForm(f => ({ ...f, specialInstructions: e.target.value }))}
            rows={6}
            className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-blue-500"
            placeholder="Style: Collar: Chinese | Cuff: Round&#10;&#10;Note yahan likhein..."
          />
        </section>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full rounded-2xl bg-blue-600 py-4 text-sm font-black text-white disabled:bg-slate-300"
        >
          {saving ? 'Save ho raha hai...' : 'Changes Save Karein'}
        </button>
      </main>
    </div>
  )
}
