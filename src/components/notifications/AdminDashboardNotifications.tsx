'use client'

import { useEffect, useState } from 'react'
import { Bell, Eye, EyeOff, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type AdminNotification = {
  id: string
  title: string
  message: string
  target_plan: string
  expires_at: string
}

const dismissedKey = (shopId: string) => `md_admin_notifications_dismissed_${shopId}`
const visibleKey = (shopId: string) => `md_admin_notifications_visible_${shopId}`

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
  const [dismissed, setDismissed] = useState<string[]>([])

  useEffect(() => {
    if (!shopId) return
    setShowNotifications(localStorage.getItem(visibleKey(shopId)) !== 'false')
    setDismissed(readJson<string[]>(dismissedKey(shopId), []))

    const load = async () => {
      const res = await fetch(`/api/notifications?shopId=${encodeURIComponent(shopId)}`, { cache: 'no-store' })
      const json = await res.json()
      if (res.ok) setNotifications(json.data ?? [])
    }
    load()
  }, [shopId])

  if (!shopId) return null

  const visible = notifications.filter(item =>
    !dismissed.includes(item.id) && new Date(item.expires_at) > new Date()
  )

  const toggleVisible = () => {
    const next = !showNotifications
    setShowNotifications(next)
    localStorage.setItem(visibleKey(shopId), String(next))
  }

  const dismiss = (id: string) => {
    const next = [...dismissed, id]
    setDismissed(next)
    localStorage.setItem(dismissedKey(shopId), JSON.stringify(next))
  }

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
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-bold text-slate-700">
          <Bell size={16} className="text-blue-600" />
          Admin Updates
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
            'relative overflow-hidden rounded-2xl border p-4 shadow-sm',
            index === 0
              ? 'border-blue-200 bg-blue-50'
              : 'border-slate-200 bg-white'
          )}
        >
          <button
            aria-label="Dismiss notification"
            onClick={() => dismiss(item.id)}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-slate-500"
          >
            <X size={14} />
          </button>
          <div className="pr-9">
            <p className="font-bold text-slate-900">{item.title}</p>
            <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-600">
              {item.message}
            </p>
            <p className="mt-3 text-[11px] font-medium text-slate-400">
              Visible until {new Date(item.expires_at).toLocaleString('en-PK')}
            </p>
          </div>
        </div>
      ))}
    </section>
  )
}
