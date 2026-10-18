// Ecranul „Norme”: introducerea rezultatelor pe modul (nota se calculează după barem) și definirea normelor.
import {S, save, cls, path} from '../store.js';
import {esc, uid, openModal, closeModal, ask, toast, $} from '../util.js';
import {defaultModule, normGrade, rres, recalcNorm} from '../calc.js';
import {render, view, setHead, classOpts, modOpts, gTag, fromTag} from '../ui.js';
import {A} from './attendance.js';

const N = {classId: null, modId: null, normId: null};
const normOf = () => S.norms.find(x => x.id === N.normId);

function renderNorms() {
  setHead('Norme de control');
  if (!cls(N.classId)) N.classId = cls(A.classId) ? A.classId : S.classes[0]?.id;
  if (!S.modules.find(m => m.id === N.modId)) N.modId = defaultModule()?.id;
  if (!normOf()) N.normId = S.norms[0]?.id;
  const c = cls(N.classId), mod = S.modules.find(m => m.id === N.modId), n = normOf();
  let entry = '';
  if (c && mod && n) {
    const r = rres(c.id, mod.id)[n.id] || {};
    entry = `<div class="list">${c.students.map((st, i) => {
      const x = r[st.id] || {}, val = n.type === 'direct' ? (x.g ?? '') : (x.v ?? '');
      return `<div class="st static"><span class="nr">${i + 1}</span><span class="nm">${esc(st.name)} <span class="muted small">${st.gender || ''}</span>${fromTag(st)}</span>
        <input type="number" class="val" inputmode="decimal" step="any" value="${val}" placeholder="${n.type === 'direct' ? 'notă' : esc(n.unit)}" data-ch="res" data-id="${st.id}">
        <span id="rg_${st.id}" style="width:36px;text-align:center">${gTag(x.g)}</span></div>`;
    }).join('') || '<div class="empty">Clasa nu are elevi.</div>'}</div>`;
  }
  view().innerHTML = `<div class="card"><h2>Introducere rezultate</h2>
    ${!S.classes.length ? '<div class="muted">Adaugă mai întâi o clasă.</div>' : !S.norms.length ? '<div class="muted">Adaugă mai întâi o normă (mai jos).</div>' : `
    <div class="row2"><label class="f">Clasa<select data-ch="nClass">${classOpts(c?.id)}</select></label>
    <label class="f">Modul<select data-ch="nMod">${modOpts(mod?.id)}</select></label></div>
    <label class="f" style="margin-top:8px">Norma<select data-ch="nNorm">${S.norms.map(x => `<option value="${x.id}" ${x.id === n?.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
    <div class="small muted" style="margin-top:8px">${n ? (n.type === 'direct' ? 'Introdu direct nota (1–10).' : `Introdu rezultatul în ${esc(n.unit)} – nota se calculează automat după barem (${n.type === 'high' ? 'mai mare = mai bine' : 'mai mic = mai bine'}). Lasă gol pentru elevii care nu au susținut proba.`) : ''}</div>`}
  </div>${entry}
  <div class="card" style="margin-top:12px"><div class="row2"><h2 class="grow" style="margin:0">Norme definite</h2><button class="btn pri sm" data-act="normEdit" data-id="">+ Normă nouă</button></div>
    ${S.norms.map(x => `<div class="item"><div class="grow"><b>${esc(x.name)}</b><div class="small muted">${x.type === 'direct' ? 'notă directă' : `${esc(x.unit)} · ${x.type === 'high' ? 'mai mare = mai bine' : 'mai mic = mai bine'} · nota 10: B ${x.t.B[0] ?? '–'} / F ${x.t.F[0] ?? '–'}`}</div></div>
      <button class="btn sm" data-act="normEdit" data-id="${x.id}">Editează</button></div>`).join('') || '<div class="muted">Nicio normă.</div>'}</div>`;
}

function normModal(id) {
  const n = S.norms.find(x => x.id === id) || {id: '', name: '', unit: '', type: 'high', t: {B: ['', '', '', '', '', ''], F: ['', '', '', '', '', '']}};
  const cell = (g, i) => `<div><input type="number" step="any" id="t${g}${i}" value="${n.t[g][i] ?? ''}" data-ch="thr"><div class="small" id="iv${g}${i}" style="margin-top:2px;min-height:1.3em"></div></div>`;
  const grid = [0, 1, 2, 3, 4, 5].map(i => `<div>Nota ${10 - i}</div>${cell('B', i)}${cell('F', i)}`).join('');
  openModal(`<h3>${id ? 'Editează norma' : 'Normă nouă'}</h3>
    <label class="f">Denumire<input type="text" id="nName" value="${esc(n.name)}" placeholder="ex: Alergare de rezistență 800 m"></label>
    <div class="row2" style="margin-top:8px">
      <label class="f">Tip notare<select id="nType" data-ch="nTypeUi">
        <option value="high" ${n.type === 'high' ? 'selected' : ''}>Barem: mai mare = mai bine (cm, nr. repetări)</option>
        <option value="low" ${n.type === 'low' ? 'selected' : ''}>Barem: mai mic = mai bine (secunde)</option>
        <option value="direct" ${n.type === 'direct' ? 'selected' : ''}>Notă directă (fără barem)</option></select></label>
      <label class="f" style="max-width:120px">Unitate<input type="text" id="nUnit" value="${esc(n.unit)}" placeholder="s, cm, rep." data-ch="thr"></label></div>
    <div id="thr" style="margin-top:12px" ${n.type === 'direct' ? 'hidden' : ''}>
      <div class="small muted" style="margin-bottom:6px" id="thrHelp"></div>
      <div class="grid-t"><div></div><div><b>Băieți</b></div><div><b>Fete</b></div>${grid}</div>
      <div class="small muted" style="margin-top:6px">Sub pragul notei 5 se acordă nota ${S.settings.minGrade}. Dacă lași coloana Fete goală, se folosește baremul pentru băieți.</div></div>
    <div class="row2" style="margin-top:14px"><button class="btn pri" data-act="normSave" data-id="${n.id}">Salvează</button>
      ${id ? `<button class="btn bad" data-act="normDel" data-id="${n.id}">Șterge</button>` : ''}<button class="btn right" data-act="close">Renunță</button></div>`);
  showIntervals();
}

// intervalul fiecărei note, calculat din limitele scrise (ex. nota 9: 8,0 – 8,3 s)
function intervals(type, raw, unit) {
  const v = raw.map(x => x === '' ? null : +x), set = v.filter(x => x != null);
  const dec = Math.max(0, ...set.map(x => (String(x).split('.')[1] || '').length));
  const step = 10 ** -dec, f = x => x.toFixed(dec).replace('.', ','), u = unit ? ' ' + unit : '';
  let prev = null;
  return v.map(x => {
    if (x == null) return '';
    let s;
    if (prev == null) s = (type === 'low' ? 'până la ' : 'de la ') + f(x) + u;
    else if (type === 'low' ? x <= prev : x >= prev) s = '⚠ verifică ordinea';
    else { const a = type === 'low' ? prev + step : prev - step; s = (type === 'low' ? `${f(a)} – ${f(x)}` : `${f(x)} – ${f(a)}`) + u; }
    prev = x;
    return s;
  });
}
function showIntervals() {
  const type = $('#nType').value, unit = $('#nUnit').value.trim();
  $('#thrHelp').textContent = type === 'low'
    ? 'Scrie pentru fiecare notă rezultatul cel mai slab cu care se mai ia nota (ex. nota 10: 7,9; nota 9: 8,3). Sub fiecare căsuță vezi intervalul.'
    : 'Scrie pentru fiecare notă rezultatul minim cu care se ia nota (ex. nota 10: 210; nota 9: 200). Sub fiecare căsuță vezi intervalul.';
  ['B', 'F'].forEach(g => {
    const vals = [0, 1, 2, 3, 4, 5].map(i => $('#t' + g + i).value);
    const empty = g === 'F' && vals.every(x => x === '');
    intervals(type, vals, unit).forEach((s, i) => {
      const el = $('#iv' + g + i);
      el.textContent = empty ? (i ? '' : 'ca la băieți') : s;
      el.style.color = s.startsWith('⚠') ? 'var(--bad)' : 'var(--muted)';
    });
  });
}

function setResult(sid, raw) {
  const n = normOf(), st = cls(N.classId).students.find(s => s.id === sid);
  const r = path('results', N.classId, N.modId, n.id);
  if (raw === '') delete r[sid];
  else r[sid] = n.type === 'direct' ? {v: null, g: normGrade(n, st.gender, raw)} : {v: +raw, g: normGrade(n, st.gender, raw)};
  save(); $('#rg_' + sid).innerHTML = gTag(r[sid]?.g);
}

export default {
  key: 'norms', title: 'Norme', render: renderNorms,
  actions: {
    normEdit(el) { normModal(el.dataset.id); },
    normSave(el) {
      const name = $('#nName').value.trim(); if (!name) { toast('Scrie denumirea normei'); return; }
      const t = {B: [], F: []};
      for (let i = 0; i < 6; i++) { const b = $('#tB' + i).value, f = $('#tF' + i).value; t.B.push(b === '' ? '' : +b); t.F.push(f === '' ? '' : +f); }
      const type = $('#nType').value;
      if (type !== 'direct' && !t.B.some(x => x !== '')) { toast('Completează baremul (cel puțin o valoare)'); return; }
      let n = S.norms.find(x => x.id === el.dataset.id);
      if (!n) { n = {id: uid()}; S.norms.push(n); }
      Object.assign(n, {name, unit: $('#nUnit').value.trim(), type, t});
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
    res(el) { setResult(el.dataset.id, el.value); },
  },
  // nota apare în timp ce scrii
  inputs: {
    thr: showIntervals,
    res(el) { const n = normOf(), st = cls(N.classId)?.students.find(s => s.id === el.dataset.id); if (n && st) $('#rg_' + st.id).innerHTML = gTag(normGrade(n, st.gender, el.value)); },
  },
};
