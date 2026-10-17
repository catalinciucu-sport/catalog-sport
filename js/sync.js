// Sincronizare cu Google Sheets prin scriptul Code.gs (vezi google-apps-script/).
// Documente trimise: "meta" (ora ultimei modificări), "core" (clase, orar, module, norme, setări)
// și "c_<classId>" cu datele clasei (CLASS_KEYS). Trimite doar ce s-a schimbat.
// Pe lângă date, trimite foile citibile „Prezență <clasa>” și „Note <clasa>”.
import {S, CLASS_KEYS, setState} from './store.js';
import {fmtD} from './util.js';
import {reasonExcused, finalFor} from './calc.js';
import {setSync} from './ui.js';

const CFG_KEY = 'catalogSport.google';
let CFG = (() => { try { return JSON.parse(localStorage.getItem(CFG_KEY)) || {}; } catch (e) { return {}; } })();
let lastW = {}, syncT = null, syncing = false, again = false, online = false;
let onRemote = () => {};
export const onRemoteData = fn => { onRemote = fn; };   // apelat când s-au preluat date mai noi din Google
export const linked = () => !!(CFG.url && CFG.token);

async function api(action, extra, cfg = CFG) {
  const r = await fetch(cfg.url, {method: 'POST', headers: {'Content-Type': 'text/plain;charset=utf-8'},
    body: JSON.stringify(Object.assign({token: cfg.token, action}, extra || {}))});
  const j = await r.json();
  if (!j.ok) { const e = new Error(j.error || 'eroare'); e.code = j.error; throw e; }
  return j;
}

function buildDocs() {
  const docs = {
    meta: JSON.stringify({updatedAt: S.updatedAt || 0}),
    // "core" = tot ce nu ține de o clasă anume (școala, clase, orar, module, norme, echipe, setări...)
    core: JSON.stringify(Object.fromEntries(Object.entries(S).filter(([k]) => !CLASS_KEYS.includes(k) && k !== 'ui' && k !== 'updatedAt'))),
  };
  S.classes.forEach(c => {
    const d = {}; CLASS_KEYS.forEach(k => d[k] = S[k][c.id] || {});
    docs['c_' + c.id] = JSON.stringify(d);
  });
  return docs;
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
    att.push([i + 1, st.name, st.gender || '', ...cells, p, a, m]);
  });
  const grades = [['Nr', 'Nume', ...S.modules.flatMap(md => [md.name + ' % prezență', md.name + ' notă prezență', md.name + ' medie norme', md.name + ' NOTA FINALĂ'])]];
  c.students.forEach((st, i) => grades.push([i + 1, st.name, ...S.modules.flatMap(md => {
    const f = finalFor(c, st, md); return [f.a.pct ?? '', f.gp ?? '', f.avgN != null ? +f.avgN.toFixed(2) : '', f.g ?? ''];
  })]));
  return {[sheetName('Prezență ', c)]: att, [sheetName('Note ', c)]: grades};
}

/* ---- trimitere ---- */
export function queueSync() { if (!linked()) return; setSync('se salvează…'); clearTimeout(syncT); syncT = setTimeout(flush, 1500); }
async function flush() {
  if (!linked() || !online) return;
  if (syncing) { again = true; return; }
  syncing = true;
  try {
    const docs = buildDocs(), send = {}, sent = {};
    for (const k in docs) if (lastW[k] !== docs[k]) { send[k] = JSON.parse(docs[k]); sent[k] = docs[k]; }
    for (const k in lastW) if (!(k in docs)) { send[k] = null; sent[k] = null; }
    if (Object.keys(send).some(k => k !== 'meta')) {
      const views = {};
      const changed = 'core' in send ? S.classes : S.classes.filter(c => ('c_' + c.id) in send);
      changed.forEach(c => Object.assign(views, buildViews(c)));
      await api('put', {docs: send, views, allViews: viewNames()});
      for (const k in sent) { if (sent[k] == null) delete lastW[k]; else lastW[k] = sent[k]; }
    } else lastW.meta = docs.meta;   // doar s-a schimbat tabul: nimic de trimis
    setSync('✓ salvat în Google');
  } catch (e) {
    setSync(e.code === 'cod_gresit' ? 'cod secret greșit' : 'offline – salvat local');
    clearTimeout(syncT); syncT = setTimeout(flush, 20000);
  }
  syncing = false;
  if (again) { again = false; flush(); }
}

/* ---- preluare ---- */
function adopt(got) {
  const core = got.core, n = Object.assign({}, core, {ui: S.ui, updatedAt: (got.meta && got.meta.updatedAt) || 0});
  CLASS_KEYS.forEach(k => n[k] = {});
  (core.classes || []).forEach(c => { const d = got['c_' + c.id]; if (d) CLASS_KEYS.forEach(k => n[k][c.id] = d[k] || {}); });
  setState(n);
}
// dacă în Google sunt date mai noi (ai lucrat pe alt dispozitiv) și aici nu e nimic netrimis, le preia
async function pullNewer() {
  const got = (await api('get')).docs || {};
  const remoteT = (got.meta && got.meta.updatedAt) || 0;
  const firstTime = !Object.keys(lastW).length;
  const localDirty = !firstTime && lastW.meta !== buildDocs().meta;
  if (got.core && !localDirty && (remoteT > (S.updatedAt || 0) || !S.classes.length)) {
    lastW = {}; for (const k in got) lastW[k] = JSON.stringify(got[k]);
    adopt(got); onRemote();
  } else if (firstTime) {
    for (const k in got) lastW[k] = JSON.stringify(got[k]);
  }
}
export async function connect() {
  if (!linked()) { setSync('doar pe acest dispozitiv'); return; }
  setSync('se conectează…');
  try { await pullNewer(); online = true; flush(); }
  catch (e) {
    online = false;
    if (e.code === 'cod_gresit') { setSync('cod secret greșit'); return; }
    setSync('offline – salvat local'); setTimeout(connect, 20000);
  }
}

/* ---- conectare / deconectare din Setări ---- */
export async function link(url, token) {
  await api('ping', null, {url, token});   // aruncă eroare dacă adresa sau codul nu sunt bune
  CFG = {url, token};
  try { localStorage.setItem(CFG_KEY, JSON.stringify(CFG)); } catch (e) {}
  lastW = {}; await connect();
}
export function unlink() {
  CFG = {}; online = false;
  try { localStorage.removeItem(CFG_KEY); } catch (e) {}
  setSync('doar pe acest dispozitiv');
}

document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState !== 'visible' || !linked() || !online || syncing) return;
  try { await pullNewer(); } catch (e) {}
});
window.addEventListener('online', () => { if (linked()) online ? flush() : connect(); });
