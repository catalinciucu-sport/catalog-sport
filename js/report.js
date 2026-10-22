// Documente de dat sau de printat, ca PDF (html2pdf, încărcat doar când e nevoie), trimise prin meniul
// de partajare al telefonului (WhatsApp, e-mail...) sau descărcate:
//  - fișa de evoluție a elevului: testări cu dată, recorduri personale, comparație cu colegii și cu baremul, grafice, observații;
//  - foaia pentru catalog a unei clase: notele alese pentru catalog, pe fiecare modul;
//  - foaia unei echipe a școlii (și Excel). Toate se pot și tipări (Print).
import {S, save, path, schoolOf, LEVELS} from './store.js';
import {esc, fmtD, fmtN, iso, openModal, toast, $} from './util.js';
import {testItems, series, bmiSeries, progress, levelOf, normGrade, standing, catalogFor} from './calc.js';
import {saveBlob, download} from './files.js';

const GENDER = {B: 'Băiat', F: 'Fată'};
const COLORS = {first: '#b9c4c0', up: '#157f3d', down: '#b42318', neu: '#0f766e'};
const HTML2PDF = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
const levelWords = l => l == null ? '' : l === 0 ? 'clasa pregătitoare' : `clasa a ${LEVELS[l]}-a`;
const head = c => `<div class="r-head"><span>${esc(schoolOf(c).name || 'Unitatea de învățământ')}</span><span>An școlar ${esc(S.school.year)}</span></div>`;

/* ---- fișa elevului ---- */
// rândurile fișei: măsurători (+ IMC după greutate), apoi probe; doar cele cu valori
function reportRows(c, st) {
  const rows = [], lvl = levelOf(c);
  const add = (it, s) => {
    if (!s.length) return;
    const row = {...it, s, p: s.length > 1 ? progress(it.better, s[0].v, s[s.length - 1].v) : null};
    if (it.kind === 'n') {   // record personal, nota la barem, poziția față de colegi
      const norm = S.norms.find(n => 'n:' + n.id === it.id);
      row.best = s.reduce((b, x) => (b == null || (norm.type === 'low' ? x.v < b.v : x.v > b.v)) ? x : b, null);
      row.grade = norm.type === 'direct' ? null : normGrade(norm, st.gender, row.best.v, lvl);
      row.pos = norm.type === 'direct' ? null : standing(norm, lvl, st.gender, st.id);
    }
    rows.push(row);
  };
  for (const it of testItems()) {
    add(it, series(c.id, it.id, st.id));
    if (it.id === 'm:w') add({id: 'bmi', name: 'IMC (indice de masă corporală)', unit: 'kg/m²', kind: 'm', better: 'none'}, bmiSeries(c.id, st.id));
  }
  return rows;
}
const resultsCell = r => r.s.map(x => `<b>${fmtN(x.v)}</b> <span style="color:#5a6661">(${fmtD(x.date).slice(0, 5)})</span>`).join(' → ');
const diffCell = r => `<td class="num ${r.p?.cls || ''}">${r.p ? (r.p.d > 0 ? '+' : '') + fmtN(r.p.d) + ' · ' + r.p.txt : '–'}</td>`;
function measuresTable(rows) {
  if (!rows.length) return '';
  return `<h2>Date antropometrice</h2><table><thead><tr><th class="l">Măsurătoarea</th><th>U.M.</th><th class="l">Rezultate (data)</th><th>Evoluție</th></tr></thead><tbody>
    ${rows.map(r => `<tr><td class="l">${esc(r.name)}</td><td>${esc(r.unit)}</td><td class="l num">${resultsCell(r)}</td>${diffCell(r)}</tr>`).join('')}</tbody></table>`;
}
function testsTable(rows, st, lvl) {
  if (!rows.length) return '';
  const peers = `${st.gender === 'F' ? 'fetele' : 'băieții'}${lvl != null ? ' din ' + levelWords(lvl) : ''}`;
  return `<h2>Probe de control</h2><table><thead><tr><th class="l">Proba</th><th class="l">Rezultate (data)</th><th>Record personal</th><th>Evoluție</th><th>Față de colegi*</th></tr></thead><tbody>
    ${rows.map(r => `<tr><td class="l">${esc(r.name)} <span style="color:#5a6661">(${esc(r.unit)})</span></td><td class="l num">${resultsCell(r)}</td>
      <td class="num"><b>${fmtN(r.best.v)}</b>${r.grade != null ? ` <span style="color:#5a6661">· nota ${r.grade}</span>` : ''}</td>${diffCell(r)}
      <td>${r.pos ? `mai bun decât <b>${r.pos.pct}%</b>` : '<span style="color:#5a6661">–</span>'}</td></tr>`).join('')}</tbody></table>
    <div style="font-size:11px;color:#5a6661;margin-top:4px">* comparat cu recordurile celorlalți elevi (${esc(peers)}) evaluați de același profesor, fără nume. „Nota” = nota la barem pentru recordul personal.</div>`;
}
// grafic mic: câte o bară pentru fiecare testare, la aceeași scară; ultima colorată după progres
function chart(r) {
  const max = Math.max(...r.s.map(x => x.v)) || 1, W = 100, H = 18, last = r.s.length - 1;
  const bars = r.s.map((x, i) => {
    const y = 2 + i * H, w = Math.max(2, x.v / max * W), color = i === last ? COLORS[r.p.cls] : COLORS.first;
    return `<text x="0" y="${y + 11}" font-size="10" fill="#5a6661">${fmtD(x.date).slice(0, 5)}</text>
      <rect x="40" y="${y}" width="${w}" height="13" rx="2" fill="${color}"/>
      <text x="${44 + w}" y="${y + 11}" font-size="10" font-weight="600" fill="#1b2420">${fmtN(x.v)}</text>`;
  }).join('');
  return `<div class="chart"><div class="t" title="${esc(r.name)}">${esc(r.name)} <span style="color:#5a6661;font-weight:400">(${esc(r.unit)})</span></div>
    <svg viewBox="0 0 190 ${r.s.length * H + 4}" role="img" aria-label="${esc(r.name)}: ${r.s.map(x => fmtN(x.v)).join(', ')}">${bars}</svg></div>`;
}

export function reportHTML(c, st) {
  const rows = reportRows(c, st), multi = rows.filter(r => r.s.length > 1), lvl = levelOf(c);
  return `<article class="rep">${head(c)}
    <h1>Fișa de evoluție – Educație fizică și sport</h1>
    <div class="r-sub">Rezultatele testărilor din anul școlar</div>
    <div class="r-meta"><div><b>Elev</b>${esc(st.name)}</div><div><b>Clasa</b>${esc(st.from ? `${st.from} (${c.name})` : c.name)}</div><div><b>Sex</b>${GENDER[st.gender] || '–'}</div><div><b>Profesor</b>${esc(S.school.teacher || '–')}</div></div>
    ${rows.length ? measuresTable(rows.filter(r => r.kind === 'm')) + testsTable(rows.filter(r => r.kind === 'n'), st, lvl)
      : '<p style="color:#5a6661">Nu sunt încă testări înregistrate pentru acest elev (tabul Testări).</p>'}
    ${multi.length ? `<h2>Evoluție</h2><div class="charts">${multi.map(chart).join('')}</div>` : ''}
    <h2>Observații și recomandări</h2><div class="obs">${esc(S.obs[c.id]?.[st.id] || '')}</div>
    <div class="sign"><span>Profesor: ${esc(S.school.teacher)} ______________</span><span>Data: ______________</span></div>
  </article>`;
}

/* ---- foaia pentru catalog: toate notele alese pentru catalog, pe module ---- */
export function catalogSheetHTML(c) {
  const lvl = levelOf(c);
  return `<article class="rep">${head(c)}
    <h1>Situația notelor – Educație fizică și sport</h1>
    <div class="r-sub">Notele de trecut în catalog, pe module · generată la ${fmtD(iso(new Date()))}</div>
    <div class="r-meta"><div><b>Clasa</b>${esc(c.name)}</div><div><b>Nivel</b>${esc(levelWords(lvl) || '–')}</div><div><b>Elevi</b>${c.students.length}</div><div><b>Profesor</b>${esc(S.school.teacher || '–')}</div></div>
    <table class="cat"><thead><tr><th>Nr</th><th class="l">Numele elevului</th>${S.modules.map(m => `<th>${esc(m.name.replace('Modulul', 'Modul'))}</th>`).join('')}</tr></thead><tbody>
    ${c.students.map((st, i) => `<tr><td>${i + 1}</td><td class="l">${esc(st.name)}${st.from ? ` <span style="color:#5a6661">(${esc(st.from)})</span>` : ''}</td>
      ${S.modules.map(m => `<td class="num"><b>${catalogFor(c, st, m).map(x => x.g).join(', ')}</b></td>`).join('')}</tr>`).join('')}
    </tbody></table>
    <div class="sign"><span>Profesor: ${esc(S.school.teacher)} ______________</span><span>Data: ______________</span></div>
  </article>`;
}

/* ---- foaia unei echipe a școlii: elevii din toate clasele, cu loc pentru viza medicală ---- */
export const teamStudents = t => S.classes.flatMap(c => c.students.filter(s => t.members.includes(s.id)).map(st => ({st, cls: st.from || c.name})))
  .sort((a, b) => a.cls.localeCompare(b.cls, 'ro') || a.st.name.localeCompare(b.st.name, 'ro'));
export function teamSheetHTML(t) {
  const list = teamStudents(t);
  return `<article class="rep">${head(S.classes[0])}
    <h1>Echipa Colegiului – ${esc(t.name)}</h1>
    <div class="r-sub">Lista elevilor din echipă · generată la ${fmtD(iso(new Date()))}</div>
    <div class="r-meta"><div><b>Echipa</b>${esc(t.name)}</div><div><b>Elevi</b>${list.length}</div><div><b>Profesor</b>${esc(S.school.teacher || '–')}</div></div>
    <table class="cat"><thead><tr><th>Nr. crt.</th><th class="l">Nume și prenume</th><th>Clasa</th><th style="width:34%">Viză medicală</th></tr></thead><tbody>
    ${list.map((x, i) => `<tr><td>${i + 1}</td><td class="l">${esc(x.st.name)}</td><td>${esc(x.cls)}</td><td style="height:26px"></td></tr>`).join('')
      || '<tr><td colspan="4" style="color:#5a6661">Nu e niciun elev bifat în această echipă.</td></tr>'}
    </tbody></table>
    <div class="sign"><span>Profesor: ${esc(S.school.teacher)} ______________</span><span>Data: ______________</span></div>
  </article>`;
}

/* ---- Print: fereastra de tipărire a sistemului (acolo se alege imprimanta) ---- */
export function printPages(pages) {
  let box = $('#printArea');
  if (!box) { box = document.createElement('div'); box.id = 'printArea'; document.body.appendChild(box); }
  box.innerHTML = pages.map((p, i) => i ? p.replace('<article class="rep"', '<article class="rep pb"') : p).join('');
  setTimeout(() => window.print(), 50);
}

/* ---- PDF ---- */
function loadLib() {
  if (window.html2pdf) return Promise.resolve();
  return new Promise((ok, fail) => { const s = document.createElement('script'); s.src = HTML2PDF; s.onload = ok; s.onerror = fail; document.head.appendChild(s); });
}
const safe = s => s.replace(/[\\/:*?"<>|]/g, '_') + '.pdf';
// pages = HTML-ul fiecărei pagini (<article class="rep">…); fiecare începe pe pagină nouă
export async function pdfBlob(pages) {
  await loadLib();
  const html = `<div style="width:740px">${pages.map((p, i) => i ? p.replace('<article class="rep"', '<article class="rep pb"') : p).join('')}</div>`;
  return await html2pdf().set({
    margin: [10, 10, 10, 10], image: {type: 'jpeg', quality: 0.95},
    html2canvas: {scale: 2, useCORS: true}, jsPDF: {unit: 'mm', format: 'a4', orientation: 'portrait'},
    pagebreak: {mode: ['css', 'avoid-all'], before: '.pb'},
  }).from(html).outputPdf('blob');
}
export const makePdf = (c, students) => pdfBlob(students.map(st => reportHTML(c, st)));
// trimite prin meniul de partajare (pe telefon: WhatsApp, e-mail...); altfel descarcă
async function deliver(pages, name, btn, mode) {
  const label = btn?.textContent;
  if (btn) { btn.disabled = true; btn.textContent = 'Se pregătește PDF-ul…'; }
  try {
    const blob = await pdfBlob(pages), file = new File([blob], name, {type: 'application/pdf'});
    if (mode === 'share' && navigator.canShare && navigator.canShare({files: [file]})) {
      try { await navigator.share({files: [file], title: name.replace('.pdf', '')}); }
      catch (e) { if (e.name !== 'AbortError') saveBlob(blob, name); }
    } else { saveBlob(blob, name); toast('PDF salvat în Descărcări'); }
  } catch (e) { toast('PDF-ul nu s-a putut crea. Verifică conexiunea la internet și încearcă din nou.'); }
  finally { if (btn) { btn.disabled = false; btn.textContent = label; } }
}
const reportName = (c, students) => safe(students.length === 1 ? `Fisa ${students[0].name} ${c.name}` : `Fise ${c.name}`);
export const sharePdf = (c, students, btn) => deliver(students.map(st => reportHTML(c, st)), reportName(c, students), btn, 'share');
export const downloadPdf = (c, students, btn) => deliver(students.map(st => reportHTML(c, st)), reportName(c, students), btn, 'download');

// în aplicație: fișa + câmp pentru observații + trimitere
export function openReport(c, st) {
  openModal(`<div class="row2" style="margin-bottom:10px"><h3 class="grow" style="margin:0">Fișa elevului</h3>
      <button class="btn pri" id="repShare">Trimite PDF</button><button class="btn" id="repSave">Descarcă</button><button class="btn" id="repPrint">Print</button><button class="btn" data-act="close">Închide</button></div>
    <label class="f" style="margin-bottom:12px">Observații și recomandări (apar pe fișă)<textarea id="repObs" style="min-height:80px">${esc(S.obs[c.id]?.[st.id] || '')}</textarea></label>
    <div id="repBody" style="overflow-x:auto">${reportHTML(c, st)}</div>`, true);
  const keepObs = () => {
    const r = path('obs', c.id), t = $('#repObs').value.trim();
    if ((r[st.id] || '') === t) return;
    if (t) r[st.id] = t; else delete r[st.id];
    save(); $('#repBody').innerHTML = reportHTML(c, st);
  };
  $('#repObs').onchange = keepObs;
  $('#repShare').onclick = e => { keepObs(); sharePdf(c, [st], e.currentTarget); };
  $('#repSave').onclick = e => { keepObs(); downloadPdf(c, [st], e.currentTarget); };
  $('#repPrint').onclick = () => { keepObs(); printPages([reportHTML(c, st)]); };
}
// foaia pentru catalog: previzualizare + trimitere / descărcare
export function openCatalogSheet(c) {
  const name = safe(`Note catalog ${c.name}`);
  openModal(`<div class="row2" style="margin-bottom:10px"><h3 class="grow" style="margin:0">Foaie pentru catalog</h3>
      <button class="btn pri" id="catShare">Trimite PDF</button><button class="btn" id="catSave">Descarcă</button><button class="btn" id="catPrint">Print</button><button class="btn" data-act="close">Închide</button></div>
    <div class="small muted" style="margin-bottom:10px">Conține toate notele alese pentru catalog până azi, pe fiecare modul (tabul Note → coloana „În catalog”).</div>
    <div style="overflow-x:auto">${catalogSheetHTML(c)}</div>`, true);
  $('#catShare').onclick = e => deliver([catalogSheetHTML(c)], name, e.currentTarget, 'share');
  $('#catSave').onclick = e => deliver([catalogSheetHTML(c)], name, e.currentTarget, 'download');
  $('#catPrint').onclick = () => printPages([catalogSheetHTML(c)]);
}
// foaia echipei: previzualizare + PDF / Excel / Print
export function openTeamSheet(t) {
  const name = safe(`Echipa ${t.name}`);
  openModal(`<div class="row2" style="margin-bottom:10px"><button class="btn" data-act="hTeams">← Echipe</button><h3 class="grow" style="margin:0">Echipa ${esc(t.name)}</h3>
      <button class="btn pri" id="tmShare">Trimite PDF</button><button class="btn" id="tmSave">Descarcă PDF</button><button class="btn" id="tmXls">Excel</button><button class="btn" id="tmPrint">Print</button><button class="btn" data-act="close">Închide</button></div>
    <div class="small muted" style="margin-bottom:10px">Elevii se bifează în echipă din Clase → clasa → Echipele școlii. Coloana „Viză medicală” rămâne goală, de completat pe hârtie.</div>
    <div style="overflow-x:auto">${teamSheetHTML(t)}</div>`, true);
  $('#tmShare').onclick = e => deliver([teamSheetHTML(t)], name, e.currentTarget, 'share');
  $('#tmSave').onclick = e => deliver([teamSheetHTML(t)], name, e.currentTarget, 'download');
  $('#tmPrint').onclick = () => printPages([teamSheetHTML(t)]);
  $('#tmXls').onclick = () => download([['Nr. crt.', 'Nume și prenume', 'Clasa', 'Viză medicală'],
    ...teamStudents(t).map((x, i) => [i + 1, x.st.name, x.cls, ''])], `Echipa ${t.name}`, 'Echipa');
}
