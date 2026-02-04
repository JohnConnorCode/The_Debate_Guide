/**
 * The Debate Guide - Service Worker
 * Enables offline reading and improved performance
 *
 * STRATEGY: Network-first for everything to ensure fresh content.
 * Cache is fallback for offline use only.
 */

const BUILD_TIMESTAMP = '%%BUILD_TIMESTAMP%%';
const CACHE_NAME = `debate-guide-v${BUILD_TIMESTAMP}`;
const OFFLINE_URL = '/offline/';

// Assets to cache for offline use
const PRECACHE_ASSETS = [
    '/offline/',
    '/manifest.json'
];

// Install - precache minimal assets, skip waiting immediately
self.addEventListener('install', event => {
    console.log('[SW] Installing new version:', BUILD_TIMESTAMP);
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(PRECACHE_ASSETS))
            .then(() => self.skipWaiting())
    );
});

// Activate - delete ALL old caches aggressively
self.addEventListener('activate', event => {
    console.log('[SW] Activating, clearing old caches');
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames
                        .filter(name => name !== CACHE_NAME)
                        .map(name => {
                            console.log('[SW] Deleting cache:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => self.clients.claim())
            .then(() => {
                // Notify all clients to reload
                self.clients.matchAll().then(clients => {
                    clients.forEach(client => {
                        client.postMessage({ type: 'SW_UPDATED', version: BUILD_TIMESTAMP });
                    });
                });
            })
    );
});

// Fetch - NETWORK FIRST for everything
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    // Only handle same-origin GET requests
    if (url.origin !== location.origin || request.method !== 'GET') {
        return;
    }

    event.respondWith(
        fetch(request)
            .then(response => {
                // Cache successful responses for offline use
                if (response.ok) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(request, responseClone);
                    });
                }
                return response;
            })
            .catch(() => {
                // Network failed - try cache
                return caches.match(request)
                    .then(cached => {
                        if (cached) return cached;
                        // For HTML, show offline page
                        if (request.headers.get('Accept')?.includes('text/html')) {
                            return caches.match(OFFLINE_URL);
                        }
                        return new Response('Offline', { status: 503 });
                    });
            })
    );
});

// Handle messages
self.addEventListener('message', event => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }
    if (event.data === 'clearCache') {
        caches.keys().then(names => {
            names.forEach(name => caches.delete(name));
        });
    }
});
