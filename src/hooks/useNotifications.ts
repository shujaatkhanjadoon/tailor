// src/hooks/useNotifications.ts
import { useState, useEffect, useCallback } from 'react'
import { notifPermission, NotifPermission } from '@/lib/notifications/permission'
import { notifScheduler, notifSettings, NotifSettings } from '@/lib/notifications/scheduler'
import { useAuth } from '@/lib/auth/AuthContext'
import { supabase } from '@/lib/supabase/client'
import { karachiDateString } from '@/lib/time'

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
    if (result === 'granted' && shopId) {
      notifScheduler.run(shopId)
    }
    return result
  }, [shopId])

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
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!shopId) return
    const tomorrowDate = new Date()
    tomorrowDate.setDate(tomorrowDate.getDate() + 1)
    const tomorrow = karachiDateString(tomorrowDate)
    const load = async () => {
      const { count: total } = await (supabase as any)
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('shop_id', shopId)
        .is('deleted_at', null)
        .lte('due_date', tomorrow)
        .not('status', 'in', '("delivered","cancelled")')
      setCount(total ?? 0)
    }
    load()
    const channel = supabase
      .channel(`notification-count-${shopId}-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `shop_id=eq.${shopId}` }, load)
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [shopId])
  return count
}
