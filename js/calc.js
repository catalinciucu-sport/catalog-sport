// Calcule: prezență, note, barem norme, testări inițial/final, progres. Fără interfață.
import {S} from './store.js';
import {iso, nrm} from './util.js';

/* ---- module ---- */
export const moduleFor = date => S.modules.find(m => date >= m.start && date <= m.end);
export function defaultModule() {
  const t = iso(new Date());
  return moduleFor(t) || [...S.modules].filter(m => m.start <= t).sort((a, b) => b.start.localeCompare(a.start))[0] || S.modules[0];
}

/* ---- prezență ---- */
export const reasonExcused = r => !!(r && S.settings.reasons.find(x => nrm(x.t) === nrm(r))?.exc);
export function sessionsIn(classId, mod) {
  const all = S.sessions[classId] || {};
  return Object.keys(all).filter(k => { const d = k.split('|')[0]; return mod && d >= mod.start && d <= mod.end; }).sort().map(k => [k, all[k]]);
}
// procentul = ore prezent ÷ ore din modul, fără orele cu absențe motivate
export function attStats(classId, sid, mod) {
  let total = 0, pres = 0, exc = 0, abs = 0;
  for (const [, s] of sessionsIn(classId, mod)) {
    const r = s[sid];
    if (!r) continue;   // elevul nu era încă în clasă
    total++;
    if (r.p) pres++; else if (reasonExcused(r.r)) exc++; else abs++;
  }
  const den = total - exc;
  return {total, pres, exc, abs, pct: den > 0 ? Math.round(pres / den * 100) : null};
}
export function gradeFromPct(pct) {
  if (pct == null) return null;
  for (const s of [...S.settings.scale].sort((a, b) => b.min - a.min)) if (pct >= s.min) return s.g;
  return S.settings.minGrade;
}

/* ---- nivelul de studiu al clasei (0 = pregătitoare, 1–12) ---- */
const ROMAN = {XII: 12, XI: 11, X: 10, IX: 9, VIII: 8, VII: 7, VI: 6, V: 5, IV: 4, III: 3, II: 2, I: 1};
export function detectLevel(name) {
  const s = nrm(name).toUpperCase();
  if (/^(PREG|CP\b|0)/.test(s)) return 0;
  const d = s.match(/^\s*(\d{1,2})/); if (d && +d[1] <= 12) return +d[1];
  const r = s.match(/^\s*(XII|XI|IX|X|VIII|VII|VI|IV|V|III|II|I)\b/); if (r) return ROMAN[r[1]];
  return null;
}
// nivelul ales în Clase, altfel din nume, altfel (la grupe) din clasa de proveniență a celor mai mulți elevi
export function levelOf(c) {
  if (!c) return null;
  if (c.level != null && c.level !== '') return +c.level;
  const n = detectLevel(c.name); if (n != null) return n;
  const count = {};
  c.students.forEach(s => { const l = s.from && detectLevel(s.from); if (l != null) count[l] = (count[l] || 0) + 1; });
  const best = Object.entries(count).sort((a, b) => b[1] - a[1])[0];
  return best ? +best[0] : null;
}
const classOfStudent = sid => S.classes.find(c => c.students.some(s => s.id === sid));

/* ---- norme de control ---- */
const filled = a => a && a.some(x => x !== '' && x != null);
// baremul folosit, în ordine: al nivelului pentru sexul elevului, cel general pentru sexul elevului,
// apoi (la fete, dacă nu există barem de fete) al băieților: întâi al nivelului, apoi cel general
export function baremFor(norm, gender, level) {
  const lv = level != null && norm.lv && norm.lv[level];
  if (gender === 'F') { if (lv && filled(lv.F)) return lv.F; if (filled(norm.t.F)) return norm.t.F; }
  return lv && filled(lv.B) ? lv.B : norm.t.B;
}
export function normGrade(norm, gender, v, level) {
  if (v === '' || v == null || isNaN(v)) return null;
  v = +v;
  if (norm.type === 'direct') return Math.max(1, Math.min(10, Math.round(v)));
  const t = baremFor(norm, gender, level) || [];
  for (let i = 0; i < 6; i++) {
    const th = t[i];
    if (th === '' || th == null) continue;
    if (norm.type === 'high' ? v >= +th : v <= +th) return 10 - i;
  }
  return S.settings.minGrade;
}
export const rres = (cId, mId) => (S.results[cId] || {})[mId] || {};
export function normsUsed(cId, mId) {
  const r = rres(cId, mId);
  return S.norms.filter(n => r[n.id] && Object.values(r[n.id]).some(x => x && x.g != null));
}
export function recalcNorm(normId) {
  const n = S.norms.find(x => x.id === normId); if (!n || n.type === 'direct') return;
  for (const cId in S.results) {
    const c = S.classes.find(x => x.id === cId); if (!c) continue;
    for (const mId in S.results[cId]) {
      const r = S.results[cId][mId][normId]; if (!r) continue;
      for (const sid in r) if (r[sid].v != null) r[sid].g = normGrade(n, c.students.find(s => s.id === sid)?.gender, r[sid].v, levelOf(c));
    }
  }
}

/* ---- rezultatele tuturor elevilor la o normă (module + testări), cel mai bun rezultat al fiecăruia ---- */
export function bestResults(norm, level, gender) {
  const best = {}, better = (a, b) => norm.type === 'low' ? a < b : a > b;
  const put = (sid, v) => { if (v == null || isNaN(v)) return; if (best[sid] == null || better(+v, best[sid])) best[sid] = +v; };
  S.classes.forEach(c => {
    if (level != null && levelOf(c) !== level) return;
    const ok = sid => !gender || c.students.find(s => s.id === sid)?.gender === gender;
    Object.values(S.results[c.id] || {}).forEach(m => Object.entries(m[norm.id] || {}).forEach(([sid, x]) => ok(sid) && put(sid, x.v)));
    (S.tests[c.id]?.['n:' + norm.id] || []).forEach(t => Object.entries(t.v).forEach(([sid, v]) => ok(sid) && put(sid, v)));
  });
  return best;   // {studentId: valoare}
}
// barem propus din rezultate: primii p% → 10, următorii → 9 ... (S.settings.curve)
export function curveBarem(norm, level, gender) {
  const vals = Object.values(bestResults(norm, level, gender)).sort((a, b) => norm.type === 'low' ? a - b : b - a);
  if (vals.length < 5) return {n: vals.length, t: null};
  let cum = 0;
  const t = S.settings.curve.map(x => { cum += +x.p; return vals[Math.min(vals.length - 1, Math.max(0, Math.ceil(vals.length * cum / 100) - 1))]; });
  return {n: vals.length, t};
}
// poziția unui rezultat față de colegii de același nivel și sex: procentul celor depășiți
export function standing(norm, level, gender, sid) {
  const best = bestResults(norm, level, gender), mine = best[sid];
  const others = Object.entries(best).filter(([id]) => id !== sid).map(([, v]) => v);
  if (mine == null || others.length < 4) return null;
  const beaten = others.filter(v => norm.type === 'low' ? mine < v : mine > v).length;
  return {pct: Math.round(beaten / others.length * 100), n: others.length + 1};
}
export {classOfStudent};

/* ---- nota finală pe modul ---- */
const roundG = x => Math.floor(x + 0.5);
// criteriile din care se poate stabili nota (lista din tabul Note)
export const CRITERIA = [
  ['auto', 'Automat'], ['att', 'Prezență'], ['norm', 'Norme'], ['team', 'Echipa școlii'],
  ['max', 'Cea mai mare (P/N)'], ['avg', 'Media P+N'],
];
export const AUTO_RULES = {max: 'cea mai mare dintre nota pe prezență și media normelor', avg: 'media dintre nota pe prezență și media normelor', norm: 'media normelor, dacă există'};
// elevul e într-o echipă care are competiții în acest modul
export const teamOf = (sid, mod) => S.teams.find(t => t.members.includes(sid) && t.modules.includes(mod.id));

function combine(rule, gp, gn) {
  if (gp == null) return gn != null ? {g: gn, src: 'Norme'} : {g: null, src: ''};
  if (gn == null) return {g: gp, src: 'Prezență'};
  if (rule === 'avg') return {g: roundG((gp + gn) / 2), src: 'Media P+N'};
  if (rule === 'norm') return {g: gn, src: 'Norme'};
  return gn > gp ? {g: gn, src: 'Norme'} : {g: gp, src: 'Prezență'};   // 'max'
}
export function finalFor(c, st, mod) {
  const a = attStats(c.id, st.id, mod);
  const gp = gradeFromPct(a.pct);
  const r = rres(c.id, mod.id);
  const gs = S.norms.map(n => r[n.id]?.[st.id]?.g).filter(g => g != null);
  const avgN = gs.length ? gs.reduce((x, y) => x + y, 0) / gs.length : null;
  const gn = avgN != null ? roundG(avgN) : null;
  const team = teamOf(st.id, mod);
  const ch = S.choice[c.id]?.[mod.id]?.[st.id] || 'auto';
  let res;
  if (ch === 'att') res = {g: gp, src: 'Prezență'};
  else if (ch === 'norm') res = {g: gn, src: 'Norme'};
  else if (ch === 'team') res = {g: 10, src: 'Echipa școlii'};
  else if (ch === 'max' || ch === 'avg') res = combine(ch, gp, gn);
  else res = team ? {g: 10, src: 'Echipa ' + team.name} : combine(S.settings.autoRule || 'max', gp, gn);
  return {a, gp, avgN, team, ch, ...res};
}

/* ---- notele pentru catalog: ce note se trec, pentru fiecare elev și modul ---- */
const normName = n => n.name.replace(/\s*\(exemplu\)/, '');
// toate notele care se pot alege: [{key, label, g}]
export function catalogOptions(c, st, mod) {
  const f = finalFor(c, st, mod), r = rres(c.id, mod.id);
  const o = [{key: 'auto', label: 'Nota calculată (' + (f.src || '–') + ')', g: f.g}, {key: 'navg', label: 'Media normelor', g: f.avgN != null ? roundG(f.avgN) : null}];
  S.norms.forEach(n => { const g = r[n.id]?.[st.id]?.g; if (g != null) o.push({key: 'norm:' + n.id, label: normName(n), g}); });
  o.push({key: 'att', label: 'Prezență' + (f.a.pct != null ? ` (${f.a.pct}%)` : ''), g: f.gp});
  o.push({key: 'team', label: f.team ? 'Echipa ' + f.team.name : 'Echipa școlii', g: 10});
  return o;
}
export const catalogPicks = (cId, mId, sid) => S.catalog[cId]?.[mId]?.[sid] || ['auto'];
// notele care intră în catalog, în ordinea aleasă: [{label, g}] (fără cele încă necalculate)
export function catalogFor(c, st, mod) {
  const opts = catalogOptions(c, st, mod);
  return catalogPicks(c.id, mod.id, st.id).map(p => typeof p === 'object' ? {label: 'Notă', g: p.m} : opts.find(o => o.key === p))
    .filter(x => x && x.g != null);
}

/* ---- testări (fiecare probă / măsurătoare cu data ei) ---- */
// tot ce se poate testa: măsurători (m:<id>) și norme (n:<id>)
export function testItems() {
  return [
    ...S.measures.map(m => ({id: 'm:' + m.id, name: m.name, unit: m.unit, better: m.better || 'none', kind: 'm'})),
    ...S.norms.map(n => ({id: 'n:' + n.id, name: n.name.replace(/\s*\(exemplu\)/, ''), unit: n.type === 'direct' ? 'notă' : n.unit,
      better: n.type === 'low' ? 'low' : 'high', kind: 'n'})),
  ];
}
// testările unei probe la o clasă, cele mai vechi primele
export const testsOf = (cId, itemId) => [...(S.tests[cId]?.[itemId] || [])].sort((a, b) => a.date.localeCompare(b.date));
// valorile unui elev la o probă: [{date, v}] în ordinea datei
export const series = (cId, itemId, sid) => testsOf(cId, itemId).filter(t => t.v[sid] != null).map(t => ({date: t.date, v: t.v[sid]}));
// IMC la fiecare cântărire, cu înălțimea măsurată cel mai aproape de acea dată
export function bmiSeries(cId, sid) {
  const hs = series(cId, 'm:h', sid);
  if (!hs.length) return [];
  const days = d => new Date(d).getTime();
  return series(cId, 'm:w', sid).map(w => {
    const h = hs.reduce((b, x) => Math.abs(days(x.date) - days(w.date)) < Math.abs(days(b.date) - days(w.date)) ? x : b);
    return {date: w.date, v: Math.round(w.v / ((h.v / 100) ** 2) * 10) / 10};
  });
}
// diferența (ultima − prima valoare) și dacă e progres
export function progress(better, a, b) {
  if (a == null || b == null) return null;
  const d = Math.round((b - a) * 100) / 100;
  if (d === 0) return {d, cls: 'neu', txt: 'la fel'};
  if (better === 'none') return {d, cls: 'neu', txt: d > 0 ? 'creștere' : 'scădere'};
  const good = better === 'high' ? d > 0 : d < 0;
  return {d, cls: good ? 'up' : 'down', txt: good ? 'progres' : 'regres'};
}
