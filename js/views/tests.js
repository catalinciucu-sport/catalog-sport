// Ecranul „Testări”: fiecare probă / măsurătoare se testează de câte ori vrei, fiecare testare cu data ei.
// De aici se deschid și fișele de evoluție ale elevilor.
import {S, save, cls, path} from '../store.js';
import {esc, uid, iso, fmtD, num, fmtN, ask, $} from '../util.js';
import {testItems, testsOf, progress} from '../calc.js';
import {render, view, setHead, classOpts, noClasses} from '../ui.js';
import {linked} from '../sync.js';
import {openReport, sharePdf} from '../report.js';
import {A} from './attendance.js';

const T = {classId: null, itemId: null, testId: null, studentId: null};
const itemOf = () => testItems().find(i => i.id === T.itemId);
const list = () => testsOf(T.classId, T.itemId);
const testOf = () => list().find(t => t.id === T.testId);

// diferența față de testarea anterioară a aceluiași elev
function deltaHTML(sid) {
  const t = testOf(), item = itemOf(); if (!t || t.v[sid] == null) return '';
  const prev = list().filter(x => x.date < t.date && x.v[sid] != null).pop();
  const p = prev && progress(item.better, prev.v[sid], t.v[sid]);
  return p ? `<span class="${p.cls === 'neu' ? 'muted' : p.cls}" title="față de ${fmtD(prev.date)}">${p.d > 0 ? '+' : ''}${fmtN(p.d)}</span>` : '';
}

function renderTests() {
  setHead('Testări');
  if (!S.classes.length) { view().innerHTML = noClasses(linked()); return; }
  if (!cls(T.classId)) T.classId = cls(A.classId) ? A.classId : S.classes[0].id;
  const items = testItems();
  if (!itemOf()) T.itemId = items[0]?.id;
  const c = cls(T.classId), item = itemOf(), tests = list();
  if (!testOf()) T.testId = tests[tests.length - 1]?.id || null;
  const t = testOf();
  if (!c.students.some(s => s.id === T.studentId)) T.studentId = c.students[0]?.id;
  setHead('Testări', c.name + (t ? ' · ' + fmtD(t.date) : ''));
  const group = (kind, label) => `<optgroup label="${label}">${items.filter(i => i.kind === kind).map(i => `<option value="${i.id}" ${i.id === T.itemId ? 'selected' : ''}>${esc(i.name)}</option>`).join('')}</optgroup>`;
  const rows = t ? c.students.map((st, i) => `<div class="st static"><span class="nr">${i + 1}</span><span class="nm">${esc(st.name)}</span>
      <input type="text" class="val" inputmode="decimal" value="${t.v[st.id] == null ? '' : fmtN(t.v[st.id])}" placeholder="${esc(item.unit)}" data-ch="tVal" data-id="${st.id}">
      <span class="delta" id="td_${st.id}">${deltaHTML(st.id)}</span></div>`).join('') : '';
  view().innerHTML = `<div class="card">
    <div class="row2">
      <label class="f">Clasa<select data-ch="tClass">${classOpts(c.id)}</select></label>
      <label class="f">Ce măsori<select data-ch="tItem">${group('m', 'Măsurători antropometrice')}${group('n', 'Probe de control')}</select></label>
    </div>
    ${item ? `<div class="row2" style="margin-top:8px;align-items:flex-end">
      ${tests.length ? `<label class="f">Testarea<select data-ch="tTest">${[...tests].reverse().map(x => `<option value="${x.id}" ${x.id === T.testId ? 'selected' : ''}>${fmtD(x.date)}</option>`).join('')}</select></label>
        <label class="f">Data testării<input type="date" value="${t.date}" data-ch="tDate"></label>` : ''}
      <button class="btn ${tests.length ? '' : 'pri'}" data-act="tNew">+ Testare nouă</button>
      ${t ? '<button class="btn bad" data-act="tDel" aria-label="Șterge testarea">Șterge</button>' : ''}
    </div>
    <div class="small muted" style="margin-top:8px">${t ? `Valori în ${esc(item.unit)}. În dreapta: diferența față de testarea anterioară (verde = progres, roșu = regres). Testările nu influențează notele din module.` : 'Nicio testare la această probă. Apasă „+ Testare nouă”.'}</div>`
    : '<div class="small muted" style="margin-top:8px">Adaugă măsurători în Setări sau norme în tabul Norme.</div>'}
  </div>
  ${rows ? `<div class="list">${rows}</div>` : ''}
  <div class="card" style="margin-top:12px"><h2>Fișe de evoluție</h2>
    <div class="small muted" style="margin-bottom:8px">Fișa arată toate testările elevului, în ordinea datei, cu grafice și observațiile tale. O poți trimite ca PDF (WhatsApp, e-mail) sau salva.</div>
    <div class="row2">
      <select class="grow" style="min-width:160px" data-ch="tStudent">${c.students.map(s => `<option value="${s.id}" ${s.id === T.studentId ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select>
      <button class="btn pri" data-act="repOne">Vezi fișa</button>
      <button class="btn" data-act="repAll">PDF cu toată clasa</button>
    </div></div>`;
}

export default {
  key: 'tests', title: 'Testări', render: renderTests,
  actions: {
    tNew() {
      const t = {id: uid(), date: iso(new Date()), v: {}};
      (path('tests', T.classId)[T.itemId] = S.tests[T.classId][T.itemId] || []).push(t);
      T.testId = t.id; save(); render(true);
    },
    tDel() {
      const t = testOf();
      ask(`Ștergi testarea din ${fmtD(t.date)} (${itemOf().name})?`, () => {
        S.tests[T.classId][T.itemId] = S.tests[T.classId][T.itemId].filter(x => x.id !== t.id);
        T.testId = null; save(); render(true);
      }, 'Șterge testarea');
    },
    repOne() { const c = cls(T.classId), st = c.students.find(s => s.id === T.studentId); if (st) openReport(c, st); },
    repAll(el) { const c = cls(T.classId); if (c.students.length) sharePdf(c, c.students, el); },
  },
  changes: {
    tClass(el) { T.classId = el.value; T.testId = null; render(); },
    tItem(el) { T.itemId = el.value; T.testId = null; render(true); },
    tTest(el) { T.testId = el.value; render(true); },
    tDate(el) { if (!el.value) return; testOf().date = el.value; save(); render(true); },
    tStudent(el) { T.studentId = el.value; },
    tVal(el) {
      const v = num(el.value), t = testOf();
      if (v == null) delete t.v[el.dataset.id]; else t.v[el.dataset.id] = v;
      if (el.value.trim() && v == null) el.value = '';
      save(); $('#td_' + el.dataset.id).innerHTML = deltaHTML(el.dataset.id);
    },
  },
};
