// Compare the two most recent Mastery Connect snapshots for a student.
//
//   node diff-mastery.js            # latest vs the one before
//
// Reads from Supabase with the service key (the tables have no anon read).
// Prints what improved, what declined, what was newly assessed, and how
// each class's mastery % moved. Scores: 4/3 = mastery, 2 = below, 1 = far
// below, NS = not yet assessed.

require('dotenv').config({ quiet: true });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const WILLY_STUDENT_ID = '8021ff47-1a41-4341-a2e0-9c4fa53cc389';

const rank = s => (s === 'NS' || s == null ? null : Number(s));
const isMastery = s => rank(s) != null && rank(s) >= 3;

async function main() {
  const { data: snaps, error } = await supabase.from('mastery_snapshots')
    .select('id, snapshot_date')
    .eq('student_id', WILLY_STUDENT_ID)
    .order('snapshot_date', { ascending: false })
    .limit(2);
  if (error) throw error;
  if (!snaps || snaps.length < 2) throw new Error(`Need two snapshots, found ${snaps?.length || 0}`);
  const [newer, older] = snaps;

  const load = async id => {
    const { data, error } = await supabase.from('mastery_classes').select('*').eq('snapshot_id', id);
    if (error) throw error;
    if (!data.length) throw new Error(`snapshot ${id} has no classes`);
    return Object.fromEntries(data.map(c => [c.class_name, c]));
  };
  const [now, before] = await Promise.all([load(newer.id), load(older.id)]);

  console.log(`Mastery Connect: ${older.snapshot_date} → ${newer.snapshot_date}\n`);

  const improved = [], declined = [], newlyScored = [], stillBelow = [];
  const classRows = [];
  for (const name of [...new Set([...Object.keys(now), ...Object.keys(before)])].sort()) {
    const a = before[name], b = now[name];
    if (!a || !b) { classRows.push(`${name}: ${a ? 'missing from new pull' : 'new class'}`); continue; }
    const oldStd = Object.fromEntries((a.standards || []).map(s => [s.code, s]));
    for (const s of b.standards || []) {
      const o = oldStd[s.code];
      const was = o ? o.score : 'NS', is = s.score;
      const line = { cls: name, code: s.code, desc: s.description || o?.description || '', was, is };
      if (rank(was) == null && rank(is) != null) newlyScored.push(line);
      else if (rank(was) != null && rank(is) != null && rank(is) > rank(was)) improved.push(line);
      else if (rank(was) != null && rank(is) != null && rank(is) < rank(was)) declined.push(line);
      if (rank(is) != null && rank(is) <= 2) stillBelow.push(line);
    }
    // Standards that disappeared or went back to NS are worth knowing about too.
    for (const code of Object.keys(oldStd)) {
      if (!(b.standards || []).some(s => s.code === code) && rank(oldStd[code].score) != null)
        declined.push({ cls: name, code, desc: oldStd[code].description || '', was: oldStd[code].score, is: '(gone)' });
    }
    const dp = (b.mastery_pct ?? 0) - (a.mastery_pct ?? 0), da = (b.assessed_pct ?? 0) - (a.assessed_pct ?? 0);
    classRows.push(`${name.padEnd(16)} mastery ${String(a.mastery_pct ?? '—').padStart(3)}% → ${String(b.mastery_pct ?? '—').padStart(3)}%` +
      `${dp ? ` (${dp > 0 ? '+' : ''}${dp})` : ''}   assessed ${a.assessed_pct ?? 0}% → ${b.assessed_pct ?? 0}%${da ? ` (+${da})` : ''}`);
  }

  const show = (title, rows, fmt) => {
    console.log(`${title} (${rows.length})`);
    if (!rows.length) console.log('  none');
    rows.forEach(r => console.log('  ' + fmt(r)));
    console.log('');
  };
  const std = r => `${r.cls}: ${r.code} ${r.was} → ${r.is}${r.desc ? ` (${r.desc})` : ''}`;
  show('IMPROVED', improved, std);
  show('DECLINED', declined, std);
  show('NEWLY ASSESSED', newlyScored, r => `${r.cls}: ${r.code} = ${r.is}${isMastery(r.is) ? '' : '  ⚠ below'}${r.desc ? ` (${r.desc})` : ''}`);
  show('STILL BELOW MASTERY NOW', stillBelow, r => `${r.cls}: ${r.code} = ${r.is}${r.desc ? ` (${r.desc})` : ''}`);
  console.log('BY CLASS');
  classRows.forEach(r => console.log('  ' + r));
}

main().catch(err => { console.error('❌', err.message || err); process.exit(1); });
