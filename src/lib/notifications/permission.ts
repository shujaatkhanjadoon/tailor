// src/lib/notifications/permission.ts

export type NotifPermission = 'granted' | 'denied' | 'default' | 'unsupported'

export const notifPermission = {
  // Check current state
  current(): NotifPermission {
    if (typeof window === 'undefined') return 'unsupported'
    if (!('Notification' in window))   return 'unsupported'
    return Notification.permission as NotifPermission
  },

  isSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window
  },

  // Request permission — returns final state
  async request(): Promise<NotifPermission> {
    if (!notifPermission.isSupported()) return 'unsupported'
    if (Notification.permission === 'granted') return 'granted'
    if (Notification.permission === 'denied')  return 'denied'
    try {
      const result = await Notification.requestPermission()
      return result as NotifPermission
    } catch {
      return 'denied'
    }
  },

  // Fire a simple notification immediately (for testing)
  fire(title: string, body: string, tag?: string) {
    if (Notification.permission !== 'granted') return
    const n = new Notification(title, {
      body,
      icon:  '/icons/icon-192.png',
      badge: '/icons/icon-96.png',
      tag:   tag ?? 'darzi-general',
      silent: false,
    })
    n.onclick = () => { window.focus(); n.close() }
  },
}