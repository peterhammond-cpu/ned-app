// Scheduled function: Runs at 7:00 PM CST on Saturdays
// Reminds Willy to take his shot

const webpush = require('web-push');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

webpush.setVapidDetails(
    'mailto:peter@nedapp.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

const WILLY_STUDENT_ID = '8021ff47-1a41-4341-a2e0-9c4fa53cc389';

exports.handler = async (event) => {
    try {
        // Get current day in CST (Central Standard Time)
        const now = new Date();
        const cstDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));

        // Check if it's Saturday (day 6)
        const dayOfWeek = cstDate.getDay();
        if (dayOfWeek !== 6) {
            return {
                statusCode: 200,
                body: JSON.stringify({ message: 'Not Saturday - no notification sent' })
            };
        }

        // Get subscriptions
        const { data: subscriptions, error: subError } = await supabase
            .from('push_subscriptions')
            .select('*')
            .eq('student_id', WILLY_STUDENT_ID);

        if (subError || !subscriptions || subscriptions.length === 0) {
            console.log('No subscriptions found');
            return { statusCode: 200, body: JSON.stringify({ message: 'No subscriptions' }) };
        }

        const payload = JSON.stringify({
            title: '💉 Shot Reminder',
            body: "Hey Willy! It's Saturday - time to take your shot. You've got this!",
            tag: 'saturday-shot',
            icon: '/icon-192.png',
            requireInteraction: true,
            data: { type: 'saturday-shot' }
        });

        // Send notifications
        const results = await Promise.allSettled(
            subscriptions.map(async (sub) => {
                const pushSub = {
                    endpoint: sub.endpoint,
                    keys: { p256dh: sub.p256dh, auth: sub.auth }
                };
                try {
                    await webpush.sendNotification(pushSub, payload);
                    return { success: true };
                } catch (err) {
                    if (err.statusCode === 410 || err.statusCode === 404) {
                        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
                    }
                    return { success: false, error: err.message };
                }
            })
        );

        const sent = results.filter(r => r.status === 'fulfilled' && r.value.success).length;

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, sent })
        };
    } catch (err) {
        console.error('Error:', err);
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
};
