/* global caches, clients, self */

const CACHE_NAME = 'bmad-shell-v1';
const PRECACHE_URLS = ['/', '/manifest.webmanifest', '/offline/shell-fallback.html'];
const API_PATH_PREFIX = '/api/';

function shouldBypassCache(request) {
  const url = new URL(request.url);

  return url.pathname.startsWith(API_PATH_PREFIX);
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  if (shouldBypassCache(request)) {
    event.respondWith(fetch(request));
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(request)
        .then((response) => {
          if (response.ok && new URL(request.url).origin === self.location.origin) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }

          return response;
        })
        .catch(() => caches.match('/offline/shell-fallback.html'));
    }),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
