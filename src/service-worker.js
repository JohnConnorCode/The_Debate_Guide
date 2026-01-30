/**
 * The Debate Guide - Service Worker
 * Enables offline reading and improved performance
 *
 * Cache versioning: BUILD_TIMESTAMP is replaced at build time
 * with the current timestamp to auto-invalidate cache on deploy.
 */

const BUILD_TIMESTAMP = '%%BUILD_TIMESTAMP%%';
const CACHE_VERSION = BUILD_TIMESTAMP || '1';
const CACHE_NAME = `debate-guide-v${CACHE_VERSION}`;
const OFFLINE_URL = '/offline/';

// Assets to cache immediately on install
const PRECACHE_ASSETS = [
    '/',
    '/introduction/',
    '/offline/',
    '/css/styles.css',
    '/css/chapter.css',
    '/css/quiz.css',
    '/css/tokens.css',
    '/css/animations.css',
    '/js/navigation.js',
    '/js/search.js',
    '/js/quiz.js',
    '/js/toast.js',
    '/search-index.json',
    '/manifest.json',
    // Quiz data files for offline functionality
    '/quizzes/chapter-01.json',
    '/quizzes/chapter-02.json',
    '/quizzes/chapter-03.json',
    '/quizzes/chapter-04.json',
    '/quizzes/chapter-05.json',
    '/quizzes/chapter-06.json',
    '/quizzes/chapter-07.json',
    '/quizzes/chapter-08.json',
    '/quizzes/chapter-09.json',
    '/quizzes/chapter-10.json',
    '/quizzes/chapter-11.json',
    '/quizzes/chapter-12.json',
    '/quizzes/chapter-13.json',
    '/quizzes/chapter-14.json',
    '/quizzes/chapter-15.json',
    '/quizzes/chapter-16.json',
    '/quizzes/chapter-17.json',
    '/quizzes/chapter-18.json',
    '/quizzes/chapter-19.json',
    '/quizzes/chapter-20.json'
];

// Install event - precache essential assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[SW] Precaching assets');
                return cache.addAll(PRECACHE_ASSETS);
            })
            .then(() => {
                // Force waiting service worker to become active
                return self.skipWaiting();
            })
            .catch(err => {
                console.error('[SW] Precache failed:', err);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames
                        .filter(name => name !== CACHE_NAME)
                        .map(name => {
                            console.log('[SW] Deleting old cache:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => {
                // Take control of all clients immediately
                return self.clients.claim();
            })
    );
});

// Fetch event - serve from cache, falling back to network
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    // Only handle same-origin requests
    if (url.origin !== location.origin) {
        return;
    }

    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }

    // HTML pages - Network first, then cache
    if (request.headers.get('Accept')?.includes('text/html')) {
        event.respondWith(
            fetch(request)
                .then(response => {
                    // Clone and cache the response
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(request, responseClone);
                    });
                    return response;
                })
                .catch(() => {
                    // Fallback to cache
                    return caches.match(request)
                        .then(cached => cached || caches.match(OFFLINE_URL));
                })
        );
        return;
    }

    // Static assets - Cache first, then network
    event.respondWith(
        caches.match(request)
            .then(cached => {
                if (cached) {
                    // Return cached version and update in background
                    event.waitUntil(
                        fetch(request)
                            .then(response => {
                                caches.open(CACHE_NAME).then(cache => {
                                    cache.put(request, response);
                                });
                            })
                            .catch(() => {
                                // Network failed, but we have cache
                            })
                    );
                    return cached;
                }

                // No cache, fetch from network
                return fetch(request)
                    .then(response => {
                        // Cache the response
                        const responseClone = response.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(request, responseClone);
                        });
                        return response;
                    });
            })
    );
});

// Handle messages from clients
self.addEventListener('message', event => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }
});
