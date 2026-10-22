// Predarea elevilor către alt profesor (care folosește tot Catalog Sport) și primirea lor.
// Fișierul de predare (.txt cu JSON, ca să poată fi trimis pe WhatsApp) conține, pentru fiecare elev:
//  - mereu: testările cu dată (măsurători și probe → recordurile personale) și observațiile de pe fișă;
//  - „în timpul anului” în plus: prezența (doar prezent / absent / absent motivat, fără motive),
//    rezultatele la norme, criteriul notei și notele alese pentru catalog.
// Probele și modulele se potrivesc după nume / dată, nu după id (fiecare profesor are id-urile lui).
import {S, CLASS_KEYS, cls, schoolOf, sortStudents} from './store.js';
import {uid, nrm, iso} from './util.js';
import {levelOf, moduleFor} from './calc.js';

export const MODES = {an: 'La final de an: testările și recordurile', curs: 'În timpul anului: plus notele, normele și absențele (fără motive)'};
const isObj = x => x && typeof x === 'object' && !Array.isArray(x);
const clean = s => nrm(String(s).replace(/\s*\(exemplu\)/, ''));

/* ---- datele unui elev din obiectele clasei ({…: {studentId: …}} la orice adâncime) ---- */
// copiază (și, cu rm, scoate) tot ce ține de elev, păstrând drumul până la el
function pick(o, sid, rm) {
  const out = {};
  for (const k in o) {
    if (k === sid) { out[k] = o[k]; if (rm) delete o[k]; }
    else if (isObj(o[k])) { const p = pick(o[k], sid, rm); if (Object.keys(p).length) out[k] = p; }
  }
  return out;
}
function plant(t, p) { for (const k in p) { if (isObj(p[k]) && isObj(t[k])) plant(t[k], p[k]); else t[k] = p[k]; } }
// testările: liste [{id, date, v: {studentId: valoare}}] → {item: [{date, v}]}
function pickTests(cId, sid, rm) {
  const out = {};
  for (const [item, list] of Object.entries(S.tests[cId] || {})) {
    const s = list.filter(t => t.v[sid] != null).map(t => ({date: t.date, v: t.v[sid]}));
    if (s.length) out[item] = s;
    if (rm) list.forEach(t => delete t.v[sid]);
  }
  return out;
}
function plantTests(cId, sid, tests) {
  const all = S.tests[cId] = S.tests[cId] || {};
  for (const [item, s] of Object.entries(tests)) {
    const list = all[item] = all[item] || [];
    for (const x of s) {
      let t = list.find(y => y.date === x.date);
      if (!t) { t = {id: uid(), date: x.date, v: {}}; list.push(t); }
      t.v[sid] = x.v;
    }
  }
}

/* ---- arhiva: elevii predați trec în clasa „Plecați <an>” (din arhivă) ---- */
function leftClass(schoolId) {
  const name = 'Plecați ' + S.school.year;
  let a = S.classes.find(c => c.archived && c.name === name && c.schoolId === schoolId);
  if (!a) { a = {id: uid(), name, schoolId, archived: S.school.year, students: []}; S.classes.push(a); }
  return a;
}
export function archiveStudents(c, sids) {
  S.teams.forEach(t => t.members = t.members.filter(m => !sids.includes(m)));
  if (sids.length === c.students.length) { c.archived = S.school.year; S.schedule = S.schedule.filter(e => e.classId !== c.id); return; }
  const a = leftClass(c.schoolId);
  for (const sid of sids) {
    const st = c.students.find(s => s.id === sid);
    a.students.push({...st, from: st.from || c.name});
    c.students = c.students.filter(s => s.id !== sid);
    CLASS_KEYS.filter(k => k !== 'tests').forEach(k => { const p = pick(S[k][c.id] || {}, sid, true); if (Object.keys(p).length) plant(S[k][a.id] = S[k][a.id] || {}, p); });
    plantTests(a.id, sid, pickTests(c.id, sid, true));
  }
  sortStudents(a);
}
export function unarchive(c) { delete c.archived; }

/* ---- fișierul de predare ---- */
export function buildPackage(c, sids, mode) {
  const items = {}, mods = {};
  const students = sids.map(sid => {
    const st = c.students.find(s => s.id === sid);
    const e = {name: st.name, gender: st.gender || '', cls: st.from || c.name, tests: pickTests(c.id, sid)};
    Object.keys(e.tests).forEach(k => items[k] = 1);
    if (S.obs[c.id]?.[sid]) e.obs = S.obs[c.id][sid];
    if (mode === 'curs') {
      // prezența fără motive: p = prezent, m = absență motivată
      const ses = pick(S.sessions[c.id] || {}, sid);
      e.att = Object.fromEntries(Object.entries(ses).map(([k, x]) => { const r = x[sid]; return [k, r.p ? {p: 1} : r.r && S.settings.reasons.find(z => nrm(z.t) === nrm(r.r))?.exc ? {p: 0, m: 1} : {p: 0}]; }));
      e.results = pick(S.results[c.id] || {}, sid);
      e.choice = pick(S.choice[c.id] || {}, sid);
      e.catalog = pick(S.catalog[c.id] || {}, sid);
      for (const [m, byNorm] of Object.entries(e.results)) { mods[m] = 1; Object.keys(byNorm).forEach(n => items['n:' + n] = 1); }
      [e.choice, e.catalog].forEach(o => Object.keys(o).forEach(m => mods[m] = 1));
      Object.values(e.catalog).forEach(o => Object.values(o).flat().forEach(p => { if (typeof p === 'string' && p.startsWith('norm:')) items['n:' + p.slice(5)] = 1; }));
    }
    return e;
  });
  const defs = Object.keys(items).map(k => {
    const id = k.slice(2);
    if (k[0] === 'm') { const m = S.measures.find(x => x.id === id); return m && {key: k, name: m.name, unit: m.unit, better: m.better || 'none'}; }
    const n = S.norms.find(x => x.id === id); return n && {key: k, name: n.name.replace(/\s*\(exemplu\)/, ''), unit: n.unit, type: n.type, t: n.t, lv: n.lv};
  }).filter(Boolean);
  return {app: 'catalog-sport', kind: 'predare-elevi', v: 1, mode, date: iso(new Date()), year: S.school.year,
    teacher: S.school.teacher || '', school: schoolOf(c).name || '', level: levelOf(c), items: defs,
    modules: S.modules.filter(m => mods[m.id]).map(({id, name, start, end}) => ({id, name, start, end})), students};
}
export function packageName(c, sids) {
  const who = sids.length === 1 ? c.students.find(s => s.id === sids[0]).name : sids.length === c.students.length ? 'clasa ' + c.name : `${sids.length} elevi ${c.name}`;
  return `Catalog Sport - predare ${who}.txt`.replace(/[\\/:*?"<>|]/g, '_');
}
export function readPackage(text) {
  try { const d = JSON.parse(text); return d && d.app === 'catalog-sport' && d.kind === 'predare-elevi' && Array.isArray(d.students) ? d : null; }
  catch (e) { return null; }
}

/* ---- primirea ---- */
// pentru fiecare probă din fișier: proba mea cu același nume (sau null = nu o am)
export function matchItems(pkg) {
  return pkg.items.map(it => {
    const local = it.key[0] === 'm'
      ? S.measures.find(m => m.id === it.key.slice(2) && (it.key === 'm:h' || it.key === 'm:w') || clean(m.name) === clean(it.name))
      : S.norms.find(n => clean(n.name) === clean(it.name));
    return {it, local: local ? it.key[0] + ':' + local.id : null};
  });
}
// modulul meu care se potrivește cu modulul profesorului de la care vine elevul
const modMap = pkg => Object.fromEntries(pkg.modules.map(m => [m.id, (S.modules.find(x => x.id === m.id && x.start <= m.end && x.end >= m.start) || moduleFor(m.start) || moduleFor(m.end))?.id]));

// opts: {classId | newName, add: {cheieProbă: true/false}, pick: [indicii elevilor primiți]}
export function applyPackage(pkg, opts) {
  let c = opts.classId && cls(opts.classId);
  if (!c) { c = {id: uid(), name: opts.newName || 'Clasă nouă', schoolId: S.schools[0].id, students: []}; S.classes.push(c); }
  // probele: cele potrivite se folosesc, cele noi se adaugă dacă ai bifat
  const map = {};
  for (const {it, local} of matchItems(pkg)) {
    if (local) { map[it.key] = local; continue; }
    if (!opts.add[it.key]) continue;
    const id = uid();
    if (it.key[0] === 'm') S.measures.push({id, name: it.name, unit: it.unit, better: it.better});
    else S.norms.push({id, name: it.name, unit: it.unit, type: it.type, t: it.t, ...(it.lv ? {lv: it.lv} : {})});
    map[it.key] = it.key[0] + ':' + id;
  }
  const mm = modMap(pkg), group = !!c.group || c.students.some(s => s.from);
  const reason = (exc, words) => S.settings.reasons.find(r => !!r.exc === exc && nrm(r.t).includes(words))?.t || S.settings.reasons.find(r => !!r.exc === exc)?.t;
  const excR = reason(true, 'motivat');
  let added = 0, merged = 0;
  for (const i of opts.pick) {
    const e = pkg.students[i];
    let st = c.students.find(s => nrm(s.name) === nrm(e.name));
    if (st) merged++;
    else { st = {id: uid(), name: e.name, gender: e.gender, ...(group ? {from: e.cls} : {})}; c.students.push(st); added++; }
    if (!st.gender && e.gender) st.gender = e.gender;
    const sid = st.id;
    const tests = {};
    for (const [k, s] of Object.entries(e.tests || {})) if (map[k]) tests[map[k]] = s;
    plantTests(c.id, sid, tests);
    if (e.obs) { const o = S.obs[c.id] = S.obs[c.id] || {}; o[sid] = o[sid] ? o[sid] + '\n' + e.obs : e.obs; }
    if (pkg.mode !== 'curs') continue;
    const ses = S.sessions[c.id] = S.sessions[c.id] || {};
    for (const [k, x] of Object.entries(e.att || {})) (ses[k] = ses[k] || {})[sid] = x.p ? {p: true} : x.m && excR ? {p: false, r: excR} : {p: false};
    for (const [m, byNorm] of Object.entries(e.results || {})) {
      if (!mm[m]) continue;
      for (const [n, byS] of Object.entries(byNorm)) {
        const ln = map['n:' + n]; if (!ln) continue;
        plant(S.results[c.id] = S.results[c.id] || {}, {[mm[m]]: {[ln.slice(2)]: {[sid]: byS[Object.keys(byS)[0]]}}});
      }
    }
    for (const [m, byS] of Object.entries(e.choice || {})) if (mm[m]) plant(S.choice[c.id] = S.choice[c.id] || {}, {[mm[m]]: {[sid]: Object.values(byS)[0]}});
    for (const [m, byS] of Object.entries(e.catalog || {})) {
      if (!mm[m]) continue;
      const picks = Object.values(byS)[0].map(p => typeof p === 'string' && p.startsWith('norm:') ? (map['n:' + p.slice(5)] ? 'norm:' + map['n:' + p.slice(5)].slice(2) : null) : p).filter(Boolean);
      plant(S.catalog[c.id] = S.catalog[c.id] || {}, {[mm[m]]: {[sid]: picks.length ? picks : ['auto']}});
    }
  }
  sortStudents(c);
  return {c, added, merged};
}
