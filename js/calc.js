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

/* ---- norme de control ---- */
export function normGrade(norm, gender, v) {
  if (v === '' || v == null || isNaN(v)) return null;
  v = +v;
  if (norm.type === 'direct') return Math.max(1, Math.min(10, Math.round(v)));
  const hasF = norm.t.F && norm.t.F.some(x => x !== '' && x != null);
  const t = gender === 'F' && hasF ? norm.t.F : norm.t.B;
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
      for (const sid in r) if (r[sid].v != null) r[sid].g = normGrade(n, c.students.find(s => s.id === sid)?.gender, r[sid].v);
    }
  }
}

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
