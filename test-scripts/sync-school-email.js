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

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

function gmailClient() {
  const o = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  o.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
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
  "event_type": "holiday|meeting|deadline|performance|sports|social|academic|other",
  "description": "detail incl. time and location if given, else null",
  "grade": "8 if 8th-grade specific, otherwise the grades it applies to, else null",
  "action_required": true if a parent must DO something (sign up, pay, RSVP, attend),
  "action_text": "what the parent must do, else null"
}

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

(async () => {
  for (const k of ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GMAIL_REFRESH_TOKEN', 'ANTHROPIC_API_KEY']) {
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
        event_type: e.event_type || 'other',
        description: e.description || null,
        grade: e.grade ? String(e.grade) : null,
        action_required: !!e.action_required,
        action_text: e.action_text || null,
        source: highSignal ? 'email:homeroom' : 'email:school'
      }));

    if (!rows.length) continue;

    const { error } = await supabase.from('school_events')
      .upsert(rows, { onConflict: 'student_id,event_date,title', ignoreDuplicates: true });

    if (error) { console.log(`::warning::Save failed for "${subject}": ${error.message}`); continue; }
    totalSaved += rows.length;
  }

  console.log(`::notice::School email sync: ${msgs.length} email(s), ${totalSaved} event row(s) upserted.`);
})().catch(err => {
  console.log(`::error::School email sync failed: ${err.message}`);
  process.exitCode = 1;
});
