require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

console.log('🔍 Testing Supabase Connection...\n');

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  try {
    const { data, error } = await supabase
      .from('families')
      .select('*')
      .limit(1);

    if (error) {
      if (error.message.includes('does not exist')) {
        console.log('✅ Connection successful!');
        console.log('⚠️  Database is empty (no tables yet) - this is expected');
        console.log('\nNext step: Create database schema');
      } else {
        console.log('❌ Connection error:', error.message);
      }
    } else {
      console.log('✅ Connection successful!');
      console.log('✅ Database has tables!');
      if (data && data.length > 0) {
        console.log('✅ Found data:', data);
      } else {
        console.log('ℹ️  Tables exist but no data yet');
      }
    }
  } catch (err) {
    console.error('❌ Failed to connect:', err.message);
  }
}

testConnection();
