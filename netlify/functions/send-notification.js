const webpush = require('web-push');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

// Configure web-push with VAPID keys
webpush.setVapidDetails(
    'mailto:peter@nedapp.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

exports.handler = async (event) => {
    // Only allow POST
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method not allowed' };
    }

    try {
        const { studentId, title, body, tag, data } = JSON.parse(event.body);

        if (!studentId || !title || !body) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Missing studentId, title, or body' })
            };
        }

        // Get all subscriptions for this student
        const { data: subscriptions, error } = await supabase
            .from('push_subscriptions')
            .select('*')
            .eq('student_id', studentId);

        if (error) {
            console.error('Error fetching subscriptions:', error);
            return {
                statusCode: 500,
                body: JSON.stringify({ error: 'Failed to fetch subscriptions' })
            };
        }

        if (!subscriptions || subscriptions.length === 0) {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: 'No subscriptions found for student' })
            };
        }

        const payload = JSON.stringify({
            title,
            body,
            tag: tag || 'ned-notification',
            data: data || {},
            icon: '/icon-192.png',
            badge: '/badge-72.png'
        });

        // Send to all subscriptions for this student
        const results = await Promise.allSettled(
            subscriptions.map(async (sub) => {
                const pushSubscription = {
                    endpoint: sub.endpoint,
                    keys: {
                        p256dh: sub.p256dh,
                        auth: sub.auth
                    }
                };

                try {
                    await webpush.sendNotification(pushSubscription, payload);
                    return { success: true, endpoint: sub.endpoint };
                } catch (err) {
                    // If subscription is expired/invalid, remove it
                    if (err.statusCode === 410 || err.statusCode === 404) {
                        await supabase
                            .from('push_subscriptions')
                            .delete()
                            .eq('endpoint', sub.endpoint);
                        console.log('Removed expired subscription:', sub.endpoint);
                    }
                    return { success: false, endpoint: sub.endpoint, error: err.message };
                }
            })
        );

        const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
        const failed = results.length - successful;

        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                sent: successful,
                failed: failed
            })
        };
    } catch (err) {
        console.error('Error:', err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};
