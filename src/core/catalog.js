// Möbel-Katalog, Zimmer-Typen und Wünsche – reine Daten, von Kern, UI und Autopilot gelesen.
import { SIZES } from './sizes.js';

export const CELL = 0.8;          // Rastergröße (m)
export const FS = 2.0;            // Maßstab Kenney-Möbel → Meter

// Pastell-Farben zum Umfärben (Stoffe: Bettdecken, Polster, Teppiche)
export const PALETTE = ['#f4a7b9', '#9fd3f2', '#a9e3b4', '#ffd98a', '#c8b6f2', '#ffb48f', '#f6efe3', '#8fd6d0'];

// tags: wofür ein Möbel zählt (Wünsche), use: was ein Gast daran tut (Animation), layer 'boden' = Teppich (darf überdeckt werden)
// stars: ab so vielen Hotel-Sternen kaufbar; welt: nur in dieser Welt im Katalog (sonst überall)
const I = (id, name, icon, cat, price, tags, use, extra = {}) => ({ id, name, icon, cat, price, tags, use, model: extra.model || id, bundle: extra.bundle || 'moebel', stars: 0, ...extra });
export const ITEMS = [
  I('bedSingle', 'Bett', '🛏️', 'schlafen', 12, ['bett'], 'schlafen'),
  I('bedDouble', 'Großes Bett', '🛏️', 'schlafen', 22, ['bett', 'weich'], 'schlafen', { stars: 1 }),
  I('bedBunk', 'Stockbett', '🛏️', 'schlafen', 26, ['bett', 'spiel'], 'schlafen', { stars: 2 }),
  I('capsuleBed', 'Kapselbett', '🛏️', 'schlafen', 18, ['bett', 'weich', 'mond'], 'schlafen', { welt: 'mond' }),
  I('cabinetBed', 'Nachttisch', '🗄️', 'schlafen', 6, ['tisch'], null),
  I('loungeSofa', 'Sofa', '🛋️', 'sitzen', 16, ['sofa'], 'sitzen'),
  I('loungeChair', 'Sessel', '💺', 'sitzen', 9, ['sofa'], 'sitzen'),
  I('loungeChairRelax', 'Kuschelsessel', '💺', 'sitzen', 14, ['sofa', 'weich'], 'sitzen', { stars: 1 }),
  I('loungeDesignSofa', 'Blaues Sofa', '🛋️', 'sitzen', 18, ['sofa'], 'sitzen', { stars: 2 }),
  I('spaceSofa', 'Sternen-Sofa', '🛋️', 'sitzen', 16, ['sofa', 'mond'], 'sitzen', { welt: 'mond' }),
  I('chairCushion', 'Stuhl', '🪑', 'sitzen', 5, ['stuhl'], 'sitzen'),
  I('benchCushion', 'Bank', '🪑', 'sitzen', 8, ['stuhl'], 'sitzen'),
  I('tableRound', 'Runder Tisch', '🍽️', 'tische', 10, ['tisch'], 'essen'),
  I('tableCoffee', 'Couchtisch', '☕', 'tische', 8, ['tisch'], null),
  I('table', 'Tisch', '🍽️', 'tische', 9, ['tisch'], 'essen'),
  I('cakeTable', 'Kuchentisch', '🍰', 'essen', 20, ['kuchen', 'essen'], 'essen'),
  I('sundaeTable', 'Eis & Muffins', '🍨', 'essen', 22, ['kuchen', 'essen'], 'essen', { stars: 1 }),
  I('fruitBuffet', 'Obst-Buffet', '🍉', 'essen', 16, ['essen', 'obst'], 'essen'),
  I('carrotTable', 'Karotten-Tisch', '🥕', 'essen', 14, ['essen', 'karotte'], 'essen'),
  I('fishTable', 'Fisch-Buffet', '🐟', 'essen', 18, ['essen', 'fisch'], 'essen', { stars: 1 }),
  I('honeyTable', 'Honigtopf', '🍯', 'essen', 12, ['essen', 'honig'], 'essen'),
  I('coffeeBar', 'Kakao-Bar', '☕', 'essen', 15, ['essen'], 'essen'),
  I('kitchenStove', 'Herd', '🍳', 'essen', 14, ['kueche'], null),
  I('kitchenFridge', 'Kühlschrank', '🧊', 'essen', 14, ['kueche'], null),
  I('bathtub', 'Badewanne', '🛁', 'bad', 24, ['bad'], 'baden'),
  I('shower', 'Dusche', '🚿', 'bad', 18, ['bad'], 'baden'),
  I('bathroomSink', 'Waschbecken', '🚰', 'bad', 8, ['waschen'], null),
  I('toilet', 'Klo', '🚽', 'bad', 8, ['klo'], null),
  I('pottedPlant', 'Topfpflanze', '🪴', 'deko', 6, ['pflanze', 'blumen'], null),
  I('flowerPot', 'Rote Blume', '🌺', 'deko', 6, ['blumen'], null),
  I('flowerPotY', 'Gelbe Blume', '🌼', 'deko', 6, ['blumen'], null),
  I('bambooPot', 'Bambus', '🎋', 'deko', 12, ['pflanze', 'bambus'], null, { stars: 1 }),
  I('rugRound', 'Runder Teppich', '⭕', 'deko', 7, ['teppich'], null, { layer: 'boden' }),
  I('rugRectangle', 'Teppich', '🟥', 'deko', 9, ['teppich'], null, { layer: 'boden' }),
  I('rugSquare', 'Viereck-Teppich', '🟧', 'deko', 7, ['teppich'], null, { layer: 'boden' }),
  I('lampRoundFloor', 'Stehlampe', '💡', 'deko', 7, ['licht'], null),
  I('lampSquareFloor', 'Eckige Lampe', '💡', 'deko', 7, ['licht'], null, { stars: 1 }),
  I('crystalLamp', 'Kristall-Lampe', '💎', 'deko', 10, ['licht', 'mond'], null, { welt: 'mond' }),
  I('bookcaseOpen', 'Bücherregal', '📚', 'deko', 10, ['buecher'], null),
  I('tv', 'Fernseher', '📺', 'spiel', 20, ['tv', 'musik'], 'tanzen'),
  I('radio', 'Radio', '📻', 'spiel', 9, ['musik'], 'tanzen'),
  I('speaker', 'Lautsprecher', '🔊', 'spiel', 12, ['musik'], 'tanzen', { stars: 2 }),
  I('bear', 'Teddy', '🧸', 'spiel', 8, ['spielzeug'], 'spielen'),
  I('toyBox', 'Spielkiste', '📦', 'spiel', 7, ['spielzeug'], 'spielen'),
  I('telescope', 'Teleskop', '🔭', 'spiel', 16, ['sterne', 'mond'], 'spielen', { welt: 'mond' }),
  I('rocketToy', 'Spielrakete', '🚀', 'spiel', 12, ['spielzeug', 'mond'], 'spielen', { welt: 'mond' }),
  I('moonRock', 'Mondstein', '🪨', 'deko', 9, ['mond', 'stein'], null, { welt: 'mond' }),
  I('spaceDesk', 'Raumfahrt-Pult', '🖥️', 'deko', 14, ['mond'], 'spielen', { welt: 'mond' }),
  I('astroStatue', 'Astronauten-Figur', '👩‍🚀', 'deko', 14, ['mond', 'sterne'], null, { welt: 'mond', stars: 1 }),
];
export const ITEM = Object.fromEntries(ITEMS.map((i) => [i.id, i]));
export const CATS = [
  { id: 'schlafen', icon: '🛏️', name: 'Schlafen' }, { id: 'sitzen', icon: '🛋️', name: 'Sitzen' },
  { id: 'tische', icon: '🍽️', name: 'Tische' }, { id: 'essen', icon: '🍰', name: 'Essen' },
  { id: 'bad', icon: '🛁', name: 'Bad' }, { id: 'deko', icon: '🌸', name: 'Deko' }, { id: 'spiel', icon: '🧸', name: 'Spielen' },
];

// Fußabdruck in Rasterzellen (bei rot 1/3 getauscht)
export function footprint(itemId, rot = 0) {
  const it = ITEM[itemId]; const s = SIZES[it.bundle + '/' + it.model];
  const w = Math.max(1, Math.ceil((s[0] * FS - 0.18) / CELL)), d = Math.max(1, Math.ceil((s[2] * FS - 0.18) / CELL));
  return rot % 2 ? [d, w] : [w, d];
}
export function tintable(itemId) { const it = ITEM[itemId]; return !!SIZES[it.bundle + '/' + it.model][3]; }
export function itemHeight(itemId) { const it = ITEM[itemId]; return SIZES[it.bundle + '/' + it.model][1] * FS; }

// Zimmer-Typen: schlaf = Gästezimmer (zuweisbar); die anderen sind Einrichtungen, die Gäste besuchen
export const ROOM_TYPES = {
  schlaf: { name: 'Schlafzimmer', icon: '🛏️', wall: '#ffe3d6', floor: '#e9c49a', hint: 'Hier schlafen deine Gäste.' },
  restaurant: { name: 'Restaurant', icon: '🍰', wall: '#fff1c9', floor: '#d9a877', hint: 'Gäste kommen zum Essen.' },
  spa: { name: 'Bad & Spa', icon: '🛁', wall: '#d8f1f3', floor: '#cfe3ea', hint: 'Baden und entspannen.' },
  spiel: { name: 'Spielzimmer', icon: '🧸', wall: '#e8defa', floor: '#f2cf9b', hint: 'Spielen und tanzen.' },
};
// Startausstattung, wenn ein Zimmer-Typ gebaut wird (damit es sofort benutzbar ist)
export const ROOM_STARTER = {
  schlaf: [{ item: 'bedSingle', gx: 0, gz: 0, rot: 0 }],
  restaurant: [{ item: 'tableRound', gx: 1, gz: 1, rot: 0 }, { item: 'chairCushion', gx: 0, gz: 1, rot: 1 }],
  spa: [{ item: 'bathtub', gx: 0, gz: 0, rot: 0 }],
  spiel: [{ item: 'toyBox', gx: 0, gz: 0, rot: 0 }, { item: 'rugRound', gx: 1, gz: 1, rot: 0 }],
};

// Wünsche (Bild-Icons, keine Lesepflicht). wo: 'zimmer' = im eigenen Zimmer, 'hotel' = irgendwo im Hotel (Einrichtung)
// need: Tag eines Möbels; room: Zimmer-Typ mit diesem Tag; ausflug: Ausflugsort gebaut
export const WISHES = {
  bett: { icon: '🛏️', name: 'Weiches Bett', wo: 'zimmer', need: 'weich' },
  blumen: { icon: '🌸', name: 'Blumen', wo: 'zimmer', need: 'blumen' },
  licht: { icon: '💡', name: 'Gemütliches Licht', wo: 'zimmer', need: 'licht' },
  sofa: { icon: '🛋️', name: 'Sofa', wo: 'zimmer', need: 'sofa' },
  musik: { icon: '🎵', name: 'Musik', wo: 'zimmer', need: 'musik' },
  teppich: { icon: '🧶', name: 'Kuscheliger Teppich', wo: 'zimmer', need: 'teppich' },
  bad: { icon: '🛁', name: 'Baden', wo: 'hotel', need: 'bad', room: 'spa', alsoRoom: true },
  kuchen: { icon: '🍰', name: 'Kuchen', wo: 'hotel', need: 'kuchen', room: 'restaurant' },
  essen: { icon: '🍽️', name: 'Gutes Essen', wo: 'hotel', need: 'essen', room: 'restaurant' },
  karotte: { icon: '🥕', name: 'Karotten', wo: 'hotel', need: 'karotte', room: 'restaurant' },
  fisch: { icon: '🐟', name: 'Fisch', wo: 'hotel', need: 'fisch', room: 'restaurant' },
  honig: { icon: '🍯', name: 'Honig', wo: 'hotel', need: 'honig', room: 'restaurant' },
  bambus: { icon: '🎋', name: 'Bambus', wo: 'zimmer', need: 'bambus' },
  spielen: { icon: '🧸', name: 'Spielen', wo: 'hotel', need: 'spielzeug', room: 'spiel' },
  sterne: { icon: '🔭', name: 'Sterne gucken', wo: 'zimmer', need: 'sterne' },
  mondstein: { icon: '🪨', name: 'Mondstein', wo: 'zimmer', need: 'stein' },
  ausflug: { icon: '🧺', name: 'Ausflug', wo: 'ausflug' },
};
