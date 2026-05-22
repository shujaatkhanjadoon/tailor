export type PushSubscriptionPayload = {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

function urlBase64ToUint8Array(value: string) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)))
}

export async function ensureServiceWorkerRegistration() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null
  return navigator.serviceWorker.register('/sw.js')
}

export async function subscribeToPush(shopId: string, memberId?: string) {
  if (!('PushManager' in window)) return { ok: false, reason: 'unsupported' as const }
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!publicKey) return { ok: false, reason: 'missing_key' as const }

  const registration = await ensureServiceWorkerRegistration()
  if (!registration) return { ok: false, reason: 'unsupported' as const }

  const existing = await registration.pushManager.getSubscription()
  const subscription = existing ?? await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  })

  const payload = subscription.toJSON() as PushSubscriptionPayload
  const res = await fetch('/api/push/subscriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ shopId, memberId, subscription: payload }),
  })

  if (!res.ok) return { ok: false, reason: 'save_failed' as const }
  return { ok: true as const }
}
