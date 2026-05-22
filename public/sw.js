self.addEventListener('install', event => {
  event.waitUntil(
    caches.open('meradarzi-shell-v1').then(cache =>
      cache.addAll(['/', '/manifest.json']).catch(() => undefined)
    )
  )
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return
  event.respondWith(
    fetch(event.request).catch(async () => {
      const cached = await caches.match(event.request)
      if (cached) return cached
      if (event.request.mode === 'navigate') return caches.match('/')
      return Response.error()
    })
  )
})

self.addEventListener('push', event => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = { body: event.data?.text() }
  }

  const title = payload.title || 'MeraDarzi'
  const options = {
    body: payload.body || 'Nayi notification',
    icon: payload.icon || '/icon-192.png',
    badge: payload.badge || '/icon-96.png',
    tag: payload.tag || 'meradarzi-push',
    data: payload.data || { url: '/' },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      const existing = clients.find(client => client.url.includes(self.location.origin))
      if (existing) {
        existing.focus()
        existing.navigate(targetUrl)
        return
      }
      return self.clients.openWindow(targetUrl)
    })
  )
})
