/* MathBooster PRO — Service Worker
   Регистрируется из index.html: navigator.serviceWorker.register('sw.js?v=2')
   Задачи:
   1. Кэшировать оболочку приложения (иконки, логотипы, манифест), чтобы PWA
      запускалась мгновенно и не мигала белым экраном.
   2. Показывать уведомления через reg.showNotification() (это использует Notify.send).

   ВАЖНО: приложение работает строго онлайн (см. App.init), поэтому index.html
   и запросы к Firebase НЕ кэшируются — иначе пользователь увидел бы устаревшие
   данные вместо актуальных из облака.
*/

const CACHE_NAME = 'mathbooster-shell-v2';

// Только статика, которая не меняется от пользователя к пользователю.
const SHELL_ASSETS = [
    'manifest.json',
    'icon-192.png',
    'icon-512.png',
    'logo.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            // addAll падает целиком, если хоть один файл недоступен,
            // поэтому кэшируем каждый файл независимо.
            .then((cache) => Promise.all(
                SHELL_ASSETS.map((url) => cache.add(url).catch(() => null))
            ))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;

    // Не вмешиваемся ни во что, кроме обычных GET-запросов за статикой.
    if (req.method !== 'GET') return;

    const url = new URL(req.url);

    // Чужие домены (Firebase, Chart.js, радио-потоки, Яндекс.Метрика) — только сеть.
    if (url.origin !== self.location.origin) return;

    // HTML всегда берём из сети: приложение онлайн-only.
    if (req.mode === 'navigate' || req.destination === 'document') return;

    // Картинки и манифест: сначала кэш, потом сеть (cache-first).
    event.respondWith(
        caches.match(req).then((cached) => {
            if (cached) return cached;
            return fetch(req).then((res) => {
                // Кэшируем только успешные ответы своего origin.
                if (res && res.ok && res.type === 'basic') {
                    const copy = res.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
                }
                return res;
            });
        })
    );
});

// Клик по уведомлению — открываем/фокусируем приложение.
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                for (const client of clientList) {
                    if ('focus' in client) return client.focus();
                }
                return self.clients.openWindow('./');
            })
    );
});
