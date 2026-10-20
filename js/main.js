// Pornirea aplicației: taburile, redesenarea ecranului și legarea evenimentelor.
// Fiecare ecran (js/views/*.js) exportă {key, title, render, actions, changes, inputs};
// elementele din pagină au data-act="numeAcțiune" (click) sau data-ch="numeSchimbare" (change/input).
import {S, onSave, persistLocal, setState, defaults, isDirty, onDraftChange, endDraft, commitDraft, discardDraft, refreshDraft} from './store.js';
import {ICON, $, closeModal, openModal, ask, toast} from './util.js';
import {setRenderer, setSync} from './ui.js';
import {queueSync, connect, onRemoteData, syncNowBtn, parseSetup, currentUrl, linked, link, unlink} from './sync.js';
import home from './views/home.js';
import attendance, {A, initAtt, ensureSess} from './views/attendance.js';
import grades from './views/grades.js';
import norms from './views/norms.js';
import tests from './views/tests.js';
import classes, {onImportFiles} from './views/classes.js';
import settings, {onBackupFile} from './views/settings.js';

// taburile din bara de jos: într-o clasă (între Home și Salvează) și în afara ei
const CLASS_VIEWS = [attendance, grades, norms, tests];
const HOME_VIEWS = [home, classes, settings];
const VIEWS = [...HOME_VIEWS, ...CLASS_VIEWS];
const byKey = Object.fromEntries(VIEWS.map(v => [v.key, v]));
const inClass = () => CLASS_VIEWS.some(v => v.key === S.ui.tab);

function leaveToHome() { endDraft(); S.ui.tab = 'home'; persistLocal(); closeModal(); render(); window.scrollTo(0, 0); }
// „Salvează”: pe Prezență înregistrează și ora (toți prezenți, dacă n-ai debifat pe nimeni), apoi trimite în Google
function saveAll() {
  const made = S.ui.tab === 'att' && ensureSess(), had = isDirty();
  commitDraft();   // salvează local și pornește trimiterea în Google
  toast(made ? 'Ora a fost înregistrată și salvată' : had ? 'Modificările au fost salvate' : 'Nu sunt modificări de salvat');
}

const ACTIONS = {
  // tabul ales e doar o preferință a acestui dispozitiv: se salvează local, nu se sincronizează
  tab(el) { S.ui.tab = el.dataset.k; persistLocal(); closeModal(); render(); window.scrollTo(0, 0); },
  goHome() {
    if (!isDirty()) return leaveToHome();
    openModal(`<h3>Ai modificări nesalvate</h3><div class="small muted">Dacă ieși fără să salvezi, se pierde tot ce ai schimbat de la ultima salvare.</div>
      <div class="row2" style="margin-top:14px"><button class="btn pri" data-act="saveLeave">Salvează și ieși</button><button class="btn bad" data-act="dropLeave">Ieși fără să salvezi</button><button class="btn right" data-act="close">Rămân aici</button></div>`);
  },
  saveLeave() { saveAll(); leaveToHome(); },
  dropLeave() { discardDraft(); leaveToHome(); toast('Modificările au fost anulate'); },
  saveAll() { saveAll(); render(true); },
  close: closeModal,
  syncNow: syncNowBtn,
};
const CHANGES = {}, INPUTS = {};
VIEWS.forEach(v => { Object.assign(ACTIONS, v.actions); Object.assign(CHANGES, v.changes); Object.assign(INPUTS, v.inputs); });

const tabBtn = v => `<button data-act="tab" data-k="${v.key}" class="${S.ui.tab === v.key ? 'on' : ''}">${ICON[v.key]}<span>${v.title}</span></button>`;
function renderTabs() {
  $('#tabs').innerHTML = inClass()
    ? `<button data-act="goHome" class="home">${ICON.home}<span>Home</span></button>${CLASS_VIEWS.map(tabBtn).join('')}<button data-act="saveAll" class="save ${isDirty() ? 'dirty' : ''}">${ICON.save}<span>Salvează</span></button>`
    : HOME_VIEWS.map(tabBtn).join('');
}
function render(keepScroll) {
  const y = window.scrollY;
  if (!byKey[S.ui.tab]) S.ui.tab = 'home';
  if (inClass() && !S.classes.length) S.ui.tab = 'home';
  renderTabs();
  byKey[S.ui.tab].render();
  // într-o clasă, numele ei apare mereu în bara de sus
  const c = inClass() && S.classes.find(x => x.id === A.classId);
  if (c && $('#ttl').textContent !== c.name && !$('#sub').textContent.includes(c.name)) $('#sub').textContent = c.name + ($('#sub').textContent ? ' · ' + $('#sub').textContent : '');
  // înălțimea barei de sus, pentru căsuțele care rămân fixe sub ea (Prezență)
  document.documentElement.style.setProperty('--hh', $('header.top').offsetHeight + 'px');
  if (keepScroll) window.scrollTo(0, y);
}
setRenderer(render);
// butonul Salvează se colorează imediat ce ai schimbat ceva
onDraftChange(() => {
  if (inClass()) renderTabs();
  if (isDirty()) setSync('modificări nesalvate');
  else if ($('#sync').textContent === 'modificări nesalvate') { if (linked()) syncNowBtn(); else setSync('doar pe acest dispozitiv'); }
});
window.addEventListener('beforeunload', e => { if (isDirty()) { e.preventDefault(); e.returnValue = ''; } });

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (el && ACTIONS[el.dataset.act]) ACTIONS[el.dataset.act](el, e);
});
document.addEventListener('change', e => { const f = CHANGES[e.target.dataset.ch]; if (f) f(e.target, e); });
document.addEventListener('input', e => { const f = INPUTS[e.target.dataset.ch]; if (f) f(e.target, e); });
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
$('#fileImp').addEventListener('change', e => { if (e.target.files.length) onImportFiles([...e.target.files]); });
$('#fileBak').addEventListener('change', e => { if (e.target.files[0]) onBackupFile(e.target.files[0]); });

onSave(queueSync);
onRemoteData(() => {
  refreshDraft();
  if (!A.classId || !S.classes.some(c => c.id === A.classId)) initAtt();
  if (!document.querySelector('#modal:not(.hidden)')) render(true);   // nu închide o fereastră deschisă
});

initAtt();
S.ui.tab = 'home';   // la pornire: Home, cu clasa de acum scoasă în evidență
render();
connect();

// deschis dintr-un link de conectare: se conectează la tabelul din link
const setup = parseSetup(location.hash);
if (setup) {
  history.replaceState(null, '', location.pathname);
  if (setup.url !== currentUrl()) {
    const other = linked();
    ask(other ? 'Conectezi aplicația la alt tabel Google? Datele de pe acest dispozitiv se înlocuiesc cu cele din tabelul nou (cele vechi rămân în tabelul lor).'
              : 'Conectezi aplicația la tabelul Google din acest link?', async () => {
      try {
        if (other) { unlink(); setState(defaults()); initAtt(); }
        await link(setup.url, setup.token); render(); toast('Conectat la Google Sheets');
      } catch (e) { toast(e.code === 'cod_gresit' ? 'Linkul nu mai este valabil (cod greșit).' : 'Nu am putut ajunge la tabel. Verifică internetul și deschide linkul din nou.'); }
    }, 'Conectează');
  }
}
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
