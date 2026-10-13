// NORTH V1.3.2 — service worker para arquivos todos na raiz.
const CACHE_NAME = 'north-v1-shell-1.3.2-flat';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './sw.js',
  './app.js',
  './navigation.js',
  './settings.js',
  './wallet.js',
  './tasks.js',
  './rewards.js',
  './usage-control.js',
  './focus.js',
  './habits.js',
  './storage.js',
  './backup.js',
  './sync.js',
  './notifications.js',
  './tokens.css',
  './components.css',
  './layout.css',
  './north-icon-192.png',
  './north-icon-512.png',
  './north-icon-maskable.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key.startsWith('north-v1-shell-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request).then((response) => {
        if (response.ok) {
          caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
        }
        return response;
      }).catch(() => cached || caches.match('./index.html'));
      return cached || network;
    })
  );
});
