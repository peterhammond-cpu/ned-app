require('dotenv').config();
const cheerio = require('cheerio');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY // Use service key for full access
);

// Read the HTML file
const html = fs.readFileSync('homework-page.html', 'utf-8');
const $ = cheerio.load(html);

const homeworkByDate = {};
let currentDate = null;

console.log('📄 Parsing homework from HTML...\n');

// Parse each paragraph
$('p').each((i, elem) => {
  const text = $(elem).text().trim();

  // Check for date header
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
      let homework = subjectMatch[2].trim();

      // Check for Canvas link
      const link = $(elem).find('a').first();
      let homeworkItem = {
        subject: subject,
        description: homework,
        link: link.length > 0 ? link.attr('href') : null
      };

      homeworkByDate[currentDate].push(homeworkItem);
    }
  }
});

console.log(`✅ Found ${Object.keys(homeworkByDate).length} dates with homework\n`);

// Filter to last 30 days
const today = new Date();
const thirtyDaysAgo = new Date(today);
thirtyDaysAgo.setDate(today.getDate() - 30);

async function saveToDatabase() {
  try {
    // Get Willy's student ID
    const { data: students, error: studentError } = await supabase
      .from('students')
      .select('id')
      .eq('name', 'Willy Hammond')
      .single();

    if (studentError) throw studentError;

    const studentId = students.id;
    console.log(`📌 Found Willy's ID: ${studentId}\n`);

    let insertCount = 0;

    // Process each date
    for (const [dateStr, items] of Object.entries(homeworkByDate)) {
      const parsedDate = new Date(dateStr);

      // Skip if outside 30 day window
      if (parsedDate < thirtyDaysAgo || parsedDate > today) continue;

      // Insert each homework item
      for (const item of items) {
        const { data, error } = await supabase
          .from('homework_items')
          .insert({
            student_id: studentId,
            source_lms: 'canvas',
            date_due: parsedDate.toISOString().split('T')[0],
            subject: item.subject,
            description: item.description,
            link: item.link,
            status: parsedDate < today ? 'late' : 'pending'
          });

        if (!error) {
          insertCount++;
        }
      }
    }

    console.log(`✅ Saved ${insertCount} homework items to database!\n`);

    // Show sample
    const { data: sample } = await supabase
      .from('homework_items')
      .select('*')
      .eq('student_id', studentId)
      .order('date_due', { ascending: false })
      .limit(5);

    console.log('📋 Sample homework items:');
    sample.forEach(item => {
      console.log(`   ${item.date_due} - ${item.subject}: ${item.description.substring(0, 50)}...`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

saveToDatabase();
