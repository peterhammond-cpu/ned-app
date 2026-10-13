// Read the custody schedule from the shared "Kids Schedule/Finance Tracker"
// sheet and record which household Willy is at on each date.
//
// WHY THIS IS AWKWARD: the schedule is not text. The grid holds day numbers
// only; who has the kids is encoded in each cell's BACKGROUND COLOUR. A
// legend row near the top pairs a colour swatch with the labels "Pete" and
// "Julia". So we read the legend at run time and match every day cell
// against it — rather than hardcoding hex values, which would break the
// first time the sheet is recoloured.
//
// PRIVACY: this sheet also contains an "Expense Tracker" tab with financial
// detail between the two households. We read ONLY the custody tab, by name,
// and never touch the rest. Nothing financial enters Ned.
//
// The sheet is owned by the other household, so treat every structural
// assumption as fragile and fail loudly rather than guess.

require('dotenv').config();
const { google } = require('googleapis');
const { createClient } = require('@supabase/supabase-js');

const SHEET_ID = process.env.CUSTODY_SHEET_ID
  || '1-8_J_Q1ZpnhupCgUZSxWLTRQ7bPJSgQAPEY5WF6n8lE';
const TAB_OVERRIDE = process.env.CUSTODY_TAB || null;
const WILLY_STUDENT_ID = '8021ff47-1a41-4341-a2e0-9c4fa53cc389';

// Tabs we must never read, regardless of selection logic.
const FORBIDDEN = /expense|finance|owed/i;

const MONTHS = {
  jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7,
  sep:8, sept:8, oct:9, nov:10, dec:11
};

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// Auth: prefer the service account that already exists for the calendar sync.
// A service account can read any Sheet shared with its email address, so this
// needs no OAuth consent flow at all — just one "Share" click on the sheet.
// Falls back to a user OAuth token if one happens to be configured.
function sheetsClient() {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
    });
    return { client: google.sheets({ version: 'v4', auth }), who: credentials.client_email };
  }
  if (process.env.GOOGLE_REFRESH_TOKEN) {
    const o = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
    o.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
    return { client: google.sheets({ version: 'v4', auth: o }), who: 'user OAuth token' };
  }
  return null;
}

const val = (cell) =>
  (cell && cell.formattedValue != null) ? String(cell.formattedValue).trim() : '';

// Normalise a background colour to {r,g,b} 0-255, or null for unfilled/white.
function bg(cell) {
  const c = cell && cell.effectiveFormat && cell.effectiveFormat.backgroundColor;
  if (!c) return null;
  const r = Math.round((c.red || 0) * 255);
  const g = Math.round((c.green || 0) * 255);
  const b = Math.round((c.blue || 0) * 255);
  if (r > 243 && g > 243 && b > 243) return null;   // white / no fill
  return { r, g, b };
}

const dist = (a, b) =>
  Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);

// Known colours, taken from life-companion/netlify/functions/sync-custody-sheet.js
// which has been reading this same sheet in production. Exact matches, because
// the fills are set from a fixed palette.
const KNOWN = [
  { who: 'dad',        rgb: { r: 0,   g: 255, b: 255 } },  // cyan
  { who: 'mom',        rgb: { r: 255, g: 0,   b: 255 } },  // magenta
  { who: 'transition', rgb: { r: 234, g: 209, b: 220 } }   // gray-pink: handoff day
];

function matchKnown(colour) {
  for (const k of KNOWN) {
    if (dist(colour, k.rgb) < 30) return k.who;
  }
  return null;
}

// Find the legend: a row holding the labels Pete and Julia in filled cells.
function findLegend(rows) {
  for (const row of rows.slice(0, 12)) {
    const cells = row.values || [];
    const legend = {};
    for (const cell of cells) {
      const t = val(cell).toLowerCase();
      const colour = bg(cell);
      if (!colour) continue;
      if (t === 'pete' || t === 'dad') legend.dad = colour;
      else if (t === 'julia' || t === 'mom') legend.mom = colour;
    }
    if (legend.dad && legend.mom) return legend;
  }
  return null;
}

// Pick the live tab. Prefer an explicit override, then a tab naming the
// current year, then the first tab. Never a financial one.
function pickTab(sheets) {
  const titles = sheets.map(s => s.properties.title);
  const allowed = titles.filter(t => !FORBIDDEN.test(t));
  if (TAB_OVERRIDE) {
    if (FORBIDDEN.test(TAB_OVERRIDE)) throw new Error(`Refusing financial tab "${TAB_OVERRIDE}"`);
    if (!titles.includes(TAB_OVERRIDE)) throw new Error(`Tab "${TAB_OVERRIDE}" not found. Tabs: ${titles.join(', ')}`);
    return TAB_OVERRIDE;
  }
  const year = String(new Date().getUTCFullYear());
  const byYear = allowed.filter(t => t.includes(year));
  if (byYear.length) return byYear[0];
  return allowed[0];
}

(async () => {
  const auth = sheetsClient();
  if (!auth) {
    console.log('::warning::No Google credentials — custody sync skipped. ' +
                'Needs GOOGLE_SERVICE_ACCOUNT_KEY (already set for the calendar sync) ' +
                'or a user OAuth token.');
    return;
  }
  const sheets = auth.client;
  console.log(`Reading as: ${auth.who}`);
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID, includeGridData: false });
  const tab = pickTab(meta.data.sheets);
  console.log(`::notice::Custody tab selected: "${tab}"`);

  const resp = await sheets.spreadsheets.get({
    spreadsheetId: SHEET_ID,
    ranges: [tab],
    includeGridData: true,
    fields: 'sheets(data(rowData(values(formattedValue,effectiveFormat/backgroundColor))))'
  });
  const rows = (resp.data.sheets[0].data[0].rowData) || [];

  // Legend is a safety net for a recoloured sheet; the known palette is primary.
  const legend = findLegend(rows);
  console.log(legend
    ? `Legend found — dad rgb(${Object.values(legend.dad)}) mom rgb(${Object.values(legend.mom)})`
    : 'No legend row found; relying on the known colour palette.');

  // Walk the grid. Column A carries a month name that applies until the next
  // one appears; day-number cells inherit it.
  const year = new Date().getUTCFullYear();
  const byDate = new Map();
  let month = null, unmatched = 0;

  for (const row of rows) {
    const cells = row.values || [];
    for (const cell of cells) {
      const t = val(cell).toLowerCase().replace(/[^a-z]/g, '');
      if (MONTHS[t] !== undefined) { month = MONTHS[t]; break; }
    }
    if (month === null) continue;

    for (const cell of cells) {
      const t = val(cell);
      if (!/^\d{1,2}$/.test(t)) continue;
      const day = Number(t);
      if (day < 1 || day > 31) continue;

      const colour = bg(cell);
      if (!colour) continue;

      // Known palette first; fall back to the legend if the sheet is recoloured.
      let who = matchKnown(colour);
      if (!who && legend) {
        const dDad = dist(colour, legend.dad);
        const dMom = dist(colour, legend.mom);
        if (Math.min(dDad, dMom) <= 60) who = dDad <= dMom ? 'dad' : 'mom';
      }
      if (!who) { unmatched++; continue; }   // some other highlight

      // A day number far from its column's month belongs to the neighbouring
      // month (e.g. "31" in a September block is Aug 31).
      let m = month;
      if (day > 25 && cells.indexOf(cell) <= 3 && month > 0) {
        // leading cell with a high day number: likely the previous month
        const probe = new Date(Date.UTC(year, month, 1));
        probe.setUTCDate(0);
        if (day > probe.getUTCDate()) m = month - 1;
      }

      const date = new Date(Date.UTC(year, m, day));
      if (date.getUTCDate() !== day) continue;     // invalid, e.g. Feb 30

      byDate.set(date.toISOString().slice(0, 10), who);
    }
  }

  console.log(`::notice::Custody schedule: ${byDate.size} day(s) resolved` +
              (unmatched ? `, ${unmatched} cell(s) with an unrecognised fill` : ''));

  if (!byDate.size) {
    console.log('::error::Legend found but no coloured day cells matched it. Not writing.');
    process.exitCode = 1;
    return;
  }

  // Store as all-day parenting events — app.js already renders
  // calendar_events.household for event_type 'parenting'.
  const rowsOut = [...byDate.entries()].map(([date, household]) => ({
    student_id: WILLY_STUDENT_ID,
    title: household === 'dad' ? "Dad's"
         : household === 'mom' ? "Mom's"
         : 'Handoff day',
    start_date: date,
    end_date: date,
    is_all_day: true,
    event_type: 'parenting',
    household,
    calendar_source: 'custody_sheet',
    external_id: `custody-${date}`,
    synced_at: new Date().toISOString()
  }));

  const { error } = await supabase.from('calendar_events')
    .upsert(rowsOut, { onConflict: 'student_id,external_id' });

  if (error) {
    console.log(`::error::Custody upsert failed: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const counts = [...byDate.values()].reduce((a, v) => (a[v] = (a[v] || 0) + 1, a), {});
  console.log(`::notice::Custody synced — ${JSON.stringify(counts)}. ` +
              `Today (${today}): ${byDate.get(today) || 'not in sheet'}`);
})().catch(err => {
  const m = err.message || String(err);
  if (/permission|403|not found|404/i.test(m)) {
    console.log('::error::Cannot open the custody sheet. Share it (Viewer is enough) ' +
                'with the service account email printed above, then re-run. ' +
                `Underlying error: ${m}`);
  } else {
    console.log(`::error::Custody sync failed: ${m}`);
  }
  process.exitCode = 1;
});
