const CACHE_NAME = 'verie-pwa-v19';
const APP_SHELL = ['./', './index.html', './manifest.json', './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png'];

// Solo se guardan respuestas válidas: 2xx propias u opacas de terceros (gstatic, scripts no-cors).
function esCacheable(response) {
  return response && (response.ok || response.type === 'opaque');
}

function guardar(request, response) {
  if (!esCacheable(response)) return;
  const copy = response.clone();
  caches.open(CACHE_NAME).then(cache => cache.put(request, copy)).catch(() => {});
}

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const scope = new URL(self.registration.scope);
  const isPage = request.mode === 'navigate' ||
    (url.origin === scope.origin && (url.pathname === scope.pathname || url.pathname.endsWith('/index.html')));

  // Página: primero red (para recibir versiones nuevas), caché si no hay conexión.
  if (isPage) {
    event.respondWith(
      fetch(request)
        .then(response => { guardar(request, response); return response; })
        .catch(() => caches.match(request).then(cached => cached || caches.match('./index.html')))
    );
    return;
  }

  // Recursos: primero caché. Si fallan, se propaga el error (nunca se devuelve HTML en lugar de un script o imagen).
  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(response => { guardar(request, response); return response; }))
  );
});
