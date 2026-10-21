// Save one Mastery Connect pull to Supabase.
//
//   node save-mastery-snapshot.js ~/Desktop/mastery-2026-10-20.json
//
// Mastery Connect has no API, so the pull happens interactively through
// Claude in Chrome on Peter's logged-in session ("pull Mastery"). That
// session writes a JSON file; this script stores it. Re-running for the same
// date replaces that day's snapshot, so it is safe to re-run.
//
// The JSON file lives OUTSIDE the repo (the repo is public). Shape:
//   { student_id, snapshot_date: 'YYYY-MM-DD', note,
//     classes: [{ class_name, section, teacher, mastery_pct, assessed_pct,
//                 standards: [{ score: '4'|'3'|'2'|'1'|'NS', code, description }] }] }
//
// mastery_pct is the site's own figure -- do not recompute it (ELA's
// leaves out some child standards).
//
// Fails loudly on an empty or malformed pull: a snapshot with zero scored
// standards would show Alex "nothing below mastery", which is a lie.

require('dotenv').config();
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const SCORES = new Set(['4', '3', '2', '1', 'NS']);

function validate(snap) {
  const problems = [];
  if (!snap.student_id) problems.push('missing student_id');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(snap.snapshot_date || '')) problems.push('snapshot_date must be YYYY-MM-DD');
  if (!Array.isArray(snap.classes) || !snap.classes.length) problems.push('no classes');
  (snap.classes || []).forEach(c => {
    if (!c.class_name) problems.push('class without class_name');
    (c.standards || []).forEach(s => {
      if (!SCORES.has(String(s.score))) problems.push(`${c.class_name}: bad score "${s.score}" on ${s.code}`);
    });
  });
  const scored = (snap.classes || []).flatMap(c => c.standards || []).filter(s => s.score !== 'NS');
  if (!scored.length) problems.push('zero scored standards -- did the pull land on the login page?');
  return { problems, scored };
}

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error('usage: node save-mastery-snapshot.js <snapshot.json>');
  const snap = JSON.parse(fs.readFileSync(file, 'utf8'));

  const { problems, scored } = validate(snap);
  if (problems.length) throw new Error('Refusing to save:\n  ' + problems.join('\n  '));

  // Replace any snapshot for the same date (cascade removes its classes).
  const { error: delErr } = await supabase.from('mastery_snapshots')
    .delete()
    .eq('student_id', snap.student_id)
    .eq('snapshot_date', snap.snapshot_date);
  if (delErr) throw delErr;

  const { data: row, error: snapErr } = await supabase.from('mastery_snapshots')
    .insert({ student_id: snap.student_id, snapshot_date: snap.snapshot_date, note: snap.note || null })
    .select('id')
    .single();
  if (snapErr) throw snapErr;

  const classes = snap.classes.map(c => ({
    snapshot_id: row.id,
    class_name: c.class_name,
    section: c.section || null,
    teacher: c.teacher || null,
    mastery_pct: c.mastery_pct ?? null,
    assessed_pct: c.assessed_pct ?? null,
    standards: c.standards || [],
  }));
  const { error: classErr } = await supabase.from('mastery_classes').insert(classes);
  if (classErr) throw classErr;

  // Read it back -- green means nothing until a value is checked.
  const { count, error: countErr } = await supabase.from('mastery_classes')
    .select('id', { count: 'exact', head: true })
    .eq('snapshot_id', row.id);
  if (countErr) throw countErr;
  if (count !== classes.length) throw new Error(`Wrote ${classes.length} classes but read back ${count}`);

  const below = scored.filter(s => Number(s.score) <= 2).length;
  console.log(`Saved ${snap.snapshot_date}: ${count} classes, ${scored.length} scored standards, ${below} at 2 or below.`);
}

main().catch(err => {
  console.error('❌', err.message || err);
  process.exit(1);
});
