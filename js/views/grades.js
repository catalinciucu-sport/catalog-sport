// Ecranul „Note”: procent de prezență, notă pe prezență, note la norme, nota finală pe modul; export Excel.
import {S, save, cls, path} from '../store.js';
import {esc, fmtD} from '../util.js';
import {defaultModule, sessionsIn, attStats, finalFor, normsUsed, rres, CRITERIA, AUTO_RULES} from '../calc.js';
import {render, view, setHead, classOpts, modOpts, gTag, noClasses, fromTag, nameWithClass} from '../ui.js';
import {download} from '../files.js';
import {linked} from '../sync.js';
import {A} from './attendance.js';

const G = {classId: null, modId: null};

function renderGrades() {
  setHead('Note');
  if (!S.classes.length) { view().innerHTML = noClasses(linked()); return; }
  if (!cls(G.classId)) G.classId = cls(A.classId) ? A.classId : S.classes[0].id;
  if (!S.modules.find(m => m.id === G.modId)) G.modId = defaultModule()?.id;
  const c = cls(G.classId), mod = S.modules.find(m => m.id === G.modId);
  if (!mod) { view().innerHTML = '<div class="card empty">Definește modulele în Setări.</div>'; return; }
  setHead('Note', `${c.name} · ${mod.name}`);
  const ns = normsUsed(c.id, mod.id), r = rres(c.id, mod.id);
  const rows = c.students.map((st, i) => {
    const f = finalFor(c, st, mod);
    return `<tr><td>${i + 1}</td><td class="l nmc">${esc(st.name)}${fromTag(st)}${f.team ? `<div class="small" style="color:var(--accent)">${esc(f.team.name)}</div>` : ''}</td>
      <td class="small">${f.a.pct != null ? f.a.pct + '%' : '–'}<div class="muted" style="font-size:11px">${f.a.pres}/${f.a.total - f.a.exc}${f.a.exc ? ' (+' + f.a.exc + ' mot.)' : ''}</div></td>
      <td>${gTag(f.gp)}</td>
      ${ns.map(n => { const x = r[n.id]?.[st.id]; return `<td>${gTag(x?.g)}${x && x.v != null && n.type !== 'direct' ? `<div class="muted" style="font-size:11px">${x.v} ${esc(n.unit)}</div>` : ''}</td>`; }).join('')}
      <td class="fin">${gTag(f.g)}</td>
      <td><select data-ch="choice" data-id="${st.id}">${CRITERIA.map(([k, t]) => `<option value="${k}" ${f.ch === k ? 'selected' : ''}>${t}${k === 'auto' && f.ch === 'auto' ? ' · ' + f.src : ''}</option>`).join('')}</select></td></tr>`;
  }).join('');
  view().innerHTML = `<div class="card"><div class="row2">
      <label class="f">Clasa<select data-ch="gClass">${classOpts(c.id)}</select></label>
      <label class="f">Modul<select data-ch="gMod">${modOpts(mod.id)}</select></label></div>
    <div class="small muted" style="margin-top:8px">${sessionsIn(c.id, mod).length} ore înregistrate în modul. Automat: membrii echipei școlii cu competiții în acest modul primesc 10; ceilalți primesc ${AUTO_RULES[S.settings.autoRule || 'max']}. Absențele motivate (ex. boală) nu scad procentul. Poți alege alt criteriu pentru fiecare elev, în coloana Sursa.</div>
    <div class="row2" style="margin-top:10px"><button class="btn pri" data-act="expGrades">Export note (Excel)</button><button class="btn" data-act="expAtt">Export prezență (Excel)</button></div></div>
  <div class="tbl-wrap"><table><thead><tr><th>Nr</th><th class="l">Elev</th><th>% prez.</th><th>Notă<br>prez.</th>
    ${ns.map(n => `<th title="${esc(n.name)}">${esc(n.name.replace(/\s*\(exemplu\)/, '').slice(0, 16))}</th>`).join('')}<th>Nota<br>finală</th><th>Sursa</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="${6 + ns.length}" class="empty">Clasa nu are elevi.</td></tr>`}</tbody></table></div>`;
}

function exportGrades() {
  const c = cls(G.classId), mod = S.modules.find(m => m.id === G.modId), ns = normsUsed(c.id, mod.id), r = rres(c.id, mod.id);
  const rows = [['Nr', 'Nume', 'Sex', 'Ore luate în calcul', 'Prezent', 'Absent', 'Motivat', '% prezență', 'Notă prezență',
    ...ns.flatMap(n => n.type === 'direct' ? [n.name] : [n.name + ' (' + n.unit + ')', n.name + ' – notă']), 'Medie norme', 'Nota finală', 'Sursa']];
  c.students.forEach((st, i) => {
    const f = finalFor(c, st, mod);
    rows.push([i + 1, nameWithClass(st), st.gender || '', f.a.total - f.a.exc, f.a.pres, f.a.abs, f.a.exc, f.a.pct ?? '', f.gp ?? '',
      ...ns.flatMap(n => { const x = r[n.id]?.[st.id]; return n.type === 'direct' ? [x?.g ?? ''] : [x?.v ?? '', x?.g ?? '']; }),
      f.avgN != null ? +f.avgN.toFixed(2) : '', f.g ?? '', f.src]);
  });
  download(rows, `Note ${c.name} ${mod.name}`, 'Note');
}
function exportAtt() {
  const c = cls(G.classId), mod = S.modules.find(m => m.id === G.modId), ss = sessionsIn(c.id, mod);
  const rows = [['Nr', 'Nume', ...ss.map(([k]) => { const [d, s] = k.split('|'); return fmtD(d).slice(0, 5) + (s !== 'ora' ? ' ' + s : ''); }), 'Prezent', 'Absent', 'Motivat', '%']];
  c.students.forEach((st, i) => {
    const a = attStats(c.id, st.id, mod);
    rows.push([i + 1, nameWithClass(st), ...ss.map(([, s]) => { const r = s[st.id]; return !r ? '' : r.p ? 'P' : 'A' + (r.r ? ' – ' + r.r : ''); }), a.pres, a.abs, a.exc, a.pct ?? '']);
  });
  download(rows, `Prezenta ${c.name} ${mod.name}`, 'Prezenta');
}

export default {
  key: 'grades', title: 'Note', render: renderGrades,
  actions: {expGrades: exportGrades, expAtt: exportAtt},
  changes: {
    gClass(el) { G.classId = el.value; render(); },
    gMod(el) { G.modId = el.value; render(); },
    choice(el) { path('choice', G.classId, G.modId)[el.dataset.id] = el.value; save(); render(true); },
  },
};
