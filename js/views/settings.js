// Ecranul „Setări”: Google Sheets, școala, orar, module, măsurători, scala notei pe prezență, motive, copie de siguranță.
import {S, save, setState, defaults, normalize} from '../store.js';
import {esc, uid, iso, toMin, DAYS, ask, toast, openModal, closeModal, $} from '../util.js';
import {AUTO_RULES} from '../calc.js';
import {render, view, setHead, classOpts} from '../ui.js';
import {linked, link, unlink, connect, setupLink, parseSetup, peerLinked, setPeer, unsetPeer, mergeWithPeer} from '../sync.js';
import {saveBlob} from '../files.js';
import {initAtt} from './attendance.js';

const row = (inner) => `<div class="item" style="flex-wrap:wrap">${inner}</div>`;
const del = (act, attr) => `<button class="btn sm bad" data-act="${act}" ${attr} aria-label="Șterge">✕</button>`;

function renderSet() {
  setHead('Setări');
  const sch = [...S.schedule].sort((a, b) => a.day - b.day || toMin(a.start) - toMin(b.start));
  view().innerHTML = `
  <div class="card"><h2>Salvare în Google Sheets</h2>
    ${linked() ? `<div class="small" style="margin-bottom:8px">Conectat. Stare: <b>${esc($('#sync').textContent || '–')}</b></div>
      <div class="row2"><button class="btn pri" data-act="gSync">Sincronizează acum</button><button class="btn" data-act="gLink">Copiază linkul de conectare</button><button class="btn bad" data-act="gOff">Deconectează</button></div>
      <div class="small muted" style="margin-top:8px">Linkul de conectare conectează alt dispozitiv la același tabel, dintr-o singură atingere. Conține codul secret: trimite-l doar ție sau persoanei care folosește acest tabel.</div>`
    : `<div class="small muted" style="margin-bottom:8px">Lipește linkul de conectare primit, sau adresa aplicației web din Google Apps Script și codul secret. După conectare, datele apar la fel pe telefon și pe calculator.</div>
      <label class="f">Linkul de conectare sau adresa aplicației web (se termină în /exec)<input type="text" id="gUrl" placeholder="https://script.google.com/macros/s/…/exec" autocomplete="off"></label>
      <label class="f" style="margin-top:8px">Cod secret<input type="text" id="gTok" autocomplete="off" autocapitalize="off" spellcheck="false"></label>
      <button class="btn pri" style="margin-top:10px" data-act="gOn">Conectează</button>`}</div>

  ${linked() ? `<div class="card"><h2>Grupe comune cu un coleg</h2>
    ${peerLinked() ? `<div class="small muted" style="margin-bottom:8px">Grupele care sunt în ambele tabele se completează reciproc: ce a bifat colegul apare la tine și invers. Ștergerile nu se transmit.</div>
      <div class="row2"><button class="btn pri" data-act="peerMerge">Completează grupele acum</button><button class="btn bad" data-act="peerOff">Elimină colegul</button></div>`
    : `<div class="small muted" style="margin-bottom:8px">Dacă lucrezi cu aceleași grupe ca un coleg care are tabelul lui, lipește aici linkul lui de conectare. Linkul rămâne doar pe acest dispozitiv.</div>
      <label class="f">Linkul de conectare al colegului<input type="text" id="peerLink" autocomplete="off" placeholder="https://…#conectare=…"></label>
      <button class="btn" style="margin-top:10px" data-act="peerOn">Salvează</button>`}</div>` : ''}

  <div class="card"><h2>Școlile mele</h2><div class="small muted" style="margin-bottom:6px">Apar pe fișele elevilor și pe foaia pentru catalog. Dacă predai la mai multe școli, fiecare clasă se atribuie unei școli (în Clase).</div>
    ${S.schools.map(sc => row(`<input type="text" class="grow" style="min-width:180px" value="${esc(sc.name)}" placeholder="ex: Colegiul „…”" data-ch="schName" data-id="${sc.id}">
      <span class="small muted">${S.classes.filter(c => c.schoolId === sc.id).length} clase</span>${S.schools.length > 1 ? del('schoolDel', `data-id="${sc.id}"`) : ''}`)).join('')}
    <button class="btn sm" style="margin-top:8px" data-act="schoolAdd">+ Adaugă școală</button>
    <div class="row2" style="margin-top:12px">
      <label class="f">Profesor<input type="text" value="${esc(S.school.teacher)}" data-ch="school" data-f="teacher"></label>
      <label class="f">An școlar<input type="text" value="${esc(S.school.year)}" data-ch="school" data-f="year"></label>
    </div></div>

  <div class="card"><h2>Orar</h2><div class="small muted" style="margin-bottom:6px">La deschidere, aplicația afișează clasa cu care ai oră acum (sau următoarea oră din ziua respectivă).</div>
    ${sch.map(e => row(`
      <select style="width:auto" data-ch="sch" data-f="day" data-id="${e.id}">${[1, 2, 3, 4, 5, 6].map(d => `<option value="${d}" ${+e.day === d ? 'selected' : ''}>${DAYS[d]}</option>`).join('')}</select>
      <input type="time" style="width:auto" value="${e.start}" data-ch="sch" data-f="start" data-id="${e.id}">
      <input type="time" style="width:auto" value="${e.end}" data-ch="sch" data-f="end" data-id="${e.id}">
      <select class="grow" style="min-width:90px" data-ch="sch" data-f="classId" data-id="${e.id}"><option value="">– clasa –</option>${classOpts(e.classId)}</select>
      ${del('schDel', `data-id="${e.id}"`)}`)).join('') || '<div class="muted small">Nicio oră în orar.</div>'}
    <button class="btn sm" style="margin-top:8px" data-act="schAdd">+ Adaugă oră</button></div>

  <div class="card"><h2>Module</h2>
    ${S.modules.map(m => row(`<input type="text" class="grow" style="min-width:110px" value="${esc(m.name)}" data-ch="mod" data-f="name" data-id="${m.id}">
      <input type="date" style="width:auto" value="${m.start}" data-ch="mod" data-f="start" data-id="${m.id}"><input type="date" style="width:auto" value="${m.end}" data-ch="mod" data-f="end" data-id="${m.id}">
      ${del('modDel', `data-id="${m.id}"`)}`)).join('')}
    <div class="small muted" style="margin-top:6px">Datele implicite sunt orientative – verifică-le cu structura anului școlar.</div>
    <button class="btn sm" style="margin-top:8px" data-act="modAdd">+ Adaugă modul</button></div>

  <div class="card"><h2>Măsurători antropometrice</h2><div class="small muted" style="margin-bottom:6px">Apar în tabul Testări și pe fișa elevului. Din înălțime și greutate se calculează automat IMC.</div>
    ${S.measures.map(m => row(`<input type="text" class="grow" style="min-width:140px" value="${esc(m.name)}" data-ch="ms" data-f="name" data-id="${m.id}">
      <input type="text" style="width:80px" value="${esc(m.unit)}" data-ch="ms" data-f="unit" data-id="${m.id}" placeholder="unitate">
      <select style="width:auto" data-ch="ms" data-f="better" data-id="${m.id}">
        <option value="none" ${m.better === 'none' ? 'selected' : ''}>doar comparație</option>
        <option value="high" ${m.better === 'high' ? 'selected' : ''}>mai mare = progres</option>
        <option value="low" ${m.better === 'low' ? 'selected' : ''}>mai mic = progres</option></select>
      ${del('msDel', `data-id="${m.id}"`)}`)).join('')}
    <button class="btn sm" style="margin-top:8px" data-act="msAdd">+ Adaugă măsurătoare</button></div>

  <div class="card"><h2>Nota pe prezență</h2><div class="small muted" style="margin-bottom:6px">Procentul = ore prezent ÷ ore din modul (fără orele cu absențe motivate).</div>
    <div class="grid-t" style="grid-template-columns:1fr 1fr">${S.settings.scale.map((s, i) => `<label class="f">Minim % pentru nota ${s.g}<input type="number" value="${s.min}" data-ch="scale" data-i="${i}"></label><div></div>`).join('')}
    <label class="f">Sub prag se acordă nota<input type="number" min="1" max="10" value="${S.settings.minGrade}" data-ch="minGrade"></label></div>
    <label class="f" style="margin-top:12px">Nota automată, când elevul are și notă pe prezență, și note la norme
      <select data-ch="autoRule">${Object.entries(AUTO_RULES).map(([k, t]) => `<option value="${k}" ${S.settings.autoRule === k ? 'selected' : ''}>${t[0].toUpperCase() + t.slice(1)}</option>`).join('')}</select></label>
    <div class="small muted" style="margin-top:6px">Membrii echipei școlii primesc automat 10 în modulele cu competiții (vezi mai jos). În tabul Note poți alege alt criteriu pentru fiecare elev.</div></div>

  <div class="card"><h2>Echipele școlii</h2><div class="small muted" style="margin-bottom:6px">Elevii din echipă primesc automat nota 10 în modulele în care echipa are competiții.</div>
    ${S.teams.map(t => `<div class="item"><div class="grow"><b>${esc(t.name)}</b><div class="small muted">${t.members.length} elevi · competiții în ${t.modules.map(id => S.modules.find(m => m.id === id)?.name).filter(Boolean).join(', ') || 'niciun modul'}</div></div>
      <button class="btn sm" data-act="teamEdit" data-id="${t.id}">Editează</button></div>`).join('') || '<div class="muted small">Nicio echipă.</div>'}
    <button class="btn sm" style="margin-top:8px" data-act="teamNew">+ Echipă nouă</button></div>

  <div class="card"><h2>Barem generat din rezultate</h2><div class="small muted" style="margin-bottom:6px">Când generezi un barem din rezultatele elevilor (în fereastra unei norme), cei mai buni primesc nota 10 și așa mai departe, după procentele de aici. Totalul trebuie să fie 100%.</div>
    <div class="row2">${S.settings.curve.map((x, i) => `<label class="f" style="min-width:90px;flex:0 1 100px">Nota ${x.g}<input type="number" min="0" max="100" value="${x.p}" data-ch="curve" data-i="${i}"></label>`).join('')}</div>
    <div class="small" style="margin-top:6px" id="curveSum">Total: ${S.settings.curve.reduce((a, x) => a + +x.p, 0)}%</div></div>

  <div class="card"><h2>Motive de absență</h2><div class="small muted" style="margin-bottom:6px">Bifează „motivat” dacă ora nu trebuie să scadă procentul de prezență.</div>
    ${S.settings.reasons.map((r, i) => `<div class="item"><input type="text" class="grow" value="${esc(r.t)}" data-ch="rsn" data-i="${i}">
      <label class="small row2"><input type="checkbox" style="width:20px;height:20px" ${r.exc ? 'checked' : ''} data-ch="rsnExc" data-i="${i}">motivat</label>
      ${del('rsnDel', `data-i="${i}"`)}</div>`).join('')}
    <button class="btn sm" style="margin-top:8px" data-act="rsnAdd">+ Adaugă motiv</button></div>

  <div class="card"><h2>Copie de siguranță</h2><div class="small muted" style="margin-bottom:8px">Pe fiecare dispozitiv se păstrează o copie locală, iar după conectare datele se salvează și în tabelul tău Google. Copia de aici e o rezervă în plus și te ajută să muți datele din versiunea veche a aplicației.</div>
    <div class="row2"><button class="btn pri" data-act="bakExp">Salvează copie (.json)</button><button class="btn" data-act="bakImp">Restaurează din copie</button><button class="btn bad" data-act="wipe">Șterge toate datele</button></div></div>`;
}

// echipa: nume, modulele cu competiții, membrii aleși pe clase
let TM = {classId: null};
function teamModal(id) {
  const t = S.teams.find(x => x.id === id);
  if (!S.classes.some(c => c.id === TM.classId)) TM.classId = S.classes[0]?.id;
  const c = S.classes.find(x => x.id === TM.classId);
  const others = S.classes.flatMap(k => k.id === TM.classId ? [] : k.students.filter(s => t.members.includes(s.id)).map(s => `${s.name} (${k.name})`));
  openModal(`<h3>Echipa școlii</h3>
    <label class="f">Denumire<input type="text" id="tmName" value="${esc(t.name)}" placeholder="ex: Volei fete"></label>
    <div class="small muted" style="margin:12px 0 4px">Module cu competiții (nota 10 automat)</div>
    <div class="chips">${S.modules.map(m => `<label class="chip ${t.modules.includes(m.id) ? 'on' : ''}"><input type="checkbox" hidden data-ch="tmMod" data-id="${t.id}" data-m="${m.id}" ${t.modules.includes(m.id) ? 'checked' : ''}>${esc(m.name)}</label>`).join('')}</div>
    <div class="small muted" style="margin:4px 0">Membri (${t.members.length}) – alege clasa și bifează elevii</div>
    ${c ? `<select data-ch="tmClass" data-id="${t.id}">${classOpts(c.id)}</select>
      <div style="margin-top:6px">${c.students.map(s => `<label class="item" style="cursor:pointer"><input type="checkbox" style="width:22px;height:22px" data-ch="tmMember" data-id="${t.id}" data-s="${s.id}" ${t.members.includes(s.id) ? 'checked' : ''}><span class="grow">${esc(s.name)}</span></label>`).join('')}</div>` : '<div class="muted">Adaugă mai întâi clasele.</div>'}
    ${others.length ? `<div class="small muted" style="margin-top:8px">Din alte clase: ${esc(others.join(', '))}</div>` : ''}
    <div class="row2" style="margin-top:14px"><button class="btn pri" data-act="teamSave" data-id="${t.id}">Gata</button><button class="btn bad" data-act="teamDel" data-id="${t.id}">Șterge echipa</button></div>`);
}
const keepTeamName = t => { const v = $('#tmName')?.value.trim(); if (v) t.name = v; };

// copia de siguranță aleasă în fereastra de restaurare (inputul #fileBak din index.html)
export async function onBackupFile(f) {
  try {
    const d = JSON.parse(await f.text());
    if (!d.classes || !d.sessions) throw 0;
    ask('Înlocuiești datele actuale cu cele din copie?', () => { setState(Object.assign(normalize(d), {ui: S.ui})); save(); initAtt(); render(); toast('Date restaurate'); }, 'Restaurează');
  } catch (err) { toast('Fișierul nu este o copie validă.'); }
}

export default {
  key: 'set', title: 'Setări', render: renderSet,
  actions: {
    async gOn(el) {
      const pasted = parseSetup($('#gUrl').value);   // s-a lipit un link de conectare întreg
      const url = pasted ? pasted.url : $('#gUrl').value.trim(), token = pasted ? pasted.token : $('#gTok').value.trim();
      if (!/^https:\/\/script\.google\.com\/.+\/exec$/.test(url)) { toast('Adresa trebuie să înceapă cu https://script.google.com și să se termine în /exec'); return; }
      if (!token) { toast('Scrie codul secret'); return; }
      el.disabled = true; el.textContent = 'Se verifică…';
      try { await link(url, token); render(); toast('Conectat la Google Sheets'); }
      catch (err) {
        el.disabled = false; el.textContent = 'Conectează';
        toast(err.code === 'cod_gresit' ? 'Codul secret nu se potrivește cu cel din script.' : 'Nu am putut ajunge la script. Verifică adresa și că e implementat pentru „Oricine”.');
      }
    },
    gOff() { ask('Deconectezi acest dispozitiv de la Google? Datele din tabel rămân neatinse.', () => { unlink(); render(); }, 'Deconectează'); },
    async gSync() { await connect(); render(true); },
    peerOn() {
      try { setPeer($('#peerLink').value); render(true); toast('Linkul colegului a fost salvat'); }
      catch (e) { toast(e.code === 'same_table' ? 'Acesta e linkul tabelului tău, nu al colegului.' : 'Linkul nu e un link de conectare valid.'); }
    },
    peerOff() { ask('Elimini legătura cu tabelul colegului? Datele rămân neatinse în ambele tabele.', () => { unsetPeer(); render(true); }, 'Elimină'); },
    async peerMerge(el) {
      el.disabled = true; el.textContent = 'Se completează…';
      try {
        const names = await mergeWithPeer();
        toast(names.length ? `Completat: ${names.join(', ')}` : 'Nu am găsit grupe comune în cele două tabele.');
      } catch (e) { toast(e.code === 'cod_gresit' ? 'Linkul colegului nu mai e valabil.' : 'Nu am putut ajunge la tabelul colegului. Verifică internetul.'); }
      render(true);
    },
    async gLink() {
      const l = setupLink();
      try { await navigator.clipboard.writeText(l); toast('Linkul de conectare a fost copiat'); }
      catch (e) { openModal(`<h3>Linkul de conectare</h3><textarea readonly style="min-height:110px" onfocus="this.select()">${esc(l)}</textarea><div class="row2" style="margin-top:12px"><button class="btn right" data-act="close">Închide</button></div>`); }
    },
    schAdd() { S.schedule.push({id: uid(), day: Math.min(5, Math.max(1, new Date().getDay())), start: '08:00', end: '08:50', classId: S.classes[0]?.id || ''}); save(); render(true); },
    schDel(el) { S.schedule = S.schedule.filter(x => x.id !== el.dataset.id); save(); render(true); },
    modAdd() { S.modules.push({id: uid(), name: 'Modul nou', start: iso(new Date()), end: iso(new Date())}); save(); render(true); },
    modDel(el) { ask('Ștergi modulul? Prezențele rămân, dar notele la norme din acest modul nu mai apar.', () => { S.modules = S.modules.filter(m => m.id !== el.dataset.id); save(); render(true); }, 'Șterge modulul'); },
    msAdd() { S.measures.push({id: uid(), name: 'Măsurătoare nouă', unit: 'cm', better: 'none'}); save(); render(true); },
    msDel(el) { ask('Ștergi măsurătoarea? Valorile introduse la ea nu mai apar pe fișe.', () => { S.measures = S.measures.filter(m => m.id !== el.dataset.id); save(); render(true); }, 'Șterge'); },
    schoolAdd() { S.schools.push({id: uid(), name: ''}); save(); render(true); },
    schoolDel(el) {
      const sc = S.schools.find(s => s.id === el.dataset.id), n = S.classes.filter(c => c.schoolId === sc.id).length;
      ask(n ? `Ștergi școala? Cele ${n} clase ale ei trec la prima școală din listă.` : 'Ștergi școala din listă?', () => {
        S.schools = S.schools.filter(s => s !== sc);
        S.classes.forEach(c => { if (c.schoolId === sc.id) c.schoolId = S.schools[0].id; });
        save(); render(true);
      }, 'Șterge școala');
    },
    teamNew() { const t = {id: uid(), name: 'Echipă nouă', members: [], modules: []}; S.teams.push(t); save(); render(true); teamModal(t.id); },
    teamEdit(el) { teamModal(el.dataset.id); },
    teamSave(el) { keepTeamName(S.teams.find(x => x.id === el.dataset.id)); save(); closeModal(); render(true); },
    teamDel(el) { const t = S.teams.find(x => x.id === el.dataset.id); ask(`Ștergi echipa ${t.name}?`, () => { S.teams = S.teams.filter(x => x !== t); save(); render(true); }, 'Șterge echipa'); },
    rsnAdd() { S.settings.reasons.push({t: 'Motiv nou', exc: false}); save(); render(true); },
    rsnDel(el) { S.settings.reasons.splice(+el.dataset.i, 1); save(); render(true); },
    bakExp() { saveBlob(new Blob([JSON.stringify(S, null, 1)], {type: 'application/json'}), `catalog-sport-copie-${iso(new Date())}.json`); },
    bakImp() { $('#fileBak').value = ''; $('#fileBak').click(); },
    wipe() {
      ask('Ștergi TOATE datele (clase, prezențe, note, testări)? Fă înainte o copie de siguranță.', () =>
        ask('Ești sigur? Ștergerea nu se poate anula.', () => { setState(defaults()); save(); initAtt(); render(); }, 'Da, șterge tot'), 'Continuă');
    },
  },
  changes: {
    school(el) { S.school[el.dataset.f] = el.value; save(); },
    schName(el) { S.schools.find(s => s.id === el.dataset.id).name = el.value.trim(); save(); },
    sch(el) { const x = S.schedule.find(s => s.id === el.dataset.id); x[el.dataset.f] = el.dataset.f === 'day' ? +el.value : el.value; save(); },
    mod(el) { S.modules.find(s => s.id === el.dataset.id)[el.dataset.f] = el.value; save(); },
    ms(el) { S.measures.find(s => s.id === el.dataset.id)[el.dataset.f] = el.value; save(); },
    scale(el) { S.settings.scale[+el.dataset.i].min = +el.value; save(); },
    minGrade(el) { S.settings.minGrade = Math.max(1, Math.min(10, +el.value || 4)); save(); },
    autoRule(el) { S.settings.autoRule = el.value; save(); },
    curve(el) {
      S.settings.curve[+el.dataset.i].p = Math.max(0, +el.value || 0); save();
      const t = S.settings.curve.reduce((a, x) => a + +x.p, 0);
      $('#curveSum').textContent = `Total: ${t}%` + (t === 100 ? '' : ' – trebuie să fie 100%');
      $('#curveSum').style.color = t === 100 ? '' : 'var(--bad)';
    },
    tmMod(el) {
      const t = S.teams.find(x => x.id === el.dataset.id); keepTeamName(t);
      t.modules = el.checked ? [...t.modules, el.dataset.m] : t.modules.filter(m => m !== el.dataset.m);
      save(); teamModal(t.id);
    },
    tmClass(el) { keepTeamName(S.teams.find(x => x.id === el.dataset.id)); TM.classId = el.value; teamModal(el.dataset.id); },
    tmMember(el) {
      const t = S.teams.find(x => x.id === el.dataset.id); keepTeamName(t);
      t.members = el.checked ? [...t.members, el.dataset.s] : t.members.filter(m => m !== el.dataset.s);
      save();
    },
    rsn(el) { S.settings.reasons[+el.dataset.i].t = el.value; save(); },
    rsnExc(el) { S.settings.reasons[+el.dataset.i].exc = el.checked; save(); },
  },
};
