// Ecranul „Clase”: import din Excel/CSV/listă lipită, adăugare și editare clase și elevi.
import {S, save, cls, sortStudents, removeClass, LEVELS, activeClasses} from '../store.js';
import {esc, uid, nrm, fmtD, openModal, closeModal, ask, toast, $} from '../util.js';
import {recalcNorm, levelOf, detectLevel} from '../calc.js';
import {render, view, setHead, classOpts} from '../ui.js';
import {parseSheet, parseCSV, readClassFiles, saveBlob} from '../files.js';
import {MODES, buildPackage, packageName, archiveStudents, unarchive, readPackage, matchItems, applyPackage} from '../transfer.js';
import {A, initAtt} from './attendance.js';

let PENDING = [];   // clase detectate la import, înainte de confirmare
let impSchool = null;   // școala în care se importă

function renderClasses() {
  const arc = S.classes.filter(c => c.archived);
  setHead('Clase', `${activeClasses().length} clase`);
  view().innerHTML = `${S.schools.map(sc => { const cs = activeClasses().filter(c => c.schoolId === sc.id); return !cs.length ? '' : `
    ${S.schools.length > 1 ? `<h2 style="font:700 16px var(--f-display);margin:14px 4px 6px">${esc(sc.name || 'Școală fără nume')}</h2>` : ''}
    <div class="list" style="margin-bottom:10px">${cs.map(c => { const l = levelOf(c); return `<div class="st" data-act="clsEdit" data-id="${c.id}"><span class="nm"><b>${esc(c.name)}</b>${l != null ? `<small class="from">clasa ${LEVELS[l] === 'Pregătitoare' ? 'pregătitoare' : 'a ' + LEVELS[l] + '-a'}</small>` : ''}</span><span class="muted small">${c.students.length} elevi</span></div>`; }).join('')}</div>`; }).join('')}
  <div class="card" style="margin-top:14px"><h2>Import</h2>
    <div class="small muted" style="margin-bottom:10px">Din Excel (.xlsx/.xls) sau CSV – fiecare foaie devine o clasă, sau se grupează după coloana „Clasa”. Coloanele „Nume”, „Prenume”, „Sex” sunt recunoscute automat. Din aplicația de catalog: exportă lista în Excel/CSV sau copiaz-o și folosește „Lipește listă”.</div>
    <div class="row2"><button class="btn pri" data-act="impFile">Importă fișier Excel / CSV</button><button class="btn" data-act="impPaste">Lipește listă</button><button class="btn" data-act="clsNew">+ Clasă nouă</button></div></div>
  <div class="card"><h2>Elevi de la alt profesor</h2>
    <div class="small muted" style="margin-bottom:10px">Deschide fișierul primit de la colegul care ți-a predat elevii (din Catalog Sport → Clase → clasa → „Predă elevi”).</div>
    <button class="btn pri" data-act="rcvFile">Primește elevi</button></div>
  ${arc.length ? `<div class="card"><h2>Arhivă</h2><div class="small muted" style="margin-bottom:8px">Clasele încheiate și elevii predați. Nu apar pe Home.</div>
    <div class="list">${arc.map(c => `<div class="st" data-act="arcOpen" data-id="${c.id}"><span class="nm"><b>${esc(c.name)}</b><small class="from">${esc(c.archived)}</small></span><span class="muted small">${c.students.length === 1 ? '1 elev' : c.students.length + ' elevi'}</span></div>`).join('')}</div></div>` : ''}`;
}

/* ---- predarea elevilor către alt profesor ---- */
let HO = {cid: null, sids: [], mode: 'curs'};
function handModal(cid) {
  const c = cls(cid);
  if (HO.cid !== cid) { const m = new Date().getMonth(); HO = {cid, sids: [], mode: m >= 5 && m <= 7 ? 'an' : 'curs'}; }
  const all = c.students.length && HO.sids.length === c.students.length;
  openModal(`<div class="sheet-top"><h3 class="grow">Predă elevi – ${esc(c.name)}</h3><button class="btn" data-act="${c.archived ? 'arcOpen' : 'hoBack'}" data-id="${c.id}">Înapoi</button></div>
    <div class="small muted">Se creează un fișier pe care îl trimiți colegului (WhatsApp, e-mail). El îl deschide în Catalog Sport → Clase → „Primește elevi”.</div>
    <div style="margin:10px 0 4px"><b>Ce trimiți</b></div>
    ${Object.entries(MODES).map(([k, t]) => `<label class="item" style="cursor:pointer"><input type="radio" name="hoMode" style="width:20px;height:20px" data-ch="hoMode" value="${k}" ${HO.mode === k ? 'checked' : ''}><span class="grow">${esc(t)}</span></label>`).join('')}
    <div class="row2" style="margin:12px 0 4px"><b class="grow">Elevii (${HO.sids.length} aleși)</b><button class="btn sm" data-act="hoAll" data-id="${c.id}">${all ? 'Niciunul' : 'Toată clasa'}</button></div>
    <div>${c.students.map(s => `<label class="item" style="cursor:pointer"><input type="checkbox" style="width:22px;height:22px" data-ch="hoSt" data-id="${c.id}" data-s="${s.id}" ${HO.sids.includes(s.id) ? 'checked' : ''}><span class="grow">${esc(s.name)}</span></label>`).join('') || '<div class="muted">Clasa nu are elevi.</div>'}</div>
    ${c.archived ? '' : `<div class="small muted" style="margin-top:8px">După trimitere, ${all ? 'clasa trece' : 'elevii trec'} în arhiva ta (Clase → Arhivă), cu tot cu datele lor. Nu se șterge nimic.</div>`}
    <div class="row2" style="margin-top:12px"><button class="btn pri" data-act="hoGo" data-id="${c.id}" data-m="share" ${HO.sids.length ? '' : 'disabled'}>Trimite</button><button class="btn" data-act="hoGo" data-id="${c.id}" data-m="save" ${HO.sids.length ? '' : 'disabled'}>Descarcă fișierul</button></div>`);
}
async function handOver(c, how) {
  const sids = c.students.filter(s => HO.sids.includes(s.id)).map(s => s.id), name = packageName(c, sids);
  const blob = new Blob([JSON.stringify(buildPackage(c, sids, HO.mode))], {type: 'text/plain'}), file = new File([blob], name, {type: 'text/plain'});
  if (how === 'share' && navigator.canShare && navigator.canShare({files: [file]})) {
    try { await navigator.share({files: [file], title: name.replace('.txt', '')}); }
    catch (e) { if (e.name === 'AbortError') return; saveBlob(blob, name); }
  } else { saveBlob(blob, name); toast('Fișierul e în Descărcări'); }
  HO.cid = null;
  if (c.archived) { closeModal(); return; }
  const whole = sids.length === c.students.length;
  archiveStudents(c, sids); save(); closeModal(); render();
  toast(whole ? `Clasa ${c.name} a trecut în arhivă` : `${sids.length === 1 ? 'Elevul a trecut' : 'Elevii au trecut'} în arhivă (Clase → Arhivă)`);
}
function arcModal(cid) {
  const c = cls(cid);
  openModal(`<div class="sheet-top"><h3 class="grow">${esc(c.name)}</h3><button class="btn" data-act="close">Închide</button></div>
    <div class="small muted">În arhivă din anul școlar ${esc(c.archived)}. Datele (testări, note, prezență) sunt păstrate.</div>
    <div style="margin-top:8px">${c.students.map((s, i) => `<div class="item"><span class="nr">${i + 1}</span><span class="grow">${esc(s.name)}${s.from && s.from !== c.name ? ` <small class="muted">(${esc(s.from)})</small>` : ''}</span></div>`).join('') || '<div class="muted">Nu are elevi.</div>'}</div>
    <div class="row2" style="margin-top:12px"><button class="btn pri" data-act="hoOpen" data-id="${c.id}">Predă elevi</button><button class="btn" data-act="arcBack" data-id="${c.id}">Scoate din arhivă</button></div>`);
}

/* ---- primirea elevilor de la alt profesor ---- */
let RC = null;   // {pkg, pick: [indici], classId, newName, add: {cheie: bool}}
export async function onReceiveFile(f) {
  const pkg = readPackage(await f.text());
  if (!pkg) { toast('Fișierul nu este o predare de elevi din Catalog Sport.'); return; }
  const names = [...new Set(pkg.students.map(e => e.cls))];
  const same = activeClasses().find(c => names.length === 1 && nrm(c.name) === nrm(names[0]));
  RC = {pkg, pick: pkg.students.map((e, i) => i), classId: same ? same.id : '', newName: names.length === 1 ? names[0] : 'Clasă nouă',
    add: Object.fromEntries(matchItems(pkg).filter(x => !x.local).map(x => [x.it.key, true]))};
  rcvModal();
}
function rcvModal() {
  const p = RC.pkg, miss = matchItems(p).filter(x => !x.local);
  const from = [p.teacher, p.school].filter(Boolean).join(', ');
  openModal(`<div class="sheet-top"><h3 class="grow">Primește elevi</h3><button class="btn" data-act="close">Renunță</button></div>
    <div class="small muted">${from ? 'De la ' + esc(from) + ' · ' : ''}${esc(fmtD(p.date))} · ${esc(MODES[p.mode] || '')}</div>
    <div style="margin:10px 0 4px"><b>Elevii (${RC.pick.length} din ${p.students.length})</b></div>
    <div>${p.students.map((e, i) => `<label class="item" style="cursor:pointer"><input type="checkbox" style="width:22px;height:22px" data-ch="rcSt" data-i="${i}" ${RC.pick.includes(i) ? 'checked' : ''}><span class="grow">${esc(e.name)} <small class="muted">(${esc(e.cls)})</small></span></label>`).join('')}</div>
    <label class="f" style="margin-top:10px">În ce clasă îi pui<select data-ch="rcCls"><option value="">+ Clasă nouă</option>${classOpts(RC.classId)}</select></label>
    ${RC.classId ? '' : `<label class="f" style="margin-top:8px">Numele clasei noi<input type="text" data-ch="rcName" value="${esc(RC.newName)}"></label>`}
    <div class="small muted" style="margin-top:6px">Dacă un elev cu același nume e deja în clasă, datele lui se completează.</div>
    ${miss.length ? `<div style="margin:12px 0 4px"><b>Probe pe care nu le ai</b></div><div class="small muted">Bifează-le pe cele pe care le adaugi (cu baremul colegului). Rezultatele la probele nebifate nu se preiau.</div>
      ${miss.map(x => `<label class="item" style="cursor:pointer"><input type="checkbox" style="width:22px;height:22px" data-ch="rcAdd" data-k="${esc(x.it.key)}" ${RC.add[x.it.key] ? 'checked' : ''}><span class="grow">${esc(x.it.name)} <small class="muted">(${esc(x.it.key[0] === 'm' ? 'măsurătoare' : 'probă')}, ${esc(x.it.unit || '')})</small></span></label>`).join('')}` : ''}
    <div class="row2" style="margin-top:12px"><button class="btn pri" data-act="rcGo" ${RC.pick.length ? '' : 'disabled'}>Primește</button></div>`);
  if (!RC.classId) { const sel = $('[data-ch="rcCls"]'); if (sel) sel.value = ''; }
}

const levelOpts = c => `<option value="">Automat${detectLevel(c.name) != null ? ' (' + LEVELS[detectLevel(c.name)] + ')' : ''}</option>${LEVELS.map((t, i) => `<option value="${i}" ${c.level != null && c.level !== '' && +c.level === i ? 'selected' : ''}>${t}</option>`).join('')}`;
// câmpul „clasa de proveniență” apare doar la grupe (elevi din mai multe clase)
const isGroup = c => !!c.group || c.students.some(s => s.from);
function clsModal(id) {
  const c = cls(id), grp = isGroup(c);
  const tTags = st => { const ts = S.teams.filter(t => t.members.includes(st.id)); return ts.length ? `<small class="from" style="color:var(--accent)">${esc(ts.map(t => t.name).join(', '))}</small>` : ''; };
  openModal(`<div class="sheet-top"><h3 class="grow">Clasa</h3><button class="btn pri" data-act="clsSave" data-id="${c.id}">Gata</button></div>
    <label class="f">Denumire<input type="text" id="cName" value="${esc(c.name)}"></label>
    <div class="row2" style="margin-top:8px">
      ${S.schools.length > 1 ? `<label class="f">Școala<select data-ch="cSchool" data-id="${c.id}">${S.schools.map(s => `<option value="${s.id}" ${s.id === c.schoolId ? 'selected' : ''}>${esc(s.name || 'Școală fără nume')}</option>`).join('')}</select></label>` : ''}
      <label class="f">Nivel de studiu (pentru bareme)<select data-ch="cLevel" data-id="${c.id}">${levelOpts(c)}</select></label>
    </div>
    <label class="row2 small" style="margin-top:8px"><input type="checkbox" style="width:20px;height:20px" data-ch="cGroup" data-id="${c.id}" ${grp ? 'checked' : ''}>
      <span class="grow">Grupă cu elevi din mai multe clase (la fiecare elev se trece clasa lui)</span></label>
    <div class="row2" style="margin:12px 0 4px"><b class="grow">Elevi (${c.students.length})</b><button class="btn sm" data-act="ctOpen" data-id="${c.id}">Echipele școlii</button><button class="btn sm" data-act="hoOpen" data-id="${c.id}">Predă elevi</button><button class="btn sm" data-act="stSort" data-id="${c.id}">Sortează A–Z</button></div>
    <div>${c.students.map((st, i) => `<div class="item"><span class="nr">${i + 1}</span>
      <span class="grow" style="min-width:0"><input type="text" value="${esc(st.name)}" data-ch="stName" data-c="${c.id}" data-id="${st.id}">${tTags(st)}</span>
      ${grp ? `<input type="text" style="width:74px" value="${esc(st.from || '')}" placeholder="clasa" title="Clasa elevului" data-ch="stFrom" data-c="${c.id}" data-id="${st.id}">` : ''}
      <select style="width:72px" data-ch="stG" data-c="${c.id}" data-id="${st.id}"><option value="">–</option><option ${st.gender === 'B' ? 'selected' : ''}>B</option><option ${st.gender === 'F' ? 'selected' : ''}>F</option></select>
      <button class="btn sm bad" data-act="stDel" data-c="${c.id}" data-id="${st.id}" aria-label="Șterge elevul">✕</button></div>`).join('')}</div>
    <div class="row2" style="margin-top:8px"><input type="text" class="grow" id="newSt" placeholder="Nume elev nou"><select id="newG" style="width:72px"><option value="">–</option><option>B</option><option>F</option></select><button class="btn sm" data-act="stAdd" data-id="${c.id}">Adaugă</button></div>
    <div class="row2" style="margin-top:16px"><button class="btn bad" data-act="clsDel" data-id="${c.id}">Șterge clasa</button></div>`);
}
const keepName = c => { const v = $('#cName')?.value.trim(); if (v) c.name = v; };

// echipele școlii pentru elevii clasei: alegi echipa, bifezi elevii
let CT = {teamId: null};
function teamsModal(cid) {
  const c = cls(cid);
  if (!S.teams.some(t => t.id === CT.teamId)) CT.teamId = S.teams[0]?.id;
  const t = S.teams.find(x => x.id === CT.teamId);
  openModal(`<div class="sheet-top"><h3 class="grow">Echipele școlii – ${esc(c.name)}</h3><button class="btn pri" data-act="ctBack" data-id="${c.id}">Gata</button></div>
    ${t ? `<div class="small muted">Alege echipa, apoi bifează elevii clasei care fac parte din ea.</div>
    <div class="chips">${S.teams.map(x => { const n = c.students.filter(s => x.members.includes(s.id)).length; return `<button class="chip ${x.id === t.id ? 'on' : ''}" data-act="ctTeam" data-id="${c.id}" data-t="${x.id}">${esc(x.name)}${n ? ` (${n})` : ''}</button>`; }).join('')}</div>
    <div>${c.students.map(s => `<label class="item" style="cursor:pointer"><input type="checkbox" style="width:22px;height:22px" data-ch="ctMember" data-id="${c.id}" data-s="${s.id}" ${t.members.includes(s.id) ? 'checked' : ''}><span class="grow">${esc(s.name)}</span></label>`).join('') || '<div class="muted">Clasa nu are elevi.</div>'}</div>
    <div class="small muted" style="margin-top:8px">Modulele cu competiții (nota 10 automat) și echipele noi se stabilesc în Setări → Echipele școlii.</div>`
    : '<div class="muted">Nu ai nicio echipă. Adaug-o din Setări → Echipele școlii.</div>'}`);
}

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
    ctOpen(el) { keepName(cls(el.dataset.id)); save(); teamsModal(el.dataset.id); },
    ctTeam(el) { CT.teamId = el.dataset.t; teamsModal(el.dataset.id); },
    ctBack(el) { clsModal(el.dataset.id); },
    hoOpen(el) { const c = cls(el.dataset.id); if (!c.archived) { keepName(c); save(); } handModal(c.id); },
    hoBack(el) { clsModal(el.dataset.id); },
    hoAll(el) { const c = cls(el.dataset.id); HO.sids = HO.sids.length === c.students.length ? [] : c.students.map(s => s.id); handModal(c.id); },
    hoGo(el) { handOver(cls(el.dataset.id), el.dataset.m); },
    arcOpen(el) { arcModal(el.dataset.id); },
    arcBack(el) { const c = cls(el.dataset.id); ask(`Scoți ${c.name} din arhivă? Apare din nou pe Home.`, () => { unarchive(c); save(); render(); }, 'Scoate din arhivă'); },
    rcvFile() { $('#fileElevi').value = ''; $('#fileElevi').click(); },
    rcGo() {
      const r = applyPackage(RC.pkg, {classId: RC.classId, newName: RC.newName.trim(), add: RC.add, pick: RC.pick});
      S.classes.sort((a, b) => a.name.localeCompare(b.name, 'ro', {numeric: true}));
      RC = null; save(); closeModal(); if (!A.classId) initAtt(); render();
      toast(`${r.c.name}: ${r.added} elevi noi${r.merged ? `, ${r.merged} completați` : ''}.`);
    },
  },
  changes: {
    hoMode(el) { HO.mode = el.value; },
    hoSt(el) { HO.sids = el.checked ? [...new Set([...HO.sids, el.dataset.s])] : HO.sids.filter(s => s !== el.dataset.s); handModal(el.dataset.id); },
    rcSt(el) { const i = +el.dataset.i; RC.pick = el.checked ? [...new Set([...RC.pick, i])].sort((a, b) => a - b) : RC.pick.filter(x => x !== i); rcvModal(); },
    rcCls(el) { RC.classId = el.value; rcvModal(); },
    rcName(el) { RC.newName = el.value; },
    rcAdd(el) { RC.add[el.dataset.k] = el.checked; },
    ctMember(el) {
      const t = S.teams.find(x => x.id === CT.teamId), sid = el.dataset.s;
      t.members = el.checked ? [...new Set([...t.members, sid])] : t.members.filter(m => m !== sid);
      save(); teamsModal(el.dataset.id);
    },
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
