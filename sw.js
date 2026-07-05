const CACHE_NAME = 'khelaghor-pwa-v3';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './hub.html',
    './landing-style.css',
    './hub-style.css',
    './icon.svg',
    './games/ludo-master/index.html',
    './games/ludo-master/style.css',
    './games/ludo-master/ludo.js',
    './games/village-runner/index.html',
    './games/village-runner/style.css',
    './games/village-runner/game.js',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
    'https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;600;700&display=swap'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                return cache.addAll(ASSETS_TO_CACHE);
            })
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

self.addEventListener('fetch', event => {
    // Only cache GET requests
    if (event.request.method !== 'GET') return;
    
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Return cached version if found
                if (response) {
                    return response;
                }
                
                // Otherwise fetch from network
                return fetch(event.request).then(
                    response => {
                        // Check if we received a valid response
                        if(!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }

                        // Clone the response because it's a stream
                        var responseToCache = response.clone();

                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            });

                        return response;
                    }
                );
            }).catch(() => {
                // If network fails and it's an HTML page, maybe show an offline page
                // But for this PWA, we'll just let it fail or return cached hub.html if possible
            })
    );
});
