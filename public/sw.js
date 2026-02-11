const BUILD_ID = new URL(self.location.href).searchParams.get('build') || 'dev';
const CACHE_VERSION = BUILD_ID;
const APP_SHELL_CACHE = `bedroom-layout-designer-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `bedroom-layout-designer-runtime-${CACHE_VERSION}`;
const CACHE_PREFIX = 'bedroom-layout-designer-';
const APP_SHELL_URLS = ['/', '/index.html', '/bed.svg', '/site.webmanifest'];
const MAX_RUNTIME_ENTRIES = 180;

const offlineResponse = (status = 503) =>
  new Response('Offline and resource unavailable.', {
    status,
    statusText: status === 503 ? 'Service Unavailable' : 'Gateway Timeout',
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });

const trimRuntimeCache = async () => {
  const cache = await caches.open(RUNTIME_CACHE);
  const requests = await cache.keys();
  const overflow = requests.length - MAX_RUNTIME_ENTRIES;
  if (overflow <= 0) return;
  await Promise.all(requests.slice(0, overflow).map((request) => cache.delete(request)));
};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter(
            (key) =>
              key.startsWith(CACHE_PREFIX) &&
              key !== APP_SHELL_CACHE &&
              key !== RUNTIME_CACHE
          )
          .map((key) => caches.delete(key))
      )
    ).then(() => trimRuntimeCache()).then(() => self.clients.claim())
  );
});

const staleWhileRevalidate = async (request) => {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then(async (response) => {
      if (response && response.ok) {
        await cache.put(request, response.clone());
        await trimRuntimeCache();
      }
      return response;
    })
    .catch(() => null);

  if (cached) {
    void networkPromise;
    return cached;
  }

  const response = await networkPromise;
  if (response) return response;
  return offlineResponse(504);
};

const networkFirstNavigate = async (request) => {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      await cache.put(request, response.clone());
      await trimRuntimeCache();
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    const appShell = await caches.match('/index.html');
    if (appShell) return appShell;
    return offlineResponse(503);
  }
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigate(request));
    return;
  }

  const isStaticAsset =
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'image' ||
    request.destination === 'font' ||
    url.pathname.startsWith('/assets/');

  if (isStaticAsset) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
