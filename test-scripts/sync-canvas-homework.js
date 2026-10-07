// sync-canvas-homework.js
// Fetches fresh homework from Canvas, clears old data, saves to Supabase
// NOW WITH SMART DUE DATE PARSING + SCHOOL CLOSURE AWARENESS!

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const cheerio = require('cheerio');

// Config
const CANVAS_DOMAIN = 'https://aaca.instructure.com';

// Course discovery.
//
// This was hardcoded to '520' (the 7th grade HW course) and silently broke
// when Willy moved up a grade: Canvas still served the old page, the parser
// found no current homework, and syncToDatabase cleared the table. The
// workflow stayed green the whole time.
//
// Now resolved at run time. Set CANVAS_COURSE_ID to pin it manually if the
// heuristic ever picks wrong; otherwise the sync finds the homework course
// itself and survives the next grade rollover.
const COURSE_ID_OVERRIDE = process.env.CANVAS_COURSE_ID || null;
const LEGACY_COURSE_ID = '520'; // last resort only
let resolvedCourseId = null;
const WILLY_STUDENT_ID = '8021ff47-1a41-4341-a2e0-9c4fa53cc389';

// Initialize Supabase
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

// ==========================================
// SCHOOL CLOSURES
// ==========================================

// Fetch school closure dates from database
async function fetchSchoolClosures() {
    console.log('📅 Fetching school closures from database...');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get closures for homework date range (7 days back to 30 days forward)
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

    const thirtyDaysOut = new Date(today);
    thirtyDaysOut.setDate(thirtyDaysOut.getDate() + 30);
    const thirtyDaysStr = thirtyDaysOut.toISOString().split('T')[0];

    const { data, error } = await supabase
        .from('school_events')
        .select('event_date, title')
        .eq('student_id', WILLY_STUDENT_ID)
        .in('event_type', ['no_school', 'closure'])
        .gte('event_date', sevenDaysAgoStr)
        .lte('event_date', thirtyDaysStr);

    if (error) {
        console.error('  ⚠️ Error fetching closures:', error.message);
        return new Set();
    }

    // Create a Set of closure date strings for fast lookup
    const closureDates = new Set(data.map(row => row.event_date));

    if (closureDates.size > 0) {
        console.log(`  ✅ Found ${closureDates.size} closure(s):`);
        data.forEach(row => {
            console.log(`     📌 ${row.event_date}: ${row.title}`);
        });
    } else {
        console.log('  ✅ No upcoming closures found');
    }

    return closureDates;
}

// Check if a date is a school closure
function isSchoolClosure(date, closureDates) {
    const dateStr = date.toISOString().split('T')[0];
    return closureDates.has(dateStr);
}

// ==========================================
// SMART DUE DATE PARSING
// ==========================================

// Map day names to day numbers (0 = Sunday)
const dayMap = {
    'sunday': 0, 'sun': 0,
    'monday': 1, 'mon': 1,
    'tuesday': 2, 'tue': 2, 'tues': 2,
    'wednesday': 3, 'wed': 3,
    'thursday': 4, 'thu': 4, 'thurs': 4,
    'friday': 5, 'fri': 5,
    'saturday': 6, 'sat': 6
};

// Get next occurrence of a specific weekday (skipping closures)
function getNextWeekday(fromDate, targetDay, closureDates) {
    const result = new Date(fromDate);
    const currentDay = result.getDay();
    let daysToAdd = targetDay - currentDay;

    if (daysToAdd <= 0) {
        daysToAdd += 7; // Move to next week
    }

    result.setDate(result.getDate() + daysToAdd);

    // If the target day is a closure, find the next school day after it
    while (isSchoolClosure(result, closureDates)) {
        console.log(`    ⚠️ ${result.toDateString()} is a closure, skipping...`);
        result.setDate(result.getDate() + 1);
        // Also skip weekends
        while (result.getDay() === 0 || result.getDay() === 6) {
            result.setDate(result.getDate() + 1);
        }
    }

    return result;
}

// Get next school day (skip weekends AND closures)
function getNextSchoolDay(fromDate, closureDates) {
    const result = new Date(fromDate);
    result.setDate(result.getDate() + 1);

    // Keep advancing until we find a school day
    let maxIterations = 30; // Safety limit
    while (maxIterations > 0) {
        // Skip Saturday (6) and Sunday (0)
        if (result.getDay() === 0 || result.getDay() === 6) {
            result.setDate(result.getDate() + 1);
            maxIterations--;
            continue;
        }

        // Skip school closures
        if (isSchoolClosure(result, closureDates)) {
            console.log(`    ⚠️ ${result.toDateString()} is a closure, skipping...`);
            result.setDate(result.getDate() + 1);
            maxIterations--;
            continue;
        }

        // Found a school day!
        break;
    }

    return result;
}

// Parse due date from description text
function parseDueDate(description, assignedDate, closureDates) {
    const text = description.toLowerCase();

    // Pattern 1: "due tomorrow" or "tomorrow"
    if (text.includes('tomorrow') || text.includes('due tomorrow')) {
        let tomorrow = new Date(assignedDate);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Check if tomorrow is a weekend or closure
        if (tomorrow.getDay() === 0 || tomorrow.getDay() === 6 || isSchoolClosure(tomorrow, closureDates)) {
            tomorrow = getNextSchoolDay(assignedDate, closureDates);
            console.log(`    📅 Parsed "tomorrow" but it's not a school day → ${tomorrow.toDateString()}`);
        } else {
            console.log(`    📅 Parsed "tomorrow" → ${tomorrow.toDateString()}`);
        }
        return tomorrow;
    }

    // Pattern 2: "due [day]" e.g., "due Wednesday", "due Fri"
    const dueDayMatch = text.match(/due\s+(sun|mon|tue|wed|thu|fri|sat|sunday|monday|tuesday|wednesday|thursday|friday|saturday)/i);
    if (dueDayMatch) {
        const targetDay = dayMap[dueDayMatch[1].toLowerCase()];
        if (targetDay !== undefined) {
            const dueDate = getNextWeekday(assignedDate, targetDay, closureDates);
            console.log(`    📅 Parsed "due ${dueDayMatch[1]}" → ${dueDate.toDateString()}`);
            return dueDate;
        }
    }

    // Pattern 3: "due [date]" e.g., "due 12/5", "due Dec 5"
    const dueDateMatch = text.match(/due\s+(\d{1,2}\/\d{1,2})/);
    if (dueDateMatch) {
        const [month, day] = dueDateMatch[1].split('/').map(Number);
        const year = assignedDate.getFullYear();
        let dueDate = new Date(year, month - 1, day);

        // If it's a closure, bump to next school day
        if (isSchoolClosure(dueDate, closureDates)) {
            console.log(`    ⚠️ ${dueDate.toDateString()} is a closure, finding next school day...`);
            dueDate = getNextSchoolDay(new Date(dueDate.getTime() - 86400000), closureDates);
        }

        console.log(`    📅 Parsed "due ${dueDateMatch[1]}" → ${dueDate.toDateString()}`);
        return dueDate;
    }

    // Pattern 4: Explicit date like "Dec 5" or "December 5"
    const monthDateMatch = text.match(/due\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})/i);
    if (monthDateMatch) {
        const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
        const monthIndex = monthNames.findIndex(m => monthDateMatch[1].toLowerCase().startsWith(m));
        if (monthIndex !== -1) {
            let dueDate = new Date(assignedDate.getFullYear(), monthIndex, parseInt(monthDateMatch[2]));

            // If it's a closure, bump to next school day
            if (isSchoolClosure(dueDate, closureDates)) {
                console.log(`    ⚠️ ${dueDate.toDateString()} is a closure, finding next school day...`);
                dueDate = getNextSchoolDay(new Date(dueDate.getTime() - 86400000), closureDates);
            }

            console.log(`    📅 Parsed "${monthDateMatch[0]}" → ${dueDate.toDateString()}`);
            return dueDate;
        }
    }

    // Pattern 5: "quiz tomorrow", "test Friday", etc.
    const eventDayMatch = text.match(/(quiz|test|exam)\s+(tomorrow|sun|mon|tue|wed|thu|fri|sat|sunday|monday|tuesday|wednesday|thursday|friday|saturday)/i);
    if (eventDayMatch) {
        if (eventDayMatch[2].toLowerCase() === 'tomorrow') {
            let tomorrow = new Date(assignedDate);
            tomorrow.setDate(tomorrow.getDate() + 1);

            if (tomorrow.getDay() === 0 || tomorrow.getDay() === 6 || isSchoolClosure(tomorrow, closureDates)) {
                tomorrow = getNextSchoolDay(assignedDate, closureDates);
            }

            console.log(`    📅 Parsed "${eventDayMatch[1]} tomorrow" → ${tomorrow.toDateString()}`);
            return tomorrow;
        }
        const targetDay = dayMap[eventDayMatch[2].toLowerCase()];
        if (targetDay !== undefined) {
            const dueDate = getNextWeekday(assignedDate, targetDay, closureDates);
            console.log(`    📅 Parsed "${eventDayMatch[1]} ${eventDayMatch[2]}" → ${dueDate.toDateString()}`);
            return dueDate;
        }
    }

    // Default: Next school day (skips weekends AND closures)
    const nextDay = getNextSchoolDay(assignedDate, closureDates);
    console.log(`    📅 No due date found, defaulting to next school day → ${nextDay.toDateString()}`);
    return nextDay;
}

// ==========================================
// CANVAS FETCHING & PARSING
// ==========================================

// Small helper so every Canvas call reports status the same way.
async function canvasGet(path) {
    const r = await fetch(`${CANVAS_DOMAIN}${path}`, {
        headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_TOKEN}` }
    });
    return { ok: r.ok, status: r.status, body: r.ok ? await r.json() : null };
}

// Work out which Canvas course holds the homework page.
//
// Scoring, highest wins:
//   +100  name looks like a homework course ("HW", "homework")
//   + 40  has a front page with real content
//   +  n  a little weight for how much content, so an abandoned shell loses
//         to a maintained page
async function resolveCourseId() {
    if (resolvedCourseId) return resolvedCourseId;

    if (COURSE_ID_OVERRIDE) {
        console.log(`::notice::Using pinned CANVAS_COURSE_ID=${COURSE_ID_OVERRIDE}`);
        resolvedCourseId = COURSE_ID_OVERRIDE;
        return resolvedCourseId;
    }

    const courses = await canvasGet('/api/v1/courses?enrollment_state=active&per_page=100');
    if (!courses.ok) {
        throw new Error(`Canvas API error listing courses: ${courses.status}`);
    }

    const candidates = [];
    for (const c of courses.body) {
        const name = c.name || '';
        let score = 0;
        if (/\bhw\b|homework/i.test(name)) score += 100;

        const fp = await canvasGet(`/api/v1/courses/${c.id}/front_page`);
        const len = fp.ok ? (fp.body.body || '').length : 0;
        if (len > 0) score += 40 + Math.min(len / 100, 40);

        if (score > 0) candidates.push({ id: String(c.id), name, len, score });
    }

    candidates.sort((a, b) => b.score - a.score);

    if (!candidates.length) {
        console.log('::warning::No Canvas course with a usable front page. ' +
                    `Falling back to legacy course ${LEGACY_COURSE_ID}.`);
        resolvedCourseId = LEGACY_COURSE_ID;
        return resolvedCourseId;
    }

    const pick = candidates[0];
    console.log(`::notice::Resolved homework course: ${pick.id} "${pick.name}" ` +
                `(${pick.len} chars on front page)`);
    for (const c of candidates.slice(1, 4)) {
        console.log(`  runner-up: ${c.id} "${c.name}" (${c.len} chars, score ${Math.round(c.score)})`);
    }
    if (pick.id !== LEGACY_COURSE_ID) {
        console.log(`::notice::Course changed from the old hardcoded ${LEGACY_COURSE_ID} to ${pick.id}.`);
    }

    resolvedCourseId = pick.id;
    return resolvedCourseId;
}

// Fetch homework page from Canvas
async function fetchCanvasHomeworkPage() {
    const courseId = await resolveCourseId();
    console.log(`📡 Fetching homework page from Canvas (course ${courseId})...`);

    const page = await canvasGet(`/api/v1/courses/${courseId}/front_page`);
    if (!page.ok) {
        throw new Error(`Canvas API error: ${page.status}`);
    }

    console.log('✅ Got homework page:', page.body.title);
    return page.body.body; // HTML content
}

// Parse homework from HTML
function parseHomework(html, closureDates) {
    const $ = cheerio.load(html);
    const homeworkByDate = {};
    let currentDate = null;
    let currentDateStr = null;

    console.log('📄 Parsing homework...\n');

    $('p').each((i, elem) => {
        const text = $(elem).text().trim();

        // Check for date header (e.g., "Monday, Dec 1, 2025")
        const dateMatch = text.match(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+([A-Za-z]+\.?\s+\d{1,2},?\s+\d{4})/i);

        if (dateMatch) {
            currentDateStr = dateMatch[0].replace(/\*\*/g, '').trim();
            currentDate = new Date(currentDateStr);
            homeworkByDate[currentDateStr] = {
                assignedDate: currentDate,
                items: []
            };
            console.log(`📆 Found date section: ${currentDateStr}`);
            return;
        }

        // If we have a current date, look for subject homework
        if (currentDate && text) {
            const subjectMatch = text.match(/^([A-Z][A-Za-z\s\(\)]+?):\s*(.+)/);

            if (subjectMatch) {
                const subject = subjectMatch[1].trim();
                const homework = subjectMatch[2].trim();

                // Skip "NH" (No Homework)
                if (homework.toUpperCase() === 'NH') {
                    console.log(`  ⏭️  ${subject}: NH (skipped)`);
                    return;
                }

                // Check for Canvas link
                const link = $(elem).find('a').first();

                console.log(`  📚 ${subject}: ${homework.substring(0, 50)}...`);

                // Parse the actual due date from the description (with closure awareness)
                const dueDate = parseDueDate(homework, currentDate, closureDates);

                homeworkByDate[currentDateStr].items.push({
                    subject: subject,
                    description: homework,
                    link: link.length > 0 ? link.attr('href') : null,
                    dueDate: dueDate
                });
            }
        }
    });

    const dateCount = Object.keys(homeworkByDate).length;
    const itemCount = Object.values(homeworkByDate).reduce((sum, d) => sum + d.items.length, 0);
    console.log(`\n✅ Found ${itemCount} homework items across ${dateCount} dates`);

    return homeworkByDate;
}

// ==========================================
// TITLE NORMALIZATION (for deduplication)
// ==========================================

// Normalize title for external_id generation
// Removes dates, day names, relative words so "Quiz TOMORROW" and "Quiz THURS 12/11" become the same
function normalizeTitle(title) {
    let normalized = title.toLowerCase();

    // Remove day names
    normalized = normalized.replace(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, '');
    normalized = normalized.replace(/\b(mon|tue|tues|wed|thu|thurs|fri|sat|sun)\b/gi, '');

    // Remove relative date words
    normalized = normalized.replace(/\b(tomorrow|today|tonight)\b/gi, '');

    // Remove date patterns like "12/11", "Dec 11", "December 11"
    normalized = normalized.replace(/\d{1,2}\/\d{1,2}(\/\d{2,4})?/g, '');
    normalized = normalized.replace(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*\d{1,2}/gi, '');

    // Normalize singular/plural for common words
    normalized = normalized.replace(/sacraments/gi, 'sacrament');
    normalized = normalized.replace(/equations/gi, 'equation');

    // Remove extra whitespace and non-alphanumeric
    normalized = normalized.replace(/[^a-z0-9]/g, '');

    return normalized;
}

// Check if title indicates a quiz or test
function isQuizOrTest(title) {
    const lower = title.toLowerCase();
    return /\b(quiz|test|exam|assessment)\b/.test(lower);
}

// ==========================================
// DATABASE SYNC
// ==========================================

// Sync homework using UPSERT (preserves checkbox state)
async function syncToDatabase(homeworkByDate) {
    console.log('\n💾 Syncing homework to database...\n');

    let upsertCount = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // STEP 1: Fetch existing checked_off status to preserve it
    console.log('📋 Fetching existing completion status...');
    const { data: existingItems } = await supabase
        .from('homework_items')
        .select('subject, date_due, title, checked_off, checked_at')
        .eq('student_id', WILLY_STUDENT_ID)
        .eq('source_lms', 'canvas');

    // Build lookup map: "subject|date_due" -> {checked_off, checked_at}
    // Also include title snippet for better matching
    const completionStatus = new Map();
    (existingItems || []).forEach(item => {
        if (item.checked_off) {
            // Key by subject + due date
            const key = `${item.subject}|${item.date_due}`;
            completionStatus.set(key, {
                checked_off: item.checked_off,
                checked_at: item.checked_at
            });
            // Also key by subject + due date + first 30 chars of title (normalized)
            const titleKey = `${item.subject}|${item.date_due}|${(item.title || '').substring(0, 30).toLowerCase()}`;
            completionStatus.set(titleKey, {
                checked_off: item.checked_off,
                checked_at: item.checked_at
            });
        }
    });
    console.log(`  ✅ Found ${completionStatus.size} completed items to preserve`);

    // STEP 2: Clear ALL existing homework (fresh start to remove duplicates)
    console.log('🧹 Clearing existing homework entries...');
    const { error: clearError } = await supabase
        .from('homework_items')
        .delete()
        .eq('student_id', WILLY_STUDENT_ID)
        .eq('source_lms', 'canvas');

    if (clearError) {
        console.error('  ⚠️ Error clearing old entries:', clearError.message);
    } else {
        console.log('  ✅ Cleared old entries');
    }

    // Only sync items assigned within the last 7 days
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Build array of all homework items
    const allItems = [];

    for (const [dateStr, data] of Object.entries(homeworkByDate)) {
        // Skip homework assigned more than 7 days ago
        if (data.assignedDate < sevenDaysAgo) {
            continue;
        }
        const assignedDate = data.assignedDate;

        for (const item of data.items) {
            const dueDate = item.dueDate;
            const dueDateStr = dueDate.toISOString().split('T')[0];
            const assignedDateStr = assignedDate.toISOString().split('T')[0];

            // Normalize title for deduplication
            // "Sacraments quiz TOMORROW" and "Sacrament quiz THURS 12/11" both become "sacramentquiz"
            const normalizedTitle = normalizeTitle(item.description.substring(0, 50));

            // Create unique external_id from subject + DUE date + normalized title
            const externalId = `${item.subject}-${dueDateStr}-${normalizedTitle}`;

            // Determine status
            let status = 'pending';
            if (dueDate < today) {
                status = 'past';
            }

            console.log(`  📝 ${item.subject}: assigned ${assignedDateStr}, due ${dueDateStr}`);
            console.log(`     🔑 ID: ${externalId}`);

            // Check if this item was previously checked off
            const titleSnippet = item.description.substring(0, 30).toLowerCase();
            const subjectDueKey = `${item.subject}|${dueDateStr}`;
            const titleKey = `${item.subject}|${dueDateStr}|${titleSnippet}`;

            let checkedOff = false;
            let checkedAt = null;

            // Try to find existing completion status
            if (completionStatus.has(titleKey)) {
                const savedStatus = completionStatus.get(titleKey);
                checkedOff = savedStatus.checked_off;
                checkedAt = savedStatus.checked_at;
                console.log(`     ✅ Restoring completion status (by title match)`);
            } else if (completionStatus.has(subjectDueKey)) {
                const savedStatus = completionStatus.get(subjectDueKey);
                checkedOff = savedStatus.checked_off;
                checkedAt = savedStatus.checked_at;
                console.log(`     ✅ Restoring completion status (by subject+date)`);
            }

            allItems.push({
                student_id: WILLY_STUDENT_ID,
                source_lms: 'canvas',
                external_id: externalId,
                date_assigned: assignedDateStr,
                date_due: dueDateStr,
                subject: item.subject,
                title: item.description.substring(0, 100),
                description: item.description,
                link: item.link,
                status: status,
                checked_off: checkedOff,
                checked_at: checkedAt
            });
        }
    }

    // Deduplicate: For quiz/test items with same subject + due date, keep only the most recent
    const deduped = [];
    const seen = new Map(); // key: "subject-dueDate-quiz" -> item

    for (const item of allItems) {
        // For quizzes/tests, create a special dedup key
        if (isQuizOrTest(item.title)) {
            const dedupKey = `${item.subject}-${item.date_due}-quiztest`;

            if (seen.has(dedupKey)) {
                // Keep the one with the later assigned date (more recent announcement)
                const existing = seen.get(dedupKey);
                if (item.date_assigned > existing.date_assigned) {
                    console.log(`  🔄 Replacing older quiz/test entry for ${item.subject} on ${item.date_due}`);
                    seen.set(dedupKey, item);
                } else {
                    console.log(`  ⏭️  Skipping older quiz/test entry for ${item.subject} on ${item.date_due}`);
                }
            } else {
                seen.set(dedupKey, item);
            }
        } else {
            // Non-quiz items: use external_id as dedup key
            if (!seen.has(item.external_id)) {
                seen.set(item.external_id, item);
            }
        }
    }

    // Convert map back to array
    const itemsToSync = Array.from(seen.values());
    console.log(`\n📊 ${allItems.length} items found, ${itemsToSync.length} after deduplication`);

    // Insert all items (we already cleared the table)
    for (const item of itemsToSync) {
        const { error } = await supabase
            .from('homework_items')
            .insert(item);

        if (!error) {
            upsertCount++;
        } else {
            console.error(`  ⚠️ Error inserting: ${error.message}`);
        }
    }

    console.log(`\n✅ Synced ${upsertCount} homework items!`);
}

// ==========================================
// MAIN
// ==========================================

async function sync() {
    try {
        console.log('\n' + '='.repeat(60));
        console.log('🚀 Starting Canvas → Supabase sync');
        console.log('   (with smart due dates + school closure awareness!)');
        console.log('='.repeat(60) + '\n');

        // First, fetch school closures
        const closureDates = await fetchSchoolClosures();

        // Then fetch and parse homework with closure awareness
        const html = await fetchCanvasHomeworkPage();
        const homeworkByDate = parseHomework(html, closureDates);

        // An empty parse is not necessarily an error (school breaks, weekends),
        // but it is never nothing to worry about: syncToDatabase clears the
        // table before inserting, so zero parsed items empties the app.
        const parsedCount = Object.values(homeworkByDate || {})
            .reduce((n, items) => n + (Array.isArray(items) ? items.length : 0), 0);
        if (parsedCount === 0) {
            console.log(`::warning::Parsed 0 homework items from course ${resolvedCourseId}. ` +
                        'The table will be emptied. Expected over a break; otherwise the ' +
                        'course ID is probably stale.');
        } else {
            console.log(`::notice::Parsed ${parsedCount} homework items from course ${resolvedCourseId}.`);
        }

        await syncToDatabase(homeworkByDate);

        console.log('\n' + '='.repeat(60));
        console.log('🎉 Sync complete!');
        console.log('='.repeat(60) + '\n');

    } catch (error) {
        // Exit non-zero so the GitHub Actions step actually fails.
        // Without this the script swallowed every error and exited 0, so the
        // workflow went green while Canvas was returning 401 and the app sat
        // empty. A sync that cannot reach Canvas must be loud, not green.
        console.error(`::error::Canvas sync failed: ${error.message}`);
        console.error('\n❌ Sync failed:', error.message);
        process.exitCode = 1;
    }
}

sync();
