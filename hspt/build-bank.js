// Build hspt/bank.json — the HSPT practice question bank.
//
//   node hspt/build-bank.js
//
// Two kinds of items:
//   - AUTHORED (hspt/src/*.json): vocabulary-based Verbal items — synonyms,
//     antonyms, analogies, classification. Written by Claude and checked by an
//     independent blind solve before they land here.
//   - GENERATED (this file): every item whose answer can be computed —
//     number series, number manipulation, comparisons, verbal logic. The
//     answer is worked out by code, so it cannot be wrong, and the
//     explanation shows the same working.
//
// Seeded, so the bank is identical on every run and item ids stay stable
// (the spaced-review queue on Willy's phone is keyed by id).

const fs = require('fs');
const path = require('path');

// ---------- seeded randomness ----------
let seed = 20261205; // test day
function rand() { // mulberry32
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const int = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
const pick = arr => arr[Math.floor(rand() * arr.length)];
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// Put the right answer among distractors at a random position.
function mc(answer, distractors) {
  const uniq = [...new Set(distractors.map(String))].filter(d => d !== String(answer));
  if (uniq.length < 3) throw new Error(`not enough distractors for ${answer}: ${distractors}`);
  const choices = shuffle([String(answer), ...shuffle(uniq).slice(0, 3)]);
  return { choices, answer: choices.indexOf(String(answer)) };
}

// Numeric distractors: the "likely mistakes" first, then near misses.
function numDistractors(ans, likely) {
  const near = [ans + 1, ans - 1, ans + 2, ans - 2, ans + 3, ans + 5, ans - 5, ans + 10];
  return [...likely, ...near].filter(n => Number.isInteger(n) && n >= 0 && n !== ans);
}

// ---------- QUANTITATIVE: number series ----------
function seriesItem(i) {
  const kind = pick(['add', 'sub', 'mul', 'alt', 'growing', 'interleave', 'squares', 'mulAdd']);
  let terms, rule, difficulty, next;
  switch (kind) {
    case 'add': { const d = int(2, 12), s = int(1, 30);
      terms = [0, 1, 2, 3, 4, 5].map(k => s + k * d); rule = `Add ${d} each time.`; difficulty = 1; break; }
    case 'sub': { const d = int(2, 9), s = int(60, 99);
      terms = [0, 1, 2, 3, 4, 5].map(k => s - k * d); rule = `Subtract ${d} each time.`; difficulty = 1; break; }
    case 'mul': { const r = pick([2, 3]), s = int(1, r === 2 ? 6 : 3);
      terms = [0, 1, 2, 3, 4, 5].map(k => s * r ** k); rule = `Multiply by ${r} each time.`; difficulty = 2; break; }
    case 'alt': { const a = int(4, 9), b = int(1, a - 1), s = int(2, 20);
      terms = [s]; for (let k = 1; k < 7; k++) terms.push(terms[k - 1] + (k % 2 ? a : -b));
      rule = `The steps alternate: +${a}, then −${b}, then +${a}, then −${b}.`; difficulty = 2; break; }
    case 'growing': { const s = int(1, 15), d0 = int(1, 3), inc = pick([1, 2]);
      terms = [s]; for (let k = 1; k < 6; k++) terms.push(terms[k - 1] + d0 + (k - 1) * inc);
      const steps = [1, 2, 3, 4, 5].map(k => d0 + (k - 1) * inc);
      rule = `The step grows by ${inc} each time: +${steps.join(', +')}.`; difficulty = 2; break; }
    case 'interleave': { const a = int(2, 6), b = int(2, 6), s1 = int(1, 10), s2 = int(20, 40);
      terms = [0, 1, 2, 3, 4, 5, 6].map(k => k % 2 === 0 ? s1 + (k / 2) * a : s2 - ((k - 1) / 2) * b);
      rule = `Two series are woven together. Every other number goes up by ${a} (${s1}, ${s1 + a}, ${s1 + 2 * a}…); the ones between go down by ${b} (${s2}, ${s2 - b}, ${s2 - 2 * b}…).`;
      difficulty = 3; break; }
    case 'squares': { const s = int(1, 5);
      terms = [0, 1, 2, 3, 4, 5].map(k => (s + k) ** 2);
      rule = `These are square numbers: ${s}×${s}, ${s + 1}×${s + 1}, ${s + 2}×${s + 2}…`; difficulty = 2; break; }
    case 'mulAdd': { const s = int(1, 4), m = 2, a = pick([1, -1]);
      terms = [s]; for (let k = 1; k < 6; k++) terms.push(k % 2 ? terms[k - 1] * m : terms[k - 1] + a);
      rule = `The steps alternate: ×${m}, then ${a > 0 ? '+1' : '−1'}.`; difficulty = 3; break; }
  }
  // Half the time ask for the next term, otherwise blank out a middle term.
  const shown = terms.slice(0, terms.length - 1);
  if (rand() < 0.6) {
    next = terms[terms.length - 1];
    const prompt = `Look at this series: <b>${shown.join(', ')}, …</b> What number should come next?`;
    const last = shown[shown.length - 1], prev = shown[shown.length - 2];
    const { choices, answer } = mc(next, numDistractors(next, [last + (last - prev), last - (last - prev), next + 1]));
    return { id: `ser-${String(i).padStart(3, '0')}`, section: 'quant', type: 'series', difficulty, prompt, choices, answer,
      explanation: `${rule} So the next number is ${next}. Tip: check the gaps between numbers first.` };
  }
  const hole = int(2, shown.length - 2);
  const missing = shown[hole];
  const display = shown.map((t, k) => k === hole ? '___' : t).join(', ');
  const prompt = `Look at this series: <b>${display}</b> What number should fill the blank?`;
  const { choices, answer } = mc(missing, numDistractors(missing, [shown[hole - 1], shown[hole + 1], missing + 2]));
  return { id: `ser-${String(i).padStart(3, '0')}`, section: 'quant', type: 'series', difficulty: Math.min(3, difficulty + 1), prompt, choices, answer,
    explanation: `${rule} So the missing number is ${missing}. Tip: check the gaps between numbers first.` };
}

// ---------- QUANTITATIVE: number manipulation ----------
function manipulationItem(i) {
  const kind = pick(['moreThanFrac', 'percent', 'dividedLess', 'fracOfNumber', 'fracOfFrac', 'subtractLeaves', 'tripled']);
  let prompt, ans, likely, explanation, difficulty;
  switch (kind) {
    case 'moreThanFrac': { const k = pick([2, 3, 4, 5]), q = int(3, 12), N = k * q, A = int(2, 15);
      ans = q + A; prompt = `What number is ${A} more than 1/${k} of ${N}?`;
      likely = [q - A, N + A, Math.round((N + A) / k)]; difficulty = 1;
      explanation = `1/${k} of ${N} is ${N} ÷ ${k} = ${q}. Then ${A} more: ${q} + ${A} = ${ans}.`; break; }
    case 'percent': { const P = pick([10, 20, 25, 50, 75]), N = pick([20, 40, 60, 80, 120, 200]);
      ans = N * P / 100; if (!Number.isInteger(ans)) return manipulationItem(i);
      prompt = `What number is ${P}% of ${N}?`; likely = [N - ans, ans * 2, P]; difficulty = 1;
      explanation = `${P}% means ${P}/100. ${N} × ${P} ÷ 100 = ${ans}.${P === 25 ? ' Shortcut: 25% is a quarter.' : P === 50 ? ' Shortcut: 50% is half.' : ''}`; break; }
    case 'dividedLess': { const k = pick([2, 3, 4, 5, 6]), B = int(12, 30), A = int(2, B - 4);
      ans = k * (B - A); prompt = `What number divided by ${k} is ${A} less than ${B}?`;
      likely = [B - A, k * (B + A), (B - A) + k]; difficulty = 2;
      explanation = `${A} less than ${B} is ${B - A}. The number divided by ${k} equals ${B - A}, so the number is ${B - A} × ${k} = ${ans}.`; break; }
    case 'fracOfNumber': { const k = pick([2, 3, 4]), A = int(2, 9), B = int(3, 12);
      ans = k * (A + B); prompt = `If 1/${k} of a number is ${A} more than ${B}, what is the number?`;
      likely = [A + B, k * B + A, (A + B) + k]; difficulty = 2;
      explanation = `${A} more than ${B} is ${A + B}. That is 1/${k} of the number, so the number is ${A + B} × ${k} = ${ans}.`; break; }
    case 'fracOfFrac': { const [a, b, c, d] = pick([[1, 2, 1, 3], [2, 3, 3, 4], [1, 2, 2, 5], [3, 4, 2, 3], [1, 3, 3, 5], [1, 4, 2, 3]]);
      const N = b * d * int(1, 4); ans = N * a * c / (b * d);
      prompt = `What is ${a}/${b} of ${c}/${d} of ${N}?`; likely = [N * c / d, N * a / b, N - ans].filter(Number.isInteger); difficulty = 3;
      explanation = `Work from the right. ${c}/${d} of ${N} is ${N * c / d}. Then ${a}/${b} of ${N * c / d} is ${ans}.`; break; }
    case 'subtractLeaves': { const k = pick([2, 3, 4]), M = k * int(3, 10), N = M / k + int(5, 30);
      ans = N - M / k; prompt = `What number subtracted from ${N} leaves 1/${k} of ${M}?`;
      likely = [M / k, N + M / k, N - M]; difficulty = 2;
      explanation = `1/${k} of ${M} is ${M / k}. ${N} − ? = ${M / k}, so ? = ${N} − ${M / k} = ${ans}.`; break; }
    case 'tripled': { const n = int(3, 15), A = int(2, 10), B = 3 * n - A;
      if (B <= 0) return manipulationItem(i);
      ans = n; prompt = `A number is tripled and then decreased by ${A}. The result is ${B}. What is the number?`;
      likely = [(B - A) / 3, B + A, 3 * B - A].filter(Number.isInteger); difficulty = 3;
      explanation = `Undo the steps backwards. Add back ${A}: ${B} + ${A} = ${B + A}. Undo tripling: ${B + A} ÷ 3 = ${ans}.`; break; }
  }
  const { choices, answer } = mc(ans, numDistractors(ans, likely));
  return { id: `man-${String(i).padStart(3, '0')}`, section: 'quant', type: 'manipulation', difficulty, prompt, choices, answer, explanation };
}

// ---------- QUANTITATIVE: comparisons (shared statement logic) ----------
const EPS = 1e-9;
const L = ['(A)', '(B)', '(C)'];
function comparisonStatements(v) {
  const s = [];
  const eq = (x, y) => Math.abs(x - y) < EPS;
  for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) if (x !== y) {
    s.push([`${L[x]} is greater than ${L[y]}`, v[x] > v[y] + EPS]);
    if (x < y) s.push([`${L[x]} and ${L[y]} are equal`, eq(v[x], v[y])]);
  }
  for (let x = 0; x < 3; x++) {
    const [y, z] = [0, 1, 2].filter(k => k !== x);
    s.push([`${L[x]} is greater than both ${L[y]} and ${L[z]}`, v[x] > v[y] + EPS && v[x] > v[z] + EPS]);
    s.push([`${L[x]} is less than both ${L[y]} and ${L[z]}`, v[x] < v[y] - EPS && v[x] < v[z] - EPS]);
    s.push([`${L[y]} and ${L[z]} are equal, and both are greater than ${L[x]}`, eq(v[y], v[z]) && v[y] > v[x] + EPS]);
  }
  s.push([`${L[0]}, ${L[1]} and ${L[2]} are equal`, eq(v[0], v[1]) && eq(v[1], v[2])]);
  return s;
}
function pickComparison(values) {
  const all = comparisonStatements(values);
  const truths = all.filter(x => x[1]), lies = all.filter(x => !x[1]);
  if (!truths.length || lies.length < 3) return null;
  // Prefer the most informative true statement (longest) half the time.
  const t = rand() < 0.5 ? truths.sort((a, b) => b[0].length - a[0].length)[0] : pick(truths);
  const choices = shuffle([t[0], ...shuffle(lies).slice(0, 3).map(x => x[0])]);
  return { choices, answer: choices.indexOf(t[0]) };
}
const fmt = n => Number.isInteger(n) ? String(n) : String(+n.toFixed(4));

// Non-geometric: three expressions that look alike but are not.
const EXPRESSION_SETS = [
  () => { const a = int(2, 6), b = int(2, 6), c = int(2, 6);
    return [[`${a} × (${b} + ${c})`, a * (b + c)], [`(${a} × ${b}) + ${c}`, a * b + c], [`${a} + (${b} × ${c})`, a + b * c]]; },
  () => { const N = pick([40, 60, 80, 120]);
    return [[`25% of ${N}`, N / 4], [`1/2 of ${N / 2}`, N / 4], [`1/3 of ${N}`, N / 3]]; },
  () => [[`2³`, 8], [`3²`, 9], [`2 × 4`, 8]],
  () => { const n = int(2, 5); return [[`${n}²`, n * n], [`${n} × 2`, n * 2], [`${n} + ${n}`, n * 2]]; },
  () => { const q = int(2, 6), d = int(3, 9), n = int(4, 12);
    return [[`${q} quarters`, q * 25], [`${d} dimes`, d * 10], [`${n} nickels`, n * 5]]; },
  () => { const h = int(1, 3), m = pick([60, 90, 100, 120, 150]), s = pick([3600, 5400, 7200]);
    return [[`${h} hour${h > 1 ? 's' : ''}`, h * 60], [`${m} minutes`, m], [`${s.toLocaleString('en-US')} seconds`, s / 60]]; },
  () => { const a = pick([0.5, 0.25, 0.75]), N = pick([40, 80, 120]);
    return [[`${a} × ${N}`, a * N], [`${a * 100}% of ${N}`, a * N], [`${N} ÷ ${pick([2, 3, 4])}`, null]]; },
  () => { const f = pick([[1, 2], [3, 4], [2, 5], [3, 5]]);
    return [[`${f[0]}/${f[1]}`, f[0] / f[1]], [`${f[0] / f[1]}`, f[0] / f[1]], [`${f[0] * 2}/${f[1] * 3}`, (f[0] * 2) / (f[1] * 3)]]; },
  () => { const a = int(10, 30), b = int(2, 9);
    return [[`${a} − ${b} + ${b}`, a], [`${a} + ${b} − ${b + 1}`, a - 1], [`${a} × 1`, a]]; },
];
function nongeoItem(i) {
  for (let tries = 0; tries < 50; tries++) {
    let set = pick(EXPRESSION_SETS)();
    // Resolve the one set with a computed divisor.
    set = set.map(([t, v]) => v === null ? [t, eval(t.replace('÷', '/'))] : [t, v]);
    set = shuffle(set);
    const values = set.map(x => x[1]);
    const c = pickComparison(values);
    if (!c) continue;
    const lines = set.map(([t], k) => `${L[k]} ${t}`).join('<br>');
    const working = set.map(([t, v], k) => `${L[k]} = ${fmt(v)}`).join(', ');
    return { id: `cmp-${String(i).padStart(3, '0')}`, section: 'quant', type: 'nongeo_compare', difficulty: 2,
      prompt: `Examine (A), (B) and (C) and find the best answer.<div class="hspt-exprs">${lines}</div>`,
      choices: c.choices, answer: c.answer,
      explanation: `Work out each one first: ${working}. Then check each statement against those numbers.` };
  }
  throw new Error('nongeo generation failed');
}

// Geometric: shaded fractions of shapes, drawn as SVG.
function shapeSvg(shape, n, k) {
  const W = 72;
  let parts = '';
  if (shape === 'strips') {
    for (let j = 0; j < n; j++) parts += `<rect x="${(j * W / n).toFixed(2)}" y="0" width="${(W / n).toFixed(2)}" height="${W}" class="${j < k ? 'geo-shade' : 'geo-empty'}"/>`;
  } else if (shape === 'grid') {
    const g = Math.round(Math.sqrt(n));
    for (let j = 0; j < n; j++) { const r = Math.floor(j / g), c = j % g;
      parts += `<rect x="${(c * W / g).toFixed(2)}" y="${(r * W / g).toFixed(2)}" width="${(W / g).toFixed(2)}" height="${(W / g).toFixed(2)}" class="${j < k ? 'geo-shade' : 'geo-empty'}"/>`; }
  } else { // circle sectors
    const R = W / 2, cx = R, cy = R;
    for (let j = 0; j < n; j++) {
      const a0 = (j / n) * 2 * Math.PI - Math.PI / 2, a1 = ((j + 1) / n) * 2 * Math.PI - Math.PI / 2;
      const p = (a) => `${(cx + R * Math.cos(a)).toFixed(2)},${(cy + R * Math.sin(a)).toFixed(2)}`;
      parts += `<path d="M${cx},${cy} L${p(a0)} A${R},${R} 0 ${1 / n > 0.5 ? 1 : 0} 1 ${p(a1)} Z" class="${j < k ? 'geo-shade' : 'geo-empty'}"/>`;
    }
  }
  return `<svg viewBox="-2 -2 ${W + 4} ${W + 4}" width="${W}" height="${W}" class="geo-fig" aria-hidden="true">${parts}</svg>`;
}
const SHAPE_OPTIONS = { strips: [2, 3, 4, 5, 6], grid: [4, 9], circle: [2, 3, 4, 6, 8] };
function randomShape(targetFrac) {
  // Try to draw a given fraction; fall back to any shape.
  const opts = shuffle(Object.entries(SHAPE_OPTIONS).flatMap(([s, ns]) => ns.map(n => [s, n])));
  for (const [s, n] of opts) {
    if (targetFrac == null) { const k = int(1, n - 1); return { s, n, k }; }
    const k = targetFrac * n;
    if (Number.isInteger(k) && k > 0 && k < n) return { s, n, k };
  }
  return null;
}
function geoItem(i) {
  for (let tries = 0; tries < 100; tries++) {
    const figs = [];
    const first = randomShape(null);
    figs.push(first);
    for (let j = 1; j < 3; j++) {
      // ~40% of the time match an earlier fraction in a different shape, so "equal" answers happen.
      const f = rand() < 0.4 ? figs[int(0, figs.length - 1)] : null;
      const shp = randomShape(f ? f.k / f.n : null);
      if (!shp) break;
      figs.push(shp);
    }
    if (figs.length < 3) continue;
    const values = figs.map(f => f.k / f.n);
    const c = pickComparison(values);
    if (!c) continue;
    const pics = figs.map((f, k) => `<figure><figcaption>${L[k]}</figcaption>${shapeSvg(f.s, f.n, f.k)}</figure>`).join('');
    const working = figs.map((f, k) => `${L[k]} has ${f.k} of ${f.n} equal parts shaded (${f.k}/${f.n})`).join('; ');
    return { id: `geo-${String(i).padStart(3, '0')}`, section: 'quant', type: 'geo_compare', difficulty: 2,
      prompt: `Examine (A), (B) and (C) and find the best answer about the <b>shaded</b> parts.<div class="hspt-figs">${pics}</div>`,
      choices: c.choices, answer: c.answer,
      explanation: `${working}. Compare the fractions, not the number of shaded pieces: 2/4 and 1/2 are the same amount.` };
  }
  throw new Error('geo generation failed');
}

// ---------- VERBAL: logic ----------
const NAMES = ['Ava', 'Ben', 'Cole', 'Dina', 'Eli', 'Fiona', 'Gus', 'Hana', 'Ivan', 'Jada', 'Kai', 'Lena', 'Marco', 'Nia', 'Omar', 'Priya'];
const RELATIONS = [ // [more, less, moreWord, lessWord, order] — "X is MORE than Y" means X ranks higher
  ['is taller than', 'is shorter than', 'taller', 'shorter', 'tallest to shortest'],
  ['is older than', 'is younger than', 'older', 'younger', 'oldest to youngest'],
  ['runs faster than', 'runs slower than', 'faster', 'slower', 'fastest to slowest'],
  ['has more books than', 'has fewer books than', 'more', 'fewer', 'most books to fewest'],
  ['lives farther from school than', 'lives closer to school than', 'farther', 'closer', 'farthest to closest'],
];
const PERMS = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
// A fact is [x, y]: x ranks above y. Truth over all orderings consistent with the premises.
function judge(premises, claim) {
  const ok = PERMS.filter(p => premises.every(([x, y]) => p.indexOf(x) < p.indexOf(y)));
  const holds = ok.map(p => p.indexOf(claim[0]) < p.indexOf(claim[1]));
  return holds.every(Boolean) ? 'true' : holds.some(Boolean) ? 'uncertain' : 'false';
}
function orderingLogicItem(i) {
  const names = shuffle(NAMES).slice(0, 3);
  const [more, less, moreWord, lessWord, order] = pick(RELATIONS);
  const say = ([x, y], useLess) => useLess ? `${names[y]} ${less} ${names[x]}` : `${names[x]} ${more} ${names[y]}`;
  // Chain (a>b, b>c) or fork (a>b, a>c / a>c, b>c)
  const shape = pick(['chain', 'chain', 'forkTop', 'forkBottom']);
  const premises = shape === 'chain' ? [[0, 1], [1, 2]] : shape === 'forkTop' ? [[0, 1], [0, 2]] : [[0, 2], [1, 2]];
  const pairs = [[0, 2], [2, 0], [1, 2], [2, 1], [0, 1], [1, 0]].filter(c => !premises.some(p => p[0] === c[0] && p[1] === c[1]));
  const claim = pick(pairs);
  const verdict = judge(premises, claim);
  const hard = rand() < 0.5; // mix "more" and "less" wording — the classic trap
  const p1 = say(premises[0], false), p2 = say(premises[1], hard), c = say(claim, hard && rand() < 0.5);
  const ranking = shape === 'chain' ? `${names[0]} → ${names[1]} → ${names[2]}` :
    shape === 'forkTop' ? `${names[0]} is above both ${names[1]} and ${names[2]}, but nothing compares ${names[1]} and ${names[2]}` :
    `${names[2]} is below both ${names[0]} and ${names[1]}, but nothing compares ${names[0]} and ${names[1]}`;
  const choices = ['true', 'false', 'uncertain'];
  return { id: `log-${String(i).padStart(3, '0')}`, section: 'verbal', type: 'logic', difficulty: hard ? 3 : shape === 'chain' ? 1 : 2,
    prompt: `${p1}. ${p2}. ${c}. <br><br>If the first two statements are true, the third is`,
    choices, answer: choices.indexOf(verdict),
    explanation: `Line them up from ${order}: ${ranking}. ` +
      (verdict === 'uncertain' ? `The third statement needs a comparison the first two never give — so it's uncertain. "Uncertain" is a real answer, not a cop-out.`
        : `That makes the third statement ${verdict}.`) +
      (hard ? ` Watch the wording flip between "${moreWord}" and "${lessWord}" — rewrite both the same way before comparing.` : '') };
}
const GROUPS = ['members of the chess club', 'students in the band', 'kids on the soccer team', 'students who ride the bus',
  'eighth graders at Lincoln', 'kids who play piano', 'students in the robotics club', 'kids who walk to school'];
const SYLLOGISMS = [ // [p1, p2, conclusion, verdict, why]
  ['All {A} are {B}', 'All {B} are {C}', 'All {A} are {C}', 'true', 'If every {A} is a {B}, and every {B} is a {C}, then every {A} is a {C}.'],
  ['All {A} are {B}', 'All {B} are {C}', 'All {C} are {A}', 'uncertain', 'The {C} group contains the {B} group, which contains the {A} group. Some {C} might not be {A} — we can\'t tell.'],
  ['All {A} are {B}', 'No {B} are {C}', 'No {A} are {C}', 'true', 'Every {A} is a {B}, and no {B} is a {C}, so no {A} can be a {C}.'],
  ['All {A} are {B}', 'No {B} are {C}', 'Some {A} are {C}', 'false', 'Every {A} is a {B}, and no {B} is a {C}, so no {A} is a {C}. "Some are" is false.'],
  ['All {A} are {B}', 'Some {B} are {C}', 'Some {A} are {C}', 'uncertain', 'The {B} who are {C} might or might not be {A}. Nothing tells us.'],
  ['No {A} are {B}', 'All {C} are {B}', 'No {C} are {A}', 'true', 'Every {C} is a {B}, and no {B} is a {A}, so no {C} is a {A}.'],
  ['Some {A} are {B}', 'All {B} are {C}', 'Some {A} are {C}', 'true', 'The {A} who are {B} are also {C} — so at least some {A} are {C}.'],
];
function syllogismItem(i) {
  const [A, B, C] = shuffle(GROUPS).slice(0, 3);
  const [p1, p2, cl, verdict, why] = pick(SYLLOGISMS);
  const f = t => t.replace(/\{A\}/g, A).replace(/\{B\}/g, B).replace(/\{C\}/g, C);
  const choices = ['true', 'false', 'uncertain'];
  return { id: `syl-${String(i).padStart(3, '0')}`, section: 'verbal', type: 'logic', difficulty: verdict === 'true' ? 2 : 3,
    prompt: `${f(p1)}. ${f(p2)}. ${f(cl)}. <br><br>If the first two statements are true, the third is`,
    choices, answer: choices.indexOf(verdict),
    explanation: `${f(why)} Tip: draw circles inside circles. Ignore what's true in real life — use only the two statements.` };
}

// ---------- MATHEMATICS (no calculator) ----------
// HSPT Math is concepts + problem solving without a calculator. His school
// algebra is strong (3s and 4s), so the point here is speed and accuracy by
// hand, and the word-problem framing.
function gcd(a, b) { return b ? gcd(b, a % b) : a; }
function frac(n, d) { const g = gcd(Math.abs(n), Math.abs(d)); n /= g; d /= g; return d === 1 ? `${n}` : `${n}/${d}`; }
function mathItem(i) {
  const kind = pick(['mult', 'divide', 'decimal', 'fracAdd', 'fracMul', 'percentWord', 'linear', 'linear2', 'area', 'angles', 'ratio', 'orderOps', 'average', 'exponent']);
  let prompt, ans, choices, explanation, difficulty, distract;
  const id = `mat-${String(i).padStart(3, '0')}`;
  switch (kind) {
    case 'mult': { const a = int(12, 89), b = int(12, 49); ans = a * b;
      prompt = `${a} × ${b} =`; distract = [ans + 10, ans - 10, a * (b + 1), (a + 1) * b]; difficulty = 1;
      explanation = `Split it: ${a} × ${b} = ${a} × ${b - (b % 10)} + ${a} × ${b % 10} = ${a * (b - (b % 10))} + ${a * (b % 10)} = ${ans}.`; break; }
    case 'divide': { const d = int(3, 12), q = int(12, 99); const N = d * q; ans = q;
      prompt = `${N} ÷ ${d} =`; distract = [q + 1, q - 1, q + 10, q - 10]; difficulty = 1;
      explanation = `${d} × ${q} = ${N}, so ${N} ÷ ${d} = ${q}. Check by multiplying back.`; break; }
    case 'decimal': { const a = int(11, 99) / 10, b = int(2, 9) / 10, op = pick(['+', '×']);
      ans = op === '+' ? +(a + b).toFixed(2) : +(a * b).toFixed(2);
      prompt = `${a} ${op} ${b} =`;
      distract = op === '+' ? [+(a + b * 10).toFixed(2), +(a + b + 1).toFixed(2), +(a + b - 0.1).toFixed(2)] : [+(a * b * 10).toFixed(2), +(a * b / 10).toFixed(3), +(a + b).toFixed(2)];
      difficulty = op === '×' ? 2 : 1;
      explanation = op === '+' ? `Line up the decimal points: ${a} + ${b} = ${ans}.` : `Multiply as whole numbers (${a * 10} × ${b * 10} = ${Math.round(a * 10 * b * 10)}), then count decimal places: two in total, so ${ans}.`;
      choices = mc(ans, distract); break; }
    case 'fracAdd': { const d1 = pick([2, 3, 4, 6]), d2 = pick([3, 4, 5, 8]); const n1 = int(1, d1 - 1), n2 = int(1, d2 - 1);
      const N = n1 * d2 + n2 * d1, D = d1 * d2; ans = frac(N, D);
      prompt = `${n1}/${d1} + ${n2}/${d2} =`; difficulty = 2;
      choices = mc(ans, [frac(n1 + n2, d1 + d2), frac(n1 + n2, D), frac(N + 1, D), frac(n1 * n2, D)].filter(x => x !== ans));
      explanation = `Common denominator ${D}: ${n1 * d2}/${D} + ${n2 * d1}/${D} = ${N}/${D}${frac(N, D) !== `${N}/${D}` ? ` = ${ans}` : ''}. Never add the bottoms.`; break; }
    case 'fracMul': { const a = int(1, 4), b = int(a + 1, 9), c = int(1, 4), d = int(c + 1, 9);
      ans = frac(a * c, b * d); prompt = `${a}/${b} × ${c}/${d} =`; difficulty = 2;
      choices = mc(ans, [frac(a * d, b * c), frac(a + c, b + d), frac(a * c + 1, b * d), frac(a * c, b + d)].filter(x => x !== ans));
      explanation = `Multiply tops and bottoms: ${a * c}/${b * d}${frac(a * c, b * d) !== `${a * c}/${b * d}` ? ` = ${ans}` : ''}.`; break; }
    case 'percentWord': { const price = pick([20, 40, 60, 80, 120, 150]), off = pick([10, 20, 25, 30, 50]);
      ans = price - price * off / 100;
      prompt = `A jacket costs $${price}. It is on sale for ${off}% off. What is the sale price?`;
      distract = [price * off / 100, price - off, price + price * off / 100]; difficulty = 2;
      explanation = `${off}% of $${price} is $${price * off / 100}. Take that off: $${price} − $${price * off / 100} = $${ans}.`;
      choices = mc(`$${ans}`, numDistractors(ans, distract).map(x => `$${x}`)); break; }
    case 'linear': { const x = int(2, 12), a = int(2, 9), b = int(1, 20); const c = a * x + b; ans = x;
      prompt = `If ${a}x + ${b} = ${c}, what is x?`; distract = [Math.round((c + b) / a), c - b, x + 1]; difficulty = 2;
      explanation = `Subtract ${b}: ${a}x = ${c - b}. Divide by ${a}: x = ${x}.`; break; }
    case 'linear2': { const x = int(2, 9), a = int(4, 9), c = int(1, a - 2), b = int(1, 12); const d = a * x + b - c * x; ans = x;
      prompt = `If ${a}x + ${b} = ${c}x + ${d}, what is x?`; distract = [x + 1, x - 1, x + 2, Math.round(d / a)]; difficulty = 3;
      explanation = `Get x on one side: ${a}x − ${c}x = ${d} − ${b}, so ${a - c}x = ${d - b} and x = ${x}.`; break; }
    case 'area': { const shape = pick(['rect', 'tri', 'perim']); const w = int(3, 15), h = int(3, 15);
      if (shape === 'rect') { ans = w * h; prompt = `A rectangle is ${w} cm long and ${h} cm wide. What is its area?`; distract = [2 * (w + h), w + h, ans + w];
        explanation = `Area = length × width = ${w} × ${h} = ${ans} square cm. (${2 * (w + h)} is the perimeter — a common trap.)`; }
      else if (shape === 'tri') { const b2 = w * 2; ans = b2 * h / 2; prompt = `A triangle has a base of ${b2} m and a height of ${h} m. What is its area?`; distract = [b2 * h, b2 + h, ans + h];
        explanation = `Area = ½ × base × height = ½ × ${b2} × ${h} = ${ans} square m. Don't forget the ½.`; }
      else { ans = 2 * (w + h); prompt = `What is the perimeter of a rectangle that is ${w} ft by ${h} ft?`; distract = [w * h, w + h, ans + 2];
        explanation = `Perimeter adds all four sides: 2 × (${w} + ${h}) = ${ans} ft.`; }
      difficulty = 1; choices = mc(ans, numDistractors(ans, distract)); break; }
    case 'angles': { const kind2 = pick(['tri', 'supp', 'comp']);
      if (kind2 === 'tri') { const a = int(30, 80), b = int(30, 150 - a); ans = 180 - a - b;
        prompt = `Two angles of a triangle measure ${a}° and ${b}°. What is the third angle?`; distract = [360 - a - b, 90 - a + b, ans + 10];
        explanation = `A triangle's angles add to 180°: 180 − ${a} − ${b} = ${ans}°.`; }
      else if (kind2 === 'supp') { const a = int(20, 160); ans = 180 - a; prompt = `What is the supplement of a ${a}° angle?`; distract = [90 - a, 360 - a, ans + 10].filter(n => n > 0);
        explanation = `Supplementary angles add to 180°: 180 − ${a} = ${ans}°. (Complementary = 90°.)`; }
      else { const a = int(10, 80); ans = 90 - a; prompt = `What is the complement of a ${a}° angle?`; distract = [180 - a, ans + 10, a];
        explanation = `Complementary angles add to 90°: 90 − ${a} = ${ans}°. (Supplementary = 180°.)`; }
      difficulty = 1; choices = mc(`${ans}°`, numDistractors(ans, distract).map(n => `${n}°`)); break; }
    case 'ratio': { const r1 = int(1, 5), r2 = int(r1 + 1, 7), k = int(2, 8); const total = (r1 + r2) * k; ans = r2 * k;
      prompt = `The ratio of boys to girls in a club is ${r1}:${r2}. There are ${total} students. How many are girls?`;
      distract = [r1 * k, total - r2, Math.round(total / 2)]; difficulty = 2;
      explanation = `${r1} + ${r2} = ${r1 + r2} parts. ${total} ÷ ${r1 + r2} = ${k} per part. Girls = ${r2} × ${k} = ${ans}.`; break; }
    case 'orderOps': { const a = int(2, 9), b = int(2, 9), c = int(2, 6), d = int(1, 9); ans = a + b * c - d;
      prompt = `${a} + ${b} × ${c} − ${d} =`; distract = [(a + b) * c - d, a + b * (c - d), ans + 2]; difficulty = 1;
      explanation = `Multiply first: ${b} × ${c} = ${b * c}. Then left to right: ${a} + ${b * c} − ${d} = ${ans}.`; break; }
    case 'average': { const n = int(3, 5), avg = int(70, 92); const xs = Array.from({ length: n - 1 }, () => avg + int(-8, 8)); const last = avg * n - xs.reduce((s, v) => s + v, 0);
      if (last < 50 || last > 100) return mathItem(i);
      ans = last; prompt = `Willy's first ${n - 1} quiz scores are ${xs.join(', ')}. What must he score on the next quiz to average ${avg}?`;
      distract = [avg, last + n, Math.round((avg * (n - 1) - xs.reduce((s, v) => s + v, 0) + avg))].filter(v => v !== ans); difficulty = 3;
      explanation = `An average of ${avg} over ${n} quizzes means a total of ${avg} × ${n} = ${avg * n}. He has ${xs.reduce((s, v) => s + v, 0)} so far, so he needs ${avg * n} − ${xs.reduce((s, v) => s + v, 0)} = ${ans}.`; break; }
    case 'exponent': { const b = int(2, 5), e = b === 2 ? int(3, 6) : int(2, 3); ans = b ** e;
      prompt = `${b}<sup>${e}</sup> =`; distract = [b * e, b ** (e - 1), b ** e + b]; difficulty = 1;
      explanation = `${b}<sup>${e}</sup> means ${Array(e).fill(b).join(' × ')} = ${ans}. Not ${b} × ${e}.`; break; }
  }
  if (!choices) choices = mc(ans, numDistractors(ans, distract));
  return { id, section: 'math', type: kind, difficulty, prompt, choices: choices.choices, answer: choices.answer, explanation };
}

// ---------- assemble ----------
function generate(fn, n) { return Array.from({ length: n }, (_, k) => fn(k + 1)); }
const generated = [
  ...generate(seriesItem, 60),
  ...generate(manipulationItem, 50),
  ...generate(nongeoItem, 40),
  ...generate(geoItem, 36),
  ...generate(orderingLogicItem, 36),
  ...generate(syllogismItem, 18),
  ...generate(mathItem, 120),
];

const srcDir = path.join(__dirname, 'src');
const authored = fs.existsSync(srcDir)
  ? fs.readdirSync(srcDir).filter(f => f.endsWith('.json')).flatMap(f => JSON.parse(fs.readFileSync(path.join(srcDir, f), 'utf8')))
  : [];

// Items removed by review (blind solve disagreed) — kept as a list, not deleted from src,
// so the record of what was rejected survives.
const rejectedFile = path.join(__dirname, 'rejected.json');
const rejected = new Set(fs.existsSync(rejectedFile) ? JSON.parse(fs.readFileSync(rejectedFile, 'utf8')) : []);

const bank = [...authored, ...generated].filter(it => !rejected.has(it.id));

// Loud validation — a broken item on Willy's phone is worse than a failed build.
const ids = new Set();
for (const it of bank) {
  const where = `item ${it.id}`;
  if (ids.has(it.id)) throw new Error(`duplicate id ${it.id}`);
  ids.add(it.id);
  if (!['verbal', 'quant', 'reading', 'math', 'language'].includes(it.section)) throw new Error(`${where}: bad section`);
  if (!Array.isArray(it.choices) || it.choices.length < 3) throw new Error(`${where}: needs 3+ choices`);
  if (new Set(it.choices).size !== it.choices.length) throw new Error(`${where}: duplicate choices`);
  if (!(it.answer >= 0 && it.answer < it.choices.length)) throw new Error(`${where}: answer out of range`);
  if (!it.prompt || !it.explanation) throw new Error(`${where}: missing prompt/explanation`);
}

fs.writeFileSync(path.join(__dirname, 'bank.json'), JSON.stringify(bank) + '\n');
const counts = {};
bank.forEach(it => { counts[it.type] = (counts[it.type] || 0) + 1; });
console.log(`bank.json: ${bank.length} items (${authored.length} authored, ${generated.length} generated, ${rejected.size} rejected)`);
console.log(counts);
