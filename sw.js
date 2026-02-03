const CACHE_NAME = 'mathbooster-v1';
const ASSETS = [
  './',
  './index.html',
  './logo.png',
  './icon-192.png',
  './icon-512.png'
];

// Установка: кешируем ресурсы
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

// Работа: берем из кеша, если нет — идем в сеть
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => res || fetch(e.request))
  );
});