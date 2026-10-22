// Grilele de evaluare MEC (gimnaziu V–VIII, liceu IX–XII), din Norme-control/*.pdf.
// Valorile sunt scrise ca în grilă, de la nota 5 la nota 10; mecNorms() le întoarce în formatul din store.js
// (t/lv cu pragurile de la nota 10 la nota 5). Timpul de rezistență e în minute.secunde (4.50 = 4'50").
// Corecturi față de PDF: VI rezistență fete nota 5 = 3'20" (scris „3,20”); X naveta fete nota 9/10 = 20"8 / 20"6 (scris 19"8 / 19"6).
// Lăsate deoparte la cererea utilizatorului: probele cu o singură valoare și cele fără barem folosit la clasă.

const up = (a, k) => Array.from({length: 6}, (_, i) => Math.round((a + i * k) * 100) / 100);   // 6 valori în progresie

// [id, denumire, unitate, tip, {nivel: [B nota5..10, F nota5..10]}]; lipsă = null
const RAW = [
  ['mec01', 'Flotări', 'rep.', 'high', {
    5: [[4, 6, 8, 10, 12, 14], [2, 3, 4, 5, 6, 7]], 6: [[5, 7, 9, 11, 13, 15], [3, 4, 5, 6, 7, 8]],
    7: [[6, 8, 10, 12, 14, 16], [4, 5, 6, 7, 8, 9]], 8: [[7, 9, 11, 13, 15, 17], [5, 6, 7, 8, 9, 10]]}],
  ['mec02', 'Tracțiuni din atârnat (băieți)', 'rep.', 'high', {
    5: [up(1, 1), null], 6: [up(2, 1), null], 7: [up(3, 1), null], 8: [up(4, 1), null], 9: [up(4, 1), null], 10: [up(5, 1), null]}],
  ['mec03', 'Ridicarea trunchiului din culcat dorsal 30"', 'rep.', 'high', {
    5: [[15, 16, 18, 20, 22, 24], [14, 15, 16, 18, 20, 22]], 6: [[16, 17, 19, 21, 23, 25], [15, 16, 17, 19, 21, 23]],
    7: [[17, 18, 20, 22, 24, 26], [16, 17, 18, 20, 22, 24]], 8: [[18, 19, 21, 23, 25, 27], [17, 18, 19, 21, 23, 25]]}],
  ['mec04', 'Ridicarea picioarelor din culcat dorsal 30"', 'rep.', 'high', {
    5: [[3, 4, 6, 8, 10, 12], [2, 3, 4, 6, 8, 10]], 6: [[4, 5, 7, 9, 11, 13], [3, 4, 5, 7, 9, 11]],
    7: [[5, 6, 8, 10, 12, 14], [4, 5, 6, 8, 10, 12]], 8: [[6, 7, 9, 11, 13, 15], [5, 6, 7, 9, 11, 13]]}],
  ['mec05', 'Ridicarea trunchiului din culcat facial 30"', 'rep.', 'high', {
    5: [[16, 17, 19, 21, 23, 25], [15, 16, 17, 19, 21, 23]], 6: [[17, 18, 20, 22, 24, 26], [16, 17, 18, 20, 22, 24]],
    7: [[18, 19, 21, 23, 25, 27], [17, 18, 19, 21, 23, 25]], 8: [[19, 20, 22, 24, 26, 28], [18, 19, 20, 22, 24, 26]]}],
  ['mec06', 'Ridicarea bazinului din așezat 30"', 'rep.', 'high', {
    5: [[10, 11, 13, 15, 17, 19], [8, 9, 10, 12, 14, 16]], 6: [[11, 12, 14, 16, 18, 20], [9, 10, 11, 13, 15, 17]],
    7: [[12, 13, 15, 17, 19, 21], [10, 11, 12, 14, 16, 18]], 8: [[13, 14, 16, 18, 20, 22], [11, 12, 13, 15, 17, 19]]}],
  ['mec07', 'Săritura în lungime de pe loc', 'cm', 'high', {
    5: [up(150, 5), up(130, 5)], 6: [up(155, 5), up(135, 5)], 7: [up(160, 5), up(140, 5)], 8: [up(165, 5), up(145, 5)]}],
  ['mec08', 'Alergare de viteză 50 m, start de sus', 's', 'low', {
    5: [up(9.0, -0.2), up(9.8, -0.2)], 6: [up(8.8, -0.2), up(9.6, -0.2)], 7: [up(8.6, -0.2), up(9.4, -0.2)], 8: [up(8.4, -0.2), up(9.2, -0.2)]}],
  ['mec09', 'Alergare de rezistență (V–VI: 800 m B / 600 m F; VII–XII: 1000 m B / 800 m F)', 'min', 'low', {
    5: [[4.00, 3.55, 3.50, 3.45, 3.40, 3.35], [3.27, 3.24, 3.21, 3.18, 3.15, 3.12]],
    6: [[3.50, 3.45, 3.40, 3.35, 3.30, 3.25], [3.20, 3.17, 3.14, 3.11, 3.08, 3.05]],
    7: [[4.55, 4.50, 4.45, 4.40, 4.35, 4.30], [4.55, 4.50, 4.45, 4.40, 4.35, 4.30]],
    8: [[4.50, 4.45, 4.40, 4.35, 4.30, 4.25], [4.50, 4.45, 4.40, 4.35, 4.30, 4.25]],
    9: [[4.50, 4.45, 4.40, 4.35, 4.30, 4.25], [4.50, 4.45, 4.40, 4.35, 4.30, 4.25]],
    10: [[4.45, 4.40, 4.35, 4.30, 4.25, 4.20], [4.45, 4.40, 4.35, 4.30, 4.25, 4.20]],
    11: [[4.50, 4.45, 4.40, 4.35, 4.30, 4.25], [4.40, 4.35, 4.30, 4.25, 4.20, 4.15]],
    12: [[4.50, 4.45, 4.40, 4.35, 4.30, 4.25], [4.40, 4.35, 4.30, 4.25, 4.20, 4.15]]}],
  ['mec10', 'Săritura în lungime cu elan', 'm', 'high', {
    5: [up(2.45, 0.05), up(2.30, 0.05)], 6: [up(2.50, 0.05), up(2.40, 0.05)], 7: [up(2.55, 0.05), up(2.45, 0.05)],
    8: [up(2.60, 0.05), up(2.50, 0.05)], 9: [up(2.80, 0.05), up(2.50, 0.05)], 10: [up(2.90, 0.05), up(2.60, 0.05)],
    11: [up(3.00, 0.05), up(2.65, 0.05)], 12: [up(3.00, 0.05), up(2.65, 0.05)]}],
  ['mec11', 'Aruncarea mingii de oină', 'm', 'high', {
    5: [up(18, 1), up(12, 1)], 6: [up(20, 1), up(13, 1)], 7: [up(22, 1), up(14, 1)], 8: [up(24, 1), up(15, 1)]}],
  ['mec12', 'Elemente acrobatice izolate', 'nr.', 'high', {
    5: [up(2, 1), null], 6: [up(2, 1), null], 7: [up(3, 1), null], 8: [up(3, 1), null], 9: [up(3, 1), up(3, 1)]}],
  // gimnaziu: cu procedee izolate se poate lua cel mult nota 8
  ['mec13', 'Procedee tehnice izolate (joc sportiv)', 'nr.', 'high', {
    5: [[1, 2, 3, 4, '', ''], null], 6: [[2, 3, 4, 5, '', ''], null], 7: [[3, 4, 5, 6, '', ''], null],
    8: [[3, 4, 5, 6, '', ''], null], 9: [up(3, 1), up(3, 1)]}],
  ['mec14', 'Flotări cu picioarele sprijinite pe bancă (băieți)', 'rep.', 'high', {9: [[6, 8, 10, 12, 14, 15], null]}],
  ['mec15', 'Flotări cu mâinile sprijinite pe bancă (fete)', 'rep.', 'high', {9: [null, up(5, 1)], 10: [null, up(5, 1)]}],
  ['mec16', 'Ridicarea simultană a trunchiului și picioarelor (băieți)', 'rep.', 'high', {9: [up(3, 1), null]}],
  ['mec17', 'Ridicarea genunchilor la piept din atârnat (fete)', 'rep.', 'high', {9: [null, up(4, 1)]}],
  ['mec18', 'Trei sărituri în lungime de pe loc succesive (băieți)', 'm', 'high', {9: [up(4.5, 0.1), null]}],
  ['mec19', 'Sărituri peste banca de gimnastică (fete)', 'rep.', 'high', {9: [null, [8, 10, 12, 13, 14, 15]]}],
  ['mec20', 'Naveta 5x10 m', 's', 'low', {
    9: [up(20.2, -0.2), up(22.0, -0.2)], 10: [up(20.0, -0.2), [21.5, 21.4, 21.2, 21.0, 20.8, 20.6]],
    11: [up(19.4, -0.2), up(22.0, -0.2)], 12: [up(18.2, -0.2), up(20.0, -0.2)]}],
  ['mec21', 'Alergare de viteză 50 m, start de jos', 's', 'low', {
    9: [up(8.2, -0.2), up(9.2, -0.2)], 10: [up(8.1, -0.2), up(9.1, -0.2)], 11: [up(8.4, -0.2), up(9.0, -0.2)], 12: [up(8.2, -0.2), up(9.0, -0.2)]}],
  ['mec22', 'Flotări cu desprindere de pe sol și lovirea palmelor (băieți)', 'rep.', 'high', {10: [[2, 4, 6, 8, 9, 10], null]}],
  ['mec23', 'Coborârea și ridicarea trunchiului din așezat pe bancă (băieți)', 'rep.', 'high', {10: [[8, 10, 12, 13, 14, 15], null]}],
  ['mec24', 'Ridicarea trunchiului din culcat dorsal cu îngreuiere (fete)', 'rep.', 'high', {10: [null, [6, 8, 9, 10, 11, 12]]}],
  ['mec25', 'Împingeri pe un picior sprijinit pe banca de gimnastică', 'rep.', 'high', {10: [[8, 10, 12, 13, 14, 15], [4, 6, 7, 8, 9, 10]]}],
  ['mec26', 'Sărituri pe verticală din ghemuit în ghemuit', 'rep.', 'high', {
    10: [[4, 6, 7, 8, 9, 10], null], 11: [null, [4, 6, 7, 8, 9, 10]], 12: [null, [6, 7, 8, 9, 10, 12]]}],
  ['mec27', 'Ridicarea genunchilor la piept cu îngreuiere, din atârnat la scara fixă (băieți)', 'rep.', 'high', {
    11: [[5, 7, 9, 10, 11, 12], null], 12: [[6, 8, 10, 12, 13, 14], null]}],
  ['mec28', 'Ridicarea picioarelor întinse din atârnat (fete)', 'rep.', 'high', {
    11: [null, [5, 7, 9, 10, 11, 12]], 12: [null, [6, 8, 10, 12, 13, 14]]}],
  ['mec29', 'Exercițiu la sol', '', 'direct', {}],
  ['mec30', 'Săritură la un aparat de gimnastică', '', 'direct', {}],
  ['mec31', 'Structură tehnico-tactică (joc sportiv)', '', 'direct', {}],
  ['mec32', 'Joc bilateral', '', 'direct', {}],
];

const empty6 = () => ['', '', '', '', '', ''];
const rev = a => a ? [...a].reverse() : empty6();

// normele MEC în formatul aplicației; baremul general = al celui mai mic nivel
export function mecNorms() {
  return RAW.map(([id, name, unit, type, lvs]) => {
    const lv = {};
    for (const k in lvs) lv[k] = {B: rev(lvs[k][0]), F: rev(lvs[k][1])};
    const first = Object.keys(lv).sort((a, b) => a - b)[0];
    const t = first ? JSON.parse(JSON.stringify(lv[first])) : {B: empty6(), F: empty6()};
    return {id, name, unit, type, t, lv};
  });
}
