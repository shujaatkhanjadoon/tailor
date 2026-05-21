// src/lib/notifications/scheduler.ts
import { notifPermission } from './permission'
import { supabase } from '@/lib/supabase/client'

// Keys for localStorage settings
const SETTINGS_KEY = 'darzi_notif_settings'
const LAST_RUN_KEY = 'darzi_notif_last_run'

export interface NotifSettings {
  enabled:           boolean
  overdueAlerts:     boolean
  dueTodayAlerts:    boolean
  dueTomorrowAlerts: boolean
  morningTime:       string   // HH:MM â€” e.g. "09:00"
  eveningTime:       string   // HH:MM â€” e.g. "18:00"
}

export const DEFAULT_SETTINGS: NotifSettings = {
  enabled:           true,
  overdueAlerts:     true,
  dueTodayAlerts:    true,
  dueTomorrowAlerts: true,
  morningTime:       '09:00',
  eveningTime:       '18:00',
}

type NotificationOrderRow = {
  order_number: number
  customer_name: string
  due_date: string
  status: string
}

export const notifSettings = {
  get(): NotifSettings {
    if (typeof window === 'undefined') return DEFAULT_SETTINGS
    try {
      const raw = localStorage.getItem(SETTINGS_KEY)
      return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS
    } catch {
      return DEFAULT_SETTINGS
    }
  },

  save(settings: Partial<NotifSettings>) {
    const current = notifSettings.get()
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...current, ...settings }))
  },
}

// â”€â”€ Main scheduler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const notifScheduler = {

  // Called once on app load â€” checks if we should fire notifications
  async run(shopId: string) {
    if (typeof window === 'undefined') return
    if (notifPermission.current() !== 'granted') return

    const settings = notifSettings.get()
    if (!settings.enabled) return

    // Throttle: don't run more than once per 30 minutes
    const lastRun = localStorage.getItem(LAST_RUN_KEY)
    if (lastRun) {
      const elapsed = Date.now() - parseInt(lastRun)
      if (elapsed < 30 * 60 * 1000) return
    }
    localStorage.setItem(LAST_RUN_KEY, String(Date.now()))

    await notifScheduler.checkOrders(shopId, settings)
  },

  async checkOrders(shopId: string, settings: NotifSettings) {
    const today    = new Date().toISOString().split('T')[0]
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]

    const { data: rows = [] } = await (supabase as any)
      .from('orders')
      .select('order_number,customer_name,due_date,status')
      .eq('shop_id', shopId)
      .is('deleted_at', null)
      .not('status', 'in', '("delivered","cancelled")')
    const activeOrders = rows as NotificationOrderRow[]

    const overdue   = activeOrders.filter(o => o.due_date < today)
    const dueToday  = activeOrders.filter(o => o.due_date === today)
    const dueTomrow = activeOrders.filter(o => o.due_date === tomorrow)

    // â”€â”€ Fire notifications â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    if (settings.overdueAlerts && overdue.length > 0) {
      notifPermission.fire(
        `🔴 ${overdue.length} Order Late Ho ${overdue.length === 1 ? 'Gaya' : 'Gaye'}!`,
        overdue.slice(0, 3).map(o =>
          `#${String(o.order_number).padStart(3,'0')} ${o.customer_name}`
        ).join(', ') + (overdue.length > 3 ? ` aur ${overdue.length - 3} aur` : ''),
        'darzi-overdue'
      )
    }

    if (settings.dueTodayAlerts && dueToday.length > 0) {
      // Small delay so overdue fires first
      setTimeout(() => {
        notifPermission.fire(
          `📅 ${dueToday.length} Order Aaj Due ${dueToday.length === 1 ? 'Hai' : 'Hain'}`,
          dueToday.slice(0, 3).map(o =>
            `#${String(o.order_number).padStart(3,'0')} ${o.customer_name}`
          ).join(', '),
          'darzi-today'
        )
      }, 2000)
    }

    if (settings.dueTomorrowAlerts && dueTomrow.length > 0) {
      setTimeout(() => {
        notifPermission.fire(
          `⏰ Kal ${dueTomrow.length} Order Due ${dueTomrow.length === 1 ? 'Hai' : 'Hain'}`,
          `Abhi tayyar karo: ` + dueTomrow.slice(0, 2).map(o =>
            o.customer_name
          ).join(', '),
          'darzi-tomorrow'
        )
      }, 4000)
    }
  },

  // Schedule for a specific time using setTimeout
  // Returns a cancel function
  scheduleDaily(shopId: string): () => void {
    const settings = notifSettings.get()
    if (!settings.enabled) return () => {}

    const timers: ReturnType<typeof setTimeout>[] = []

    const scheduleForTime = (timeStr: string) => {
      const [h, m]  = timeStr.split(':').map(Number)
      const now     = new Date()
      const target  = new Date()
      target.setHours(h, m, 0, 0)

      // If time already passed today, schedule for tomorrow
      if (target <= now) target.setDate(target.getDate() + 1)

      const delay = target.getTime() - now.getTime()

      const t = setTimeout(async () => {
        await notifScheduler.checkOrders(shopId, notifSettings.get())
        // Reschedule for next day
        scheduleForTime(timeStr)
      }, delay)

      timers.push(t)
    }

    scheduleForTime(settings.morningTime)
    scheduleForTime(settings.eveningTime)

    return () => timers.forEach(clearTimeout)
  },

  // Test notification â€” fire immediately
  async test() {
    if (notifPermission.current() !== 'granted') return false
    notifPermission.fire(
      '✅ MeraDarzi',
      'Notifications kaam kar rahi hain! Aap ko due orders ki yaad dilayi jayegi.',
      'darzi-test'
    )
    return true
  },
}
