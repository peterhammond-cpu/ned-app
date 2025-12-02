// sync-canvas-homework.js
// Fetches fresh homework from Canvas, clears old data, saves to Supabase

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
    
    console.log('📄 Parsing homework...');
    
    $('p').each((i, elem) => {
        const text = $(elem).text().trim();
        
        // Check for date header (e.g., "Monday, Dec 1, 2025")
        const dateMatch = text.match(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+([A-Za-z]+\.?\s+\d{1,2},?\s+\d{4})/i);
        
        if (dateMatch) {
            currentDate = dateMatch[0].replace(/\*\*/g, '').trim();
            homeworkByDate[currentDate] = [];
            return;
        }
        
        // If we have a current date, look for subject homework
        if (currentDate && text) {
            const subjectMatch = text.match(/^([A-Z][A-Za-z\s\(\)]+?):\s*(.+)/);
            
            if (subjectMatch) {
                const subject = subjectMatch[1].trim();
                const homework = subjectMatch[2].trim();
                
                // Skip "NH" (No Homework)
                if (homework.toUpperCase() === 'NH') return;
                
                // Check for Canvas link
                const link = $(elem).find('a').first();
                
                homeworkByDate[currentDate].push({
                    subject: subject,
                    description: homework,
                    link: link.length > 0 ? link.attr('href') : null
                });
            }
        }
    });
    
    const dateCount = Object.keys(homeworkByDate).length;
    const itemCount = Object.values(homeworkByDate).flat().length;
    console.log(`✅ Found ${itemCount} homework items across ${dateCount} dates`);
    
    return homeworkByDate;
}

// Clear old homework and save fresh data
async function syncToDatabase(homeworkByDate) {
    console.log('🗑️  Clearing old homework...');
    
    // Delete all existing homework for Willy
    const { error: deleteError } = await supabase
        .from('homework_items')
        .delete()
        .eq('student_id', WILLY_STUDENT_ID);
    
    if (deleteError) {
        throw new Error(`Delete error: ${deleteError.message}`);
    }
    
    console.log('💾 Saving fresh homework...');
    
    let insertCount = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (const [dateStr, items] of Object.entries(homeworkByDate)) {
        const parsedDate = new Date(dateStr);
        
        for (const item of items) {
            const { error } = await supabase
                .from('homework_items')
                .insert({
                    student_id: WILLY_STUDENT_ID,
                    source_lms: 'canvas',
                    date_due: parsedDate.toISOString().split('T')[0],
                    subject: item.subject,
                    title: item.description.substring(0, 100),
                    description: item.description,
                    link: item.link,
                    status: parsedDate < today ? 'late' : 'pending'
                });
            
            if (!error) {
                insertCount++;
            } else {
                console.error(`  ⚠️ Error inserting: ${error.message}`);
            }
        }
    }
    
    console.log(`✅ Saved ${insertCount} homework items!`);
}

// Main function
async function sync() {
    try {
        console.log('\n🚀 Starting Canvas → Supabase sync...\n');
        
        const html = await fetchCanvasHomeworkPage();
        const homeworkByDate = parseHomework(html);
        await syncToDatabase(homeworkByDate);
        
        console.log('\n🎉 Sync complete!\n');
        
    } catch (error) {
        console.error('\n❌ Sync failed:', error.message);
    }
}

sync();