'use strict';

// Bump this on every release so browsers pick up the new asset versions.
const CACHE_NAME = 'kiss-ultra-gui-v2';

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

    // Network-first for everything (HTML, JS, CSS, images): this app is
    // actively changing, and a stale cached script silently shadowing a
    // fresh deploy is worse than the extra network round-trip. Only fall
    // back to cache when actually offline.
    event.respondWith(
        fetch(request).then(function (response) {
            if (response && response.ok) {
                var copy = response.clone();
                caches.open(CACHE_NAME).then(function (cache) {
                    cache.put(request, copy);
                });
            }
            return response;
        }).catch(function () {
            return caches.match(request).then(function (cached) {
                return cached || (request.mode === 'navigate' ? caches.match('./index.html') : undefined);
            });
        })
    );
});
