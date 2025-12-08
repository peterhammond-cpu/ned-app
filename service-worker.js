// Ned App Service Worker - Push Notifications

const CACHE_NAME = 'ned-app-v1';

// Install event
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing...');
    self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activating...');
    event.waitUntil(clients.claim());
});

// Push event - handles incoming push notifications
self.addEventListener('push', (event) => {
    console.log('[Service Worker] Push received');

    let data = {
        title: 'Ned',
        body: 'You have a notification!',
        icon: '/icon-192.png',
        badge: '/badge-72.png',
        tag: 'ned-notification',
        data: {}
    };

    if (event.data) {
        try {
            const payload = event.data.json();
            data = { ...data, ...payload };
        } catch (e) {
            data.body = event.data.text();
        }
    }

    const options = {
        body: data.body,
        icon: data.icon || '/icon-192.png',
        badge: data.badge || '/badge-72.png',
        tag: data.tag || 'ned-notification',
        data: data.data || {},
        vibrate: [200, 100, 200],
        requireInteraction: data.requireInteraction || false,
        actions: data.actions || []
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
    console.log('[Service Worker] Notification clicked');

    event.notification.close();

    // Handle action buttons
    if (event.action === 'open') {
        event.waitUntil(clients.openWindow('/'));
    } else if (event.action === 'dismiss') {
        // Just close the notification
    } else {
        // Default: open the app
        event.waitUntil(
            clients.matchAll({ type: 'window', includeUncontrolled: true })
                .then((clientList) => {
                    // If app is already open, focus it
                    for (const client of clientList) {
                        if (client.url.includes(self.location.origin) && 'focus' in client) {
                            return client.focus();
                        }
                    }
                    // Otherwise open new window
                    return clients.openWindow('/');
                })
        );
    }
});

// Notification close event
self.addEventListener('notificationclose', (event) => {
    console.log('[Service Worker] Notification closed');
});
