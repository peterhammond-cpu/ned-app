// send-homework-notification.js
// Sends push notification after homework sync with count of items due

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const webpush = require('web-push');

const WILLY_STUDENT_ID = '8021ff47-1a41-4341-a2e0-9c4fa53cc389';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

// Configure web-push
webpush.setVapidDetails(
    'mailto:peter@nedapp.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

async function sendHomeworkNotification() {
    console.log('📱 Preparing homework notification...');

    // Get homework due today and tomorrow
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 1);

    const todayStr = today.toISOString().split('T')[0];
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    const dayAfterStr = dayAfter.toISOString().split('T')[0];

    // Get unchecked homework items
    const { data: homework, error: hwError } = await supabase
        .from('homework_items')
        .select('id, title, subject, date_due')
        .eq('student_id', WILLY_STUDENT_ID)
        .eq('checked_off', false)
        .gte('date_due', todayStr)
        .lt('date_due', dayAfterStr)
        .order('date_due', { ascending: true });

    if (hwError) {
        console.error('❌ Error fetching homework:', hwError.message);
        return;
    }

    const dueToday = homework?.filter(h => h.date_due === todayStr) || [];
    const dueTomorrow = homework?.filter(h => h.date_due === tomorrowStr) || [];
    const totalItems = dueToday.length + dueTomorrow.length;

    if (totalItems === 0) {
        console.log('✅ No homework to notify about');
        return;
    }

    // Build notification message
    let title = '📚 Homework Alert';
    let body = '';

    if (dueToday.length > 0 && dueTomorrow.length > 0) {
        body = `${dueToday.length} due today, ${dueTomorrow.length} due tomorrow`;
    } else if (dueToday.length > 0) {
        body = `${dueToday.length} item${dueToday.length > 1 ? 's' : ''} due today!`;
    } else {
        body = `${dueTomorrow.length} item${dueTomorrow.length > 1 ? 's' : ''} due tomorrow`;
    }

    // Get push subscriptions
    const { data: subscriptions, error: subError } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('student_id', WILLY_STUDENT_ID);

    if (subError || !subscriptions || subscriptions.length === 0) {
        console.log('⚠️ No push subscriptions found');
        return;
    }

    console.log(`📤 Sending to ${subscriptions.length} device(s): "${body}"`);

    const payload = JSON.stringify({
        title,
        body,
        tag: 'homework-alert',
        icon: '/icon-192.png',
        badge: '/badge-72.png',
        data: { url: '/' }
    });

    // Send to all subscriptions
    let sent = 0;
    for (const sub of subscriptions) {
        const pushSubscription = {
            endpoint: sub.endpoint,
            keys: {
                p256dh: sub.p256dh,
                auth: sub.auth
            }
        };

        try {
            await webpush.sendNotification(pushSubscription, payload);
            sent++;
            console.log(`   ✅ Sent to ${sub.endpoint.substring(0, 50)}...`);
        } catch (err) {
            console.error(`   ❌ Failed: ${err.message}`);

            // Remove expired subscriptions
            if (err.statusCode === 410 || err.statusCode === 404) {
                await supabase
                    .from('push_subscriptions')
                    .delete()
                    .eq('endpoint', sub.endpoint);
                console.log('   🗑️ Removed expired subscription');
            }
        }
    }

    console.log(`📱 Notification sent to ${sent}/${subscriptions.length} devices`);
}

sendHomeworkNotification().catch(err => {
    console.error('❌ Notification failed:', err);
    process.exit(1);
});
