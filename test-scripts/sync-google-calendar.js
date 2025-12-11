// sync-google-calendar.js
// Fetches events from Google Calendar and syncs to Supabase
// Handles: parenting schedule, school events, sports

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { google } = require('googleapis');

// Config
const WILLY_STUDENT_ID = '8021ff47-1a41-4341-a2e0-9c4fa53cc389';

// Calendar IDs - set these in GitHub Secrets or .env
// You'll get these from Google Calendar settings for each calendar
const CALENDAR_IDS = {
    parenting: process.env.GOOGLE_CALENDAR_PARENTING_ID,    // The custody schedule (your shared calendar)
    school: process.env.GOOGLE_CALENDAR_SCHOOL_ID || 'info@alphonsusacademy.org',  // St. Alphonsus (public)
    sports: process.env.GOOGLE_CALENDAR_SPORTS_ID           // TeamSnap/GameChanger (optional)
};

// Initialize Supabase
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

// Initialize Google Calendar API with service account
function getGoogleCalendar() {
    // Service account credentials from environment
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);

    const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/calendar.readonly']
    });

    return google.calendar({ version: 'v3', auth });
}

// ==========================================
// FETCH EVENTS FROM GOOGLE
// ==========================================
async function fetchCalendarEvents(calendar, calendarId, calendarType) {
    if (!calendarId) {
        console.log(`   ⏭️  No calendar ID configured for ${calendarType}, skipping`);
        return [];
    }

    console.log(`\n📅 Fetching ${calendarType} events...`);

    const now = new Date();
    const thirtyDaysOut = new Date();
    thirtyDaysOut.setDate(thirtyDaysOut.getDate() + 30);

    // Also get 7 days back for recently passed events
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    try {
        const response = await calendar.events.list({
            calendarId: calendarId,
            timeMin: sevenDaysAgo.toISOString(),
            timeMax: thirtyDaysOut.toISOString(),
            singleEvents: true,          // Expand recurring events
            orderBy: 'startTime',
            maxResults: 100
        });

        const events = response.data.items || [];
        console.log(`   ✅ Found ${events.length} events`);

        return events.map(event => ({
            ...event,
            calendarType
        }));

    } catch (error) {
        console.error(`   ❌ Error fetching ${calendarType}:`, error.message);
        return [];
    }
}

// ==========================================
// PARSE EVENT TYPE & HOUSEHOLD
// ==========================================
function parseEventDetails(event) {
    const title = (event.summary || '').toLowerCase();

    // Detect parenting schedule
    let household = null;
    if (title.includes('kids with pete')) {
        household = 'dad';
    } else if (title.includes('kids with julia')) {
        household = 'mom';
    }

    // Detect event type
    let eventType = 'general';
    if (event.calendarType === 'parenting') {
        eventType = 'parenting';
    } else if (event.calendarType === 'school') {
        eventType = 'school';
    } else if (event.calendarType === 'sports') {
        eventType = 'sports';
    }

    // Detect specific event keywords
    if (title.includes('practice')) {
        eventType = 'sports_practice';
    } else if (title.includes('game') || title.includes('match')) {
        eventType = 'sports_game';
    } else if (title.includes('no school') || title.includes('holiday') || title.includes('break')) {
        eventType = 'no_school';
    } else if (title.includes('early dismissal') || title.includes('half day')) {
        eventType = 'early_dismissal';
    }

    return { household, eventType };
}

// ==========================================
// CONVERT TO SUPABASE FORMAT
// ==========================================
function convertToSupabaseFormat(event) {
    const { household, eventType } = parseEventDetails(event);

    // Handle all-day vs timed events
    const isAllDay = !!event.start.date;
    const startDate = isAllDay ? event.start.date : event.start.dateTime.split('T')[0];
    const startTime = isAllDay ? null : event.start.dateTime;
    const endDate = isAllDay ? event.end.date : event.end.dateTime.split('T')[0];
    const endTime = isAllDay ? null : event.end.dateTime;

    // Create stable external_id: {calendarType}-{googleEventId}
    // Google event IDs are stable even for recurring events (each instance gets unique ID)
    const externalId = `${event.calendarType}-${event.id}`;

    return {
        student_id: WILLY_STUDENT_ID,
        external_id: externalId,
        calendar_source: event.calendarType,
        google_event_id: event.id,
        title: event.summary || 'Untitled Event',
        description: event.description || null,
        location: event.location || null,
        start_date: startDate,
        start_time: startTime,
        end_date: endDate,
        end_time: endTime,
        is_all_day: isAllDay,
        event_type: eventType,
        household: household,
        synced_at: new Date().toISOString()
    };
}

// ==========================================
// SYNC TO DATABASE
// ==========================================
async function syncToDatabase(events) {
    console.log('\n💾 Syncing to Supabase...');

    if (events.length === 0) {
        console.log('   ⏭️  No events to sync');
        return;
    }

    const records = events.map(convertToSupabaseFormat);

    // Upsert all records (update if exists, insert if new)
    let successCount = 0;
    let errorCount = 0;

    for (const record of records) {
        const { error } = await supabase
            .from('calendar_events')
            .upsert(record, {
                onConflict: 'student_id,external_id',
                ignoreDuplicates: false
            });

        if (error) {
            console.error(`   ❌ Error syncing "${record.title}":`, error.message);
            errorCount++;
        } else {
            successCount++;
        }
    }

    console.log(`   ✅ Synced ${successCount} events`);
    if (errorCount > 0) {
        console.log(`   ⚠️  ${errorCount} errors`);
    }

    // Clean up old events (ended more than 14 days ago)
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    const { error: cleanupError } = await supabase
        .from('calendar_events')
        .delete()
        .eq('student_id', WILLY_STUDENT_ID)
        .lt('end_date', twoWeeksAgo.toISOString().split('T')[0]);

    if (cleanupError) {
        console.log(`   ⚠️  Cleanup error:`, cleanupError.message);
    } else {
        console.log(`   🧹 Cleaned up events older than 14 days`);
    }
}

// ==========================================
// MAIN
// ==========================================
async function main() {
    console.log('='.repeat(60));
    console.log('📅 Google Calendar → Supabase Sync');
    console.log('   ' + new Date().toISOString());
    console.log('='.repeat(60));

    // Check for required config
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
        console.error('❌ GOOGLE_SERVICE_ACCOUNT_KEY not set');
        process.exit(1);
    }

    const calendar = getGoogleCalendar();

    // Fetch from all configured calendars
    const allEvents = [];

    const parentingEvents = await fetchCalendarEvents(
        calendar,
        CALENDAR_IDS.parenting,
        'parenting'
    );
    allEvents.push(...parentingEvents);

    const schoolEvents = await fetchCalendarEvents(
        calendar,
        CALENDAR_IDS.school,
        'school'
    );
    allEvents.push(...schoolEvents);

    const sportsEvents = await fetchCalendarEvents(
        calendar,
        CALENDAR_IDS.sports,
        'sports'
    );
    allEvents.push(...sportsEvents);

    console.log(`\n📊 Total events found: ${allEvents.length}`);

    // Sync to database
    await syncToDatabase(allEvents);

    console.log('\n' + '='.repeat(60));
    console.log('🎉 Calendar sync complete!');
    console.log('='.repeat(60));
}

main().catch(err => {
    console.error('❌ Calendar sync failed:', err);
    process.exit(1);
});
