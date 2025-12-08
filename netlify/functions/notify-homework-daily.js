// Scheduled function: Runs at 3:10 PM CST Mon-Fri
// Notifies Willy about homework due today

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
        // Get today's date in CST (Central Standard Time)
        const now = new Date();
        const cstDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
        const today = cstDate.toISOString().split('T')[0];

        // Check if it's a weekday (Mon-Fri)
        const dayOfWeek = cstDate.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            return {
                statusCode: 200,
                body: JSON.stringify({ message: 'Weekend - no notification sent' })
            };
        }

        // Get homework due today that's not completed
        const { data: homework, error: hwError } = await supabase
            .from('homework_items')
            .select('*')
            .eq('student_id', WILLY_STUDENT_ID)
            .eq('date_due', today)
            .neq('status', 'completed');

        if (hwError) {
            console.error('Error fetching homework:', hwError);
            return { statusCode: 500, body: JSON.stringify({ error: 'Failed to fetch homework' }) };
        }

        if (!homework || homework.length === 0) {
            return {
                statusCode: 200,
                body: JSON.stringify({ message: 'No homework due today' })
            };
        }

        // Build notification message
        const count = homework.length;
        const subjects = [...new Set(homework.map(h => h.course_name || h.subject))].slice(0, 3);

        let body;
        if (count === 1) {
            body = `You have 1 assignment due today: ${subjects[0]}`;
        } else {
            body = `You have ${count} assignments due today: ${subjects.join(', ')}`;
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
            title: '📚 Homework Check',
            body: body,
            tag: 'homework-daily',
            icon: '/icon-192.png',
            data: { type: 'homework-daily' }
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
            body: JSON.stringify({ success: true, sent, homeworkCount: count })
        };
    } catch (err) {
        console.error('Error:', err);
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
};
