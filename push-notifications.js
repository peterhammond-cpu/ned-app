// Push Notifications Module for Ned App

const PushNotifications = {
    // VAPID public key - must match the one in Netlify env vars
    // Generate with: npx web-push generate-vapid-keys
    VAPID_PUBLIC_KEY: null, // Will be set from environment or config

    studentId: '8021ff47-1a41-4341-a2e0-9c4fa53cc389', // Willy's ID

    async init(vapidPublicKey) {
        this.VAPID_PUBLIC_KEY = vapidPublicKey;

        // Check if push notifications are supported
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            console.log('Push notifications not supported');
            return false;
        }

        // Register service worker
        try {
            const registration = await navigator.serviceWorker.register('/service-worker.js');
            console.log('Service Worker registered:', registration);
            return true;
        } catch (err) {
            console.error('Service Worker registration failed:', err);
            return false;
        }
    },

    async getPermissionStatus() {
        if (!('Notification' in window)) {
            return 'unsupported';
        }
        return Notification.permission;
    },

    async requestPermission() {
        if (!('Notification' in window)) {
            return 'unsupported';
        }

        const permission = await Notification.requestPermission();
        return permission;
    },

    async subscribe() {
        try {
            const registration = await navigator.serviceWorker.ready;

            // Check for existing subscription
            let subscription = await registration.pushManager.getSubscription();

            if (!subscription) {
                // Create new subscription
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: this.urlBase64ToUint8Array(this.VAPID_PUBLIC_KEY)
                });
            }

            // Save subscription to server
            const response = await fetch('/api/save-subscription', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subscription: subscription.toJSON(),
                    studentId: this.studentId
                })
            });

            if (!response.ok) {
                throw new Error('Failed to save subscription');
            }

            console.log('Push subscription saved successfully');
            return true;
        } catch (err) {
            console.error('Failed to subscribe:', err);
            return false;
        }
    },

    async unsubscribe() {
        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();

            if (subscription) {
                await subscription.unsubscribe();
                console.log('Unsubscribed from push notifications');
            }
            return true;
        } catch (err) {
            console.error('Failed to unsubscribe:', err);
            return false;
        }
    },

    async isSubscribed() {
        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();
            return !!subscription;
        } catch (err) {
            return false;
        }
    },

    // Helper to convert VAPID key
    urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/-/g, '+')
            .replace(/_/g, '/');

        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);

        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }
};

// Make available globally
window.PushNotifications = PushNotifications;
