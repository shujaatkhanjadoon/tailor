// src/hooks/useNotifications.ts
import { useState, useEffect, useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db/schema'
import { notifPermission, NotifPermission } from '@/lib/notifications/permission'
import { notifScheduler, notifSettings, NotifSettings } from '@/lib/notifications/scheduler'
import { useAuth } from '@/lib/auth/AuthContext'

export function useNotifications() {
  const { shopId }  = useAuth()
  const [permission, setPermission] = useState<NotifPermission>('default')
  const [settings,   setSettings]   = useState<NotifSettings>(notifSettings.get())
  const [testing,    setTesting]    = useState(false)

  // Init permission state
  useEffect(() => {
    setPermission(notifPermission.current())
  }, [])

  // Run scheduler on mount
  useEffect(() => {
    if (!shopId) return
    notifScheduler.run(shopId)
    const cancel = notifScheduler.scheduleDaily(shopId)
    return cancel
  }, [shopId])

  const requestPermission = useCallback(async () => {
    const result = await notifPermission.request()
    setPermission(result)
    return result
  }, [])

  const updateSetting = useCallback((key: keyof NotifSettings, value: boolean | string) => {
    const updated = { ...settings, [key]: value }
    setSettings(updated)
    notifSettings.save(updated)
  }, [settings])

  const testNotification = useCallback(async () => {
    setTesting(true)
    await notifScheduler.test()
    setTimeout(() => setTesting(false), 2000)
  }, [])

  return {
    permission,
    isGranted:   permission === 'granted',
    isDenied:    permission === 'denied',
    isSupported: notifPermission.isSupported(),
    settings,
    updateSetting,
    requestPermission,
    testNotification,
    testing,
  }
}

// Hook for the notification bell — counts upcoming/overdue orders
export function useNotificationCount(shopId: string | null) {
  const today    = new Date().toISOString().split('T')[0]
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]

  const count = useLiveQuery(
    async (): Promise<number> => {
      if (!shopId) return 0
      const urgent = await db.orders
        .where('shopId').equals(shopId)
        .filter(o =>
          o._deleted === 0 &&
          !['delivered', 'cancelled'].includes(o.status) &&
          (o.dueDate <= tomorrow)   // overdue + today + tomorrow
        )
        .count()
      return urgent
    },
    [shopId, today],
    0
  )

  return count ?? 0
}