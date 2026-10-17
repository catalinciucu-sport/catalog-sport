// Fișiere: import de elevi din Excel/CSV/listă lipită și export de tabele (Excel, sau CSV fără internet).
// XLSX vine din biblioteca SheetJS încărcată în index.html.
import {nrm} from './util.js';

/* ---- import ---- */
function gend(v) { v = nrm(v); if (/^(f|fem|fata|fete)/.test(v)) return 'F'; if (/^(m|b|masc|baiat|baieti)/.test(v)) return 'B'; return ''; }

// rânduri de tabel → [{name: clasa, students: [{name, gender}], use: true}]
export function parseSheet(rows, fallback) {
  rows = rows.map(r => (r || []).map(c => c == null ? '' : String(c).trim())).filter(r => r.some(c => c));
  if (!rows.length) return [];
  let hi = -1;
  for (let i = 0; i < Math.min(12, rows.length); i++)
    if (rows[i].some(c => /^(nume|prenume|elev|numele|name|student)/.test(nrm(c)))) { hi = i; break; }
  let nameCols = [], classCol = -1, gCol = -1;
  if (hi >= 0) {
    const H = rows[hi].map(nrm);
    H.forEach((h, i) => { if (/^clas/.test(h)) classCol = i; else if (/^(sex|gen)\b/.test(h)) gCol = i; });
    const full = H.findIndex(h => /nume\s*(si|,|\/)?\s*prenume|numele si prenumele|^elev|^name|^student/.test(h));
    if (full >= 0) nameCols = [full];
    else { const a = H.findIndex(h => /^nume/.test(h)), b = H.findIndex(h => /^prenume/.test(h)); nameCols = [a, b].filter(i => i >= 0); }
  } else {
    // fără antet: coloana cu cele mai multe texte e cea cu numele
    const cols = Math.max(...rows.map(r => r.length)); let best = -1, bs = 0;
    for (let k = 0; k < cols; k++) { let s = 0; rows.forEach(r => { const v = r[k] || ''; if (v.length > 2 && !/^[\d.,\s\/-]+$/.test(v)) s++; }); if (s > bs) { bs = s; best = k; } }
    if (best < 0) return [];
    nameCols = [best];
    for (let k = 0; k < cols; k++) if (k !== best && rows.every(r => !r[k] || /^(m|f|b)$/i.test(r[k]))) { gCol = k; break; }
  }
  const groups = new Map();
  for (const r of rows.slice(hi + 1)) {
    const name = nameCols.map(i => r[i] || '').join(' ').replace(/\s+/g, ' ').trim().replace(/^\d+\s*[.)-]\s*/, '');
    if (!name || /^[\d.,\s]+$/.test(name) || /^total/.test(nrm(name))) continue;
    const cn = (classCol >= 0 && r[classCol]) ? r[classCol] : fallback;
    if (!groups.has(cn)) groups.set(cn, []);
    groups.get(cn).push({name, gender: gCol >= 0 ? gend(r[gCol]) : ''});
  }
  return [...groups].map(([name, students]) => ({name, students, use: true}));
}

export function parseCSV(text) {
  const first = text.split(/\r?\n/)[0] || '';
  const sep = (first.match(/\t/g) || []).length ? '\t' : (first.match(/;/g) || []).length >= (first.match(/,/g) || []).length ? ';' : ',';
  const out = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === sep) { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); out.push(row); row = []; cur = ''; }
    else cur += ch;
  }
  row.push(cur); out.push(row);
  return out;
}

// fișiere alese de utilizator → listă de clase detectate (o foaie = o clasă, sau după coloana „Clasa”)
export async function readClassFiles(files, onError) {
  const found = [];
  for (const f of files) {
    const base = f.name.replace(/\.[^.]+$/, '');
    try {
      if (/\.(csv|txt)$/i.test(f.name)) found.push(...parseSheet(parseCSV(await f.text()), base));
      else if (!window.XLSX) onError('Pentru Excel e nevoie de internet la prima deschidere. Salvează fișierul ca CSV.');
      else {
        const wb = XLSX.read(await f.arrayBuffer(), {type: 'array'});
        const multi = wb.SheetNames.length > 1;
        wb.SheetNames.forEach(sn => {
          const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], {header: 1, raw: false, defval: ''});
          found.push(...parseSheet(rows, multi || !/^(sheet|foaie|foaia)\s*\d*$/i.test(sn) ? sn : base));
        });
      }
    } catch (e) { onError('Nu am putut citi ' + f.name); }
  }
  return found;
}

/* ---- export ---- */
export function saveBlob(b, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
export function download(rows, name, sheet) {
  name = name.replace(/[\\/:*?"<>|]/g, '_');
  if (window.XLSX) {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), (sheet || 'Date').slice(0, 31));
    saveBlob(new Blob([XLSX.write(wb, {type: 'array', bookType: 'xlsx'})]), name + '.xlsx');
  } else {
    const csv = rows.map(r => r.map(v => { v = String(v ?? ''); return /[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(';')).join('\r\n');
    saveBlob(new Blob(['﻿' + csv], {type: 'text/csv'}), name + '.csv');
  }
}
