// DEBUG SCRIPT - Run this to see what's in your database
// Usage: node debug-homework.js

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://jzmivepzevgqlmxirlmk.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
const WILLY_STUDENT_ID = '8021ff47-1a41-4341-a2e0-9c4fa53cc389';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function debug() {
    console.log('='.repeat(60));
    console.log('NED APP - DATABASE DEBUG');
    console.log('='.repeat(60));
    console.log('');
    
    // 1. Check today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();
    console.log('📅 Today:', today.toDateString());
    console.log('📅 Today ISO (for query):', todayISO);
    console.log('');
    
    // 2. Get ALL homework for Willy (no date filter)
    console.log('='.repeat(60));
    console.log('ALL HOMEWORK IN DATABASE (no filter):');
    console.log('='.repeat(60));
    
    const { data: allHomework, error: allError } = await supabase
        .from('homework_items')
        .select('id, subject, title, date_due, date_assigned, status')
        .eq('student_id', WILLY_STUDENT_ID)
        .order('date_due', { ascending: true });
    
    if (allError) {
        console.log('❌ ERROR fetching all homework:', allError);
    } else {
        console.log(`Found ${allHomework.length} total items:\n`);
        allHomework.forEach(item => {
            const dueDate = new Date(item.date_due);
            const isPast = dueDate < today;
            const marker = isPast ? '⏪ PAST' : '✅ CURRENT/FUTURE';
            console.log(`${marker} | Due: ${item.date_due} | ${item.subject}: ${item.title?.substring(0, 40)}...`);
        });
    }
    
    console.log('');
    
    // 3. Get homework with the SAME filter the app uses
    console.log('='.repeat(60));
    console.log('HOMEWORK AFTER FILTER (date_due >= today):');
    console.log('='.repeat(60));
    
    const { data: filteredHomework, error: filteredError } = await supabase
        .from('homework_items')
        .select('*')
        .eq('student_id', WILLY_STUDENT_ID)
        .gte('date_due', todayISO)
        .order('date_due', { ascending: true });
    
    if (filteredError) {
        console.log('❌ ERROR fetching filtered homework:', filteredError);
    } else {
        console.log(`Found ${filteredHomework.length} items due today or later:\n`);
        filteredHomework.forEach(item => {
            console.log(`📚 Due: ${item.date_due} | ${item.subject}: ${item.title}`);
        });
        
        if (filteredHomework.length === 0) {
            console.log('');
            console.log('⚠️  NO HOMEWORK FOUND!');
            console.log('   This explains why the app falls back to hardcoded data.');
            console.log('   Either:');
            console.log('   1. All homework in DB has past due dates');
            console.log('   2. Canvas sync needs to be run');
            console.log('   3. The date_due field format doesn\'t match the query');
        }
    }
    
    console.log('');
    console.log('='.repeat(60));
    console.log('DIAGNOSIS COMPLETE');
    console.log('='.repeat(60));
}

debug().catch(console.error);
