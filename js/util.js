// Mici unelte folosite peste tot: formatări, date calendaristice, ferestre, toast, iconițe.

export const uid = () => Math.random().toString(36).slice(2, 10);
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
export const $ = s => document.querySelector(s);

export const DAYS = ['Duminică', 'Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă'];
const z = n => String(n).padStart(2, '0');
export const iso = d => d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate());
export const fmtD = s => { const [y, m, d] = s.split('-'); return `${d}.${m}.${y}`; };
export const toMin = t => { const [h, m] = String(t || '0:0').split(':').map(Number); return h * 60 + (m || 0); };
export const wday = date => new Date(date + 'T12:00').getDay();
export const pad2 = z;
// comparare fără diacritice și majuscule
export const nrm = s => String(s ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
// numere: acceptă virgulă, afișează cu virgulă
export const num = v => { if (v === '' || v == null) return null; const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? null : n; };
export const fmtN = v => v == null ? '–' : String(Math.round(v * 100) / 100).replace('.', ',');

export function toast(t) {
  const el = $('#toast'); el.textContent = t; el.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 2400);
}
export function openModal(html, wide) { $('#sheet').className = 'sheet' + (wide ? ' wide' : ''); $('#sheet').innerHTML = html; $('#modal').classList.remove('hidden'); }
export function closeModal() { $('#modal').classList.add('hidden'); $('#sheet').innerHTML = ''; }
// confirmare în pagină, cu buton explicit
export function ask(text, yes, label) {
  openModal(`<h3>${esc(text)}</h3><div class="row2" style="margin-top:14px"><button class="btn pri" id="askYes">${esc(label || 'Da, continuă')}</button><button class="btn right" data-act="close">Renunță</button></div>`);
  $('#askYes').onclick = () => { closeModal(); yes(); };
}

const svg = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
export const ICON = {
  att: svg('<rect x="4" y="3" width="16" height="18" rx="2"/><path d="m8 12 3 3 5-6"/>'),
  grades: svg('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  norms: svg('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M10 2h4"/>'),
  tests: svg('<path d="M3 17 9 11l4 4 8-8"/><path d="M15 7h6v6"/>'),
  classes: svg('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 4 6"/>'),
  set: svg('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>'),
  team: svg('<path d="M8 21h8M12 16v5M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4"/>'),
  home: svg('<path d="M3 11 12 3l9 8"/><path d="M5 9.5V21h5v-6h4v6h5V9.5"/>'),
  save: svg('<path d="M5 3h11l4 4v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M8 3v5h7V3M8 21v-7h8v7"/>'),
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5 9-10"/></svg>',
};
