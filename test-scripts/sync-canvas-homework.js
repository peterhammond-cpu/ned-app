// sync-canvas-homework.js
// Fetches fresh homework from Canvas, clears old data, saves to Supabase
// NOW WITH CLAUDE-POWERED SPLITTING + SCHOOL CLOSURE AWARENESS!

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const cheerio = require('cheerio');
const Anthropic = require('@anthropic-ai/sdk');

// Config
const CANVAS_DOMAIN = 'https://aaca.instructure.com';
const COURSE_ID = '520'; // 7th Grade HW course
const WILLY_STUDENT_ID = '8021ff47-1a41-4341-a2e0-9c4fa53cc389';

// Initialize Supabase
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

// Initialize Claude
const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
});

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
        console.log(`      ⚠️ ${result.toDateString()} is a closure, skipping...`);
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
            console.log(`      ⚠️ ${result.toDateString()} is a closure, skipping...`);
            result.setDate(result.getDate() + 1);
            maxIterations--;
            continue;
        }
        
        // Found a school day!
        break;
    }
    
    return result;
}

// Parse due date from a due string (like "tomorrow", "Tuesday", "12/5")
function parseDueDateFromString(dueStr, assignedDate, closureDates) {
    if (!dueStr) {
        return getNextSchoolDay(assignedDate, closureDates);
    }
    
    const text = dueStr.toLowerCase().trim();
    
    // "tomorrow"
    if (text === 'tomorrow') {
        let tomorrow = new Date(assignedDate);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        if (tomorrow.getDay() === 0 || tomorrow.getDay() === 6 || isSchoolClosure(tomorrow, closureDates)) {
            return getNextSchoolDay(assignedDate, closureDates);
        }
        return tomorrow;
    }
    
    // Day name like "Tuesday", "Fri"
    for (const [dayName, dayNum] of Object.entries(dayMap)) {
        if (text.startsWith(dayName) || text === dayName) {
            return getNextWeekday(assignedDate, dayNum, closureDates);
        }
    }
    
    // Date like "12/5" or "12/9"
    const dateMatch = text.match(/(\d{1,2})\/(\d{1,2})/);
    if (dateMatch) {
        const month = parseInt(dateMatch[1]);
        const day = parseInt(dateMatch[2]);
        const year = assignedDate.getFullYear();
        let dueDate = new Date(year, month - 1, day);
        
        if (isSchoolClosure(dueDate, closureDates)) {
            dueDate = getNextSchoolDay(new Date(dueDate.getTime() - 86400000), closureDates);
        }
        return dueDate;
    }
    
    // Default to next school day
    return getNextSchoolDay(assignedDate, closureDates);
}

// ==========================================
// CLAUDE-POWERED HOMEWORK SPLITTING
// ==========================================

async function splitHomeworkWithClaude(subject, description, assignedDateStr) {
    console.log(`  🤖 Asking Claude to analyze: "${description.substring(0, 60)}..."`);
    
    const prompt = `You are parsing a homework assignment for a 7th grader. The teacher often combines multiple items in one entry.

Subject: ${subject}
Assigned Date: ${assignedDateStr}
Description: ${description}

Split this into separate items if there are multiple tasks. For each item, determine:
1. A clear, concise title (max 150 chars)
2. The type: "homework", "quiz", "test", "project", or "reading"
3. When it's due (extract from text, or "tomorrow" if not specified)

IMPORTANT: 
- If there's a quiz/test mentioned with a day (like "quiz Tuesday"), that's a SEPARATE item from the homework
- Homework without explicit due date is usually due "tomorrow" (next school day)
- Keep titles clear and actionable

Respond with ONLY valid JSON, no markdown:
{
  "items": [
    {
      "title": "Clear title here",
      "type": "homework|quiz|test|project|reading",
      "due": "tomorrow|Monday|Tuesday|etc|12/5"
    }
  ]
}`;

    try {
        const response = await anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 500,
            messages: [{ role: 'user', content: prompt }]
        });
        
        const content = response.content[0].text.trim();
        
        // Parse JSON response
        const parsed = JSON.parse(content);
        
        if (parsed.items && Array.isArray(parsed.items)) {
            console.log(`    ✅ Claude found ${parsed.items.length} item(s)`);
            return parsed.items;
        }
        
        throw new Error('Invalid response structure');
        
    } catch (error) {
        console.log(`    ⚠️ Claude parsing failed: ${error.message}`);
        console.log(`    📝 Falling back to single item`);
        
        // Fallback: return as single item
        return [{
            title: description,
            type: 'homework',
            due: 'tomorrow'
        }];
    }
}

// ==========================================
// CANVAS FETCHING & PARSING
// ==========================================

// Fetch homework page from Canvas
async function fetchCanvasHomeworkPage() {
    console.log('📡 Fetching homework page from Canvas...');
    
    const response = await fetch(
        `${CANVAS_DOMAIN}/api/v1/courses/${COURSE_ID}/front_page`,
        {
            headers: {
                'Authorization': `Bearer ${process.env.CANVAS_API_TOKEN}`
            }
        }
    );
    
    if (!response.ok) {
        throw new Error(`Canvas API error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('✅ Got homework page:', data.title);
    return data.body; // HTML content
}

// Parse homework from HTML (returns raw items before Claude processing)
function parseHomeworkRaw(html) {
    const $ = cheerio.load(html);
    const homeworkByDate = {};
    let currentDate = null;
    let currentDateStr = null;
    
    console.log('📄 Parsing homework from Canvas...\n');
    
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
                
                console.log(`  📚 ${subject}: ${homework.substring(0, 60)}${homework.length > 60 ? '...' : ''}`);
                
                homeworkByDate[currentDateStr].items.push({
                    subject: subject,
                    description: homework,
                    link: link.length > 0 ? link.attr('href') : null
                });
            }
        }
    });
    
    const dateCount = Object.keys(homeworkByDate).length;
    const itemCount = Object.values(homeworkByDate).reduce((sum, d) => sum + d.items.length, 0);
    console.log(`\n✅ Found ${itemCount} raw homework entries across ${dateCount} dates`);
    
    return homeworkByDate;
}

// Process homework with Claude splitting
async function processHomeworkWithClaude(homeworkByDate, closureDates) {
    console.log('\n🤖 Processing homework with Claude...\n');
    
    const processedItems = [];
    
    for (const [dateStr, data] of Object.entries(homeworkByDate)) {
        const assignedDate = data.assignedDate;
        const assignedDateStr = assignedDate.toISOString().split('T')[0];
        
        for (const item of data.items) {
            // Ask Claude to split this item
            const splitItems = await splitHomeworkWithClaude(
                item.subject, 
                item.description, 
                assignedDateStr
            );
            
            // Process each split item
            for (let i = 0; i < splitItems.length; i++) {
                const splitItem = splitItems[i];
                
                // Parse the due date
                const dueDate = parseDueDateFromString(splitItem.due, assignedDate, closureDates);
                const dueDateStr = dueDate.toISOString().split('T')[0];
                
                console.log(`      → ${splitItem.type}: "${splitItem.title.substring(0, 50)}..." due ${dueDateStr}`);
                
                processedItems.push({
                    subject: item.subject,
                    title: splitItem.title,
                    type: splitItem.type,
                    description: item.description, // Keep original for reference
                    link: item.link,
                    assignedDate: assignedDate,
                    dueDate: dueDate,
                    splitIndex: i // To make external_id unique
                });
            }
        }
    }
    
    console.log(`\n✅ Processed into ${processedItems.length} total items`);
    return processedItems;
}

// ==========================================
// DATABASE SYNC
// ==========================================

async function syncToDatabase(processedItems) {
    console.log('\n💾 Syncing homework to database...\n');
    
    let upsertCount = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Only sync items assigned within the last 7 days
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    for (const item of processedItems) {
        // Skip homework assigned more than 7 days ago
        if (item.assignedDate < sevenDaysAgo) {
            continue;
        }
        
        const dueDateStr = item.dueDate.toISOString().split('T')[0];
        const assignedDateStr = item.assignedDate.toISOString().split('T')[0];
        
        // Create unique external_id from subject + assigned date + split index + title hash
        const titleHash = item.title.substring(0, 30).replace(/[^a-zA-Z0-9]/g, '');
        const externalId = `${item.subject}-${assignedDateStr}-${item.splitIndex}-${titleHash}`;
        
        // Determine status
        let status = 'pending';
        if (item.dueDate < today) {
            status = 'past';
        }
        
        console.log(`  📝 ${item.subject} (${item.type}): due ${dueDateStr}`);
        
        const { error } = await supabase
            .from('homework_items')
            .upsert({
                student_id: WILLY_STUDENT_ID,
                source_lms: 'canvas',
                external_id: externalId,
                date_assigned: assignedDateStr,
                date_due: dueDateStr,
                subject: item.subject,
                title: item.title.substring(0, 200), // Increased from 100
                description: item.description,
                link: item.link,
                status: status,
                item_type: item.type // New field for homework/quiz/test
            }, { 
                onConflict: 'student_id,external_id',
                ignoreDuplicates: false 
            });
        
        if (!error) {
            upsertCount++;
        } else {
            console.error(`  ⚠️ Error upserting: ${error.message}`);
        }
    }
    
    // Clean up old items (due more than 7 days ago)
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().split('T')[0];
    
    const { error: cleanupError } = await supabase
        .from('homework_items')
        .delete()
        .eq('student_id', WILLY_STUDENT_ID)
        .lt('date_due', weekAgoStr);
    
    if (cleanupError) {
        console.error(`  ⚠️ Cleanup error: ${cleanupError.message}`);
    } else {
        console.log(`\n🧹 Cleaned up items due before ${weekAgoStr}`);
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
        console.log('   (with Claude splitting + school closure awareness!)');
        console.log('='.repeat(60) + '\n');
        
        // Fetch school closures
        const closureDates = await fetchSchoolClosures();
        
        // Fetch and parse raw homework from Canvas
        const html = await fetchCanvasHomeworkPage();
        const homeworkByDate = parseHomeworkRaw(html);
        
        // Process with Claude (split multi-item entries)
        const processedItems = await processHomeworkWithClaude(homeworkByDate, closureDates);
        
        // Sync to database
        await syncToDatabase(processedItems);
        
        console.log('\n' + '='.repeat(60));
        console.log('🎉 Sync complete!');
        console.log('='.repeat(60) + '\n');
        
    } catch (error) {
        console.error('\n❌ Sync failed:', error.message);
        process.exit(1);
    }
}

sync();
