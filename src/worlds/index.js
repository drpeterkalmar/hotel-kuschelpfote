// Welten-Verzeichnis. Neue Welt: Datei src/worlds/<id>.js anlegen und hier eintragen (siehe README).
import blumenwiese from './blumenwiese.js';
import mond from './mond.js';
import { CFG } from '../config.js';

export const WORLDS = { blumenwiese, mond };
export const WORLD_LIST = [blumenwiese, mond];
// Kacheln fürs Album: kommende Welten (Teil 2) mit Vorschau-Farben
export const SOON = [
  { id: 'ski', name: 'Ski-Resort', icon: '⛷️', farben: ['#dff3ff', '#9cc9ef', '#ffffff'] },
  { id: 'beach', name: 'Beach-Resort', icon: '🏖️', farben: ['#ffe9b8', '#7fd8e6', '#ffd27a'] },
  { id: 'unterwasser', name: 'Unterwasserhotel', icon: '🐠', farben: ['#1f6fa8', '#5fc7d9', '#b8f0e8'] },
  { id: 'schiff', name: 'Kreuzfahrtschiff', icon: '🛳️', farben: ['#ffffff', '#6fb6e8', '#f27a7a'] },
];
export const ALL_SPECIES = ['bunny', 'chick', 'cow', 'pig', 'bee', 'panda', 'cat', 'dog', 'penguin', 'beaver', 'caterpillar', 'crab',
  'deer', 'elephant', 'fish', 'fox', 'giraffe', 'hog', 'koala', 'lion', 'monkey', 'parrot', 'polar', 'tiger'];
export const SPECIES_NAME = { bunny: 'Hase', chick: 'Küken', cow: 'Kuh', pig: 'Schwein', bee: 'Biene', panda: 'Panda', cat: 'Katze',
  dog: 'Hund', penguin: 'Pinguin', beaver: 'Biber', caterpillar: 'Raupe', crab: 'Krabbe', deer: 'Hirsch', elephant: 'Elefant', fish: 'Fisch',
  fox: 'Fuchs', giraffe: 'Giraffe', hog: 'Wildschwein', koala: 'Koala', lion: 'Löwe', monkey: 'Affe', parrot: 'Papagei', polar: 'Eisbär', tiger: 'Tiger' };

export function worldUnlocked(slot, w) {
  if (CFG.alles || !w.frei.welt) return true;
  const h = slot.worlds[w.frei.welt];
  return !!h && h.stars >= w.frei.sterne;
}
