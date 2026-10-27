// Welt 1: Blumenwiese – Start-Welt mit Tutorial. Nur Daten + Verweise auf Module (Kern liest nur diese Datei).
export default {
  id: 'blumenwiese', name: 'Blumenwiese', icon: '🌼', order: 1,
  frei: { welt: null, sterne: 0 },                       // von Anfang an offen
  gaeste: [
    { art: 'bunny', name: 'Hase', wuensche: ['karotte', 'blumen', 'bett', 'teppich', 'ausflug'] },
    { art: 'chick', name: 'Küken', wuensche: ['blumen', 'musik', 'licht', 'kuchen', 'ausflug'] },
    { art: 'cow', name: 'Kuh', wuensche: ['bett', 'sofa', 'essen', 'blumen', 'ausflug'] },
    { art: 'pig', name: 'Schwein', wuensche: ['bad', 'kuchen', 'sofa', 'essen', 'ausflug'] },
  ],
  ueberraschung: { art: 'bee', name: 'Biene', wuensche: ['honig', 'blumen', 'musik'], ab: 4, chance: 0.15, sicherBei: 6 },
  fahrzeug: 'blumenzug',
  physik: { schwerkraft: 1, laufFaktor: 1, huepfen: 0 },
  look: {
    himmelOben: '#8fcdf2', himmelUnten: '#fff0d8', nebel: '#f3ecdf', nebelDichte: 0.0055,
    sonne: '#ffe8c4', sonneStaerke: 2.1, sonneRichtung: [-0.55, 0.75, 0.62],
    himmelLicht: '#cfe8ff', bodenLicht: '#c9b48a', huelle: 1.25,
    boden: '#9fd77f', bodenRand: '#c3e59a',
    wand: '#fff5ea', sockel: '#f3c6a8', dach: '#f18f8f', dachKante: '#ffd2c2', akzent: '#f6a5b5',
    dachForm: 'giebel', fassade: 'holz',
    grading: { lift: [0.018, 0.012, 0.022], waerme: 1.035, saettigung: 1.13, vignette: 0.2 }, bloom: 0.22,
  },
  lobbyDeko: [
    { item: 'pottedPlant', x: -5.1, z: -1.5 }, { item: 'loungeSofa', x: -3.2, z: -1.55 }, { item: 'flowerPot', x: -1.6, z: -1.6 },
    { item: 'rugRound', x: -3.1, z: -0.5 }, { item: 'flowerPotY', x: 2.2, z: -1.6 }, { item: 'lampRoundFloor', x: 5.15, z: 1.6 },
  ],
  umgebung: 'wiese',                                      // src/gfx/env_wiese.js
  ausflug: { id: 'picknick', name: 'Blumenpicknick', icon: '🧺', preis: 120, punkt: { x: 10.4, y: 0, z: 1.6 },
    text: 'Picknickdecke auf der Wiese: Gäste kommen fröhlicher zurück.', modul: 'picknick' },
  musik: { tonleiter: [0, 2, 4, 7, 9], grundton: 62, tempo: 92, klang: 'spieluhr' },
};
