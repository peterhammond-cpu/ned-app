// data-quality-check.js
// Runs data quality checks across all tables and logs issues
// Designed to run daily via GitHub Actions

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

const WILLY_STUDENT_ID = '8021ff47-1a41-4341-a2e0-9c4fa53cc389';

// Track all issues found
const issues = [];

function logIssue(severity, category, message, details = null) {
    const issue = {
        severity,      // 'error', 'warning', 'info'
        category,      // 'duplicate', 'orphan', 'stale', 'anomaly'
        message,
        details,
        found_at: new Date().toISOString()
    };
    issues.push(issue);

    const emoji = severity === 'error' ? '❌' : severity === 'warning' ? '⚠️' : 'ℹ️';
    console.log(`${emoji} [${category.toUpperCase()}] ${message}`);
    if (details) console.log(`   Details:`, JSON.stringify(details, null, 2));
}

// ==========================================
// CHECK 1: Duplicate Homework
// ==========================================
async function checkDuplicateHomework() {
    console.log('\n📚 Checking for duplicate homework...');

    const { data, error } = await supabase
        .from('homework_items')
        .select('id, subject, title, date_due, external_id')
        .eq('student_id', WILLY_STUDENT_ID);

    if (error) {
        logIssue('error', 'system', 'Failed to fetch homework', { error: error.message });
        return;
    }

    // Check for duplicate external_ids
    const externalIdCounts = {};
    data.forEach(item => {
        externalIdCounts[item.external_id] = (externalIdCounts[item.external_id] || 0) + 1;
    });

    const duplicateExternalIds = Object.entries(externalIdCounts)
        .filter(([_, count]) => count > 1);

    if (duplicateExternalIds.length > 0) {
        logIssue('error', 'duplicate', `Found ${duplicateExternalIds.length} duplicate external_ids in homework`, {
            duplicates: duplicateExternalIds.map(([id, count]) => ({ external_id: id, count }))
        });
    }

    // Check for same title + subject + due date (different external_id)
    const contentKey = item => `${item.subject}|${item.date_due}|${item.title.toLowerCase().trim()}`;
    const contentCounts = {};
    data.forEach(item => {
        const key = contentKey(item);
        if (!contentCounts[key]) contentCounts[key] = [];
        contentCounts[key].push(item.id);
    });

    const contentDupes = Object.entries(contentCounts)
        .filter(([_, ids]) => ids.length > 1);

    if (contentDupes.length > 0) {
        logIssue('warning', 'duplicate', `Found ${contentDupes.length} homework items with same content but different IDs`, {
            duplicates: contentDupes.map(([key, ids]) => ({ content: key, ids }))
        });
    }

    console.log(`   ✅ Checked ${data.length} homework items`);
}

// ==========================================
// CHECK 2: Duplicate Calendar Events
// ==========================================
async function checkDuplicateCalendarEvents() {
    console.log('\n📅 Checking for duplicate calendar events...');

    const { data, error } = await supabase
        .from('calendar_events')
        .select('id, external_id, title, start_date')
        .eq('student_id', WILLY_STUDENT_ID);

    if (error) {
        // Table might not exist yet
        if (error.code === '42P01') {
            console.log('   ⏭️  calendar_events table does not exist yet, skipping');
            return;
        }
        logIssue('error', 'system', 'Failed to fetch calendar events', { error: error.message });
        return;
    }

    if (!data || data.length === 0) {
        console.log('   ⏭️  No calendar events to check');
        return;
    }

    // Check for duplicate external_ids
    const externalIdCounts = {};
    data.forEach(item => {
        externalIdCounts[item.external_id] = (externalIdCounts[item.external_id] || 0) + 1;
    });

    const duplicates = Object.entries(externalIdCounts)
        .filter(([_, count]) => count > 1);

    if (duplicates.length > 0) {
        logIssue('error', 'duplicate', `Found ${duplicates.length} duplicate calendar events`, {
            duplicates: duplicates.map(([id, count]) => ({ external_id: id, count }))
        });
    }

    console.log(`   ✅ Checked ${data.length} calendar events`);
}

// ==========================================
// CHECK 3: Stale Data (nothing synced recently)
// ==========================================
async function checkStaleData() {
    console.log('\n⏰ Checking for stale data...');

    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const twoDaysAgoISO = twoDaysAgo.toISOString();

    // Check homework sync
    const { data: recentHomework } = await supabase
        .from('homework_items')
        .select('synced_at')
        .eq('student_id', WILLY_STUDENT_ID)
        .gte('synced_at', twoDaysAgoISO)
        .limit(1);

    if (!recentHomework || recentHomework.length === 0) {
        logIssue('warning', 'stale', 'No homework synced in the last 48 hours');
    } else {
        console.log('   ✅ Homework sync is current');
    }

    // Check match data sync
    const { data: matchData } = await supabase
        .from('match_data')
        .select('updated_at')
        .eq('team_id', 81)
        .single();

    if (matchData) {
        const matchUpdated = new Date(matchData.updated_at);
        if (matchUpdated < twoDaysAgo) {
            logIssue('warning', 'stale', 'Match data not updated in 48+ hours', {
                last_updated: matchData.updated_at
            });
        } else {
            console.log('   ✅ Match data sync is current');
        }
    }
}

// ==========================================
// CHECK 4: Anomalies (weird data)
// ==========================================
async function checkAnomalies() {
    console.log('\n🔍 Checking for data anomalies...');

    const today = new Date();
    const oneYearOut = new Date();
    oneYearOut.setFullYear(oneYearOut.getFullYear() + 1);

    // Homework due more than 30 days out (probably wrong)
    const thirtyDaysOut = new Date();
    thirtyDaysOut.setDate(thirtyDaysOut.getDate() + 30);

    const { data: farOutHomework } = await supabase
        .from('homework_items')
        .select('id, title, date_due')
        .eq('student_id', WILLY_STUDENT_ID)
        .gt('date_due', thirtyDaysOut.toISOString().split('T')[0]);

    if (farOutHomework && farOutHomework.length > 0) {
        logIssue('warning', 'anomaly', `Found ${farOutHomework.length} homework items due 30+ days out`, {
            items: farOutHomework.map(h => ({ id: h.id, title: h.title, due: h.date_due }))
        });
    } else {
        console.log('   ✅ No far-future homework anomalies');
    }

    // Homework with missing required fields
    const { data: incompleteHomework } = await supabase
        .from('homework_items')
        .select('id, title, subject, date_due')
        .eq('student_id', WILLY_STUDENT_ID)
        .or('subject.is.null,title.is.null,date_due.is.null');

    if (incompleteHomework && incompleteHomework.length > 0) {
        logIssue('error', 'anomaly', `Found ${incompleteHomework.length} homework items with missing fields`, {
            items: incompleteHomework
        });
    } else {
        console.log('   ✅ No incomplete homework records');
    }
}

// ==========================================
// CHECK 5: Orphaned Records
// ==========================================
async function checkOrphanedRecords() {
    console.log('\n👻 Checking for orphaned records...');

    // Check if any records reference non-existent students
    // This would require a students table check
    // For now, just verify our known student exists

    const { data: student } = await supabase
        .from('students')
        .select('id, name')
        .eq('id', WILLY_STUDENT_ID)
        .single();

    if (!student) {
        logIssue('error', 'orphan', 'Primary student record not found!', {
            student_id: WILLY_STUDENT_ID
        });
    } else {
        console.log(`   ✅ Student record exists: ${student.name}`);
    }
}

// ==========================================
// SAVE RESULTS
// ==========================================
async function saveResults() {
    if (issues.length === 0) {
        console.log('\n🎉 No data quality issues found!');
        return;
    }

    console.log(`\n📊 Summary: Found ${issues.length} issue(s)`);

    // Log to data_quality_log table (create if needed via Supabase dashboard)
    const logEntry = {
        run_at: new Date().toISOString(),
        issues_found: issues.length,
        errors: issues.filter(i => i.severity === 'error').length,
        warnings: issues.filter(i => i.severity === 'warning').length,
        details: issues
    };

    const { error } = await supabase
        .from('data_quality_log')
        .insert(logEntry);

    if (error) {
        // Table might not exist, just log to console
        if (error.code === '42P01') {
            console.log('   ℹ️  data_quality_log table does not exist, results logged to console only');
        } else {
            console.error('   ⚠️  Failed to save results:', error.message);
        }
    } else {
        console.log('   ✅ Results saved to data_quality_log table');
    }

    // Exit with error code if critical issues found
    const errorCount = issues.filter(i => i.severity === 'error').length;
    if (errorCount > 0) {
        console.log(`\n❌ ${errorCount} error(s) require attention!`);
        process.exit(1);
    }
}

// ==========================================
// MAIN
// ==========================================
async function main() {
    console.log('='.repeat(60));
    console.log('🔍 NED APP - Data Quality Check');
    console.log('   ' + new Date().toISOString());
    console.log('='.repeat(60));

    await checkDuplicateHomework();
    await checkDuplicateCalendarEvents();
    await checkStaleData();
    await checkAnomalies();
    await checkOrphanedRecords();
    await saveResults();

    console.log('\n' + '='.repeat(60));
    console.log('✅ Data quality check complete');
    console.log('='.repeat(60));
}

main().catch(err => {
    console.error('❌ Data quality check failed:', err);
    process.exit(1);
});
