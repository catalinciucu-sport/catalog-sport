// Ecranul „Clase”: import din Excel/CSV/listă lipită, adăugare și editare clase și elevi.
import {S, save, cls, sortStudents, removeClass, LEVELS} from '../store.js';
import {esc, uid, nrm, openModal, closeModal, ask, toast, $} from '../util.js';
import {recalcNorm, levelOf, detectLevel} from '../calc.js';
import {render, view, setHead} from '../ui.js';
import {parseSheet, parseCSV, readClassFiles} from '../files.js';
import {A, initAtt} from './attendance.js';

let PENDING = [];   // clase detectate la import, înainte de confirmare
let impSchool = null;   // școala în care se importă

function renderClasses() {
  setHead('Clase', `${S.classes.length} clase`);
  view().innerHTML = `<div class="card"><h2>Import</h2>
    <div class="small muted" style="margin-bottom:10px">Din Excel (.xlsx/.xls) sau CSV – fiecare foaie devine o clasă, sau se grupează după coloana „Clasa”. Coloanele „Nume”, „Prenume”, „Sex” sunt recunoscute automat. Din aplicația de catalog: exportă lista în Excel/CSV sau copiaz-o și folosește „Lipește listă”.</div>
    <div class="row2"><button class="btn pri" data-act="impFile">Importă fișier Excel / CSV</button><button class="btn" data-act="impPaste">Lipește listă</button><button class="btn" data-act="clsNew">+ Clasă nouă</button></div></div>
  ${S.schools.map(sc => { const cs = S.classes.filter(c => c.schoolId === sc.id); return !cs.length ? '' : `
    ${S.schools.length > 1 ? `<h2 style="font:700 16px var(--f-display);margin:14px 4px 6px">${esc(sc.name || 'Școală fără nume')}</h2>` : ''}
    <div class="list" style="margin-bottom:10px">${cs.map(c => { const l = levelOf(c); return `<div class="st" data-act="clsEdit" data-id="${c.id}"><span class="nm"><b>${esc(c.name)}</b>${l != null ? `<small class="from">clasa ${LEVELS[l] === 'Pregătitoare' ? 'pregătitoare' : 'a ' + LEVELS[l] + '-a'}</small>` : ''}</span><span class="muted small">${c.students.length} elevi</span></div>`; }).join('')}</div>`; }).join('')}`;
}

const levelOpts = c => `<option value="">Automat${detectLevel(c.name) != null ? ' (' + LEVELS[detectLevel(c.name)] + ')' : ''}</option>${LEVELS.map((t, i) => `<option value="${i}" ${c.level != null && c.level !== '' && +c.level === i ? 'selected' : ''}>${t}</option>`).join('')}`;
// câmpul „clasa de proveniență” apare doar la grupe (elevi din mai multe clase)
const isGroup = c => !!c.group || c.students.some(s => s.from);
function clsModal(id) {
  const c = cls(id), grp = isGroup(c);
  openModal(`<h3>Clasa</h3>
    <label class="f">Denumire<input type="text" id="cName" value="${esc(c.name)}"></label>
    <div class="row2" style="margin-top:8px">
      ${S.schools.length > 1 ? `<label class="f">Școala<select data-ch="cSchool" data-id="${c.id}">${S.schools.map(s => `<option value="${s.id}" ${s.id === c.schoolId ? 'selected' : ''}>${esc(s.name || 'Școală fără nume')}</option>`).join('')}</select></label>` : ''}
      <label class="f">Nivel de studiu (pentru bareme)<select data-ch="cLevel" data-id="${c.id}">${levelOpts(c)}</select></label>
    </div>
    <label class="row2 small" style="margin-top:8px"><input type="checkbox" style="width:20px;height:20px" data-ch="cGroup" data-id="${c.id}" ${grp ? 'checked' : ''}>
      <span class="grow">Grupă cu elevi din mai multe clase (la fiecare elev se trece clasa lui)</span></label>
    <div class="row2" style="margin:12px 0 4px"><b class="grow">Elevi (${c.students.length})</b><button class="btn sm" data-act="stSort" data-id="${c.id}">Sortează A–Z</button></div>
    <div>${c.students.map((st, i) => `<div class="item"><span class="nr">${i + 1}</span>
      <input type="text" class="grow" value="${esc(st.name)}" data-ch="stName" data-c="${c.id}" data-id="${st.id}">
      ${grp ? `<input type="text" style="width:74px" value="${esc(st.from || '')}" placeholder="clasa" title="Clasa elevului" data-ch="stFrom" data-c="${c.id}" data-id="${st.id}">` : ''}
      <select style="width:72px" data-ch="stG" data-c="${c.id}" data-id="${st.id}"><option value="">–</option><option ${st.gender === 'B' ? 'selected' : ''}>B</option><option ${st.gender === 'F' ? 'selected' : ''}>F</option></select>
      <button class="btn sm bad" data-act="stDel" data-c="${c.id}" data-id="${st.id}" aria-label="Șterge elevul">✕</button></div>`).join('')}</div>
    <div class="row2" style="margin-top:8px"><input type="text" class="grow" id="newSt" placeholder="Nume elev nou"><select id="newG" style="width:72px"><option value="">–</option><option>B</option><option>F</option></select><button class="btn sm" data-act="stAdd" data-id="${c.id}">Adaugă</button></div>
    <div class="row2" style="margin-top:16px"><button class="btn pri" data-act="clsSave" data-id="${c.id}">Gata</button><button class="btn bad" data-act="clsDel" data-id="${c.id}">Șterge clasa</button></div>`);
}
const keepName = c => { const v = $('#cName')?.value.trim(); if (v) c.name = v; };

function previewImport() {
  if (!PENDING.length) { toast('Nu am găsit elevi în fișier.'); return; }
  if (!S.schools.some(s => s.id === impSchool)) impSchool = S.schools[0].id;
  openModal(`<h3>Verifică importul</h3><div class="small muted" style="margin-bottom:8px">Poți redenumi clasele. Dacă o clasă cu același nume există deja, se adaugă doar elevii noi.</div>
    ${S.schools.length > 1 ? `<label class="f" style="margin-bottom:8px">Importă în școala<select data-ch="impSchool">${S.schools.map(s => `<option value="${s.id}" ${s.id === impSchool ? 'selected' : ''}>${esc(s.name || 'Școală fără nume')}</option>`).join('')}</select></label>` : ''}
    ${PENDING.map((p, i) => `<div class="item"><input type="checkbox" ${p.use ? 'checked' : ''} data-ch="pUse" data-i="${i}" style="width:22px;height:22px">
      <input type="text" class="grow" value="${esc(p.name)}" data-ch="pName" data-i="${i}">
      <span class="small muted">${p.students.length} elevi</span></div>
      <div class="small muted" style="margin:-4px 0 6px 32px">${esc(p.students.slice(0, 3).map(s => s.name).join(', '))}${p.students.length > 3 ? '…' : ''}</div>`).join('')}
    <div class="row2" style="margin-top:12px"><button class="btn pri" data-act="impDo">Importă</button><button class="btn right" data-act="close">Renunță</button></div>`);
}
function doImport() {
  let nc = 0, ns = 0;
  for (const p of PENDING.filter(p => p.use && p.name.trim())) {
    let c = S.classes.find(x => nrm(x.name) === nrm(p.name) && x.schoolId === impSchool);
    if (!c) { c = {id: uid(), name: p.name.trim(), schoolId: impSchool, students: []}; S.classes.push(c); nc++; }
    for (const s of p.students) {
      const ex = c.students.find(x => nrm(x.name) === nrm(s.name));
      if (ex) { if (!ex.gender && s.gender) ex.gender = s.gender; continue; }
      c.students.push({id: uid(), name: s.name, gender: s.gender, ...(s.from ? {from: s.from} : {})}); ns++;
    }
    sortStudents(c);
  }
  S.classes.sort((a, b) => a.name.localeCompare(b.name, 'ro', {numeric: true}));
  save(); closeModal(); if (!A.classId) initAtt(); render(); toast(`Importat: ${nc} clase noi, ${ns} elevi.`);
}

// fișierele alese în fereastra de import (inputul #fileImp din index.html)
export async function onImportFiles(files) { PENDING = await readClassFiles(files, toast); previewImport(); }

export default {
  key: 'classes', title: 'Clase', render: renderClasses,
  actions: {
    impFile() { $('#fileImp').value = ''; $('#fileImp').click(); },
    impPaste() {
      openModal(`<h3>Lipește lista de elevi</h3><label class="f">Clasa<input type="text" id="pCls" placeholder="ex: 9B"></label>
        <label class="f" style="margin-top:8px">Elevi (câte unul pe rând; merge și copiat direct din Excel sau din catalog)<textarea id="pTxt" placeholder="Popescu Andrei&#10;Ionescu Maria&#10;..."></textarea></label>
        <div class="row2" style="margin-top:12px"><button class="btn pri" data-act="pasteGo">Continuă</button><button class="btn right" data-act="close">Renunță</button></div>`);
    },
    pasteGo() {
      const name = $('#pCls').value.trim() || 'Clasă nouă', txt = $('#pTxt').value;
      PENDING = parseSheet(txt.includes('\t') || txt.includes(';') ? parseCSV(txt) : txt.split(/\r?\n/).map(l => [l]), name);
      previewImport();
    },
    impDo: doImport,
    clsNew() { const c = {id: uid(), name: 'Clasă nouă', schoolId: S.schools[0].id, students: []}; S.classes.push(c); save(); render(); clsModal(c.id); },
    clsEdit(el) { clsModal(el.dataset.id); },
    clsSave(el) { keepName(cls(el.dataset.id)); save(); closeModal(); render(); },
    clsDel(el) { const id = el.dataset.id; ask('Ștergi clasa cu tot cu prezențele, notele și testările ei?', () => { removeClass(id); save(); render(); }, 'Șterge clasa'); },
    stAdd(el) {
      const n = $('#newSt').value.trim(); if (!n) return;
      const c = cls(el.dataset.id); keepName(c);
      c.students.push({id: uid(), name: n, gender: $('#newG').value}); save(); clsModal(c.id);
      setTimeout(() => $('#newSt')?.focus(), 0);
    },
    stDel(el) {
      const c = cls(el.dataset.c), st = c.students.find(s => s.id === el.dataset.id); keepName(c);
      ask(`Ștergi elevul ${st.name}?`, () => {
        c.students = c.students.filter(s => s.id !== st.id);
        S.teams.forEach(t => t.members = t.members.filter(m => m !== st.id));
        save(); clsModal(c.id);
      }, 'Șterge elevul');
    },
    stSort(el) { const c = cls(el.dataset.id); keepName(c); sortStudents(c); save(); clsModal(c.id); },
  },
  changes: {
    stName(el) { const st = cls(el.dataset.c).students.find(s => s.id === el.dataset.id); if (el.value.trim()) st.name = el.value.trim(); save(); },
    cGroup(el) {
      const c = cls(el.dataset.id); keepName(c);
      if (el.checked) { c.group = true; save(); clsModal(c.id); return; }
      if (!c.students.some(s => s.from)) { delete c.group; save(); clsModal(c.id); return; }
      ask('Ștergi clasa trecută la fiecare elev? Elevii rămân în grupă.', () => { delete c.group; c.students.forEach(s => delete s.from); save(); clsModal(c.id); }, 'Șterge clasele');
      el.checked = true;
    },
    cSchool(el) { cls(el.dataset.id).schoolId = el.value; save(); },
    cLevel(el) { const c = cls(el.dataset.id); if (el.value === '') delete c.level; else c.level = +el.value; S.norms.forEach(n => recalcNorm(n.id)); save(); },
    impSchool(el) { impSchool = el.value; },
    stFrom(el) { const st = cls(el.dataset.c).students.find(s => s.id === el.dataset.id), v = el.value.trim(); if (v) st.from = v; else delete st.from; save(); },
    stG(el) { cls(el.dataset.c).students.find(s => s.id === el.dataset.id).gender = el.value; S.norms.forEach(n => recalcNorm(n.id)); save(); },
    pUse(el) { PENDING[+el.dataset.i].use = el.checked; },
    pName(el) { PENDING[+el.dataset.i].name = el.value; },
  },
};
