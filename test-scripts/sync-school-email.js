// Pull school email from Gmail, extract events with Claude, save to Supabase.
//
// This closes the gap that killed the original newsletter feature: extraction
// always worked (it is LLM-based, so it survives template redesigns), but
// getting the email in front of it required Peter to open the app, find the
// message, and paste it. That stopped happening in Dec 2025.
//
// Senders (both @alphonsusacademy.org):
//   kkey@  — Katie Key, Willy's homeroom teacher. Dated, 8th-grade specific.
//            HIGH signal — this is the briefing.
//   info@  — school-wide "Week N" newsletter. Mostly retrospective community
//            news. LOW signal; only forward-dated items are kept.
//
// Idempotent: school_events upserts on (student_id, event_date, title) with
// ignoreDuplicates, so re-reading the same newsletter changes nothing.

require('dotenv').config();
const { google } = require('googleapis');
const { createClient } = require('@supabase/supabase-js');

const WILLY_STUDENT_ID = '8021ff47-1a41-4341-a2e0-9c4fa53cc389';
const HIGH_SIGNAL_SENDER = 'kkey@alphonsusacademy.org';
const QUERY = 'from:(info@alphonsusacademy.org OR kkey@alphonsusacademy.org)';
const LOOKBACK_DAYS = Number(process.env.SCHOOL_EMAIL_LOOKBACK_DAYS || 10);

// Must match what the rest of the app understands. sync-canvas-homework.js
// queries event_type in ('no_school','closure') for closure-aware due dates,
// and app.js switches on these for icons. A value outside this set is not a
// cosmetic problem — it silently disables features.
const VALID_EVENT_TYPES = new Set([
  'no_school', 'early_dismissal', 'field_trip', 'form_due',
  'picture_day', 'event', 'reminder'
]);

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

function gmailClient() {
  const o = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  o.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return google.gmail({ version: 'v1', auth: o });
}

// Walk the MIME tree for readable text. Prefer text/plain; fall back to HTML
// with tags stripped, because the school newsletter is an HTML template.
function extractBody(payload) {
  let plain = '', html = '';
  (function walk(p) {
    if (!p) return;
    const data = p.body && p.body.data;
    if (data) {
      const decoded = Buffer.from(data, 'base64').toString('utf8');
      if (p.mimeType === 'text/plain') plain += decoded + '\n';
      else if (p.mimeType === 'text/html') html += decoded + '\n';
    }
    (p.parts || []).forEach(walk);
  })(payload);

  if (plain.trim()) return plain;
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function extractEvents(text, sentDate, sender) {
  // sentDate matters: these emails write "Thurs, Nov 5" with no year. Inferring
  // from today breaks every December, when "Jan 5" means next year. Anchoring
  // to the send date is correct year-round.
  const prompt = `Extract school events from this email from Willy's school (Alphonsus Academy, AACA).

The email was sent on ${sentDate}. Dates in the body usually omit the year —
infer it from the send date, so a date earlier in the calendar than the send
date belongs to the following year.

Willy is in 8th grade, homeroom "Key" (his classes are prefixed 8Key).

Return ONLY a JSON array. One object per event:
{
  "title": "short name",
  "event_date": "YYYY-MM-DD",
  "event_type": one of exactly: no_school | early_dismissal | field_trip | form_due | picture_day | event | reminder,
  "description": "detail incl. time and location if given, else null",
  "grade": "8 if 8th-grade specific, otherwise the grades it applies to, else null",
  "action_required": true if a parent must DO something (sign up, pay, RSVP, attend),
  "action_text": "what the parent must do, else null"
}

ALWAYS capture these, even though they read as administrative rather than as
events. They are the highest-value dates in the whole email:
- term/trimester start and end ("End of T1", "T2 Begins")
- report cards, conferences, grade-posting deadlines
- anything stating when work stops counting
A trimester ending is when grades lock — it matters more than a pizza lunch.
Use event_type "reminder" for these and set action_required false unless the
parent must do something.

event_type rules — these values are load-bearing, not labels:
- "no_school" for closures, holidays, teacher PD days, breaks. The homework
  sync queries this exact value to avoid setting due dates on closed days,
  so a closure typed as anything else silently breaks due-date logic.
- "early_dismissal" for half days.
- "form_due" when something must be returned or paid by a date.
- "event" for everything else with a date; "reminder" for soft nudges.

Rules:
- Only events with a determinable date. Skip anything undated.
- Skip events already in the past relative to the send date.
- Skip pure news and photo recaps with no future date.
- Prefer precision over volume. Return [] if there is nothing dated.

---
${text.slice(0, 18000)}`;

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!r.ok) throw new Error(`Anthropic API ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const body = await r.json();
  const raw = body.content[0].text;
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try { return JSON.parse(match[0]); }
  catch { console.log(`::warning::Could not parse model output as JSON from ${sender}`); return []; }
}

// The same event arrives from both senders with different wording —
//   "No School - Indigenous People's Day"   (homeroom)
//   "No School—Indigenous Peoples' Day"     (school newsletter)
// The upsert key is (student_id, event_date, title), so punctuation alone
// defeats it. Normalise hard for comparison only; the stored title is
// untouched.
function normTitle(t) {
  return String(t || '')
    .toLowerCase()
    .replace(/[\u2010-\u2015]/g, '-')      // en/em dashes -> hyphen
    .replace(/['\u2018\u2019]/g, '')        // apostrophes
    .replace(/\b(\d{4})\b/g, '')            // years: "Rocket Run 2026" == "Rocket Run"
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(the|a|an|our|class|aaca|ums|hr\s*\d+)\b/g, ' ')
    .trim().replace(/\s+/g, ' ');
}

// Homeroom wins: it is Willy-specific and tends to carry the correct detail.
const rank = (src) => (src === 'email:homeroom' ? 2 : 1);

// Exact normalisation misses the common case where one source qualifies the
// other: "Early Dismissal" vs "Halloween-Early Dismissal", same day, same
// event. Treat two titles on the SAME DATE as the same event when one wholly
// contains the other, provided the shorter is substantial enough that the
// match is not accidental. Same-date is doing most of the safety work here.
function sameEvent(a, b) {
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (short.split(' ').length < 2 || short.length < 9) return false;
  return long.includes(short);
}

// Collapse a day's events, keeping the best-ranked member of each cluster.
function collapseDay(items) {
  const kept = [];
  for (const it of items) {
    const n = normTitle(it.title);
    const hit = kept.find(k => sameEvent(normTitle(k.title), n));
    if (!hit) { kept.push(it); continue; }
    // Prefer the better source; on a tie prefer the more descriptive title.
    const better = rank(it.source) > rank(hit.source)
      || (rank(it.source) === rank(hit.source) && String(it.title).length > String(hit.title).length);
    if (better) kept[kept.indexOf(hit)] = it;
  }
  return kept;
}

(async () => {
  for (const k of ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN', 'ANTHROPIC_API_KEY']) {
    if (!process.env[k]) {
      console.log(`::warning::${k} not set — school email sync skipped. See docs/school-email-setup.md`);
      return;
    }
  }

  const gmail = gmailClient();
  const q = `${QUERY} newer_than:${LOOKBACK_DAYS}d`;
  const list = await gmail.users.messages.list({ userId: 'me', q, maxResults: 25 });
  const msgs = list.data.messages || [];
  console.log(`Found ${msgs.length} school email(s) in the last ${LOOKBACK_DAYS} days.`);

  let totalSaved = 0;
  const collected = [];

  for (const { id } of msgs) {
    const full = await gmail.users.messages.get({ userId: 'me', id, format: 'full' });
    const headers = full.data.payload.headers || [];
    const h = (n) => (headers.find(x => x.name.toLowerCase() === n) || {}).value || '';
    const from = h('from'), subject = h('subject'), sent = h('date');

    const text = extractBody(full.data.payload);
    if (!text || text.length < 40) { console.log(`  skip (no text): ${subject}`); continue; }

    const highSignal = from.toLowerCase().includes(HIGH_SIGNAL_SENDER);
    const events = await extractEvents(text, sent, from);
    console.log(`  ${highSignal ? '[homeroom]' : '[school]  '} "${subject.slice(0, 55)}" -> ${events.length} event(s)`);

    const rows = events
      .filter(e => e && e.title && /^\d{4}-\d{2}-\d{2}$/.test(e.event_date || ''))
      .map(e => ({
        student_id: WILLY_STUDENT_ID,
        title: String(e.title).slice(0, 200),
        event_date: e.event_date,
        event_type: VALID_EVENT_TYPES.has(e.event_type) ? e.event_type : 'event',
        description: e.description || null,
        grade: e.grade ? String(e.grade) : null,
        action_required: !!e.action_required,
        action_text: e.action_text || null,
        source: highSignal ? 'email:homeroom' : 'email:school'
      }));

    collected.push(...rows);
  }

  // Dedupe within this run, per day, allowing one title to qualify another.
  const byDay = new Map();
  for (const r of collected) {
    if (!byDay.has(r.event_date)) byDay.set(r.event_date, []);
    byDay.get(r.event_date).push(r);
  }
  const deduped = [...byDay.values()].flatMap(collapseDay);
  const collapsed = collected.length - deduped.length;

  // Reconcile against what is already stored: drop anything that duplicates an
  // existing row, and clear out duplicates written by earlier runs.
  const dates = [...new Set(deduped.map(r => r.event_date))];
  let removed = 0;
  if (dates.length) {
    const { data: existing } = await supabase
      .from('school_events')
      .select('id,event_date,title,source')
      .eq('student_id', WILLY_STUDENT_ID)
      .in('event_date', dates);

    const byDate = new Map();
    for (const e of (existing || [])) {
      if (!byDate.has(e.event_date)) byDate.set(e.event_date, []);
      byDate.get(e.event_date).push(e);
    }

    // Existing duplicate clusters: keep the best, delete the rest.
    const doomed = [];
    for (const dayRows of byDate.values()) {
      const clusters = [];
      for (const e of dayRows) {
        const n = normTitle(e.title);
        const c = clusters.find(cl => sameEvent(normTitle(cl[0].title), n));
        if (c) c.push(e); else clusters.push([e]);
      }
      for (const cl of clusters) {
        if (cl.length < 2) continue;
        cl.sort((a, b) => rank(b.source) - rank(a.source)
                       || String(b.title).length - String(a.title).length);
        doomed.push(...cl.slice(1).map(g => g.id));
      }
    }
    if (doomed.length) {
      const { error } = await supabase.from('school_events').delete().in('id', doomed);
      if (error) console.log(`::warning::Could not clear duplicates: ${error.message}`);
      else removed = doomed.length;
    }
  }

  if (deduped.length) {
    const { error } = await supabase.from('school_events')
      .upsert(deduped, { onConflict: 'student_id,event_date,title', ignoreDuplicates: true });
    if (error) console.log(`::warning::Save failed: ${error.message}`);
    else totalSaved = deduped.length;
  }

  console.log(`::notice::School email sync: ${msgs.length} email(s), ${totalSaved} event(s) upserted` +
              (collapsed ? `, ${collapsed} cross-source duplicate(s) merged` : '') +
              (removed ? `, ${removed} stale duplicate(s) removed` : '') + '.');
})().catch(err => {
  console.log(`::error::School email sync failed: ${err.message}`);
  process.exitCode = 1;
});
