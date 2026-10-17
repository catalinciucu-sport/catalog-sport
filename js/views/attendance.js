// Ecranul „Prezență”: clasa cu care ai oră, listă cu bifă, motive de absență, istoricul orelor.
import {S, save, cls, path} from '../store.js';
import {esc, iso, fmtD, toMin, wday, nrm, DAYS, ICON, uid, openModal, closeModal, ask, toast, $} from '../util.js';
import {moduleFor, attStats} from '../calc.js';
import {render, view, setHead, classOpts, noClasses} from '../ui.js';
import {linked} from '../sync.js';

// starea ecranului (clasa, data și ora afișate)
export const A = {classId: null, date: iso(new Date()), slot: 'ora', info: null};

function currentSlot() {
  const now = new Date(), d = now.getDay(), m = now.getHours() * 60 + now.getMinutes();
  const today = S.schedule.filter(e => +e.day === d && cls(e.classId)).sort((a, b) => toMin(a.start) - toMin(b.start));
  const cur = today.find(e => toMin(e.start) - 10 <= m && m <= toMin(e.end) + 5);
  if (cur) return {e: cur, kind: 'now'};
  const next = today.find(e => toMin(e.start) > m);
  return next ? {e: next, kind: 'next'} : null;
}
function slotsFor(classId, date) {
  const fromSch = S.schedule.filter(e => e.classId === classId && +e.day === wday(date)).map(e => e.start);
  const fromSess = Object.keys(S.sessions[classId] || {}).filter(k => k.startsWith(date + '|')).map(k => k.split('|')[1]);
  const all = [...new Set([...fromSch, ...fromSess])].sort((a, b) => toMin(a) - toMin(b));
  return all.length ? all : ['ora'];
}
// la pornire: clasa cu care ai oră acum (sau următoarea), altfel ultima folosită
export function initAtt() {
  const today = iso(new Date()), cs = currentSlot();
  if (cs) { Object.assign(A, {classId: cs.e.classId, date: today, slot: cs.e.start, info: cs}); return; }
  const c = cls(S.ui.lastClass) || S.classes[0];
  Object.assign(A, {classId: c ? c.id : null, date: today, slot: c ? slotsFor(c.id, today)[0] : 'ora', info: null});
}
const sessKey = () => A.date + '|' + A.slot;
function getSess(create) {
  if (!A.classId) return null;
  const all = S.sessions[A.classId];
  let s = all && all[sessKey()];
  if (!s && create) {
    s = path('sessions', A.classId)[sessKey()] = {};
    cls(A.classId).students.forEach(st => s[st.id] = {p: false});
  }
  return s || null;
}

function renderAtt() {
  if (!S.classes.length) { setHead('Prezență'); view().innerHTML = noClasses(linked()); return; }
  if (!cls(A.classId)) { A.classId = S.classes[0].id; A.slot = slotsFor(A.classId, A.date)[0]; }
  const c = cls(A.classId), sess = getSess(false), mod = moduleFor(A.date);
  const slots = slotsFor(c.id, A.date);
  if (!slots.includes(A.slot)) slots.push(A.slot);
  setHead('Prezență', `${c.name} · ${DAYS[wday(A.date)]} ${fmtD(A.date)}`);
  let banner = '';
  if (A.info && A.info.e.classId === c.id && A.date === iso(new Date()))
    banner = `<div class="banner">${A.info.kind === 'now' ? 'Ai oră acum cu' : 'Următoarea oră:'} <b>${esc(c.name)}</b> · ${A.info.e.start}–${A.info.e.end}</div>`;
  else if (!S.schedule.length)
    banner = `<div class="banner">Completează <b>orarul</b> în Setări și aplicația va deschide automat clasa cu care ai oră.</div>`;
  let pres = 0, abs = 0;
  if (sess) c.students.forEach(st => { const r = sess[st.id]; if (r) r.p ? pres++ : abs++; });
  const rows = c.students.map((st, i) => {
    const r = sess && sess[st.id], on = r && r.p, isAbs = r && !r.p;
    const pct = mod ? attStats(c.id, st.id, mod).pct : null;
    const why = isAbs ? `<button class="why ${r.r ? 'set' : ''}" data-act="why" data-id="${st.id}">${esc(r.r || 'Motiv?')}</button>` : '';
    return `<div class="st ${on ? 'on' : ''} ${isAbs ? 'abs' : ''}" data-act="tog" data-id="${st.id}" role="checkbox" aria-checked="${!!on}">
      <span class="chk">${ICON.check}</span><span class="nr">${i + 1}</span>
      <span class="nm">${esc(st.name)}</span>${why}${pct != null ? `<span class="pct">${pct}%</span>` : ''}</div>`;
  }).join('');
  view().innerHTML = `${banner}
  <div class="card">
    <div class="row2">
      <label class="f" style="flex-basis:100%">Clasa<select data-ch="attClass">${classOpts(c.id)}</select></label>
      <label class="f">Data<input type="date" value="${A.date}" data-ch="attDate"></label>
      <label class="f" style="max-width:110px;min-width:90px">Ora<select data-ch="attSlot">${slots.map(s => `<option ${s === A.slot ? 'selected' : ''} value="${s}">${s === 'ora' ? '—' : s}</option>`).join('')}</select></label>
    </div>
    <div class="row2" style="margin-top:10px">
      <button class="btn pri" data-act="allIn">Toți prezenți</button>
      <button class="btn" data-act="hist">Istoric</button>
      ${sess ? '<button class="btn bad right" data-act="delSess">Șterge</button>' : ''}
    </div>
  </div>
  <div class="stats">
    <span class="pill">${c.students.length} elevi</span>
    ${sess ? `<span class="pill g">${pres} prezenți</span><span class="pill b">${abs} absenți</span>` : '<span class="pill">Ora nu a fost încă înregistrată – bifează elevii prezenți</span>'}
    <span class="pill">${mod ? esc(mod.name) : 'În afara modulelor'}</span>
  </div>
  ${c.students.length ? `<div class="list">${rows}</div>` : '<div class="card empty">Clasa nu are elevi. Adaugă-i din tabul Clase.</div>'}`;
}

function whyModal(sid) {
  const st = cls(A.classId).students.find(s => s.id === sid);
  const cur = getSess(false)?.[sid]?.r || '';
  const known = S.settings.reasons.some(r => nrm(r.t) === nrm(cur));
  openModal(`<h3>Motivul absenței</h3><div class="muted small">${esc(st.name)}</div>
    <div class="chips">${S.settings.reasons.map(r => `<button class="chip ${nrm(r.t) === nrm(cur) ? 'on' : ''}" data-act="setWhy" data-id="${sid}" data-r="${esc(r.t)}">${esc(r.t)}${r.exc ? ' ✓' : ''}</button>`).join('')}</div>
    <label class="f">Alt motiv / observație<input type="text" id="whyTxt" value="${known ? '' : esc(cur)}" placeholder="ex: entorsă gleznă, adeverință până la 30.10"></label>
    <div class="small muted" style="margin:8px 0">✓ = motiv care nu scade procentul de prezență (ora nu se ia în calcul).</div>
    <div class="row2"><button class="btn pri" data-act="setWhyTxt" data-id="${sid}">Salvează</button><button class="btn" data-act="setWhy" data-id="${sid}" data-r="">Fără motiv</button><button class="btn right" data-act="close">Închide</button></div>`);
}
function histModal() {
  const c = cls(A.classId);
  const items = Object.entries(S.sessions[c.id] || {}).sort((a, b) => b[0].localeCompare(a[0])).map(([k, s]) => {
    const [d, sl] = k.split('|'), v = Object.values(s), p = v.filter(x => x.p).length;
    return `<div class="item"><div class="grow"><b>${DAYS[wday(d)]} ${fmtD(d)}</b> ${sl !== 'ora' ? sl : ''}<div class="small muted">${p} prezenți · ${v.length - p} absenți · ${esc(moduleFor(d)?.name || 'în afara modulelor')}</div></div>
      <button class="btn sm" data-act="openSess" data-k="${esc(k)}">Deschide</button></div>`;
  }).join('');
  openModal(`<h3>Istoric ore – ${esc(c.name)}</h3>${items || '<div class="empty">Nicio oră înregistrată încă.</div>'}<div class="row2" style="margin-top:12px"><button class="btn right" data-act="close">Închide</button></div>`);
}

export default {
  key: 'att', title: 'Prezență', render: renderAtt,
  actions: {
    tog(el) {
      const s = getSess(true), id = el.dataset.id;
      s[id] = s[id] || {p: false}; s[id].p = !s[id].p; if (s[id].p) delete s[id].r;
      S.ui.lastClass = A.classId; save(); render(true);
    },
    why(el, e) { e.stopPropagation(); whyModal(el.dataset.id); },
    setWhy(el) { const s = getSess(true); s[el.dataset.id] = el.dataset.r ? {p: false, r: el.dataset.r} : {p: false}; save(); closeModal(); render(true); },
    setWhyTxt(el) { const t = $('#whyTxt').value.trim(), s = getSess(true); s[el.dataset.id] = t ? {p: false, r: t} : {p: false}; save(); closeModal(); render(true); },
    allIn() { const s = getSess(true); cls(A.classId).students.forEach(st => s[st.id] = {p: true}); save(); render(true); toast('Toți elevii marcați prezenți'); },
    delSess() { ask('Ștergi prezența înregistrată la această oră?', () => { delete S.sessions[A.classId][sessKey()]; save(); render(true); }, 'Șterge ora'); },
    hist: histModal,
    openSess(el) { const [d, s] = el.dataset.k.split('|'); Object.assign(A, {date: d, slot: s, info: null}); closeModal(); render(); },
    demo() {
      const c = {id: uid(), name: 'Clasa exemplu', students: ['Avram Ioana|F', 'Barbu Andrei|B', 'Constantin Maria|F', 'Dinu Alexandru|B', 'Enache Elena|F', 'Florea Mihai|B', 'Georgescu Ana|F', 'Ilie Radu|B']
        .map(x => { const [name, gender] = x.split('|'); return {id: uid(), name, gender}; })};
      S.classes.push(c); Object.assign(A, {classId: c.id, slot: slotsFor(c.id, A.date)[0]});
      S.ui.tab = 'att'; save(); render(); toast('Am adăugat o clasă exemplu – o poți șterge din tabul Clase');
    },
  },
  changes: {
    attClass(el) { Object.assign(A, {classId: el.value, info: null, slot: slotsFor(el.value, A.date)[0]}); S.ui.lastClass = el.value; save(); render(); },
    attDate(el) { if (!el.value) return; Object.assign(A, {date: el.value, info: null, slot: slotsFor(A.classId, el.value)[0]}); render(); },
    attSlot(el) { A.slot = el.value; render(); },
  },
};
