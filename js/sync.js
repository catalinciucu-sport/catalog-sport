// Sincronizare cu Google Sheets prin scriptul Code.gs (vezi google-apps-script/).
// Documente: "core" (școala, clase, orar, module, norme, echipe, setări) și "c_<classId>" cu datele
// clasei (CLASS_KEYS). Fiecare dispozitiv ține minte în BASE ultima versiune sincronizată a fiecărui
// document. La fiecare sincronizare compară: ce s-a schimbat doar aici se trimite, ce s-a schimbat doar
// în Google se preia, iar dacă s-a schimbat în ambele locuri se combină (merge3). Nu contează ora.
// Pe lângă date, trimite foile citibile „Prezență <clasa>” și „Note <clasa>”.
import {S, CLASS_KEYS, persistLocal} from './store.js';
import {fmtD} from './util.js';
import {reasonExcused, finalFor} from './calc.js';
import {setSync} from './ui.js';

const CFG_KEY = 'catalogSport.google', BASE_KEY = 'catalogSport.base';
const readLS = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } };
const writeLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
let CFG = readLS(CFG_KEY, {});
let BASE = readLS(BASE_KEY, {});
let syncT = null, syncing = false, again = false, online = false;
let onRemote = () => {};
export const onRemoteData = fn => { onRemote = fn; };   // apelat când s-au preluat modificări din Google
export const linked = () => !!(CFG.url && CFG.token);

async function api(action, extra, cfg = CFG) {
  const r = await fetch(cfg.url, {method: 'POST', headers: {'Content-Type': 'text/plain;charset=utf-8'},
    body: JSON.stringify(Object.assign({token: cfg.token, action}, extra || {}))});
  const j = await r.json();
  if (!j.ok) { const e = new Error(j.error || 'eroare'); e.code = j.error; throw e; }
  return j;
}

/* ---- documentele locale ---- */
function buildDocs() {
  const docs = {core: JSON.stringify(Object.fromEntries(Object.entries(S).filter(([k]) => !CLASS_KEYS.includes(k) && k !== 'ui' && k !== 'updatedAt')))};
  S.classes.forEach(c => { const d = {}; CLASS_KEYS.forEach(k => d[k] = S[k][c.id] || {}); docs['c_' + c.id] = JSON.stringify(d); });
  return docs;
}
function applyDoc(k, d) {
  if (k === 'core') { if (d) Object.assign(S, d); return; }
  const id = k.slice(2);
  CLASS_KEYS.forEach(f => { if (d) S[f][id] = d[f] || {}; else delete S[f][id]; });
}

/* ---- combinarea a două versiuni pornind de la versiunea comună (b) ---- */
const J = x => JSON.stringify(x);
const isObj = x => x && typeof x === 'object' && !Array.isArray(x);
const isIdList = x => Array.isArray(x) && x.every(o => isObj(o) && 'id' in o);
const byId = a => Object.fromEntries((a || []).map(o => [o.id, o]));
export function merge3(b, l, r) {
  if (J(l) === J(r)) return l;
  if (J(l) === J(b)) return r;          // s-a schimbat doar în Google
  if (J(r) === J(b)) return l;          // s-a schimbat doar aici
  if (isIdList(l) && isIdList(r)) {      // liste cu id (clase, elevi, norme, echipe...): element cu element
    const bm = byId(isIdList(b) ? b : []), lm = byId(l), rm = byId(r);
    return [...l.map(x => x.id), ...r.map(x => x.id).filter(id => !lm[id])]
      .map(id => merge3(bm[id], lm[id], rm[id])).filter(v => v !== undefined);
  }
  if (isObj(l) && isObj(r)) {            // obiecte (ore, elevi, rezultate...): cheie cu cheie
    const out = {};
    new Set([...Object.keys(l), ...Object.keys(r)]).forEach(k => { const v = merge3(isObj(b) ? b[k] : undefined, l[k], r[k]); if (v !== undefined) out[k] = v; });
    return out;
  }
  // aceeași oră creată pe ambele dispozitive (fără versiune comună): o bifă de pe oricare rămâne
  if (b === undefined && typeof l === 'boolean' && typeof r === 'boolean') return l || r;
  return l;                              // aceeași valoare schimbată diferit în ambele locuri: rămâne cea de aici
}

/* ---- foile citibile din Google Sheets ---- */
const sheetName = (prefix, c) => (prefix + c.name).replace(/[\[\]*?\/\\:]/g, '-').slice(0, 90);
const viewNames = () => S.classes.flatMap(c => [sheetName('Prezență ', c), sheetName('Note ', c)]);
function buildViews(c) {
  const all = Object.keys(S.sessions[c.id] || {}).sort();
  const att = [['Nr', 'Nume', 'Sex', ...all.map(k => { const [d, s] = k.split('|'); return fmtD(d) + (s !== 'ora' ? ' ' + s : ''); }), 'Prezent', 'Absent', 'Motivat']];
  c.students.forEach((st, i) => {
    let p = 0, a = 0, m = 0;
    const cells = all.map(k => {
      const r = S.sessions[c.id][k][st.id]; if (!r) return '';
      if (r.p) { p++; return 'P'; }
      if (reasonExcused(r.r)) m++; else a++;
      return 'A' + (r.r ? ' – ' + r.r : '');
    });
    att.push([i + 1, st.name + (st.from ? ` (${st.from})` : ''), st.gender || '', ...cells, p, a, m]);
  });
  const grades = [['Nr', 'Nume', ...S.modules.flatMap(md => [md.name + ' % prezență', md.name + ' notă prezență', md.name + ' medie norme', md.name + ' NOTA FINALĂ'])]];
  c.students.forEach((st, i) => grades.push([i + 1, st.name + (st.from ? ` (${st.from})` : ''), ...S.modules.flatMap(md => {
    const f = finalFor(c, st, md); return [f.a.pct ?? '', f.gp ?? '', f.avgN != null ? +f.avgN.toFixed(2) : '', f.g ?? ''];
  })]));
  return {[sheetName('Prezență ', c)]: att, [sheetName('Note ', c)]: grades};
}

/* ---- o sincronizare completă: citește Google, preia / combină, trimite ce e nou aici ---- */
async function syncNow() {
  const remote = (await api('get')).docs || {};
  delete remote.meta;   // document folosit de versiuni mai vechi ale aplicației
  const R = Object.fromEntries(Object.entries(remote).map(([k, v]) => [k, J(v)]));
  const L = buildDocs();
  const send = {}, sentStr = {};
  let took = false;
  // întâi „core” (lista de clase), apoi clasele
  const keys = [...new Set([...Object.keys(L), ...Object.keys(R), ...Object.keys(BASE)])].sort((a, b) => (a === 'core' ? -1 : b === 'core' ? 1 : 0));
  for (const k of keys) {
    const l = L[k], r = R[k], b = BASE[k];
    if (l === r) { if (l === undefined) delete BASE[k]; else BASE[k] = l; continue; }
    const localChanged = l !== b, remoteChanged = r !== b;
    if (remoteChanged && !localChanged) {          // doar în Google
      applyDoc(k, r === undefined ? null : JSON.parse(r)); took = true;
      if (r === undefined) delete BASE[k]; else BASE[k] = r;
    } else if (localChanged && !remoteChanged) {   // doar aici
      send[k] = l === undefined ? null : JSON.parse(l); sentStr[k] = l;
    } else {                                       // în ambele: se combină
      const m = merge3(b === undefined ? undefined : JSON.parse(b), l === undefined ? undefined : JSON.parse(l), r === undefined ? undefined : JSON.parse(r));
      applyDoc(k, m === undefined ? null : m); took = true;
      send[k] = m === undefined ? null : m; sentStr[k] = m === undefined ? undefined : J(m);
    }
  }
  if (took) { persistLocal(); onRemote(); }
  if (Object.keys(send).length) {
    const views = {};
    ('core' in send ? S.classes : S.classes.filter(c => ('c_' + c.id) in send)).forEach(c => Object.assign(views, buildViews(c)));
    await api('put', {docs: send, views, allViews: viewNames()});
    for (const k in sentStr) { if (sentStr[k] === undefined) delete BASE[k]; else BASE[k] = sentStr[k]; }
  }
  writeLS(BASE_KEY, BASE);
}

const btn = () => document.getElementById('syncBtn');
async function run() {
  if (btn()) btn().hidden = !linked();
  if (!linked()) return;
  if (syncing) { again = true; return; }
  syncing = true; btn()?.classList.add('spin');
  try { await syncNow(); online = true; setSync('✓ salvat în Google'); }
  catch (e) {
    online = false;
    setSync(e.code === 'cod_gresit' ? 'cod secret greșit' : 'offline – salvat local');
    if (e.code !== 'cod_gresit') { clearTimeout(syncT); syncT = setTimeout(run, 20000); }
  }
  syncing = false; btn()?.classList.remove('spin');
  if (again) { again = false; run(); }
}
// butonul de reîmprospătare din bara de sus
export function syncNowBtn() { setSync('se sincronizează…'); clearTimeout(syncT); run(); }

export function queueSync() { if (!linked()) return; setSync('se salvează…'); clearTimeout(syncT); syncT = setTimeout(run, 1500); }
export async function connect() {
  if (!linked()) { setSync('doar pe acest dispozitiv'); return; }
  setSync('se conectează…');
  await run();
}

/* ---- link de conectare: adresa scriptului + codul secret într-un singur link (…/#conectare=…) ---- */
export const currentUrl = () => CFG.url || '';
export function setupLink() {
  const code = btoa(JSON.stringify({u: CFG.url, t: CFG.token})).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return location.origin + location.pathname + '#conectare=' + code;
}
export function parseSetup(text) {
  const m = String(text || '').match(/#conectare=([\w-]+)/);
  if (!m) return null;
  try {
    const s = m[1].replace(/-/g, '+').replace(/_/g, '/'), d = JSON.parse(atob(s + '='.repeat((4 - s.length % 4) % 4)));
    return /^https:\/\/script\.google\.com\/.+\/exec$/.test(d.u) && d.t ? {url: d.u, token: d.t} : null;
  } catch (e) { return null; }
}

/* ---- grupe comune cu un coleg care are tabelul lui ----
   Clasele cu același id în ambele tabele (grupele copiate) se completează reciproc: listele de elevi
   și datele (prezență, note, testări) se unesc. Ștergerile nu se transmit. Linkul colegului stă doar pe acest dispozitiv. */
const PEER_KEY = 'catalogSport.peer';
export const peerLinked = () => !!readLS(PEER_KEY, null);
export function setPeer(text) {
  const p = parseSetup(text);
  if (!p) throw Object.assign(new Error('link'), {code: 'link_invalid'});
  if (p.url === CFG.url) throw Object.assign(new Error('same'), {code: 'same_table'});
  writeLS(PEER_KEY, p);
}
export function unsetPeer() { try { localStorage.removeItem(PEER_KEY); } catch (e) {} }
export async function mergeWithPeer() {
  const peer = readLS(PEER_KEY, null);
  await run();                                         // întâi tabelul meu la zi
  const other = (await api('get', null, peer)).docs || {};
  const oc = other.core;
  const shared = oc ? S.classes.filter(c => (oc.classes || []).some(x => x.id === c.id)) : [];
  if (!shared.length) return [];
  const send = {core: Object.assign({}, oc, {classes: oc.classes.map(x => { const m = S.classes.find(c => c.id === x.id); return m ? merge3(undefined, m, x) : x; })})};
  S.classes = S.classes.map(c => { const o = oc.classes.find(x => x.id === c.id); return o ? merge3(undefined, c, o) : c; });
  for (const c of shared) {
    const mine = {}; CLASS_KEYS.forEach(k => mine[k] = S[k][c.id] || {});
    const m = merge3(undefined, mine, other['c_' + c.id] || {}) || mine;
    CLASS_KEYS.forEach(k => S[k][c.id] = m[k] || {});
    send['c_' + c.id] = m;
  }
  await api('put', {docs: send}, peer);                // la coleg
  persistLocal(); onRemote(); queueSync();              // la mine
  return shared.map(c => c.name);
}

/* ---- conectare / deconectare din Setări ---- */
export async function link(url, token) {
  await api('ping', null, {url, token});   // aruncă eroare dacă adresa sau codul nu sunt bune
  CFG = {url, token}; writeLS(CFG_KEY, CFG);
  BASE = {}; writeLS(BASE_KEY, BASE);       // prima sincronizare unește datele de aici cu cele din Google
  await connect();
}
export function unlink() {
  CFG = {}; BASE = {}; online = false;
  if (btn()) btn().hidden = true;
  try { localStorage.removeItem(CFG_KEY); localStorage.removeItem(BASE_KEY); } catch (e) {}
  setSync('doar pe acest dispozitiv');
}

// când revii în aplicație sau revine internetul: verifică dacă ai lucrat între timp pe alt dispozitiv
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') run(); });
window.addEventListener('online', run);
// și singur, la 2 minute, cât timp aplicația e pe ecran
setInterval(() => { if (document.visibilityState === 'visible' && !syncing) run(); }, 120000);
