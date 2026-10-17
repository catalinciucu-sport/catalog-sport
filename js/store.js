// Starea aplicației (S), valorile implicite și salvarea locală.
// Modelul de date e descris în CLAUDE.md. Orice modificare se face pe S, apoi se apelează save().
import {uid} from './util.js';

export const KEY = 'catalogSport.v1';

// Date care țin de o clasă: {classId: ...}. Sincronizarea le trimite într-un document per clasă.
export const CLASS_KEYS = ['sessions', 'results', 'choice', 'tests', 'obs'];

export function defaults() {
  return {
    school: {name: '', year: '2026–2027', teacher: ''},
    classes: [],     // [{id, name, students: [{id, name, gender: 'B'|'F'|''}]}]
    schedule: [],    // [{id, day: 1-6, start: 'HH:MM', end: 'HH:MM', classId}]
    // Date orientative pentru anul școlar 2026–2027 — se verifică în Setări.
    modules: [
      {id: uid(), name: 'Modulul 1', start: '2026-09-07', end: '2026-10-23'},
      {id: uid(), name: 'Modulul 2', start: '2026-11-02', end: '2026-12-19'},
      {id: uid(), name: 'Modulul 3', start: '2027-01-08', end: '2027-02-12'},
      {id: uid(), name: 'Modulul 4', start: '2027-02-22', end: '2027-04-02'},
      {id: uid(), name: 'Modulul 5', start: '2027-04-12', end: '2027-06-18'},
    ],
    // type: 'high' (mai mare = mai bine) | 'low' (mai mic = mai bine) | 'direct' (notă directă); t = praguri notele 10..5
    norms: [
      {id: uid(), name: 'Alergare viteză 50 m (exemplu)', unit: 's', type: 'low',
        t: {B: [7.0, 7.3, 7.6, 7.9, 8.2, 8.5], F: [7.8, 8.1, 8.4, 8.7, 9.0, 9.4]}},
      {id: uid(), name: 'Săritura în lungime de pe loc (exemplu)', unit: 'cm', type: 'high',
        t: {B: [230, 220, 210, 200, 190, 180], F: [200, 190, 180, 170, 160, 150]}},
    ],
    // măsurători antropometrice; 'h' și 'w' au id-uri fixe (IMC se calculează din ele)
    // better: 'none' (doar se compară) | 'high' | 'low'
    measures: [
      {id: 'h', name: 'Înălțime', unit: 'cm', better: 'none'},
      {id: 'w', name: 'Greutate', unit: 'kg', better: 'none'},
      {id: 'anv', name: 'Anvergura brațelor', unit: 'cm', better: 'none'},
    ],
    // echipele școlii: membrii primesc automat 10 în modulele cu competiții
    teams: [],      // [{id, name, members: [studentId], modules: [moduleId]}]
    sessions: {},   // {classId: {"YYYY-MM-DD|HH:MM": {studentId: {p: bool, r: 'motiv'}}}}
    results: {},    // {classId: {moduleId: {normId: {studentId: {v, g}}}}}
    choice: {},     // {classId: {moduleId: {studentId: 'auto'|'att'|'norm'|'team'|'avg'|'max'}}}
    tests: {},      // {classId: {'m:<id>'|'n:<id>': [{id, date: 'YYYY-MM-DD', v: {studentId: număr}}]}}
    obs: {},        // {classId: {studentId: 'observații pentru fișă'}}
    settings: {
      scale: [{min: 90, g: 10}, {min: 80, g: 9}, {min: 70, g: 8}, {min: 60, g: 7}, {min: 50, g: 6}, {min: 40, g: 5}],
      minGrade: 4,
      autoRule: 'max',   // nota automată când există și prezență, și norme: 'max' | 'avg' | 'norm'
      reasons: [
        {t: 'Absent', exc: false},
        {t: 'Fără echipament', exc: false},
        {t: 'Scutit medical', exc: true},
        {t: 'Învoit / motivat', exc: true},
        {t: 'Accidentat', exc: true},
        {t: 'Concurs / olimpiadă', exc: true},
      ],
    },
    ui: {lastClass: null, tab: 'att'},
    updatedAt: 0,
  };
}

// completează câmpurile lipsă (date vechi, copii de siguranță, date venite din Google)
export function normalize(d) {
  const def = defaults();
  const n = Object.assign(def, d, {
    school: Object.assign(def.school, d.school || {}),
    settings: Object.assign(def.settings, d.settings || {}),
    ui: Object.assign(def.ui, d.ui || {}),
    measures: d.measures || def.measures,
    teams: d.teams || [],
  });
  CLASS_KEYS.forEach(k => { n[k] = n[k] || {}; });
  return n;
}

function load() {
  try { const raw = localStorage.getItem(KEY); if (raw) return normalize(JSON.parse(raw)); } catch (e) {}
  return defaults();
}

export let S = load();

export function persistLocal() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
export function setState(n) { S = normalize(n); persistLocal(); }

let afterSave = () => {};
export function onSave(fn) { afterSave = fn; }
export function save() { S.updatedAt = Date.now(); persistLocal(); afterSave(); }

export const cls = id => S.classes.find(c => c.id === id);
export const sortStudents = c => c.students.sort((a, b) => a.name.localeCompare(b.name, 'ro'));
export function removeClass(id) {
  const gone = new Set((cls(id)?.students || []).map(s => s.id));
  S.teams.forEach(t => t.members = t.members.filter(m => !gone.has(m)));
  S.classes = S.classes.filter(c => c.id !== id);
  CLASS_KEYS.forEach(k => delete S[k][id]);
  S.schedule = S.schedule.filter(e => e.classId !== id);
}
// creează la nevoie S[key][a][b]... și îl întoarce
export function path(key, ...ids) {
  let o = S[key];
  for (const id of ids) o = o[id] = o[id] || {};
  return o;
}
