// Fișa de evoluție a elevului: antet, tabel cu toate testările (cu dată), grafice, observații.
// Se vede într-o fereastră din aplicație; PDF-ul se face cu html2pdf (încărcat doar când e nevoie)
// și se trimite prin meniul de partajare al telefonului (WhatsApp, e-mail...) sau se descarcă.
import {S, save, path} from './store.js';
import {esc, fmtD, fmtN, openModal, toast, $} from './util.js';
import {testItems, series, bmiSeries, progress} from './calc.js';
import {saveBlob} from './files.js';

const GENDER = {B: 'Băiat', F: 'Fată'};
const COLORS = {first: '#b9c4c0', up: '#157f3d', down: '#b42318', neu: '#0f766e'};
const HTML2PDF = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';

// rândurile fișei: măsurători (+ IMC după greutate), apoi probe; doar cele cu valori
function reportRows(c, st) {
  const rows = [], add = (it, s) => { if (s.length) rows.push({...it, s, p: s.length > 1 ? progress(it.better, s[0].v, s[s.length - 1].v) : null}); };
  for (const it of testItems()) {
    add(it, series(c.id, it.id, st.id));
    if (it.id === 'm:w') add({id: 'bmi', name: 'IMC (indice de masă corporală)', unit: 'kg/m²', kind: 'm', better: 'none'}, bmiSeries(c.id, st.id));
  }
  return rows;
}

function table(rows, title) {
  if (!rows.length) return '';
  return `<h2>${title}</h2><table><thead><tr><th class="l">Proba</th><th>U.M.</th><th class="l">Rezultate (data)</th><th>Diferență</th><th>Evoluție</th></tr></thead><tbody>
    ${rows.map(r => `<tr><td class="l">${esc(r.name)}</td><td>${esc(r.unit)}</td>
      <td class="l num">${r.s.map(x => `<b>${fmtN(x.v)}</b> <span style="color:#5a6661">(${fmtD(x.date).slice(0, 5)})</span>`).join(' → ')}</td>
      <td class="num ${r.p?.cls || ''}">${r.p ? (r.p.d > 0 ? '+' : '') + fmtN(r.p.d) : '–'}</td><td class="${r.p?.cls || ''}">${r.p?.txt || '–'}</td></tr>`).join('')}
  </tbody></table>`;
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
  const rows = reportRows(c, st), multi = rows.filter(r => r.s.length > 1);
  return `<article class="rep">
    <div class="r-head"><span>${esc(S.school.name || 'Unitatea de învățământ')}</span><span>An școlar ${esc(S.school.year)}</span></div>
    <h1>Fișa de evoluție – Educație fizică și sport</h1>
    <div class="r-sub">Rezultatele testărilor din anul școlar</div>
    <div class="r-meta"><div><b>Elev</b>${esc(st.name)}</div><div><b>Clasa</b>${esc(st.from ? `${st.from} (${c.name})` : c.name)}</div><div><b>Sex</b>${GENDER[st.gender] || '–'}</div><div><b>Profesor</b>${esc(S.school.teacher || '–')}</div></div>
    ${rows.length ? table(rows.filter(r => r.kind === 'm'), 'Date antropometrice') + table(rows.filter(r => r.kind === 'n'), 'Probe de control')
      : '<p style="color:#5a6661">Nu sunt încă testări înregistrate pentru acest elev (tabul Testări).</p>'}
    ${multi.length ? `<h2>Evoluție</h2><div class="charts">${multi.map(chart).join('')}</div>` : ''}
    <h2>Observații și recomandări</h2><div class="obs">${esc(S.obs[c.id]?.[st.id] || '')}</div>
    <div class="sign"><span>Profesor: ${esc(S.school.teacher)} ______________</span><span>Data: ______________</span></div>
  </article>`;
}

/* ---- PDF ---- */
function loadLib() {
  if (window.html2pdf) return Promise.resolve();
  return new Promise((ok, fail) => { const s = document.createElement('script'); s.src = HTML2PDF; s.onload = ok; s.onerror = fail; document.head.appendChild(s); });
}
const fileName = (c, students) => (students.length === 1 ? `Fisa ${students[0].name} ${c.name}` : `Fise ${c.name}`).replace(/[\\/:*?"<>|]/g, '_') + '.pdf';

export async function makePdf(c, students) {
  await loadLib();
  // html2pdf își face singur un container ascuns; îi dăm fișele ca text, la lățimea unei pagini A4
  const html = `<div style="width:740px">${students.map((st, i) => reportHTML(c, st).replace('<article class="rep"', `<article class="rep${i ? ' pb' : ''}"`)).join('')}</div>`;
  return await html2pdf().set({
    margin: [10, 10, 10, 10], image: {type: 'jpeg', quality: 0.95},
    html2canvas: {scale: 2, useCORS: true}, jsPDF: {unit: 'mm', format: 'a4', orientation: 'portrait'},
    pagebreak: {mode: ['css', 'avoid-all'], before: '.pb'},
  }).from(html).outputPdf('blob');
}

// trimite PDF-ul prin meniul de partajare (pe telefon: WhatsApp, e-mail...); altfel îl descarcă
export async function sharePdf(c, students, btn) {
  const label = btn?.textContent;
  if (btn) { btn.disabled = true; btn.textContent = 'Se pregătește PDF-ul…'; }
  try {
    const name = fileName(c, students), blob = await makePdf(c, students);
    const file = new File([blob], name, {type: 'application/pdf'});
    if (navigator.canShare && navigator.canShare({files: [file]})) {
      try { await navigator.share({files: [file], title: name.replace('.pdf', '')}); }
      catch (e) { if (e.name !== 'AbortError') saveBlob(blob, name); }
    } else { saveBlob(blob, name); toast('PDF salvat în Descărcări'); }
  } catch (e) { toast('PDF-ul nu s-a putut crea. Verifică conexiunea la internet și încearcă din nou.'); }
  finally { if (btn) { btn.disabled = false; btn.textContent = label; } }
}
export async function downloadPdf(c, students) {
  try { saveBlob(await makePdf(c, students), fileName(c, students)); toast('PDF salvat în Descărcări'); }
  catch (e) { toast('PDF-ul nu s-a putut crea. Verifică conexiunea la internet și încearcă din nou.'); }
}

// în aplicație: fișa + câmp pentru observații + trimitere
export function openReport(c, st) {
  openModal(`<div class="row2" style="margin-bottom:10px"><h3 class="grow" style="margin:0">Fișa elevului</h3>
      <button class="btn pri" id="repShare">Trimite PDF</button><button class="btn" id="repSave">Descarcă</button><button class="btn" data-act="close">Închide</button></div>
    <label class="f" style="margin-bottom:12px">Observații și recomandări (apar pe fișă)<textarea id="repObs" style="min-height:80px">${esc(S.obs[c.id]?.[st.id] || '')}</textarea></label>
    <div id="repBody">${reportHTML(c, st)}</div>`, true);
  const keepObs = () => {
    const r = path('obs', c.id), t = $('#repObs').value.trim();
    if ((r[st.id] || '') === t) return;
    if (t) r[st.id] = t; else delete r[st.id];
    save(); $('#repBody').innerHTML = reportHTML(c, st);
  };
  $('#repObs').onchange = keepObs;
  $('#repShare').onclick = e => { keepObs(); sharePdf(c, [st], e.currentTarget); };
  $('#repSave').onclick = () => { keepObs(); downloadPdf(c, [st]); };
}
