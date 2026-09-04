'use strict';

// Bump this on every release so browsers pick up the new asset versions.
const CACHE_NAME = 'kiss-ultra-gui-v1';

const APP_SHELL = [
    './',
    './index.html',
    './manifest.webmanifest'
];

self.addEventListener('install', function (event) {
    event.waitUntil(
        caches.open(CACHE_NAME).then(function (cache) {
            return cache.addAll(APP_SHELL);
        }).then(function () {
            return self.skipWaiting();
        })
    );
});

self.addEventListener('activate', function (event) {
    event.waitUntil(
        caches.keys().then(function (keys) {
            return Promise.all(
                keys.filter(function (key) {
                    return key !== CACHE_NAME;
                }).map(function (key) {
                    return caches.delete(key);
                })
            );
        }).then(function () {
            return self.clients.claim();
        })
    );
});

self.addEventListener('fetch', function (event) {
    var request = event.request;

    // Only handle GET requests for our own origin. Everything else (GitHub
    // API lookups, proxy.php, WebUSB/WebSerial handshakes are not fetches
    // anyway) goes straight to the network untouched.
    if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) {
        return;
    }

    if (request.mode === 'navigate') {
        // Network-first for HTML so updates show up immediately; fall back
        // to the cached shell when offline.
        event.respondWith(
            fetch(request).then(function (response) {
                var copy = response.clone();
                caches.open(CACHE_NAME).then(function (cache) {
                    cache.put(request, copy);
                });
                return response;
            }).catch(function () {
                return caches.match('./index.html');
            })
        );
        return;
    }

    // Cache-first for static assets (js/css/images/i18n), refreshing the
    // cache in the background on every hit.
    event.respondWith(
        caches.match(request).then(function (cached) {
            var fetchPromise = fetch(request).then(function (response) {
                if (response && response.ok) {
                    var copy = response.clone();
                    caches.open(CACHE_NAME).then(function (cache) {
                        cache.put(request, copy);
                    });
                }
                return response;
            }).catch(function () {
                return cached;
            });

            return cached || fetchPromise;
        })
    );
});
