// Ecranul „Home”: clasele ca iconițe (ca aplicațiile pe telefon) și ora de acum din orar.
// De aici intri într-o clasă (Prezență, Note, Norme, Testări), în Clase și în Setări.
import {S, schoolOf} from '../store.js';
import {esc, iso, fmtD, wday, DAYS, ICON, openModal} from '../util.js';
import {openTeamSheet, teamStudents} from '../report.js';
import {render, view, setHead, noClasses} from '../ui.js';
import {linked} from '../sync.js';
import {currentSlot, openClass} from './attendance.js';

const COLORS = ['#0f766e', '#1c7ed6', '#e8590c', '#7048e8', '#2f9e44', '#d6336c', '#0c8599', '#f08c00', '#4c6ef5', '#c92a2a'];
// pista de atletism din colțul bannerului
const TRACK = `<svg class="track" viewBox="0 0 220 130" fill="none" stroke="#fff" stroke-width="3" aria-hidden="true">
  <rect x="6" y="6" width="208" height="118" rx="59"/><rect x="22" y="22" width="176" height="86" rx="43"/><rect x="38" y="38" width="144" height="54" rx="27"/>
  <path d="M110 6v32M110 92v32" stroke-dasharray="4 5"/></svg>`;

function greet() {
  const h = new Date().getHours();
  return h < 11 ? 'Bună dimineața!' : h < 18 ? 'Bună ziua!' : 'Bună seara!';
}
function tile(c, i, nowIds) {
  const short = c.name.replace(/\s+/g, '').slice(0, 5), len = short.length;
  const now = nowIds.has(c.id);
  return `<button class="app ${now ? 'now' : ''}" data-act="openCls" data-id="${c.id}" aria-label="${esc(c.name)}, ${c.students.length} elevi">
    <span class="ic" style="--c:${COLORS[i % COLORS.length]};font-size:${len <= 2 ? 24 : len <= 3 ? 21 : len <= 4 ? 18 : 15}px">${esc(short)}${now ? '<span class="badge">ACUM</span>' : ''}</span>
    <span class="lb">${esc(c.name)}</span><span class="ct">${c.students.length} elevi</span></button>`;
}

function renderHome() {
  setHead('Catalog Sport', schoolOf(S.classes[0])?.name || '');
  const today = iso(new Date()), cs = currentSlot();
  const nowIds = new Set(cs ? cs.all.map(x => x.classId) : []);
  const nowBox = cs ? `<div class="now">
      <div class="grow"><div class="small">${cs.kind === 'now' ? 'Ai oră acum' : 'Următoarea oră'} · ${cs.e.start}–${cs.e.end}</div>
      <div class="row2" style="margin-top:6px">${cs.all.map(x => `<button class="btn sm" data-act="openCls" data-id="${x.classId}">${esc(S.classes.find(c => c.id === x.classId).name)} →</button>`).join('')}</div></div></div>`
    : S.classes.length && !S.schedule.length ? '<div class="now small">Completează orarul în Setări și aici vei vedea clasa cu care ai oră.</div>' : '';
  const hero = `<div class="hero">${TRACK}<h2>${greet()}</h2><div class="small">${DAYS[wday(today)]}, ${fmtD(today)}</div>${nowBox}</div>`;
  if (!S.classes.length) { view().innerHTML = hero + noClasses(linked()); return; }
  // culori stabile: după poziția clasei în listă
  const idx = new Map(S.classes.map((c, i) => [c.id, i]));
  const groups = S.schools.map(sc => ({sc, cs: S.classes.filter(c => c.schoolId === sc.id)})).filter(g => g.cs.length);
  view().innerHTML = hero + groups.map(g => `
    <h2 class="apps-h">${S.schools.length > 1 ? esc(g.sc.name || 'Școală fără nume') : 'Clasele mele'}</h2>
    <div class="apps">${g.cs.map(c => tile(c, idx.get(c.id), nowIds)).join('')}</div>`).join('') +
    `<div class="home-links"><button class="btn" data-act="hTeams">${ICON.team}<span>Echipa Colegiului</span></button><button class="btn" data-act="tab" data-k="classes">${ICON.classes}<span>Clase și elevi</span></button><button class="btn" data-act="tab" data-k="set">${ICON.set}<span>Setări</span></button></div>`;
}

export default {
  key: 'home', title: 'Home', render: renderHome,
  actions: {
    openCls(el) { openClass(el.dataset.id); render(); window.scrollTo(0, 0); },
    // „Echipa Colegiului”: alegi echipa, apoi se deschide foaia ei (PDF, Excel, Print)
    hTeams() {
      openModal(`<h3>Echipa Colegiului</h3><div class="small muted" style="margin-bottom:10px">Alege echipa.</div>
        <div class="team-btns">${S.teams.map(t => `<button class="btn" data-act="hTeam" data-id="${t.id}">${ICON.team}<span class="grow">${esc(t.name)}</span><span class="muted small">${(n => n === 1 ? '1 elev' : n + ' elevi')(teamStudents(t).length)}</span></button>`).join('')
          || '<div class="muted">Nu ai nicio echipă. Adaug-o din Setări → Echipele școlii.</div>'}</div>
        <div class="row2" style="margin-top:14px"><button class="btn" data-act="close">Închide</button></div>`);
    },
    hTeam(el) { openTeamSheet(S.teams.find(t => t.id === el.dataset.id)); },
  },
};
