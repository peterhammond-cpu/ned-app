// Temporary test - show ALL homework
async function fetchAllHomework() {
  try {
    const { data, error } = await window.NedSupabase.supabase
      .from('homework_items')
      .select('id, date_due, subject, title, description, link, status, checked_off, checked_at')
      .eq('student_id', '8021ff47-1a41-4341-a2e0-9c4fa53cc389')
      .order('date_due', { ascending: true })
      .limit(20);  // Just show first 20
    
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Failed to fetch homework:', err);
    return [];
  }
}
