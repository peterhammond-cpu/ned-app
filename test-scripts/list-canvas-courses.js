// Diagnostic: list the Canvas courses the stored CANVAS_API_TOKEN can see.
//
// Exists because COURSE_ID is hardcoded in sync-canvas-homework.js and goes
// stale every time Willy changes grade. Run this to find the new ID.
//
// Runs in GitHub Actions so it can use the CANVAS_API_TOKEN secret without
// anyone needing to generate a fresh token (which requires a pairing code
// from Willy). Prints course names + IDs only — never the token.
//
//   gh workflow run canvas-courses.yml     (or the Run workflow button)

const DOMAIN = 'https://aaca.instructure.com';
const TOKEN = process.env.CANVAS_API_TOKEN;
const CURRENT_HARDCODED_ID = '520'; // keep in sync with sync-canvas-homework.js

if (!TOKEN) { console.error('::error::CANVAS_API_TOKEN not set'); process.exit(1); }

const notice = (m) => console.log(`::notice::${m}`);

async function get(path) {
  const r = await fetch(`${DOMAIN}${path}`, { headers: { Authorization: `Bearer ${TOKEN}` } });
  return { status: r.status, ok: r.ok, body: r.ok ? await r.json() : await r.text() };
}

(async () => {
  const me = await get('/api/v1/users/self');
  if (!me.ok) {
    console.error(`::error::Token rejected — HTTP ${me.status}${me.status === 401 ? ' (expired or revoked)' : ''}`);
    process.exit(1);
  }
  notice(`Token OK — authenticated as ${me.body.name} (user id ${me.body.id})`);

  const act = await get('/api/v1/courses?enrollment_state=active&per_page=100');
  if (!act.ok) { console.error(`::error::Course list failed — HTTP ${act.status}`); process.exit(1); }

  if (!act.body.length) {
    notice('NO ACTIVE COURSES — this token sees nothing. Likely an observer link that did not roll over to the new school year.');
  }
  for (const c of act.body) {
    notice(`COURSE  id=${c.id}  "${c.name || '(unnamed)'}"  code=${c.course_code || '-'}`);
  }

  // Is the hardcoded one still real, and does its front page have content?
  const old = await get(`/api/v1/courses/${CURRENT_HARDCODED_ID}`);
  notice(old.ok
    ? `HARDCODED ${CURRENT_HARDCODED_ID} still accessible: "${old.body.name}"`
    : `HARDCODED ${CURRENT_HARDCODED_ID} NOT accessible — HTTP ${old.status}`);

  const fp = await get(`/api/v1/courses/${CURRENT_HARDCODED_ID}/front_page`);
  notice(fp.ok
    ? `HARDCODED ${CURRENT_HARDCODED_ID} front_page: "${fp.body.title}" — body length ${(fp.body.body || '').length} chars`
    : `HARDCODED ${CURRENT_HARDCODED_ID} front_page unavailable — HTTP ${fp.status}`);

  // For each active course, does it have a front page worth syncing?
  for (const c of act.body) {
    const f = await get(`/api/v1/courses/${c.id}/front_page`);
    if (f.ok) notice(`FRONTPAGE id=${c.id} "${f.body.title}" — ${(f.body.body || '').length} chars`);
  }

  // ---- Does Canvas already hold the grades? -------------------------------
  // Mastery Connect has no parent API and sends no notification emails, so the
  // blindsiding problem has no clean route in. But an observer token can read
  // the observed student's grades, and many teachers mark work in the Canvas
  // gradebook even when standards assessments live in Mastery Connect. If
  // grades show up here, Job B needs no new credentials at all.
  notice('--- GRADES CHECK ---');

  for (const c of act.body) {
    const en = await get(`/api/v1/courses/${c.id}/enrollments?type[]=StudentEnrollment&include[]=current_grading_period_scores`);
    if (!en.ok) { notice(`GRADES id=${c.id} enrollments unavailable — HTTP ${en.status}`); continue; }
    for (const e of en.body) {
      const g = e.grades || {};
      const score = g.current_score ?? g.final_score;
      notice(`GRADES id=${c.id} "${c.name}" student=${e.user_id} score=${score ?? 'none'} grade=${g.current_grade ?? 'none'}`);
    }
    if (!en.body.length) notice(`GRADES id=${c.id} "${c.name}" — no student enrollments visible`);
  }

  // Graded submissions are the early-warning signal: a quiz marked today is
  // exactly the thing Peter currently finds out about too late.
  for (const c of act.body) {
    const sub = await get(`/api/v1/courses/${c.id}/students/submissions?student_ids[]=all&per_page=20&order=graded_at&order_direction=descending`);
    if (!sub.ok) { notice(`SUBMISSIONS id=${c.id} unavailable — HTTP ${sub.status}`); continue; }
    const graded = sub.body.filter(s => s.graded_at);
    notice(`SUBMISSIONS id=${c.id} "${c.name}" — ${graded.length} graded of ${sub.body.length} returned`);
    for (const s of graded.slice(0, 5)) {
      notice(`  GRADED id=${c.id} assignment=${s.assignment_id} score=${s.score ?? 'none'} graded_at=${s.graded_at}`);
    }
  }
})();
