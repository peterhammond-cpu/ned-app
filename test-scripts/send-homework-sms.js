// send-homework-sms.js
// Sends SMS with tonight's homework + motivational nag

require('dotenv').config();
const twilio = require('twilio');
const { createClient } = require('@supabase/supabase-js');

// Config
const WILLY_STUDENT_ID = '8021ff47-1a41-4341-a2e0-9c4fa53cc389';

// Initialize clients
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

const twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

// Rotating motivational nags
const nags = [
    { style: 'Stewie', message: "Blast! If something confuses you, ask your teacher NOW. Panicking at 9pm is for amateurs." },
    { style: 'Kendrick', message: "Real ones ask questions early. Don't fumble at 9pm. 🎤" },
    { style: 'Dad', message: "Teachers love questions almost as much as YOU. Ask now! ☕" },
    { style: 'Coach', message: "Champions prepare. Confused? Email your teacher before practice. 💪" }
];

// Get today's nag (rotates by day of year)
function getTodaysNag() {
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
    return nags[dayOfYear % nags.length];
}

// Fetch tonight's homework
async function fetchHomework() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const tomorrowISO = tomorrow.toISOString();

    const { data, error } = await supabase
        .from('homework_items')
        .select('subject, title')
        .eq('student_id', WILLY_STUDENT_ID)
        .gte('date_due', tomorrowISO)
        .order('date_due', { ascending: true })
        .limit(8);

    if (error) {
        console.error('❌ Error fetching homework:', error);
        return [];
    }

    return data || [];
}

// Build SMS message
function buildMessage(homework) {
    const nag = getTodaysNag();

    let message = `📚 Tonight's Homework:\n`;

    if (homework.length === 0) {
        message += `• No homework found! Double-check Canvas.\n`;
    } else {
        homework.forEach(item => {
            // Truncate title to keep SMS short
            const shortTitle = item.title.length > 40
                ? item.title.substring(0, 40) + '...'
                : item.title;
            message += `• ${item.subject}: ${shortTitle}\n`;
        });
    }

    message += `\n${nag.message}`;
    message += `\n\n🔗 polite-dasik-8c85da.netlify.app`;

    console.log(`📝 Using ${nag.style} style today`);
    return message;
}

// Send SMS
async function sendSMS(message) {
    console.log('📱 Sending SMS...\n');
    console.log('--- MESSAGE ---');
    console.log(message);
    console.log('---------------\n');

    const result = await twilioClient.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: process.env.WILLY_PHONE_NUMBER
    });

    console.log('✅ SMS sent! SID:', result.sid);
    return result;
}

// Main
async function main() {
    console.log('='.repeat(50));
    console.log('📱 Homework SMS Sender');
    console.log('='.repeat(50) + '\n');

    const homework = await fetchHomework();
    console.log(`📚 Found ${homework.length} homework items\n`);

    const message = buildMessage(homework);
    await sendSMS(message);

    console.log('\n' + '='.repeat(50));
    console.log('🎉 Done!');
    console.log('='.repeat(50));
}

main();
