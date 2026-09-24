// EduAI2 service worker — handles Web Push notifications.
// No caching strategy: assets are served directly from Cloudflare CDN.
const CACHE_NAME = 'eduai2-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
  ).then(() => self.clients.claim())
));

// Push notification handler
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data?.json() ?? {}; } catch { data = { title: '學習提醒', body: event.data?.text() ?? '' }; }
  const title = data.title || '學習提醒｜公民法律研究室';
  const options = {
    body: data.body || '',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    tag: data.tag || 'study-reminder',
    data: data.url ? { url: data.url } : {},
    requireInteraction: false
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification click: focus or open the relevant page
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/planner/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      const match = windowClients.find(c => c.url.includes(url));
      return match ? match.focus() : clients.openWindow(url);
    })
  );
});
