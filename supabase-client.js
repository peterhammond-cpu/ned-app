const SUPABASE_URL = 'https://jzmivepzevgqlmxirlmk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp6bWl2ZXB6ZXZncWxteGlybG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwODQ2MTAsImV4cCI6MjA3OTY2MDYxMH0.RTfSV7jMgyc1bpcDCZFtVoX9MjBYo0KElC0S16O6_og';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const WILLY_STUDENT_ID = "8021ff47-1a41-4341-a2e0-9c4fa53cc389";
async function fetchTodaysHomework() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('homework_items')
      .select('id, date_due, subject, title, description, link, status, checked_off, checked_at')
      .eq('student_id', WILLY_STUDENT_ID)
      .eq('date_due', today)
      .order('subject', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Failed to fetch homework:', err);
    return [];
  }
}
async function checkOffHomework(homeworkId) {
  try {
    const { error } = await supabase
      .from('homework_items')
      .update({ checked_off: true, checked_at: new Date().toISOString() })
      .eq('id', homeworkId);
    if (error) return false;
    return true;
  } catch (err) {
    console.error('Failed to check off homework:', err);
    return false;
  }
}
async function uncheckHomework(homeworkId) {
  try {
    const { error } = await supabase
      .from('homework_items')
      .update({ checked_off: false, checked_at: null })
      .eq('id', homeworkId);
    if (error) return false;
    return true;
  } catch (err) {
    console.error('Failed to uncheck homework:', err);
    return false;
  }
}
window.NedSupabase = {
  fetchAllHomework,
  fetchUpcomingHomework,
  fetchTodaysHomework,
  checkOffHomework,
  uncheckHomework
};
console.log('✅ Supabase client initialized for Ned App');

async function fetchUpcomingHomework() {
  try {
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    const startDate = today.toISOString().split('T')[0];
    const endDate = nextWeek.toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('homework_items')
      .select('id, date_due, subject, title, description, link, status, checked_off, checked_at')
      .eq('student_id', WILLY_STUDENT_ID)
      .gte('date_due', startDate)
      .lte('date_due', endDate)
      .order('date_due', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Failed to fetch upcoming homework:', err);
    return [];
  }
}

async function fetchAllHomework() {
  try {
    const { data, error } = await supabase
      .from('homework_items')
      .select('id, date_due, subject, title, description, link, status, checked_off, checked_at')
      .eq('student_id', WILLY_STUDENT_ID)
      .order('date_due', { ascending: true })
      .limit(20);

    if (error) throw error;
    console.log('📚 Fetched ALL homework - showing first 20 items');
    return data || [];
  } catch (err) {
    console.error('Failed to fetch all homework:', err);
    return [];
  }
}
