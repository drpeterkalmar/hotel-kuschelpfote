// Welt 2: Mondhotel – Kuppel-Hotel auf dem Kraterboden, Erde am Sternenhimmel, 1/6 g.
import { CFG } from '../config.js';
export default {
  id: 'mond', name: 'Mondhotel', icon: '🌙', order: 2,
  frei: { welt: 'blumenwiese', sterne: 3 },              // 3 Sterne in der Blumenwiese öffnen den Mond
  gaeste: [
    { art: 'panda', name: 'Panda', wuensche: ['bambus', 'bett', 'essen', 'sterne', 'ausflug'] },
    { art: 'cat', name: 'Katze', wuensche: ['fisch', 'sofa', 'licht', 'sterne', 'ausflug'] },
    { art: 'dog', name: 'Hund', wuensche: ['spielen', 'ausflug', 'essen', 'mondstein'] },
    { art: 'penguin', name: 'Pinguin', wuensche: ['fisch', 'bad', 'musik', 'mondstein', 'ausflug'] },
  ],
  ueberraschung: null,
  fahrzeug: 'mondshuttle',
  // Schwerkraft als Bruchteil von g (?schwerkraft=). Gäste hüpfen in hohen, langsamen Bögen.
  get physik() { return { schwerkraft: CFG.schwerkraft, laufFaktor: 0.85, huepfen: 1, drinnen: 0.35 }; },
  look: {
    himmelOben: '#05061a', himmelUnten: '#1d2148', nebel: '#191c3a', nebelDichte: 0.006,
    sonne: '#fff6e8', sonneStaerke: 2.3, sonneRichtung: [0.6, 0.62, 0.55],
    himmelLicht: '#a9b8ff', bodenLicht: '#5a5560', huelle: 1.05,
    boden: '#a9abb3', bodenRand: '#8d8f99',
    wand: '#f3f5fb', sockel: '#c9d0e2', dach: '#9fb3e8', dachKante: '#ffd27a', akzent: '#ffb35c',
    grading: { lift: [0.03, 0.03, 0.06], waerme: 0.99, saettigung: 1.04, vignette: 0.3 }, bloom: 0.5,
    sterne: true, erde: true,
  },
  starter: { schlaf: [{ item: 'capsuleBed', gx: 0, gz: 0, rot: 0 }] },
  lobbyDeko: [
    { item: 'moonRock', x: -5.0, z: -1.5 }, { item: 'spaceSofa', x: -3.2, z: -1.55 }, { item: 'crystalLamp', x: -1.6, z: -1.5 },
    { item: 'rugRound', x: -3.1, z: -0.5 }, { item: 'telescope', x: 2.2, z: -1.5 }, { item: 'astroStatue', x: 5.1, z: 1.5 },
  ],
  umgebung: 'mond',                                       // src/gfx/env_mond.js
  ausflug: { id: 'mondspaziergang', name: 'Mond-Ausflug', icon: '🚀', preis: 140, punkt: { x: 10.6, y: 0, z: 1.4 },
    text: 'Luftschleuse: Raumanzug an und los über den Mond hüpfen!', modul: 'mondsprung', anzug: true },
  musik: { tonleiter: [0, 2, 4, 7, 9, 11], grundton: 60, tempo: 70, klang: 'glas' },
};
