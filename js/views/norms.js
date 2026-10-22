// Ecranul „Norme”: introducerea rezultatelor pe modul (nota se calculează după baremul nivelului clasei)
// și definirea normelor: barem general + bareme pe niveluri, completate de mână sau generate din rezultate.
import {S, save, cls, path, LEVELS} from '../store.js';
import {esc, uid, openModal, closeModal, ask, toast, $} from '../util.js';
import {defaultModule, normGrade, rres, recalcNorm, levelOf, curveBarem} from '../calc.js';
import {render, view, setHead, classOpts, modOpts, gTag, fromTag} from '../ui.js';
import {A} from './attendance.js';
import {mecNorms} from '../mec.js';

const N = {classId: null, modId: null, normId: null};
const normOf = () => S.norms.find(x => x.id === N.normId);
const empty6 = () => ['', '', '', '', '', ''];
const lvName = l => l === 'g' ? 'General' : LEVELS[+l];
const filled = a => a && a.some(x => x !== '' && x != null);
// unitatea „min” = minute.secunde (4.50 = 4'50"); se afișează mereu cu două zecimale
const isMin = u => u === 'min';
const shown2 = (v, u) => v === '' || v == null ? '' : isMin(u) ? (+v).toFixed(2) : v;
const badSec = v => v !== '' && v != null && Math.round((+v % 1) * 100) >= 60;
let MEC_NEW = [];

function renderNorms() {
  setHead('Norme de control');
  N.classId = cls(A.classId) ? A.classId : S.classes[0]?.id;   // clasa deschisă din Home
  if (!S.modules.find(m => m.id === N.modId)) N.modId = defaultModule()?.id;
  if (!normOf()) N.normId = S.norms[0]?.id;
  const c = cls(N.classId), mod = S.modules.find(m => m.id === N.modId), n = normOf(), lvl = levelOf(c);
  let entry = '';
  if (c && mod && n) {
    const r = rres(c.id, mod.id)[n.id] || {};
    entry = `<div class="list">${c.students.map((st, i) => {
      const x = r[st.id] || {}, val = n.type === 'direct' ? (x.g ?? '') : shown2(x.v, n.unit);
      return `<div class="st static"><span class="nr">${i + 1}</span><span class="nm">${esc(st.name)} <span class="muted small">${st.gender || ''}</span>${fromTag(st)}</span>
        <input type="number" class="val" inputmode="decimal" step="any" value="${val}" placeholder="${n.type === 'direct' ? 'notă' : isMin(n.unit) ? 'ex. 4.50' : esc(n.unit)}" data-ch="res" data-id="${st.id}">
        <span id="rg_${st.id}" style="width:36px;text-align:center">${gTag(x.g)}</span></div>`;
    }).join('') || '<div class="empty">Clasa nu are elevi.</div>'}</div>`;
  }
  const lvUsed = lvl != null && n?.lv?.[lvl] && (filled(n.lv[lvl].B) || filled(n.lv[lvl].F));
  view().innerHTML = `<div class="card"><h2>Introducere rezultate</h2>
    ${!S.classes.length ? '<div class="muted">Adaugă mai întâi o clasă.</div>' : !S.norms.length ? '<div class="muted">Adaugă mai întâi o normă (mai jos).</div>' : `
    <div class="row2"><label class="f">Modul<select data-ch="nMod">${modOpts(mod?.id)}</select></label></div>
    <label class="f" style="margin-top:8px">Norma<select data-ch="nNorm">${S.norms.map(x => `<option value="${x.id}" ${x.id === n?.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
    <div class="small muted" style="margin-top:8px">${n ? (n.type === 'direct' ? 'Introdu direct nota (1–10).' : `Introdu rezultatul în ${isMin(n.unit) ? 'minute.secunde (4.50 = 4 min 50 s)' : esc(n.unit)} – nota se calculează automat după ${lvUsed ? `baremul pentru clasa a ${LEVELS[lvl]}-a` : 'baremul general'} (${n.type === 'high' ? 'mai mare = mai bine' : 'mai mic = mai bine'}). Lasă gol pentru elevii care nu au susținut proba.`) : ''}</div>`}
  </div>${entry}
  <div class="card" style="margin-top:12px"><div class="row2"><h2 class="grow" style="margin:0">Norme definite</h2><button class="btn pri sm" data-act="normEdit" data-id="">+ Normă nouă</button></div>
    <button class="btn sm" data-act="mecAdd" style="margin:8px 0 4px">Adaugă grilele MEC (clasele V–XII)</button>
    ${S.norms.map(x => { const lv = Object.keys(x.lv || {}).filter(k => filled(x.lv[k].B) || filled(x.lv[k].F)).sort((a, b) => a - b);
      return `<div class="item"><div class="grow"><b>${esc(x.name)}</b><div class="small muted">${x.type === 'direct' ? 'notă directă' : `${esc(x.unit)} · ${x.type === 'high' ? 'mai mare = mai bine' : 'mai mic = mai bine'} · bareme: general${lv.length ? ', ' + lv.map(k => LEVELS[k]).join(', ') : ''}`}</div></div>
      <button class="btn sm" data-act="normEdit" data-id="${x.id}">Editează</button></div>`; }).join('') || '<div class="muted">Nicio normă.</div>'}</div>`;
}

/* ---- fereastra normei: DRAFT ține baremele cât timp editezi; LV = nivelul afișat ('g' = general) ---- */
let DRAFT = null, LV = 'g', EDIT_ID = '';
const cur = () => LV === 'g' ? DRAFT.t : (DRAFT.lv[LV] = DRAFT.lv[LV] || {B: empty6(), F: empty6()});
function normModal(id) {
  const n = S.norms.find(x => x.id === id) || {id: '', name: '', unit: '', type: 'high', t: {B: empty6(), F: empty6()}};
  EDIT_ID = n.id; LV = 'g';
  DRAFT = {t: JSON.parse(JSON.stringify(n.t)), lv: JSON.parse(JSON.stringify(n.lv || {}))};
  openModal(`<h3>${id ? 'Editează norma' : 'Normă nouă'}</h3>
    <label class="f">Denumire<input type="text" id="nName" value="${esc(n.name)}" placeholder="ex: Alergare de rezistență 800 m"></label>
    <div class="row2" style="margin-top:8px">
      <label class="f">Tip notare<select id="nType" data-ch="nTypeUi">
        <option value="high" ${n.type === 'high' ? 'selected' : ''}>Barem: mai mare = mai bine (cm, nr. repetări)</option>
        <option value="low" ${n.type === 'low' ? 'selected' : ''}>Barem: mai mic = mai bine (secunde)</option>
        <option value="direct" ${n.type === 'direct' ? 'selected' : ''}>Notă directă (fără barem)</option></select></label>
      <label class="f" style="max-width:120px">Unitate<input type="text" id="nUnit" value="${esc(n.unit)}" placeholder="s, cm, rep." data-ch="thr"></label></div>
    <div id="thr" style="margin-top:12px" ${n.type === 'direct' ? 'hidden' : ''}><div id="thrBody"></div></div>
    <div class="row2" style="margin-top:14px"><button class="btn pri" data-act="normSave">Salvează</button>
      ${id ? `<button class="btn bad" data-act="normDel" data-id="${n.id}">Șterge</button>` : ''}<button class="btn right" data-act="close">Renunță</button></div>`);
  drawBarem();
}
function drawBarem() {
  const classLv = [...new Set(S.classes.map(levelOf).filter(l => l != null))];
  const shown = [...new Set([...classLv, ...Object.keys(DRAFT.lv).map(Number)])].sort((a, b) => a - b);
  const rest = LEVELS.map((t, i) => i).filter(i => !shown.includes(i));
  const t = cur(), unit = $('#nUnit').value.trim();
  const cell = (g, i) => `<div><input type="number" step="any" id="t${g}${i}" value="${shown2(t[g][i], unit)}" data-ch="thr"><div class="small" id="iv${g}${i}" style="margin-top:2px;min-height:1.3em"></div></div>`;
  $('#thrBody').innerHTML = `
    <div class="small muted" style="margin-bottom:6px">Baremul general se folosește la nivelurile fără barem propriu. Alege un nivel ca să-i completezi baremul.</div>
    <div class="chips" style="margin:0 0 10px">${['g', ...shown].map(k => { const has = k === 'g' || (DRAFT.lv[k] && (filled(DRAFT.lv[k].B) || filled(DRAFT.lv[k].F)));
      return `<button class="chip ${String(k) === String(LV) ? 'on' : ''}" data-act="nLv" data-k="${k}">${lvName(k)}${has && k !== 'g' ? ' ✓' : ''}</button>`; }).join('')}
      ${rest.length ? `<select data-ch="nLvAdd" style="width:auto;min-height:38px"><option value="">+ nivel</option>${rest.map(i => `<option value="${i}">${LEVELS[i]}</option>`).join('')}</select>` : ''}</div>
    <div class="small muted" style="margin-bottom:6px" id="thrHelp"></div>
    <div class="grid-t"><div></div><div><b>Băieți</b></div><div><b>Fete</b></div>${[0, 1, 2, 3, 4, 5].map(i => `<div>Nota ${10 - i}</div>${cell('B', i)}${cell('F', i)}`).join('')}</div>
    <div class="small muted" style="margin-top:6px">Sub pragul notei 5 se acordă nota ${S.settings.minGrade}. Dacă lași coloana Fete goală, se folosește baremul pentru băieți.</div>
    <div class="row2" style="margin-top:10px"><button class="btn sm" data-act="nCurve">Generează din rezultate</button>
      ${LV !== 'g' ? '<button class="btn sm bad" data-act="nLvClear">Golește baremul acestui nivel</button>' : ''}</div>
    <div class="small muted" id="curveInfo" style="margin-top:6px"></div>`;
  showIntervals();
}

// intervalul fiecărei note, calculat din limitele scrise (ex. nota 9: 8,0 – 8,3 s)
function intervals(type, raw, unit) {
  const v = raw.map(x => x === '' ? null : +x), set = v.filter(x => x != null);
  const dec = isMin(unit) ? 2 : Math.max(0, ...set.map(x => (String(x).split('.')[1] || '').length));
  const f = x => isMin(unit) ? x.toFixed(2).replace('.', "'") + '"' : x.toFixed(dec).replace('.', ','), u = unit && !isMin(unit) ? ' ' + unit : '';
  // la minute.secunde, pasul de după x.00 e x-1.59 (nu x-1.99)
  const nextMin = (x, d) => { let s = Math.round(x * 100) + d; if (s % 100 > 59) s += d > 0 ? 40 : -40; return s / 100; };
  const step = 10 ** -dec, move = (x, d) => isMin(unit) ? nextMin(x, d) : x + d * step;
  let prev = null;
  return v.map(x => {
    if (x == null) return '';
    let s;
    if (isMin(unit) && badSec(x)) s = '⚠ secundele trec de 59';
    else if (prev == null) s = (type === 'low' ? 'până la ' : 'de la ') + f(x) + u;
    else if (type === 'low' ? x <= prev : x >= prev) s = '⚠ verifică ordinea';
    else { const a = move(prev, type === 'low' ? 1 : -1); s = (type === 'low' ? `${f(a)} – ${f(x)}` : `${f(x)} – ${f(a)}`) + u; }
    prev = x;
    return s;
  });
}
// citește căsuțele în DRAFT și arată intervalele
function showIntervals() {
  if (!$('#thrHelp')) return;
  const type = $('#nType').value, unit = $('#nUnit').value.trim(), t = cur();
  $('#thrHelp').textContent = (LV === 'g' ? 'Barem general. ' : `Barem pentru clasa ${LEVELS[LV] === 'Pregătitoare' ? 'pregătitoare' : 'a ' + LEVELS[LV] + '-a'}. `) + (type === 'low'
    ? 'Scrie pentru fiecare notă rezultatul cel mai slab cu care se mai ia nota (ex. nota 10: 7,9; nota 9: 8,3).'
    : 'Scrie pentru fiecare notă rezultatul minim cu care se ia nota (ex. nota 10: 210; nota 9: 200).')
    + (isMin(unit) ? ' Timpul se scrie minute.secunde: 4.50 = 4 min 50 s.' : '');
  ['B', 'F'].forEach(g => {
    const vals = [0, 1, 2, 3, 4, 5].map(i => $('#t' + g + i).value);
    t[g] = vals.map(v => v === '' ? '' : +v);
    const none = g === 'F' && vals.every(x => x === '');
    intervals(type, vals, unit).forEach((s, i) => {
      const el = $('#iv' + g + i);
      el.textContent = none ? (i ? '' : 'ca la băieți') : s;
      el.style.color = s.startsWith('⚠') ? 'var(--bad)' : 'var(--muted)';
    });
  });
}

function setResult(sid, raw) {
  const n = normOf(), c = cls(N.classId), st = c.students.find(s => s.id === sid);
  const r = path('results', N.classId, N.modId, n.id);
  if (raw === '') delete r[sid];
  else if (isMin(n.unit) && n.type !== 'direct' && badSec(raw)) { toast('Secundele trec de 59 – scrie de ex. 4.50 pentru 4 min 50 s'); return; }
  else { const g = normGrade(n, st.gender, raw, levelOf(c)); r[sid] = n.type === 'direct' ? {v: null, g} : {v: +raw, g}; }
  save(); $('#rg_' + sid).innerHTML = gTag(r[sid]?.g);
}

export default {
  key: 'norms', title: 'Norme', render: renderNorms,
  actions: {
    normEdit(el) { normModal(el.dataset.id); },
    // grilele MEC: arată întâi ce se adaugă; normele existente (după id) nu se ating
    mecAdd() {
      MEC_NEW = mecNorms().filter(m => !S.norms.some(x => x.id === m.id));
      if (!MEC_NEW.length) { toast('Toate probele din grilele MEC sunt deja în listă'); return; }
      const lv = m => { const k = Object.keys(m.lv).sort((a, b) => a - b); return k.length ? k.map(x => LEVELS[x]).join(', ') : 'notă directă'; };
      openModal(`<h3>Adaugă grilele MEC</h3>
        <div class="small muted" style="margin-bottom:8px">Se adaugă ${MEC_NEW.length} probe, cu baremele pe clase (băieți și fete). Normele tale și rezultatele elevilor rămân neschimbate; probele MEC deja existente nu se rescriu.</div>
        <div style="max-height:50vh;overflow:auto">${MEC_NEW.map(m => `<div class="item"><div class="grow">${esc(m.name)}<div class="small muted">${esc(lv(m))}</div></div></div>`).join('')}</div>
        <div class="row2" style="margin-top:14px"><button class="btn pri" data-act="mecYes">Adaugă ${MEC_NEW.length} probe</button><button class="btn right" data-act="close">Renunță</button></div>`);
    },
    mecYes() {
      const add = MEC_NEW.filter(m => !S.norms.some(x => x.id === m.id));
      S.norms.push(...add); MEC_NEW = [];
      save(); closeModal(); render(); toast(`Am adăugat ${add.length} probe MEC`);
    },
    nLv(el) { showIntervals(); LV = el.dataset.k === 'g' ? 'g' : el.dataset.k; drawBarem(); },
    nLvClear() { delete DRAFT.lv[LV]; LV = 'g'; drawBarem(); },
    nCurve() {
      showIntervals();
      const type = $('#nType').value;
      if (!EDIT_ID) { $('#curveInfo').textContent = 'Salvează mai întâi norma și introdu rezultate la ea.'; return; }
      const lvl = LV === 'g' ? null : +LV, norm = {id: EDIT_ID, type}, t = cur(), info = [];
      ['B', 'F'].forEach(g => {
        const r = curveBarem(norm, lvl, g);
        info.push(`${g === 'B' ? 'băieți' : 'fete'}: ${r.n} elevi`);
        if (r.t) t[g] = r.t.map(v => Math.round(v * 100) / 100);
      });
      drawBarem();
      $('#curveInfo').textContent = `Barem propus din rezultatele ${lvl == null ? 'tuturor elevilor' : 'elevilor de clasa a ' + LEVELS[lvl] + '-a'} (${info.join(', ')}; e nevoie de minimum 5). Verifică-l, ajustează-l dacă vrei și apasă Salvează.`;
    },
    normSave() {
      showIntervals();
      const name = $('#nName').value.trim(); if (!name) { toast('Scrie denumirea normei'); return; }
      const type = $('#nType').value;
      if (type !== 'direct' && !filled(DRAFT.t.B) && !filled(DRAFT.t.F)) { toast('Completează baremul general (cel puțin o valoare)'); return; }
      if (isMin($('#nUnit').value.trim()) && [DRAFT.t, ...Object.values(DRAFT.lv)].some(x => [...x.B, ...x.F].some(badSec))) { toast('Un timp are secundele peste 59 (scrie ex. 4.50)'); return; }
      Object.keys(DRAFT.lv).forEach(k => { if (!filled(DRAFT.lv[k].B) && !filled(DRAFT.lv[k].F)) delete DRAFT.lv[k]; });
      let n = S.norms.find(x => x.id === EDIT_ID);
      if (!n) { n = {id: uid()}; S.norms.push(n); }
      Object.assign(n, {name, unit: $('#nUnit').value.trim(), type, t: DRAFT.t, lv: DRAFT.lv});
      recalcNorm(n.id); N.normId = n.id; save(); closeModal(); render();
    },
    normDel(el) {
      const id = el.dataset.id;
      ask('Ștergi norma și toate rezultatele ei?', () => {
        S.norms = S.norms.filter(x => x.id !== id);
        for (const c in S.results) for (const m in S.results[c]) delete S.results[c][m][id];
        save(); render();
      }, 'Șterge norma');
    },
  },
  changes: {
    nClass(el) { N.classId = el.value; render(); },
    nMod(el) { N.modId = el.value; render(); },
    nNorm(el) { N.normId = el.value; render(); },
    nTypeUi(el) { $('#thr').hidden = el.value === 'direct'; showIntervals(); },
    nLvAdd(el) { if (el.value === '') return; showIntervals(); LV = el.value; cur(); drawBarem(); },
    res(el) { setResult(el.dataset.id, el.value); },
  },
  // nota apare în timp ce scrii
  inputs: {
    thr: showIntervals,
    res(el) { const n = normOf(), c = cls(N.classId), st = c?.students.find(s => s.id === el.dataset.id); if (n && st) $('#rg_' + st.id).innerHTML = isMin(n.unit) && n.type !== 'direct' && badSec(el.value) ? '⚠' : gTag(normGrade(n, st.gender, el.value, levelOf(c))); },
  },
};
