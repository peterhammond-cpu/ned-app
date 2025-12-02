// sync-canvas-homework.js
// Fetches fresh homework from Canvas, clears old data, saves to Supabase
// NOW WITH SMART DUE DATE PARSING!

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const cheerio = require('cheerio');

// Config
const CANVAS_DOMAIN = 'https://aaca.instructure.com';
const COURSE_ID = '520'; // 7th Grade HW course
const WILLY_STUDENT_ID = '8021ff47-1a41-4341-a2e0-9c4fa53cc389';

// Initialize Supabase
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

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

// Get next occurrence of a specific weekday
function getNextWeekday(fromDate, targetDay) {
    const result = new Date(fromDate);
    const currentDay = result.getDay();
    let daysToAdd = targetDay - currentDay;
    
    if (daysToAdd <= 0) {
        daysToAdd += 7; // Move to next week
    }
    
    result.setDate(result.getDate() + daysToAdd);
    return result;
}

// Get next school day (skip weekends)
function getNextSchoolDay(fromDate) {
    const result = new Date(fromDate);
    result.setDate(result.getDate() + 1);
    
    // Skip Saturday (6) and Sunday (0)
    while (result.getDay() === 0 || result.getDay() === 6) {
        result.setDate(result.getDate() + 1);
    }
    
    return result;
}

// Parse due date from description text
function parseDueDate(description, assignedDate) {
    const text = description.toLowerCase();
    
    // Pattern 1: "due tomorrow" or "tomorrow"
    if (text.includes('tomorrow') || text.includes('due tomorrow')) {
        const tomorrow = new Date(assignedDate);
        tomorrow.setDate(tomorrow.getDate() + 1);
        console.log(`    📅 Parsed "tomorrow" → ${tomorrow.toDateString()}`);
        return tomorrow;
    }
    
    // Pattern 2: "due [day]" e.g., "due Wednesday", "due Fri"
    const dueDayMatch = text.match(/due\s+(sun|mon|tue|wed|thu|fri|sat|sunday|monday|tuesday|wednesday|thursday|friday|saturday)/i);
    if (dueDayMatch) {
        const targetDay = dayMap[dueDayMatch[1].toLowerCase()];
        if (targetDay !== undefined) {
            const dueDate = getNextWeekday(assignedDate, targetDay);
            console.log(`    📅 Parsed "due ${dueDayMatch[1]}" → ${dueDate.toDateString()}`);
            return dueDate;
        }
    }
    
    // Pattern 3: "due [date]" e.g., "due 12/5", "due Dec 5"
    const dueDateMatch = text.match(/due\s+(\d{1,2}\/\d{1,2})/);
    if (dueDateMatch) {
        const [month, day] = dueDateMatch[1].split('/').map(Number);
        const year = assignedDate.getFullYear();
        const dueDate = new Date(year, month - 1, day);
        console.log(`    📅 Parsed "due ${dueDateMatch[1]}" → ${dueDate.toDateString()}`);
        return dueDate;
    }
    
    // Pattern 4: Explicit date like "Dec 5" or "December 5"
    const monthDateMatch = text.match(/due\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})/i);
    if (monthDateMatch) {
        const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
        const monthIndex = monthNames.findIndex(m => monthDateMatch[1].toLowerCase().startsWith(m));
        if (monthIndex !== -1) {
            const dueDate = new Date(assignedDate.getFullYear(), monthIndex, parseInt(monthDateMatch[2]));
            console.log(`    📅 Parsed "${monthDateMatch[0]}" → ${dueDate.toDateString()}`);
            return dueDate;
        }
    }
    
    // Pattern 5: "quiz tomorrow", "test Friday", etc.
    const eventDayMatch = text.match(/(quiz|test|exam)\s+(tomorrow|sun|mon|tue|wed|thu|fri|sat|sunday|monday|tuesday|wednesday|thursday|friday|saturday)/i);
    if (eventDayMatch) {
        if (eventDayMatch[2].toLowerCase() === 'tomorrow') {
            const tomorrow = new Date(assignedDate);
            tomorrow.setDate(tomorrow.getDate() + 1);
            console.log(`    📅 Parsed "${eventDayMatch[1]} tomorrow" → ${tomorrow.toDateString()}`);
            return tomorrow;
        }
        const targetDay = dayMap[eventDayMatch[2].toLowerCase()];
        if (targetDay !== undefined) {
            const dueDate = getNextWeekday(assignedDate, targetDay);
            console.log(`    📅 Parsed "${eventDayMatch[1]} ${eventDayMatch[2]}" → ${dueDate.toDateString()}`);
            return dueDate;
        }
    }
    
    // Default: Next school day
    const nextDay = getNextSchoolDay(assignedDate);
    console.log(`    📅 No due date found, defaulting to next school day → ${nextDay.toDateString()}`);
    return nextDay;
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

// Parse homework from HTML
function parseHomework(html) {
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
                
                // Parse the actual due date from the description
                const dueDate = parseDueDate(homework, currentDate);
                
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
// DATABASE SYNC
// ==========================================

// Clear old homework and save fresh data
async function syncToDatabase(homeworkByDate) {
    console.log('\n🗑️  Clearing old homework...');
    
    // Delete all existing homework for Willy
    const { error: deleteError } = await supabase
        .from('homework_items')
        .delete()
        .eq('student_id', WILLY_STUDENT_ID);
    
    if (deleteError) {
        throw new Error(`Delete error: ${deleteError.message}`);
    }
    
    console.log('💾 Saving fresh homework...\n');
    
    let insertCount = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (const [dateStr, data] of Object.entries(homeworkByDate)) {
        const assignedDate = data.assignedDate;
        
        for (const item of data.items) {
            const dueDate = item.dueDate;
            const dueDateStr = dueDate.toISOString().split('T')[0];
            const assignedDateStr = assignedDate.toISOString().split('T')[0];
            
            // Determine status
            let status = 'pending';
            if (dueDate < today) {
                status = 'past';
            }
            
            console.log(`  💾 ${item.subject}: assigned ${assignedDateStr}, due ${dueDateStr}`);
            
            const { error } = await supabase
                .from('homework_items')
                .insert({
                    student_id: WILLY_STUDENT_ID,
                    source_lms: 'canvas',
                    date_assigned: assignedDateStr,
                    date_due: dueDateStr,
                    subject: item.subject,
                    title: item.description.substring(0, 100),
                    description: item.description,
                    link: item.link,
                    status: status
                });
            
            if (!error) {
                insertCount++;
            } else {
                console.error(`  ⚠️ Error inserting: ${error.message}`);
            }
        }
    }
    
    console.log(`\n✅ Saved ${insertCount} homework items!`);
}

// ==========================================
// MAIN
// ==========================================

async function sync() {
    try {
        console.log('\n' + '='.repeat(60));
        console.log('🚀 Starting Canvas → Supabase sync (with smart due dates!)');
        console.log('='.repeat(60) + '\n');
        
        const html = await fetchCanvasHomeworkPage();
        const homeworkByDate = parseHomework(html);
        await syncToDatabase(homeworkByDate);
        
        console.log('\n' + '='.repeat(60));
        console.log('🎉 Sync complete!');
        console.log('='.repeat(60) + '\n');
        
    } catch (error) {
        console.error('\n❌ Sync failed:', error.message);
    }
}

sync();