'use client'

import { useEffect, useMemo, useState } from 'react'
import { Bell, CalendarClock, Loader2, MessageCircle, Send, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

type TargetPlan = 'all' | 'starter' | 'professional' | 'business'
type NotificationRow = {
  id: string
  title: string
  message: string
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

function expiryFromHours(hours: number) {
  const d = new Date()
  d.setHours(d.getHours() + hours)
  return d.toISOString().slice(0, 16)
}

export default function AdminNotificationsPage() {
  const [targetPlan, setTargetPlan] = useState<TargetPlan>('all')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [durationHours, setDurationHours] = useState(24)
  const [customExpiry, setCustomExpiry] = useState(expiryFromHours(24))
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<NotificationRow[]>([])
  const [waLinks, setWaLinks] = useState<{ shopName: string; phone: string; url: string }[]>([])

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
          expiresAt: new Date(expiresAt).toISOString(),
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Notification failed')
      setTitle('')
      setMessage('')
      await load()
    } finally {
      setSaving(false)
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
    <div className="mx-auto w-full max-w-screen-xl space-y-5">
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
                onClick={sendNotification}
                disabled={saving || !title.trim() || !message.trim()}
                className="flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-bold text-white disabled:bg-slate-700 disabled:text-slate-400"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                Send Dashboard Notification
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
                  <p className="mt-3 text-[11px] text-slate-500">
                    Expires {new Date(row.expires_at).toLocaleString('en-PK')}
                  </p>
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
