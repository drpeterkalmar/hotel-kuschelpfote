// Alle Balancing- und Gefühlswerte an einer Stelle, mit URL-Override für Peter (A/B ohne Neubau).
//   ?geld=500      Startmünzen eines neuen Spielstands
//   ?tempo=3       Spielzeit läuft 3× schneller (Anreise, Aufenthalt, Laufen)
//   ?alles=1       alles freigeschaltet (Welten, Möbel, Etagen) – zum Testen
//   ?schwerkraft=  Mond-Schwerkraft als Bruchteil von g (Standard 1/6 ≈ 0.1667)
//   ?ton=0         Ton aus   ?tutorial=0  Tutorial überspringen   ?welt=mond  direkt in eine Welt
const Q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams('');
export const URLQ = Q;
const num = (k, d) => { const v = Q.get(k); return v !== null && v !== '' && isFinite(+v) ? +v : d; };

export const CFG = {
  startGeld: num('geld', 140),
  tempo: Math.max(0.1, num('tempo', 1)),
  alles: Q.get('alles') === '1',
  schwerkraft: num('schwerkraft', 1 / 6),      // Anteil von g auf dem Mond
  g: 9.81,
  ton: Q.get('ton') !== '0',
  tutorial: Q.get('tutorial') !== '0',
};

export const BAL = {
  // Etagen: Preis der n-ten zusätzlichen Etage (n = 0 → erste neue Etage)
  etagePreis: [50, 140, 260, 420, 620, 880, 1200, 1600],
  maxEtagen: 8,
  zimmerPreis: { schlaf: 25, restaurant: 60, spa: 60, spiel: 50 },
  ausflugPreis: 120,
  // Gäste
  anreiseAbstand: [14, 24],      // Sekunden zwischen zwei Ankünften (Zufall im Bereich)
  ersteAnreise: 3,
  maxWartend: 4,                 // so viele Gäste warten höchstens in der Lobby (dann kommt einfach keiner mehr)
  aufenthalt: [38, 52],          // Sekunden im Zimmer
  laufTempo: 1.6,                // m/s
  liftTempo: 2.2,
  besuchDauer: 6,                // s je Möbel-/Einrichtungsbesuch
  ausflugDauer: 16,
  // Wertung → Münzen
  grundMuenzen: 14,
  muenzenJeHerz: 7,
  // Hotel-Sterne nach gesammelten Herzen
  sterneHerzen: [8, 28, 60, 110, 180],
  weltFrei: { mond: 3 },          // Sterne in der Blumenwiese, um die nächste Welt zu öffnen
  minigameMuenzen: 2,            // je gesammeltem Stein/Blume
};

export function setConfig(o) { Object.assign(CFG, o); }
export function setBal(o) { Object.assign(BAL, o); }
