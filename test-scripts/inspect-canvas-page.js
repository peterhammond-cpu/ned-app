// Report the STRUCTURE of the Canvas homework front page.
//
// The parser was written for the 7th grade page: <p> elements holding a
// "Monday, September 15, 2026" header followed by "Subject: task" lines.
// Course 675 ("8th Grade 2026-2027") has 47k chars of content but parses to
// zero items, so its markup differs. This reports enough shape to rewrite
// parseHomework without anyone pasting HTML around.
//
// Emits structure and short samples, not the full page.

const cheerio = require('cheerio');

const DOMAIN = 'https://aaca.instructure.com';
const TOKEN = process.env.CANVAS_API_TOKEN;
const COURSE = process.env.CANVAS_COURSE_ID || '675';

const out = (m) => console.log(`::notice::${m}`);

(async () => {
  const r = await fetch(`${DOMAIN}/api/v1/courses/${COURSE}/front_page`, {
    headers: { Authorization: `Bearer ${TOKEN}` }
  });
  if (!r.ok) { console.log(`::error::front_page HTTP ${r.status}`); process.exit(1); }

  const page = await r.json();
  const html = page.body || '';
  out(`PAGE "${page.title}" — ${html.length} chars`);

  const $ = cheerio.load(html);

  // 1. Which elements actually carry the content?
  const counts = {};
  $('*').each((_, el) => { counts[el.tagName] = (counts[el.tagName] || 0) + 1; });
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 12);
  out('TAGS ' + top.map(([t, n]) => `${t}:${n}`).join('  '));

  // 2. Does the date header the parser looks for appear anywhere at all?
  const DATE_RE = /(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+([A-Za-z]+\.?\s+\d{1,2})/i;
  const text = $.root().text();
  const allDates = text.match(new RegExp(DATE_RE.source, 'gi')) || [];
  out(`DATE-LIKE STRINGS in page text: ${allDates.length}` +
      (allDates.length ? ` — e.g. ${allDates.slice(0, 4).join(' | ')}` : ''));

  // 3. Where do those dates live? That is the element the parser should walk.
  for (const tag of ['p', 'li', 'td', 'h1', 'h2', 'h3', 'h4', 'strong', 'div', 'span']) {
    const hits = [];
    $(tag).each((_, el) => {
      const t = $(el).text().trim();
      if (t && DATE_RE.test(t) && t.length < 200) hits.push(t.replace(/\s+/g, ' ').slice(0, 90));
    });
    if (hits.length) out(`DATES IN <${tag}>: ${hits.length} — first: "${hits[0]}"`);
  }

  // 4. Sample the first few of each likely content element.
  for (const tag of ['p', 'li', 'td']) {
    const samples = [];
    $(tag).each((_, el) => {
      const t = $(el).text().trim().replace(/\s+/g, ' ');
      if (t && samples.length < 6) samples.push(t.slice(0, 110));
    });
    if (samples.length) {
      out(`SAMPLE <${tag}> (${$(tag).length} total):`);
      samples.forEach((s, i) => out(`   ${tag}[${i}] ${s}`));
    }
  }

  // 5. Does the "Subject: task" shape appear?
  const SUBJ_RE = /^([A-Z][A-Za-z\s()/&-]{1,30}):\s*(.+)/;
  let subjHits = 0; const subjEx = [];
  $('p, li, td, div').each((_, el) => {
    const t = $(el).text().trim().replace(/\s+/g, ' ');
    if (SUBJ_RE.test(t)) { subjHits++; if (subjEx.length < 4) subjEx.push(t.slice(0, 90)); }
  });
  out(`"Subject: task" shaped lines: ${subjHits}` + (subjEx.length ? ` — e.g. ${subjEx.join(' | ')}` : ''));

  // 6. Tables are a common rewrite of a list-style page.
  out(`TABLES: ${$('table').length}, ROWS: ${$('tr').length}, LIST ITEMS: ${$('li').length}`);
})();
