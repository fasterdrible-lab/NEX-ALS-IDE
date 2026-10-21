// Service worker do Zeus Mobile: permite instalar na tela inicial. Não guarda dados em cache —
// tudo vem ao vivo do serviço (o app só funciona com o Tailscale ligado). As notificações push entram aqui depois.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))
self.addEventListener('fetch', () => { /* rede direto */ })
