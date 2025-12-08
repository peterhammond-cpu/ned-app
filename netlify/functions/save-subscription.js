const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event) => {
    // Only allow POST
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method not allowed' };
    }

    try {
        const { subscription, studentId } = JSON.parse(event.body);

        if (!subscription || !studentId) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Missing subscription or studentId' })
            };
        }

        // Upsert subscription (update if endpoint exists, insert if new)
        const { data, error } = await supabase
            .from('push_subscriptions')
            .upsert({
                student_id: studentId,
                endpoint: subscription.endpoint,
                p256dh: subscription.keys.p256dh,
                auth: subscription.keys.auth,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'endpoint'
            });

        if (error) {
            console.error('Error saving subscription:', error);
            return {
                statusCode: 500,
                body: JSON.stringify({ error: 'Failed to save subscription' })
            };
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true })
        };
    } catch (err) {
        console.error('Error:', err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};
