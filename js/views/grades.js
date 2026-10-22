// Ecranul „Note”: procent de prezență, notă pe prezență, note la norme, nota finală pe modul; export Excel.
import {S, save, cls, path} from '../store.js';
import {esc, fmtD, openModal, closeModal, ask, toast, $} from '../util.js';
import {defaultModule, sessionsIn, attStats, finalFor, normsUsed, rres, CRITERIA, AUTO_RULES, anyTeam, catalogOptions, catalogPicks, catalogFor} from '../calc.js';
import {openCatalogSheet} from '../report.js';
import {render, view, setHead, classOpts, modOpts, gTag, noClasses, fromTag, nameWithClass} from '../ui.js';
import {download} from '../files.js';
import {linked} from '../sync.js';
import {A} from './attendance.js';

const G = {classId: null, modId: null};

function renderGrades() {
  setHead('Note');
  if (!S.classes.length) { view().innerHTML = noClasses(linked()); return; }
  G.classId = cls(A.classId) ? A.classId : S.classes[0].id;   // clasa deschisă din Home
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
      <td><select data-ch="choice" data-id="${st.id}">${CRITERIA.filter(([k]) => k !== 'team' || anyTeam(st.id)).map(([k, t]) => `<option value="${k}" ${f.ch === k ? 'selected' : ''}>${t}${k === 'auto' && f.ch === 'auto' ? ' · ' + f.src : ''}</option>`).join('')}</select></td>
      <td><button class="btn sm" data-act="catEdit" data-id="${st.id}" title="Alege notele pentru catalog">${catalogFor(c, st, mod).map(x => gTag(x.g)).join(' ') || '<span class="muted">–</span>'} ✎</button></td></tr>`;
  }).join('');
  view().innerHTML = `<div class="tbl-wrap"><table><thead><tr><th>Nr</th><th class="l">Elev</th><th>% prez.</th><th>Notă<br>prez.</th>
    ${ns.map(n => `<th title="${esc(n.name)}">${esc(n.name.replace(/\s*\(exemplu\)/, '').slice(0, 16))}</th>`).join('')}<th>Nota<br>calculată</th><th>Criteriu</th><th>În catalog</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="${7 + ns.length}" class="empty">Clasa nu are elevi.</td></tr>`}</tbody></table></div>
  <div class="card" style="margin-top:12px"><div class="row2">
      <label class="f">Modul<select data-ch="gMod">${modOpts(mod.id)}</select></label></div>
    <div class="small muted" style="margin-top:8px">${sessionsIn(c.id, mod).length} ore înregistrate în modul. Automat: membrii echipei școlii cu competiții în acest modul primesc 10; ceilalți primesc ${AUTO_RULES[S.settings.autoRule || 'max']}. Absențele motivate (ex. boală) nu scad procentul. Poți alege alt criteriu pentru fiecare elev, în coloana Criteriu („Echipa școlii” apare doar la elevii bifați într-o echipă).</div>
    <div class="small muted" style="margin-top:6px">În coloana <b>În catalog</b> alegi ce note se trec în catalog (una sau mai multe): apasă pe note.</div>
    <div class="row2" style="margin-top:10px"><button class="btn pri" data-act="catSheet">Foaie pentru catalog</button><button class="btn" data-act="expGrades">Export note (Excel)</button><button class="btn" data-act="expAtt">Export prezență (Excel)</button></div></div>`;
}

/* ---- fereastra „Note pentru catalog” a unui elev, în modulul ales ---- */
function catModal(sid) {
  const c = cls(G.classId), mod = S.modules.find(m => m.id === G.modId), st = c.students.find(s => s.id === sid);
  const picks = catalogPicks(c.id, mod.id, sid), opts = catalogOptions(c, st, mod), manual = picks.filter(p => typeof p === 'object');
  openModal(`<h3>Note pentru catalog</h3><div class="muted small" style="margin-bottom:10px">${esc(st.name)} · ${esc(c.name)} · ${esc(mod.name)}</div>
    ${opts.map(o => `<label class="item" style="cursor:pointer"><input type="checkbox" style="width:22px;height:22px" data-ch="catPick" data-id="${sid}" data-k="${o.key}" ${picks.includes(o.key) ? 'checked' : ''}>
      <span class="grow">${esc(o.label)}</span>${gTag(o.g)}</label>`).join('')}
    <div class="small muted" style="margin:12px 0 4px">Note trecute de mână</div>
    ${manual.map((m, i) => `<div class="item"><span class="grow">Notă</span>${gTag(m.m)}<button class="btn sm bad" data-act="catDelM" data-id="${sid}" data-i="${i}" aria-label="Șterge nota">✕</button></div>`).join('')}
    <div class="row2"><input type="number" min="1" max="10" id="catM" placeholder="notă 1–10" style="width:120px"><button class="btn sm" data-act="catAddM" data-id="${sid}">Adaugă notă</button></div>
    <div class="row2" style="margin-top:16px"><button class="btn pri" data-act="catDone">Gata</button><button class="btn" data-act="catAll" data-id="${sid}">La fel pentru toată clasa</button></div>
    <div class="small muted" style="margin-top:6px">„La fel pentru toată clasa” copiază bifele (nu și notele trecute de mână) la toți elevii din ${esc(c.name)}, în ${esc(mod.name)}.</div>`);
}
const setPicks = (sid, arr) => { path('catalog', G.classId, G.modId)[sid] = arr; save(); };

function exportGrades() {
  const c = cls(G.classId), mod = S.modules.find(m => m.id === G.modId), ns = normsUsed(c.id, mod.id), r = rres(c.id, mod.id);
  const rows = [['Nr', 'Nume', 'Sex', 'Ore luate în calcul', 'Prezent', 'Absent', 'Motivat', '% prezență', 'Notă prezență',
    ...ns.flatMap(n => n.type === 'direct' ? [n.name] : [n.name + ' (' + n.unit + ')', n.name + ' – notă']), 'Medie norme', 'Nota calculată', 'Criteriu', 'În catalog']];
  c.students.forEach((st, i) => {
    const f = finalFor(c, st, mod);
    rows.push([i + 1, nameWithClass(st), st.gender || '', f.a.total - f.a.exc, f.a.pres, f.a.abs, f.a.exc, f.a.pct ?? '', f.gp ?? '',
      ...ns.flatMap(n => { const x = r[n.id]?.[st.id]; return n.type === 'direct' ? [x?.g ?? ''] : [x?.v ?? '', x?.g ?? '']; }),
      f.avgN != null ? +f.avgN.toFixed(2) : '', f.g ?? '', f.src, catalogFor(c, st, mod).map(x => x.g).join(', ')]);
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
  actions: {
    expGrades: exportGrades, expAtt: exportAtt,
    catEdit(el) { catModal(el.dataset.id); },
    catDone() { closeModal(); render(true); },
    catAddM(el) {
      const g = Math.round(+$('#catM').value); if (!(g >= 1 && g <= 10)) { toast('Scrie o notă între 1 și 10'); return; }
      const sid = el.dataset.id; setPicks(sid, [...catalogPicks(G.classId, G.modId, sid), {m: g}]); catModal(sid);
    },
    catDelM(el) {
      const sid = el.dataset.id, picks = catalogPicks(G.classId, G.modId, sid), man = picks.filter(p => typeof p === 'object')[+el.dataset.i];
      setPicks(sid, picks.filter(p => p !== man)); catModal(sid);
    },
    catAll(el) {
      const c = cls(G.classId), keys = catalogPicks(c.id, G.modId, el.dataset.id).filter(p => typeof p === 'string');
      ask(`Pui aceleași note în catalog la toți cei ${c.students.length} elevi din ${c.name}?`, () => {
        c.students.forEach(st => setPicks(st.id, [...keys, ...catalogPicks(c.id, G.modId, st.id).filter(p => typeof p === 'object')]));
        render(true); toast('Aplicat la toată clasa');
      }, 'Aplică');
    },
    catSheet() { const c = cls(G.classId); openCatalogSheet(c); },
  },
  changes: {
    catPick(el) {
      const c = cls(G.classId), mod = S.modules.find(m => m.id === G.modId), st = c.students.find(s => s.id === el.dataset.id);
      const picks = catalogPicks(c.id, mod.id, st.id), keys = catalogOptions(c, st, mod).map(o => o.key)
        .filter(k => k === el.dataset.k ? el.checked : picks.includes(k));
      setPicks(st.id, [...keys, ...picks.filter(p => typeof p === 'object')]);
    },
    gClass(el) { G.classId = el.value; render(); },
    gMod(el) { G.modId = el.value; render(); },
    choice(el) { path('choice', G.classId, G.modId)[el.dataset.id] = el.value; save(); render(true); },
  },
};
