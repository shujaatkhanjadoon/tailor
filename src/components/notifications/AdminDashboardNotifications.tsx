'use client'

import { useEffect, useState } from 'react'
import { Bell, Eye, EyeOff } from 'lucide-react'
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

  useEffect(() => {
    if (!shopId) return
    setShowNotifications(localStorage.getItem(visibleKey(shopId)) !== 'false')

    const load = async () => {
      const res = await fetch(`/api/notifications?shopId=${encodeURIComponent(shopId)}`, { cache: 'no-store' })
      const json = await res.json()
      if (res.ok) {
        const nextNotifications = json.data ?? []
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

  const visible = notifications.filter(item => new Date(item.expires_at) > new Date())

  const toggleVisible = () => {
    const next = !showNotifications
    setShowNotifications(next)
    localStorage.setItem(visibleKey(shopId), String(next))
  }

  const styles = {
    info: 'border-blue-200 bg-blue-50 text-blue-700',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    warning: 'border-amber-200 bg-amber-50 text-amber-700',
    urgent: 'border-red-200 bg-red-50 text-red-700',
  } as const

  if (!showNotifications) {
    return (
      <button
        onClick={toggleVisible}
        className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left"
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
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-bold text-slate-700">
          <Bell size={16} className="text-blue-600" />
          Admin Updates ({visible.length})
        </p>
        <button
          onClick={toggleVisible}
          className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-bold text-slate-500"
        >
          <EyeOff size={12} />
          Hide
        </button>
      </div>
      {visible.map((item, index) => (
        <div
          key={item.id}
          className={cn(
            'overflow-hidden rounded-2xl border p-4 shadow-sm',
            styles[item.type ?? 'info'],
            index > 0 && 'bg-opacity-70'
          )}
        >
          <div>
            <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
              <p className="font-bold text-slate-900">{item.title}</p>
              <span className="rounded-full bg-white/70 px-2 py-1 text-[10px] font-bold uppercase">
                {item.type ?? 'info'}
              </span>
            </div>
            <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-600">
              {item.message}
            </p>
            <p className="mt-3 text-[11px] font-medium text-slate-400">
              Visible until {formatKarachiDateTime(item.expires_at, { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          </div>
        </div>
      ))}
    </section>
  )
}
