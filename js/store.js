// Starea aplicației (S), valorile implicite și salvarea locală.
// Modelul de date e descris în CLAUDE.md. Orice modificare se face pe S, apoi se apelează save().
import {uid} from './util.js';

export const KEY = 'catalogSport.v1';

// Date care țin de o clasă: {classId: ...}. Sincronizarea le trimite într-un document per clasă.
export const CLASS_KEYS = ['sessions', 'results', 'choice', 'tests', 'obs', 'catalog'];

// niveluri de studiu: 0 = clasa pregătitoare, 1–12 = I–XII
export const LEVELS = ['Pregătitoare', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

// echipele școlii adăugate automat; id-uri fixe, ca să nu apară dublate pe alt dispozitiv
const DEFAULT_TEAMS = [['tmSah', 'Șah'], ['tmTenis', 'Tenis de masă'], ['tmFotB', 'Fotbal băieți'], ['tmFotF', 'Fotbal fete'],
  ['tmHandF', 'Handbal fete'], ['tmBaschB', 'Baschet băieți'], ['tmBaschF', 'Baschet fete']].map(([id, name]) => ({id, name}));
const nrmName = s => String(s ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function defaults() {
  return {
    school: {year: '2026–2027', teacher: ''},
    schools: [{id: 'sc1', name: ''}],   // școlile profesorului; fiecare clasă are schoolId
    // [{id, name, schoolId, level?: 0–12 (dacă lipsește, se deduce din nume), students: [{id, name, gender: 'B'|'F'|'', from?: clasa de proveniență}]}]
    classes: [],
    schedule: [],    // [{id, day: 1-6, start: 'HH:MM', end: 'HH:MM', classId}]
    // Date orientative pentru anul școlar 2026–2027 — se verifică în Setări.
    modules: [
      // id-uri fixe: aceleași pe orice dispozitiv, ca să nu apară dublate la conectare
      {id: 'mod1', name: 'Modulul 1', start: '2026-09-07', end: '2026-10-23'},
      {id: 'mod2', name: 'Modulul 2', start: '2026-11-02', end: '2026-12-19'},
      {id: 'mod3', name: 'Modulul 3', start: '2027-01-08', end: '2027-02-12'},
      {id: 'mod4', name: 'Modulul 4', start: '2027-02-22', end: '2027-04-02'},
      {id: 'mod5', name: 'Modulul 5', start: '2027-04-12', end: '2027-06-18'},
    ],
    // type: 'high' (mai mare = mai bine) | 'low' (mai mic = mai bine) | 'direct' (notă directă)
    // t = baremul general (praguri pentru notele 10..5, B/F); lv = bareme pe niveluri {'9': {B: [...], F: [...]}}
    norms: [
      {id: 'ex50', name: 'Alergare viteză 50 m (exemplu)', unit: 's', type: 'low',
        t: {B: [7.0, 7.3, 7.6, 7.9, 8.2, 8.5], F: [7.8, 8.1, 8.4, 8.7, 9.0, 9.4]}},
      {id: 'exlung', name: 'Săritura în lungime de pe loc (exemplu)', unit: 'cm', type: 'high',
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
    teams: DEFAULT_TEAMS.map(t => ({...t, members: [], modules: []})),   // [{id, name, members: [studentId], modules: [moduleId]}]
    sessions: {},   // {classId: {"YYYY-MM-DD|HH:MM": {studentId: {p: bool, r: 'motiv'}}}}
    results: {},    // {classId: {moduleId: {normId: {studentId: {v, g}}}}}
    choice: {},     // {classId: {moduleId: {studentId: 'auto'|'att'|'norm'|'team'|'avg'|'max'}}}
    tests: {},      // {classId: {'m:<id>'|'n:<id>': [{id, date: 'YYYY-MM-DD', v: {studentId: număr}}]}}
    obs: {},        // {classId: {studentId: 'observații pentru fișă'}}
    // notele trecute în catalog: {classId: {moduleId: {studentId: ['auto'|'att'|'navg'|'team'|'norm:<id>'|{m: notă}]}}}; lipsă = ['auto']
    catalog: {},
    settings: {
      // baremul generat din rezultate: ce procent din elevi primește fiecare notă (de la cei mai buni)
      curve: [{g: 10, p: 10}, {g: 9, p: 15}, {g: 8, p: 20}, {g: 7, p: 20}, {g: 6, p: 20}, {g: 5, p: 15}],
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
        {t: 'Inapt fiziologic', exc: false},
      ],
      rv: 2,   // versiunea listei de motive (2 = cu „Inapt fiziologic”)
      tv: 1,   // 1 = echipele școlii implicite au fost adăugate
    },
    // tab: 'home' | 'classes' | 'set' (din Home) sau 'att' | 'grades' | 'norms' | 'tests' (într-o clasă); cnt: 'mod' | 'an'
    ui: {lastClass: null, tab: 'home', cnt: 'mod'},
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
    // versiunile vechi aveau o singură școală în school.name → devine prima școală (id fix, la fel pe toate dispozitivele)
    schools: d.schools && d.schools.length ? d.schools : [{id: 'sc1', name: (d.school && d.school.name) || ''}],
  });
  delete n.school.name;
  // date mai vechi: se adaugă o singură dată motivul „Inapt fiziologic” și echipele școlii (dacă ai șters ceva după, nu mai revine)
  const ds = d.settings || {};
  if (!ds.rv) {
    if (!n.settings.reasons.some(r => nrmName(r.t) === 'inapt fiziologic')) n.settings.reasons.push({t: 'Inapt fiziologic', exc: false});
    n.settings.rv = 2;
  }
  if (!ds.tv) {
    DEFAULT_TEAMS.forEach(t => { if (!n.teams.some(x => x.id === t.id || nrmName(x.name) === nrmName(t.name))) n.teams.push({...t, members: [], modules: []}); });
    n.settings.tv = 1;
  }
  n.classes.forEach(c => { if (!c.schoolId || !n.schools.some(s => s.id === c.schoolId)) c.schoolId = n.schools[0].id; });
  CLASS_KEYS.forEach(k => { n[k] = n[k] || {}; });
  return n;
}
export const schoolOf = c => S.schools.find(s => s.id === c?.schoolId) || S.schools[0];

function load() {
  try { const raw = localStorage.getItem(KEY); if (raw) return normalize(JSON.parse(raw)); } catch (e) {}
  return defaults();
}

export let S = load();

/* ---- ciorna dintr-o clasă ----
   Cât timp ești într-o clasă (Prezență, Note, Norme, Testări), save() nu salvează: doar ține minte că s-au făcut
   modificări. Butonul „Salvează” le scrie (local și în Google); Home fără salvare le poate anula.
   draft = textul datelor de la ultima salvare; dirty = s-a schimbat ceva de atunci. Cât timp dirty, sincronizarea stă. */
let draft = null, dirty = false, onDraft = () => {};
export const isDirty = () => dirty;
export const onDraftChange = fn => { onDraft = fn; };
export function beginDraft() { draft = JSON.stringify(S); dirty = false; onDraft(); }
export function endDraft() { draft = null; dirty = false; onDraft(); }
// date noi venite din Google cât timp nu ai modificări nesalvate: devin punctul de plecare al ciornei
export function refreshDraft() { if (draft && !dirty) draft = JSON.stringify(S); }
export function discardDraft() {
  if (draft && dirty) { const ui = S.ui; S = normalize(JSON.parse(draft)); S.ui = ui; }
  dirty = false; if (draft) draft = JSON.stringify(S); persistLocal(); onDraft();
}
export function commitDraft() { dirty = false; realSave(); if (draft) draft = JSON.stringify(S); onDraft(); }

// cu modificări nesalvate, pe dispozitiv rămâne versiunea salvată (doar preferințele de afișare sunt cele de acum)
export function persistLocal() {
  try { localStorage.setItem(KEY, dirty ? JSON.stringify(Object.assign(JSON.parse(draft), {ui: S.ui})) : JSON.stringify(S)); } catch (e) {}
}
export function setState(n) { S = normalize(n); persistLocal(); }

let afterSave = () => {};
export function onSave(fn) { afterSave = fn; }
function realSave() { S.updatedAt = Date.now(); persistLocal(); afterSave(); }
export function save() {
  if (draft) { if (!dirty) { dirty = true; onDraft(); } return; }
  realSave();
}

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
