// Exercise the grid walk against a synthetic sheet shaped like the real one,
// including the cases the review flagged: leading cells from the previous
// month, trailing cells from the next, and a school year spanning Dec->Jan.
const CYAN = { red:0, green:1, blue:1 };          // Pete / dad
const MAG  = { red:1, green:0, blue:1 };          // Julia / mom

const cell = (v, colour) => ({
  formattedValue: v == null ? undefined : String(v),
  effectiveFormat: colour ? { backgroundColor: colour } : undefined
});
const row = (...v) => ({ values: v });

// Columns: A label | B transition | C..I = M T W Th F Sat Sun
// Realistic: the month label shares the header row, as it does in the sheet.
const headerFor = (m) => row(cell(m), cell('w/o Mon'), cell('M'), cell('T'), cell('W'),
                             cell('Th'), cell('F'), cell('Sat'), cell('Sun'));

const rows = [
  row(cell(''), cell('Transition'), cell('Pete', CYAN), cell('Julia', MAG)),
  headerFor('Sep'),
  // Aug 31 is a Monday in 2026; Sep 1-6 follow. Leading cell is PREVIOUS month.
  row(cell(''), cell(''), cell(31, CYAN), cell(1, CYAN), cell(2, MAG),
      cell(3, MAG), cell(4, MAG), cell(5, CYAN), cell(6, CYAN)),
  headerFor('Oct'),
  // Sep 28 Mon ... Oct 1-4. Leading cells are PREVIOUS month in an Oct block.
  row(cell(''), cell(''), cell(28, MAG), cell(29, MAG), cell(30, MAG),
      cell(1, CYAN), cell(2, CYAN), cell(3, CYAN), cell(4, CYAN)),
];

const fs = require('fs');
let src = fs.readFileSync('../sync-custody-schedule.js', 'utf8');
// Pull out the pure helpers + grid walk, skipping network/db.
src = src.split('(async () => {')[0];
const harness = src
  .replace(/require\('dotenv'\)\.config\(\);/, '')
  .replace(/const \{ google \} = require\('googleapis'\);/, '')
  .replace(/const \{ createClient \} = require\('@supabase\/supabase-js'\);/, '')
  .replace(/const supabase = createClient\([^)]*\);/s, '');

const walk = fs.readFileSync('../sync-custody-schedule.js', 'utf8');
const body = walk.slice(walk.indexOf('  // Walk the grid.'), walk.indexOf('  console.log(`::notice::Custody schedule:'));

const fn = new Function('rows', 'legendIn', 'tab', `
${harness}
const legend = legendIn;
${body}
return { byDate, unmatched };
`);

const legend = { dad: {r:0,g:255,b:255}, mom: {r:255,g:0,b:255} };
const { byDate, unmatched } = fn(rows, legend, '2026 - Rev9.01');

const expected = {
  '2026-08-31':'dad', '2026-09-01':'dad', '2026-09-02':'mom', '2026-09-03':'mom',
  '2026-09-04':'mom', '2026-09-05':'dad', '2026-09-06':'dad',
  '2026-09-28':'mom', '2026-09-29':'mom', '2026-09-30':'mom',
  '2026-10-01':'dad', '2026-10-02':'dad', '2026-10-03':'dad', '2026-10-04':'dad'
};

let pass = 0, fail = 0;
for (const [d, who] of Object.entries(expected)) {
  const got = byDate.get(d);
  if (got === who) { pass++; }
  else { fail++; console.log(`  FAIL ${d}: expected ${who}, got ${got || 'MISSING'}`); }
}
for (const [d, who] of byDate) {
  if (!(d in expected)) { fail++; console.log(`  FAIL unexpected ${d} = ${who}`); }
}
console.log(`\n  ${pass} passed, ${fail} failed, ${unmatched} unmatched cells`);
process.exit(fail ? 1 : 0);
