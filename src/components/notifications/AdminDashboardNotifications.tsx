'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Bell, CheckCircle2, Eye, EyeOff, Info, Megaphone, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatKarachiDateTime } from '@/lib/time'

type AdminNotification = {
  id: string
  title: string
  message: string
  type?: 'info' | 'success' | 'warning' | 'urgent'
  target_plan: string
  expires_at: string
}

const visibleKey = (shopId: string) => `md_admin_notifications_visible_${shopId}`
const seenKey = (shopId: string) => `md_admin_notifications_seen_${shopId}`
const dismissedKey = (shopId: string) => `md_admin_notifications_dismissed_${shopId}`

function readJson<T>(key: string, fallback: T): T {
  if (typeof localStorage === 'undefined') return fallback
  try {
    return JSON.parse(localStorage.getItem(key) || '') as T
  } catch {
    return fallback
  }
}

export function AdminDashboardNotifications({ shopId }: { shopId: string | null }) {
  const [notifications, setNotifications] = useState<AdminNotification[]>([])
  const [showNotifications, setShowNotifications] = useState(true)
  const [dismissedIds, setDismissedIds] = useState<string[]>([])

  useEffect(() => {
    if (!shopId) return
    setShowNotifications(localStorage.getItem(visibleKey(shopId)) !== 'false')
    setDismissedIds(readJson<string[]>(dismissedKey(shopId), []))

    const load = async () => {
      const res = await fetch(`/api/notifications?shopId=${encodeURIComponent(shopId)}`, { cache: 'no-store' })
      const json = await res.json()
      if (res.ok) {
        const nextNotifications = json.data ?? []
        const dismissed = readJson<string[]>(dismissedKey(shopId), [])
        setDismissedIds(dismissed)
        setNotifications(nextNotifications)
        const nextIds = nextNotifications.map((item: AdminNotification) => item.id)
        const hadNew = nextIds.some((id: string) => !readJson<string[]>(seenKey(shopId), []).includes(id))
        if (hadNew) {
          setShowNotifications(true)
          localStorage.setItem(visibleKey(shopId), 'true')
          localStorage.setItem(seenKey(shopId), JSON.stringify(nextIds))
        }
      }
    }
    load()
    const interval = window.setInterval(load, 60_000)
    return () => window.clearInterval(interval)
  }, [shopId])

  if (!shopId) return null

  const visible = notifications.filter(item => new Date(item.expires_at) > new Date() && !dismissedIds.includes(item.id))

  const toggleVisible = () => {
    const next = !showNotifications
    setShowNotifications(next)
    localStorage.setItem(visibleKey(shopId), String(next))
  }

  const dismissNotification = (id: string) => {
    const next = [...new Set([...dismissedIds, id])]
    setDismissedIds(next)
    localStorage.setItem(dismissedKey(shopId), JSON.stringify(next))
  }

  const styles = {
    info: {
      icon: Info,
      accent: 'bg-blue-600',
      badge: 'bg-blue-50 text-blue-700 ring-blue-100',
      iconBox: 'bg-blue-50 text-blue-700',
    },
    success: {
      icon: CheckCircle2,
      accent: 'bg-emerald-600',
      badge: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
      iconBox: 'bg-emerald-50 text-emerald-700',
    },
    warning: {
      icon: AlertTriangle,
      accent: 'bg-amber-500',
      badge: 'bg-amber-50 text-amber-700 ring-amber-100',
      iconBox: 'bg-amber-50 text-amber-700',
    },
    urgent: {
      icon: Megaphone,
      accent: 'bg-red-600',
      badge: 'bg-red-50 text-red-700 ring-red-100',
      iconBox: 'bg-red-50 text-red-700',
    },
  } as const

  if (!showNotifications) {
    return (
      <button
        onClick={toggleVisible}
        className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-600">
          <Eye size={16} className="text-blue-600" />
          Admin notifications hidden
        </span>
        <span className="text-xs font-bold text-blue-600">Show</span>
      </button>
    )
  }

  if (visible.length === 0) return null

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="flex items-center gap-2 text-sm font-bold text-slate-800">
            <Bell size={16} className="text-blue-600" />
            Admin Updates
          </p>
          <p className="mt-0.5 text-xs text-slate-400">{visible.length} active message{visible.length === 1 ? '' : 's'}</p>
        </div>
        <button
          onClick={toggleVisible}
          className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-bold text-slate-500 hover:bg-slate-200"
        >
          <EyeOff size={12} />
          Hide
        </button>
      </div>
      <div className="mt-3 space-y-2.5">
      {visible.map((item) => {
        const style = styles[item.type ?? 'info']
        const Icon = style.icon
        return (
        <div
          key={item.id}
          className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-xs"
        >
          <span className={cn('absolute inset-y-0 left-0 w-1', style.accent)} />
          <div className="flex items-start gap-3 pl-1">
            <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl', style.iconBox)}>
              <Icon size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-1.5 flex items-start justify-between gap-3">
                <p className="font-bold leading-snug text-slate-900">{item.title}</p>
                <button
                  type="button"
                  aria-label={`Dismiss ${item.title}`}
                  title="Dismiss notification"
                  onClick={() => dismissNotification(item.id)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <X size={16} />
                </button>
              </div>
              <span className={cn('inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ring-1', style.badge)}>
                {item.type ?? 'info'}
              </span>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-600">
                {item.message}
              </p>
              <p className="mt-3 text-[11px] font-medium text-slate-400">
                Visible until {formatKarachiDateTime(item.expires_at, { dateStyle: 'medium', timeStyle: 'short' })}
              </p>
            </div>
          </div>
        </div>
      )})}
      </div>
    </section>
  )
}
