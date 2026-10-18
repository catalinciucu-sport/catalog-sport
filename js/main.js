// Pornirea aplicației: taburile, redesenarea ecranului și legarea evenimentelor.
// Fiecare ecran (js/views/*.js) exportă {key, title, render, actions, changes, inputs};
// elementele din pagină au data-act="numeAcțiune" (click) sau data-ch="numeSchimbare" (change/input).
import {S, onSave, persistLocal, setState, defaults} from './store.js';
import {ICON, $, closeModal, ask, toast} from './util.js';
import {setRenderer} from './ui.js';
import {queueSync, connect, onRemoteData, syncNowBtn, parseSetup, currentUrl, linked, link, unlink} from './sync.js';
import attendance, {A, initAtt} from './views/attendance.js';
import grades from './views/grades.js';
import norms from './views/norms.js';
import tests from './views/tests.js';
import classes, {onImportFiles} from './views/classes.js';
import settings, {onBackupFile} from './views/settings.js';

// ordinea taburilor din bara de jos
const VIEWS = [attendance, grades, norms, tests, classes, settings];
const byKey = Object.fromEntries(VIEWS.map(v => [v.key, v]));

const ACTIONS = {
  // tabul ales e doar o preferință a acestui dispozitiv: se salvează local, nu se sincronizează
  tab(el) { S.ui.tab = el.dataset.k; persistLocal(); closeModal(); render(); window.scrollTo(0, 0); },
  close: closeModal,
  syncNow: syncNowBtn,
};
const CHANGES = {}, INPUTS = {};
VIEWS.forEach(v => { Object.assign(ACTIONS, v.actions); Object.assign(CHANGES, v.changes); Object.assign(INPUTS, v.inputs); });

function render(keepScroll) {
  const y = window.scrollY;
  if (!byKey[S.ui.tab]) S.ui.tab = 'att';
  $('#tabs').innerHTML = VIEWS.map(v => `<button data-act="tab" data-k="${v.key}" class="${S.ui.tab === v.key ? 'on' : ''}">${ICON[v.key]}<span>${v.title}</span></button>`).join('');
  byKey[S.ui.tab].render();
  if (keepScroll) window.scrollTo(0, y);
}
setRenderer(render);

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
  if (!A.classId || !S.classes.some(c => c.id === A.classId)) initAtt();
  if (!document.querySelector('#modal:not(.hidden)')) render(true);   // nu închide o fereastră deschisă
});

initAtt();
S.ui.tab = 'att';
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
