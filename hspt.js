// ==========================================
// HSPT PRACTICE TAB
// ==========================================
// About 12 minutes a day for the HSPT (Sat 5 Dec 2026, DePaul College Prep).
// Built on what the evidence actually supports:
//   - retrieval practice with an explanation after every answer
//   - spaced review: a missed question comes back after 1 day, then 3; it
//     drops out after two correct answers on separate days
//   - interleaving: question types are mixed, weighted toward weak ones
//   - from 4 Nov, a short timed sprint at his ACCOMMODATED pace
//
// Allowance is a weekly target of finished sessions (no streaks, nothing lost
// for a missed day), and it rewards finishing, never the score.
//
// Scheduling state lives in localStorage on his phone. Every finished session
// is also sent to Supabase (write-only) for the adult summary on the Mastery tab.

const HSPT = (function () {
    const TEST_DATE = '2026-12-05';
    const SPRINT_FROM = '2026-11-04';
    const WEEKLY_TARGET = 4;
    const EXTENDED_TIME = 1.5; // his accommodation; confirm DePaul's exact figure
    const STATE_KEY = 'nedHsptState';

    // Seconds per question on the real test (standard time).
    const PACE = { verbal: 16, quant: 35, reading: 24, math: 42, language: 25 };
    const SECTION_LABEL = { verbal: 'Verbal', quant: 'Quantitative', reading: 'Reading', math: 'Math', language: 'Language' };
    // How much each section is worth chasing, from his Mastery data: Verbal and
    // Quant are new to him (not on the CPS test); Language is already strong.
    const PRIORITY = { verbal: 1.2, quant: 1.2, reading: 1.0, math: 0.8, language: 0.5 };
    const DIAGNOSTIC_ORDER = ['verbal', 'quant', 'math', 'reading', 'language'];
    const PRACTICE_SIZE = 15;       // questions per session before the sprint phase
    const PRACTICE_SIZE_SPRINT = 12; // shorter once the sprint is added, to stay near 12 minutes
    const REVIEW_MAX = 7;
    const SPRINT_SIZE = 8;

    let bank = null;
    let byId = {};
    let run = null; // the session in progress

    // ---------- dates (local, not UTC) ----------
    function dayStr(d = new Date()) {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    function addDays(str, n) { const d = new Date(str + 'T00:00:00'); d.setDate(d.getDate() + n); return dayStr(d); }
    function weekStart(str = dayStr()) { // Monday
        const d = new Date(str + 'T00:00:00');
        d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
        return dayStr(d);
    }
    function daysToTest() { return Math.round((new Date(TEST_DATE + 'T00:00:00') - new Date(dayStr() + 'T00:00:00')) / 86400000); }

    // ---------- state ----------
    function blankState() { return { version: 1, items: {}, typeHist: {}, diagnostic: {}, sessions: [], pending: [] }; }
    function load() {
        try { return Object.assign(blankState(), JSON.parse(localStorage.getItem(STATE_KEY) || '{}')); }
        catch (e) { console.error('HSPT state unreadable, starting fresh', e); return blankState(); }
    }
    function save(state) { localStorage.setItem(STATE_KEY, JSON.stringify(state)); }

    function sessionsThisWeek(state) {
        const ws = weekStart();
        return state.sessions.filter(s => s.completed && s.date >= ws).length;
    }

    // Rolling accuracy over the last 10 answers of a type; unseen counts as 50%.
    function typeAccuracy(state, type) {
        const h = (state.typeHist[type] || []).slice(-10);
        return h.length ? h.reduce((a, b) => a + b, 0) / h.length : 0.5;
    }

    // ---------- bank ----------
    async function loadBank() {
        if (bank) return bank;
        const res = await fetch('hspt/bank.json', { cache: 'no-cache' });
        if (!res.ok) throw new Error(`bank.json ${res.status}`);
        bank = await res.json();
        if (!Array.isArray(bank) || !bank.length) throw new Error('bank.json is empty');
        byId = Object.fromEntries(bank.map(it => [it.id, it]));
        return bank;
    }
    const sectionsInBank = () => DIAGNOSTIC_ORDER.filter(s => bank.some(it => it.section === s));
    const typesOf = section => [...new Set(bank.filter(it => it.section === section).map(it => it.type))];

    function shuffle(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
        return a;
    }

    // Unseen items first, then the least recently seen.
    function freshItems(state, filter, exclude) {
        return bank.filter(it => filter(it) && !exclude.has(it.id))
            .sort((a, b) => {
                const sa = state.items[a.id], sb = state.items[b.id];
                if (!sa !== !sb) return sa ? 1 : -1;
                return (sa?.last || 0) - (sb?.last || 0) || Math.random() - 0.5;
            });
    }

    // A reading question only makes sense with its passage, so passages travel as a block.
    function passageBlock(state, exclude) {
        const pool = freshItems(state, it => it.section === 'reading', exclude);
        if (!pool.length) return [];
        const pid = pool[0].passage_id;
        return bank.filter(it => it.passage_id === pid).map(it => ({ id: it.id, phase: 'new' }));
    }

    // ---------- building a session ----------
    function nextDiagnosticSection(state) {
        return sectionsInBank().find(s => !state.diagnostic[s]) || null;
    }

    function buildDiagnostic(state, section) {
        const used = new Set();
        let queue = [];
        if (section === 'reading') {
            queue = passageBlock(state, used);
            queue.forEach(q => used.add(q.id));
            const more = passageBlock(state, used);
            queue = queue.concat(more);
        } else {
            const types = typesOf(section);
            const per = Math.max(1, Math.floor(15 / types.length));
            types.forEach(type => {
                // One easy, then medium: a diagnostic should map skills, not discourage.
                const pool = freshItems(state, it => it.type === type, used)
                    .sort((a, b) => Math.abs(a.difficulty - 2) - Math.abs(b.difficulty - 2));
                pool.slice(0, per).forEach(it => { used.add(it.id); queue.push({ id: it.id, phase: 'diagnostic' }); });
            });
            queue = shuffle(queue);
        }
        queue.forEach(q => { q.phase = 'diagnostic'; });
        return { mode: 'diagnostic', section, queue };
    }

    function buildPractice(state) {
        const today = dayStr();
        const size = today >= SPRINT_FROM ? PRACTICE_SIZE_SPRINT : PRACTICE_SIZE;
        const used = new Set();
        const queue = [];

        // 1) Spaced review: anything due today or earlier, oldest first.
        Object.entries(state.items)
            .filter(([id, s]) => s.due && s.due <= today && byId[id] && byId[id].section !== 'reading')
            .sort((a, b) => a[1].due.localeCompare(b[1].due))
            .slice(0, REVIEW_MAX)
            .forEach(([id]) => { used.add(id); queue.push({ id, phase: 'review' }); });

        // 2) New items, weighted toward weak types in high-priority sections.
        const sections = sectionsInBank();
        const types = sections.flatMap(sec => typesOf(sec).filter(t => sec !== 'reading').map(t => ({ sec, t })));
        const weight = ({ sec, t }) => PRIORITY[sec] * (1 - typeAccuracy(state, t)) + 0.15;
        let readingAdded = false;
        while (queue.length < size) {
            // Every other session or so, include one reading passage (4 questions) as a block.
            if (!readingAdded && sections.includes('reading') && queue.length <= size - 4 && Math.random() < 0.5) {
                readingAdded = true;
                passageBlock(state, used).forEach(q => { used.add(q.id); queue.push(q); });
                continue;
            }
            readingAdded = true;
            const total = types.reduce((s, x) => s + weight(x), 0);
            let r = Math.random() * total, chosen = types[0];
            for (const x of types) { r -= weight(x); if (r <= 0) { chosen = x; break; } }
            const acc = typeAccuracy(state, chosen.t);
            const target = acc > 0.8 ? 3 : acc > 0.6 ? 2 : 1;
            const pool = freshItems(state, it => it.type === chosen.t, used)
                .sort((a, b) => (!state.items[a.id] === !state.items[b.id] ? Math.abs(a.difficulty - target) - Math.abs(b.difficulty - target) : 0));
            if (!pool.length) { types.splice(types.indexOf(chosen), 1); if (!types.length) break; continue; }
            used.add(pool[0].id);
            queue.push({ id: pool[0].id, phase: 'new' });
        }

        // Mix review and new together, but keep a reading passage's questions in order.
        const reading = queue.filter(q => byId[q.id].section === 'reading');
        const rest = shuffle(queue.filter(q => byId[q.id].section !== 'reading'));
        const at = Math.floor(rest.length / 2);
        const mixed = [...rest.slice(0, at), ...reading, ...rest.slice(at)];

        // 3) From 4 Nov: a timed sprint at accommodated pace, on one section.
        let sprint = null;
        if (today >= SPRINT_FROM) {
            const sec = ['verbal', 'quant', 'math', 'language'].filter(s => sections.includes(s))[state.sessions.length % 4] || 'verbal';
            const items = freshItems(state, it => it.section === sec, used).slice(0, SPRINT_SIZE);
            if (items.length) sprint = { section: sec, ids: items.map(it => it.id), seconds: Math.round(items.length * PACE[sec] * EXTENDED_TIME) };
        }
        return { mode: 'practice', queue: mixed, sprint };
    }

    // ---------- recording answers ----------
    function record(state, item, phase, correct) {
        const today = dayStr();
        const s = state.items[item.id] || { n: 0, c: 0, box: null, due: null };
        s.n++; if (correct) s.c++;
        s.last = Date.now();
        if (!correct) { s.box = 0; s.due = addDays(today, 1); }
        else if (phase === 'review' && s.box != null) {
            if (s.box >= 1) { s.box = null; s.due = null; }   // second delayed correct: graduated
            else { s.box = 1; s.due = addDays(today, 3); }
        }
        state.items[item.id] = s;
        const h = state.typeHist[item.type] || [];
        h.push(correct ? 1 : 0);
        state.typeHist[item.type] = h.slice(-20);
    }

    async function upload(payload) {
        const { data, error } = await NedCore.getClient().rpc('record_hspt_session', {
            p_student_id: NedCore.getStudentId(), p_session: payload.session, p_attempts: payload.attempts,
        });
        if (error) throw error;
        return data;
    }
    async function flushPending() {
        const state = load();
        if (!state.pending.length) return;
        const left = [];
        for (const p of state.pending) {
            try { await upload(p); } catch (e) { console.error('HSPT upload still failing:', e); left.push(p); }
        }
        const fresh = load(); fresh.pending = left; save(fresh);
    }

    // ---------- UI ----------
    const $ = id => document.getElementById(id);
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    function weekDots(n) {
        return Array.from({ length: WEEKLY_TARGET }, (_, i) => `<span class="hspt-dot ${i < n ? 'on' : ''}"></span>`).join('');
    }

    function renderHome() {
        const state = load();
        const done = sessionsThisWeek(state);
        const diag = nextDiagnosticSection(state);
        const doneToday = state.sessions.some(s => s.completed && s.date === dayStr());
        const days = daysToTest();
        const sections = sectionsInBank();
        const diagIndex = diag ? sections.indexOf(diag) + 1 : 0;

        let action;
        if (days < 0) action = `<p class="card-subtitle">The HSPT is done. Nice work getting there.</p>`;
        else if (diag) action = `
            <button class="hspt-start" onclick="HSPT.start()">Start: ${SECTION_LABEL[diag]} check-in</button>
            <p class="hspt-hint">Check-in ${diagIndex} of ${sections.length}. No timer. It shows where to focus, so guess if you're not sure.</p>`;
        else action = `
            <button class="hspt-start" onclick="HSPT.start()">${doneToday ? 'Do another round' : "Start today's practice"}</button>
            <p class="hspt-hint">About 12 minutes${dayStr() >= SPRINT_FROM ? ', with a short timed sprint at the end' : ''}.${doneToday ? ' Today already counts.' : ''}</p>`;

        $('hspt-home').innerHTML = `
            <div class="hspt-countdown">${days > 0 ? `<b>${days}</b> days to the HSPT` : days === 0 ? '<b>Today</b> is the HSPT' : ''}</div>
            <div class="hspt-week">
                <div class="hspt-dots">${weekDots(done)}</div>
                <div class="hspt-week-text">${Math.min(done, WEEKLY_TARGET)} of ${WEEKLY_TARGET} this week${done >= WEEKLY_TARGET ? ' ✅' : ''}</div>
            </div>
            ${action}`;
        $('hspt-home').hidden = false;
        $('hspt-quiz').hidden = true;
    }

    async function open() {
        if (run) return; // switching tabs mid-session must not throw the session away
        try {
            await loadBank();
            renderHome();
            flushPending();
        } catch (e) {
            console.error('HSPT failed to load:', e);
            $('hspt-home').innerHTML = '<div class="empty-state">Could not load the practice questions. Check the connection and try again.</div>';
        }
    }

    function start() {
        const state = load();
        const diag = nextDiagnosticSection(state);
        const plan = diag ? buildDiagnostic(state, diag) : buildPractice(state);
        if (!plan.queue.length) { $('hspt-home').innerHTML = '<div class="empty-state">No questions available.</div>'; return; }
        run = {
            ...plan, pos: 0, attempts: [], started: new Date().toISOString(), id: crypto.randomUUID(),
            shownAt: 0, inSprint: false, sprintPos: 0, sprintEnds: 0, timer: null, sprintAnswers: [],
        };
        $('hspt-home').hidden = true;
        $('hspt-quiz').hidden = false;
        showQuestion();
    }

    function currentItem() {
        return run.inSprint ? byId[run.sprint.ids[run.sprintPos]] : byId[run.queue[run.pos].id];
    }

    // Shuffle answer order on every showing, so position is never a clue (the
    // authored sets drifted into A-B-C-D cycles). "No mistake" stays last, as on
    // the real test; true/false/uncertain keeps its fixed order.
    function choiceOrder(it) {
        const idx = it.choices.map((_, i) => i);
        if (it.type === 'logic') return idx;
        const last = it.choices[it.choices.length - 1];
        const pinLast = /^no mistake/i.test(last);
        const body = shuffle(pinLast ? idx.slice(0, -1) : idx);
        return pinLast ? [...body, idx.length - 1] : body;
    }

    function showQuestion() {
        const it = currentItem();
        run.order = choiceOrder(it);
        const total = run.inSprint ? run.sprint.ids.length : run.queue.length;
        const pos = run.inSprint ? run.sprintPos : run.pos;
        const isReview = !run.inSprint && run.queue[run.pos].phase === 'review';
        run.shownAt = Date.now();

        const passage = it.passage
            ? `<div class="hspt-passage">${it.passage.split(/\n\n+/).map(p => `<p>${esc(p)}</p>`).join('')}</div>` : '';
        $('hspt-quiz').innerHTML = `
            <div class="hspt-quiz-top">
                <span class="hspt-tag">${SECTION_LABEL[it.section]}${isReview ? ' · review' : ''}${run.inSprint ? ' · sprint' : ''}</span>
                <span class="hspt-count">${pos + 1} / ${total}</span>
                <button class="hspt-quit" onclick="HSPT.quit()" aria-label="Stop">✕</button>
            </div>
            ${run.inSprint ? '<div class="hspt-timer"><span id="hspt-timer-fill"></span></div>' : ''}
            ${passage}
            <div class="hspt-prompt">${it.prompt}</div>
            <div class="hspt-choices">
                ${run.order.map((orig, pos) => `<button class="hspt-choice" data-i="${orig}" onclick="HSPT.answer(${orig})">
                    <span class="hspt-letter">${'ABCD'[pos]}</span><span>${esc(it.choices[orig])}</span></button>`).join('')}
            </div>
            <div id="hspt-feedback"></div>`;
        if (run.inSprint) tickTimer();
        window.scrollTo({ top: $('hspt-quiz').offsetTop - 10, behavior: 'smooth' });
    }

    function attemptRecord(it, phase, chosen) {
        return {
            item_id: it.id, section: it.section, type: it.type, phase,
            correct: chosen === it.answer, chosen, ms: Date.now() - run.shownAt, answered_at: new Date().toISOString(),
        };
    }

    function answer(i) {
        const it = currentItem();
        if (run.inSprint) {
            // Sprint = test conditions: no feedback until the end.
            run.sprintAnswers.push(attemptRecord(it, 'sprint', i));
            run.sprintPos++;
            if (run.sprintPos >= run.sprint.ids.length) return endSprint();
            return showQuestion();
        }
        if (document.querySelector('.hspt-choice.picked')) return; // already answered
        const phase = run.queue[run.pos].phase;
        const att = attemptRecord(it, phase, i);
        run.attempts.push(att);
        const state = load(); record(state, it, phase, att.correct); save(state);

        document.querySelectorAll('.hspt-choice').forEach(b => {
            const k = Number(b.dataset.i);
            b.disabled = true;
            if (k === it.answer) b.classList.add('right');
            if (k === i) b.classList.add('picked', att.correct ? 'right' : 'wrong');
        });
        $('hspt-feedback').innerHTML = `
            <div class="hspt-explain ${att.correct ? 'ok' : 'miss'}">
                <b>${att.correct ? 'Right.' : `Answer: ${'ABCD'[run.order.indexOf(it.answer)]}.`}</b> ${it.explanation}
                ${att.correct ? '' : '<div class="hspt-later">This one comes back tomorrow.</div>'}
            </div>
            <button class="hspt-next" onclick="HSPT.next()">${run.pos + 1 < run.queue.length || run.sprint ? 'Next →' : 'Finish'}</button>`;
        $('hspt-feedback').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function next() {
        run.pos++;
        if (run.pos < run.queue.length) return showQuestion();
        if (run.sprint) return startSprint();
        finish(true);
    }

    function startSprint() {
        $('hspt-quiz').innerHTML = `
            <div class="hspt-sprint-intro">
                <h3>⏱ Sprint: ${run.sprint.ids.length} ${SECTION_LABEL[run.sprint.section]} questions</h3>
                <p>${Math.round(run.sprint.seconds / 60 * 10) / 10} minutes, which is your real test pace with extra time.</p>
                <p>No answers shown until the end. Never leave one blank: if you're stuck, cross out what's wrong and guess.</p>
                <button class="hspt-start" onclick="HSPT.goSprint()">Go</button>
            </div>`;
    }
    function goSprint() {
        run.inSprint = true; run.sprintPos = 0;
        run.sprintEnds = Date.now() + run.sprint.seconds * 1000;
        showQuestion();
    }
    function tickTimer() {
        clearTimeout(run.timer);
        const left = run.sprintEnds - Date.now();
        const fill = $('hspt-timer-fill');
        if (fill) fill.style.width = `${Math.max(0, left / (run.sprint.seconds * 1000)) * 100}%`;
        if (left <= 0) return endSprint();
        run.timer = setTimeout(tickTimer, 500);
    }
    function endSprint() {
        clearTimeout(run.timer);
        run.inSprint = false;
        const state = load();
        // Unanswered when time ran out count as misses (on the real test, guess instead).
        run.sprint.ids.slice(run.sprintAnswers.length).forEach(id => {
            run.sprintAnswers.push({ item_id: id, section: byId[id].section, type: byId[id].type, phase: 'sprint',
                correct: false, chosen: null, ms: null, answered_at: new Date().toISOString() });
        });
        run.sprintAnswers.forEach(a => record(state, byId[a.item_id], 'sprint', a.correct));
        save(state);
        run.attempts.push(...run.sprintAnswers);
        finish(true);
    }

    function quit() {
        clearTimeout(run?.timer);
        if (run && run.attempts.length) finish(false);
        else { run = null; renderHome(); }
    }

    function finish(completed) {
        const state = load();
        const n = run.attempts.length, c = run.attempts.filter(a => a.correct).length;
        if (completed && run.mode === 'diagnostic') state.diagnostic[run.section] = dayStr();
        state.sessions.push({ date: dayStr(), mode: run.mode, n, correct: c, completed });
        state.sessions = state.sessions.slice(-200);
        const payload = {
            session: { id: run.id, mode: run.mode, section: run.section || null, started_at: run.started,
                completed_at: completed ? new Date().toISOString() : null, n_items: n, n_correct: c },
            attempts: run.attempts,
        };
        state.pending.push(payload);
        save(state);
        flushPending();

        const week = sessionsThisWeek(state);
        const comeBack = Object.values(state.items).filter(s => s.due === addDays(dayStr(), 1)).length;
        const sprintMisses = run.attempts.filter(a => a.phase === 'sprint' && !a.correct);
        const sprintNote = run.sprint && run.attempts.some(a => a.phase === 'sprint')
            ? `<p>Sprint: ${run.attempts.filter(a => a.phase === 'sprint' && a.correct).length} of ${run.sprint.ids.length}.
               ${sprintMisses.length ? 'The ones you missed come back tomorrow with explanations.' : ''}</p>` : '';
        $('hspt-quiz').innerHTML = `
            <div class="hspt-done">
                <h3>${completed ? 'Done ✅' : 'Stopped. Saved what you did.'}</h3>
                <p>${c} of ${n} right.</p>
                ${sprintNote}
                ${completed ? `<div class="hspt-week"><div class="hspt-dots">${weekDots(week)}</div>
                    <div class="hspt-week-text">${Math.min(week, WEEKLY_TARGET)} of ${WEEKLY_TARGET} this week${week >= WEEKLY_TARGET ? '. Target reached ✅' : ''}</div></div>`
                    : '<p class="hspt-hint">Only finished sessions count toward the week.</p>'}
                ${comeBack ? `<p class="hspt-hint">${comeBack} question${comeBack > 1 ? 's' : ''} will come back tomorrow. Getting them right the second time is what makes it stick.</p>` : ''}
                <button class="hspt-next" onclick="HSPT.home()">Back</button>
            </div>`;
        run = null;
    }

    // ---------- adult summary (Mastery tab, behind the key) ----------
    const TYPE_LABEL = {
        synonym: 'Synonyms', antonym: 'Antonyms', analogy: 'Analogies', classification: 'Odd one out', logic: 'Verbal logic',
        series: 'Number series', manipulation: 'Number puzzles', nongeo_compare: 'Comparisons', geo_compare: 'Shape comparisons',
        main_idea: 'Main idea', detail: 'Details', inference: 'Inference', vocab_context: 'Vocab in context',
        purpose_tone: 'Purpose & tone', theme: 'Theme', figurative: 'Figurative language',
        usage: 'Grammar & usage', spelling: 'Spelling', composition: 'Composition',
        mult: 'Multiplication', divide: 'Division', decimal: 'Decimals', fracAdd: 'Adding fractions', fracMul: 'Multiplying fractions',
        percentWord: 'Percent problems', linear: 'Equations', linear2: 'Two-sided equations', area: 'Area & perimeter',
        angles: 'Angles', ratio: 'Ratios', orderOps: 'Order of operations', average: 'Averages', exponent: 'Exponents',
    };
    const pct = (c, n) => n ? Math.round(c / n * 100) + '%' : '—';

    async function report(key) {
        const box = $('hspt-report');
        if (!box) return;
        box.innerHTML = '<div class="empty-state">Loading…</div>';
        const since = new Date(Date.now() - 56 * 86400000).toISOString();
        const { data, error } = await NedCore.getClient().rpc('get_hspt_progress', {
            p_student_id: NedCore.getStudentId(), p_key: key, p_since: since,
        });
        if (error) {
            console.error('HSPT report failed:', error);
            box.innerHTML = '<div class="empty-state">Could not load HSPT practice.</div>';
            return;
        }
        const sessions = data.sessions || [], attempts = data.attempts || [];
        if (!attempts.length) {
            box.innerHTML = `<div class="empty-state">No practice yet. ${daysToTest()} days to the test.</div>`;
            return;
        }
        const ws = weekStart();
        const localDay = iso => dayStr(new Date(iso));
        const weekSessions = sessions.filter(s => s.completed_at && localDay(s.started_at) >= ws);
        const weekAttempts = attempts.filter(a => localDay(a.answered_at) >= ws);

        // Accuracy by type over everything, for strengths / needs work.
        const byType = {};
        attempts.forEach(a => {
            const t = byType[a.type] || (byType[a.type] = { type: a.type, section: a.section, n: 0, c: 0 });
            t.n++; if (a.correct) t.c++;
        });
        const enough = Object.values(byType).filter(t => t.n >= 5);
        const ranked = [...enough].sort((a, b) => b.c / b.n - a.c / a.n);
        const strengths = ranked.slice(0, 3).filter(t => t.c / t.n >= 0.7);
        const needs = ranked.slice(-3).reverse().filter(t => t.c / t.n < 0.8 && !strengths.includes(t));

        const bySection = {};
        attempts.forEach(a => {
            const s = bySection[a.section] || (bySection[a.section] = { n: 0, c: 0, wn: 0, wc: 0 });
            s.n++; if (a.correct) s.c++;
            if (localDay(a.answered_at) >= ws) { s.wn++; if (a.correct) s.wc++; }
        });

        // Retention: questions answered again days after a miss. Best predictor of real gains.
        const review = attempts.filter(a => a.phase === 'review');
        const sprint = attempts.filter(a => a.phase === 'sprint' && a.ms != null);
        const paceRows = Object.entries(sprint.reduce((m, a) => { (m[a.section] = m[a.section] || []).push(a.ms); return m; }, {}))
            .map(([sec, ms]) => {
                const avg = ms.reduce((s, v) => s + v, 0) / ms.length / 1000;
                const target = PACE[sec] * EXTENDED_TIME;
                return `<div class="hspt-rrow"><span>${SECTION_LABEL[sec]}</span><span>${avg.toFixed(0)}s per question</span><span class="${avg <= target ? 'good' : 'warn'}">target ${target.toFixed(0)}s</span></div>`;
            }).join('');

        const typeLine = t => `<div class="hspt-rrow"><span>${TYPE_LABEL[t.type] || t.type}</span><span class="hspt-rsec">${SECTION_LABEL[t.section]}</span><span>${pct(t.c, t.n)} <small>(${t.n})</small></span></div>`;
        const days = weekSessions.map(s => new Date(s.started_at).toLocaleDateString('en-US', { weekday: 'short' }));

        box.innerHTML = `
            <p class="card-subtitle">${daysToTest()} days to the test · ${sessions.filter(s => s.completed_at).length} sessions finished in total</p>
            <div class="hspt-rblock">
                <div class="hspt-rhead">This week (allowance)</div>
                <div class="hspt-week"><div class="hspt-dots">${weekDots(weekSessions.length)}</div>
                    <div class="hspt-week-text">${weekSessions.length} of ${WEEKLY_TARGET}${weekSessions.length >= WEEKLY_TARGET ? ' ✅ target reached' : ''}${days.length ? ' · ' + days.join(', ') : ''}</div></div>
                <div class="hspt-hint">${weekAttempts.length} questions this week. Counts finished sessions only, whatever the score.</div>
            </div>
            <div class="hspt-rblock">
                <div class="hspt-rhead">By section</div>
                ${DIAGNOSTIC_ORDER.filter(s => bySection[s]).map(s => `<div class="hspt-rrow"><span>${SECTION_LABEL[s]}</span><span>this week ${pct(bySection[s].wc, bySection[s].wn)}</span><span>overall ${pct(bySection[s].c, bySection[s].n)} <small>(${bySection[s].n})</small></span></div>`).join('')}
            </div>
            ${strengths.length ? `<div class="hspt-rblock"><div class="hspt-rhead">Strongest</div>${strengths.map(typeLine).join('')}</div>` : ''}
            ${needs.length ? `<div class="hspt-rblock"><div class="hspt-rhead">Needs work (for a tutor)</div>${needs.map(typeLine).join('')}</div>` : ''}
            ${!enough.length ? '<div class="hspt-hint">Strengths and weak spots appear once each question type has 5+ answers.</div>' : ''}
            <div class="hspt-rblock">
                <div class="hspt-rhead">Retention</div>
                <div class="hspt-hint">${review.length ? `${pct(review.filter(a => a.correct).length, review.length)} right on questions he'd missed before, asked again days later (${review.length}). This is the number that shows learning, not just practice.` : 'Appears once missed questions start coming back for review.'}</div>
            </div>
            ${paceRows ? `<div class="hspt-rblock"><div class="hspt-rhead">Timed pace (with extra time)</div>${paceRows}</div>` : ''}`;
    }

    return { open, start, answer, next, goSprint, quit, home: renderHome, report, TEST_DATE, WEEKLY_TARGET, PACE, EXTENDED_TIME, SECTION_LABEL };
})();
