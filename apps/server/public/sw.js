// Service worker do Zeus Mobile: permite instalar na tela inicial e recebe as notificações (Web Push).
// Não guarda dados em cache — tudo vem ao vivo do serviço (o app só abre com o Tailscale ligado).
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))
self.addEventListener('fetch', () => { /* rede direto */ })

// Aviso do serviço: { title, body, url, tag }. O texto é curto de propósito (sem comandos).
self.addEventListener('push', e => {
  let d = {}
  try { d = e.data ? e.data.json() : {} } catch { d = { title: 'Zeus', body: e.data ? e.data.text() : '' } }
  e.waitUntil(self.registration.showNotification(d.title || 'Zeus', {
    body: d.body || '',
    tag: d.tag || undefined,
    renotify: !!d.tag,
    icon: '/icon-256.png',
    badge: '/icon-256.png',
    data: { url: d.url || '/' },
  }))
})

// Tocar na notificação: abre o app (ou traz o que já está aberto) direto no projeto.
self.addEventListener('notificationclick', e => {
  e.notification.close()
  const url = new URL(e.notification.data?.url || '/', self.location.origin).href
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const w of wins) {
      if (new URL(w.url).origin === self.location.origin) {
        await w.focus()
        w.postMessage({ type: 'open', url })
        return
      }
    }
    await self.clients.openWindow(url)
  })())
})
