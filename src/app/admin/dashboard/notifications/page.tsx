'use client'

import { useEffect, useMemo, useState } from 'react'
import { Bell, CalendarClock, Edit2, Loader2, MessageCircle, Save, Send, Trash2, Users, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatKarachiDateTime, formatKarachiDateTimeInput } from '@/lib/time'

type TargetPlan = 'all' | 'starter' | 'professional' | 'business'
type NotificationType = 'info' | 'success' | 'warning' | 'urgent'
type NotificationRow = {
  id: string
  title: string
  message: string
  type?: NotificationType
  target_plan: TargetPlan
  expires_at: string
  created_at: string
}

const TARGETS: { key: TargetPlan; label: string }[] = [
  { key: 'all', label: 'All users' },
  { key: 'starter', label: 'Starter' },
  { key: 'professional', label: 'Professional' },
  { key: 'business', label: 'Business' },
]

const DURATIONS = [
  { label: '1 hour', hours: 1 },
  { label: '24 hours', hours: 24 },
  { label: '7 days', hours: 24 * 7 },
  { label: 'Custom', hours: 0 },
]

const TYPES: { key: NotificationType; label: string; className: string }[] = [
  { key: 'info', label: 'Info', className: 'border-blue-500 bg-blue-600 text-white' },
  { key: 'success', label: 'Success', className: 'border-emerald-500 bg-emerald-600 text-white' },
  { key: 'warning', label: 'Warning', className: 'border-amber-500 bg-amber-500 text-slate-950' },
  { key: 'urgent', label: 'Urgent', className: 'border-red-500 bg-red-600 text-white' },
]

const typeBadge: Record<NotificationType, string> = {
  info: 'bg-blue-500/10 text-blue-300',
  success: 'bg-emerald-500/10 text-emerald-300',
  warning: 'bg-amber-500/10 text-amber-300',
  urgent: 'bg-red-500/10 text-red-300',
}

function expiryFromHours(hours: number) {
  return formatKarachiDateTimeInput(new Date(Date.now() + hours * 60 * 60 * 1000))
}

export default function AdminNotificationsPage() {
  const [targetPlan, setTargetPlan] = useState<TargetPlan>('all')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [type, setType] = useState<NotificationType>('info')
  const [durationHours, setDurationHours] = useState(24)
  const [customExpiry, setCustomExpiry] = useState(expiryFromHours(24))
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<NotificationRow[]>([])
  const [waLinks, setWaLinks] = useState<{ shopName: string; phone: string; url: string }[]>([])
  const [editing, setEditing] = useState<NotificationRow | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const expiresAt = useMemo(
    () => durationHours > 0 ? expiryFromHours(durationHours) : customExpiry,
    [customExpiry, durationHours]
  )

  const load = async () => {
    setLoading(true)
    const res = await fetch('/api/admin/notifications', { cache: 'no-store' })
    const json = await res.json()
    if (res.ok) setRows(json.data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const sendNotification = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetPlan,
          title,
          message,
          type,
          expiresAt: new Date(expiresAt).toISOString(),
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Notification failed')
      setTitle('')
      setMessage('')
      setType('info')
      await load()
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (row: NotificationRow) => {
    setEditing(row)
    setTargetPlan(row.target_plan)
    setTitle(row.title)
    setMessage(row.message)
    setType(row.type ?? 'info')
    setDurationHours(0)
    setCustomExpiry(formatKarachiDateTimeInput(new Date(row.expires_at)))
  }

  const cancelEdit = () => {
    setEditing(null)
    setTitle('')
    setMessage('')
    setType('info')
    setDurationHours(24)
    setCustomExpiry(expiryFromHours(24))
  }

  const updateNotification = async () => {
    if (!editing) return
    setSaving(true)
    try {
      const res = await fetch('/api/admin/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editing.id,
          targetPlan,
          title,
          message,
          type,
          expiresAt: new Date(expiresAt).toISOString(),
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Update failed')
      cancelEdit()
      await load()
    } finally {
      setSaving(false)
    }
  }

  const deleteNotification = async (id: string) => {
    if (!confirm('Delete this notification?')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/admin/notifications?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Delete failed')
      if (editing?.id === id) cancelEdit()
      await load()
    } finally {
      setDeletingId(null)
    }
  }

  const loadWhatsAppLinks = async () => {
    const res = await fetch('/api/admin/notifications/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetPlan, message: `${title}\n\n${message}`.trim() }),
    })
    const json = await res.json()
    if (res.ok) setWaLinks(json.data ?? [])
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Notifications</h1>
        <p className="mt-1 text-sm text-slate-400">Send dashboard announcements and prepare WhatsApp bulk messages.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-2">
            <Bell size={18} className="text-blue-400" />
            <h2 className="font-bold text-white">Create Notification</h2>
          </div>

          <div className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Audience</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {TARGETS.map(target => (
                  <button
                    key={target.key}
                    onClick={() => setTargetPlan(target.key)}
                    className={cn(
                      'rounded-xl border px-3 py-2 text-xs font-bold transition-colors',
                      targetPlan === target.key
                        ? 'border-blue-500 bg-blue-600 text-white'
                        : 'border-slate-700 bg-slate-950 text-slate-400 hover:text-white'
                    )}
                  >
                    {target.label}
                  </button>
                ))}
              </div>
            </div>

            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Notification title"
              className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-semibold text-white outline-none focus:border-blue-500"
            />

            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Write the message shops should see on their dashboard..."
              rows={5}
              className="w-full resize-none rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-blue-500"
            />

            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Type</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {TYPES.map(item => (
                  <button
                    key={item.key}
                    onClick={() => setType(item.key)}
                    className={cn(
                      'rounded-xl border px-3 py-2 text-xs font-bold transition-colors',
                      type === item.key
                        ? item.className
                        : 'border-slate-700 bg-slate-950 text-slate-400 hover:text-white'
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Visible For</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {DURATIONS.map(d => (
                  <button
                    key={d.label}
                    onClick={() => {
                      setDurationHours(d.hours)
                      if (d.hours > 0) setCustomExpiry(expiryFromHours(d.hours))
                    }}
                    className={cn(
                      'rounded-xl border px-3 py-2 text-xs font-bold transition-colors',
                      durationHours === d.hours
                        ? 'border-emerald-500 bg-emerald-600 text-white'
                        : 'border-slate-700 bg-slate-950 text-slate-400 hover:text-white'
                    )}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
              {durationHours === 0 && (
                <input
                  type="datetime-local"
                  value={customExpiry}
                  onChange={e => setCustomExpiry(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                />
              )}
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <button
                onClick={editing ? updateNotification : sendNotification}
                disabled={saving || !title.trim() || !message.trim()}
                className="flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-bold text-white disabled:bg-slate-700 disabled:text-slate-400"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : editing ? <Save size={16} /> : <Send size={16} />}
                {editing ? 'Update Notification' : 'Send Dashboard Notification'}
              </button>
              <button
                onClick={loadWhatsAppLinks}
                disabled={!message.trim()}
                className="flex items-center justify-center gap-2 rounded-2xl border border-green-600 bg-green-600/10 px-4 py-3 text-sm font-bold text-green-300 disabled:border-slate-700 disabled:text-slate-500"
              >
                <MessageCircle size={16} />
                Bulk WhatsApp
              </button>
            </div>
            {editing && (
              <button
                onClick={cancelEdit}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-700 px-4 py-3 text-sm font-bold text-slate-300 hover:bg-slate-800"
              >
                <X size={16} />
                Cancel Edit
              </button>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-2">
            <CalendarClock size={18} className="text-emerald-400" />
            <h2 className="font-bold text-white">Active Notifications</h2>
          </div>
          {loading ? (
            <div className="py-12 text-center text-slate-500">Loading...</div>
          ) : rows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-500">
              No active notifications.
            </div>
          ) : (
            <div className="space-y-3">
              {rows.map(row => (
                <div key={row.id} className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-white">{row.title}</p>
                      <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-400">{row.message}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-blue-500/10 px-2 py-1 text-[10px] font-bold uppercase text-blue-300">
                      {row.target_plan}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                      <span className={cn('rounded-full px-2 py-1 font-bold uppercase', typeBadge[row.type ?? 'info'])}>
                        {row.type ?? 'info'}
                      </span>
                      <span>Expires {formatKarachiDateTime(row.expires_at, { dateStyle: 'medium', timeStyle: 'short' })}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => startEdit(row)}
                        className="flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-bold text-slate-300 hover:border-blue-500 hover:text-blue-300"
                      >
                        <Edit2 size={13} />
                        Edit
                      </button>
                      <button
                        onClick={() => deleteNotification(row.id)}
                        disabled={deletingId === row.id}
                        className="flex items-center gap-1 rounded-lg border border-red-900/80 px-2.5 py-1.5 text-xs font-bold text-red-300 hover:border-red-500 disabled:opacity-60"
                      >
                        {deletingId === row.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {waLinks.length > 0 && (
        <section className="rounded-2xl border border-green-900 bg-green-950/40 p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <Users size={18} className="text-green-300" />
            <h2 className="font-bold text-white">WhatsApp Recipients ({waLinks.length})</h2>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {waLinks.map(link => (
              <a
                key={`${link.phone}-${link.shopName}`}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl border border-green-900 bg-slate-950 px-3 py-2 text-sm font-semibold text-green-200 hover:border-green-500"
              >
                {link.shopName}
                <span className="block text-[11px] font-medium text-green-500">{link.phone}</span>
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
