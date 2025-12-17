const CACHE_NAME = 'kotvukai-v3';
var STATIC_ASSETS = [
  '/',
  '/manifest.json',
];

const API_CACHE_NAME = 'kotvukai-api-v3';
var API_CACHE_DURATION = 30 * 1000;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME && k !== API_CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
  console.log('[SW] Service Worker activated');
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);


  if (request.method !== 'GET') return;


  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
    return;
  }


  if (url.pathname.startsWith('/ws')) return;


  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      }).catch(() => offlineFallback(request));
    })
  );
});

async function handleApiRequest(request) {
  const url = new URL(request.url);


  const cacheableEndpoints = [
    '/api/market/ticker',
    '/api/analytics/',
    '/api/sentiment/',
    '/api/whale/',
    '/api/news/',
    '/api/heatmap/',
    '/api/screener/',
    '/api/fear-greed',
  ];

  const isCacheable = cacheableEndpoints.some(ep => url.pathname.startsWith(ep));

  if (!isCacheable) {
    return fetch(request).catch(() => new Response(JSON.stringify({ error: 'offline' }), {
      headers: { 'Content-Type': 'application/json' }
    }));
  }

  try {
    const response = await fetch(request);

    if (response.ok) {
      const clone = response.clone();
      var cache = await caches.open(API_CACHE_NAME);
      await cache.put(request, clone);
    }

    return response;
  } catch (error) {

    const cached = await caches.match(request);
    if (cached) {
      console.log('[SW] Serving from cache:', url.pathname);
      return cached;
    }

    return new Response(JSON.stringify({ error: 'offline', message: 'No cached data available' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

function offlineFallback(request) {
  const url = new URL(request.url);

  if (request.headers.get('accept').includes('text/html')) {
    return caches.match('/');
  }

  return new Response('Offline', { status: 503 });
}

self.addEventListener('push', (event) => {
  console.log('[SW] Push received');

  let data = { title: 'KotvukAI', body: 'New notification', icon: '/icons/icon-192.svg' };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  var options = {
    body: data.body,
    icon: '/icons/icon-192.svg',
    badge: '/icons/icon-192.svg',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/',
      timestamp: Date.now()
    },
    actions: data.actions || [
      { action: 'open', title: 'Open' },
      { action: 'close', title: 'Close' }
    ],
    tag: data.tag || 'default',
    renotify: true,
    requireInteraction: data.requireInteraction || false
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked');
  event.notification.close();

  const action = event.action;
  var url = event.notification.data?.url || '/';

  if (action === 'close') return;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {

      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed');
});

self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);

  if (event.tag === 'sync-trades') {
    event.waitUntil(syncTrades());
  }

  if (event.tag === 'sync-alerts') {
    event.waitUntil(syncAlerts());
  }
});

async function syncTrades() {
  try {

    const pending = await getPendingData('pending-trades');

    for (const trade of pending) {
      try {
        const response = await fetch('/api/trades', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(trade)
        });

        if (response.ok) {
          await removePendingData('pending-trades', trade.id);
        }
      } catch (e) {
        console.error('[SW] Failed to sync trade:', e);
      }
    }
  } catch (e) {
    console.error('[SW] Sync trades error:', e);
  }
}

async function syncAlerts() {
  try {
    const pending = await getPendingData('pending-alerts');

    for (const alert of pending) {
      try {
        const response = await fetch('/api/alerts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(alert)
        });

        if (response.ok) {
          await removePendingData('pending-alerts', alert.id);
        }
      } catch (e) {
        console.error('[SW] Failed to sync alert:', e);
      }
    }
  } catch (e) {
    console.error('[SW] Sync alerts error:', e);
  }
}

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('kotvukai-offline', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('pending-trades')) {
        db.createObjectStore('pending-trades', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('pending-alerts')) {
        db.createObjectStore('pending-alerts', { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

async function getPendingData(store) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(store, 'readonly');
    const objectStore = transaction.objectStore(store);
    const request = objectStore.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function removePendingData(store, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(store, 'readwrite');
    const objectStore = transaction.objectStore(store);
    const request = objectStore.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'SUBSCRIBE_PUSH') {
    event.waitUntil(
      self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: event.data.vapidKey
      }).then((subscription) => {
        event.ports[0].postMessage({ success: true, subscription: subscription.toJSON() });
      }).catch((error) => {
        event.ports[0].postMessage({ success: false, error: error.message });
      })
    );
  }

  if (event.data && event.data.type === 'CACHE_URLS') {
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => cache.addAll(event.data.urls))
    );
  }
});

self.addEventListener('periodicsync', (event) => {
  console.log('[SW] Periodic sync:', event.tag);

  if (event.tag === 'update-prices') {
    event.waitUntil(updatePrices());
  }
});

async function updatePrices() {
  try {
    const response = await fetch('/api/market/ticker');
    if (response.ok) {
      const data = await response.json();

      const cache = await caches.open(API_CACHE_NAME);
      await cache.put('/api/market/ticker', new Response(JSON.stringify(data)));


      const clients = await self.clients.matchAll();
      clients.forEach(client => {
        client.postMessage({ type: 'PRICES_UPDATED', data });
      });
    }
  } catch (e) {
    console.error('[SW] Update prices error:', e);
  }
}

console.log('[SW] KotvukAI Service Worker loaded');
