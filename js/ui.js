// Piese de interfață comune ecranelor: titlul de sus, liste de selecție, eticheta de notă.
// render() redesenează ecranul curent (îl leagă main.js).
import {S, activeClasses} from './store.js';
import {esc, fmtD, nrm, $} from './util.js';

let renderFn = () => {};
export const setRenderer = fn => { renderFn = fn; };
export const render = keepScroll => renderFn(keepScroll);

export const view = () => $('#view');
export function setHead(t, sub) { $('#ttl').textContent = t; $('#sub').textContent = sub || ''; }
export function setSync(t) { const el = $('#sync'); if (el) el.textContent = t; }

// lista claselor pentru selecții; cu mai multe școli, grupate pe școli
export function classOpts(sel) {
  const opt = c => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${esc(c.name)}</option>`;
  if (S.schools.length < 2) return activeClasses().map(opt).join('');
  return S.schools.map(sc => { const cs = activeClasses().filter(c => c.schoolId === sc.id); return cs.length ? `<optgroup label="${esc(sc.name || 'Școală fără nume')}">${cs.map(opt).join('')}</optgroup>` : ''; }).join('');
}
export const modOpts = sel => S.modules.map(m => `<option value="${m.id}" ${m.id === sel ? 'selected' : ''}>${esc(m.name)} (${fmtD(m.start).slice(0, 5)}–${fmtD(m.end).slice(0, 5)})</option>`).join('');
// clasa de proveniență, sub nume, pentru elevii din grupe (student.from, ex. „9COM”)
export const fromTag = st => st.from ? `<small class="from">${esc(st.from)}</small>` : '';
export const nameWithClass = st => st.name + (st.from ? ` (${st.from})` : '');
// culoarea fiecărui motiv de absență; motivele adăugate în Setări primesc culori din EXTRA, cele scrise de mână gri
const RC = {'absent': '#d6336c', 'fara echipament': '#e8590c', 'scutit medical': '#1c7ed6', 'invoit / motivat': '#7048e8',
  'accidentat': '#e03131', 'concurs / olimpiada': '#0c8599', 'inapt fiziologic': '#9c6644'};
const EXTRA = ['#2f9e44', '#5f3dc4', '#1098ad', '#f08c00', '#a61e4d'];
export function reasonColor(t) {
  if (!t) return RC.absent;
  const k = nrm(t); if (RC[k]) return RC[k];
  const i = S.settings.reasons.findIndex(r => nrm(r.t) === k);
  return i < 0 ? '#868e96' : EXTRA[i % EXTRA.length];
}
export const gTag = g => g == null ? '<span class="muted">–</span>' : `<span class="g g${g}">${g}</span>`;

export const noClasses = linked => `<div class="card empty"><h2>Lista de prezență apare aici</h2>
  Importă clasele dintr-un fișier Excel sau lipește lista de elevi. Apoi completează orarul în Setări și aplicația îți deschide singură clasa cu care ai oră.
  <div class="row2" style="justify-content:center;margin-top:14px"><button class="btn pri" data-act="tab" data-k="classes">Importă clasele</button><button class="btn" data-act="demo">Încearcă cu o clasă exemplu</button></div>
  ${linked ? '' : '<div class="small" style="margin-top:14px">Ai deja datele în Google de pe alt dispozitiv? <button class="btn sm" data-act="tab" data-k="set">Conectează la Google</button></div>'}</div>`;
