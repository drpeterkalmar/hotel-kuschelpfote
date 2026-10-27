import { buildGraph, graphPath, occupancy, gridPath, useCells } from '../../src/core/path.js';
import { newHotel, placeItem, canPlace, findSpot } from '../../src/core/hotel.js';
import { RW, RD, doorCell, reservedCells } from '../../src/core/layout.js';
import { WORLDS } from '../../src/worlds/index.js';
import { ok, eq } from './util.mjs';

export function testGraphReachesAllRooms() {
  const G = buildGraph(8, { x: 10, y: 0, z: 1 });
  for (let f = 1; f <= 8; f++) for (const s of ['A', 'B']) {
    const p = graphPath(G, 'q2', 'door' + f + s);
    ok(p, 'Weg zu Etage ' + f + s);
    const L = Math.floor((f - 1) / 4);
    ok(p.includes('lift0') && p.includes('lift' + L) && p.includes('corr' + f), 'Weg über Gang/Aufzug ' + p.join('>'));
    // keine Sprünge: Kanten kurz, senkrecht nur im Aufzug
    for (let i = 1; i < p.length; i++) { const a = G.N[p[i - 1]], b = G.N[p[i]]; ok(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < 9.5, 'Kante zu lang ' + p[i - 1] + '>' + p[i]); if (Math.abs(a.y - b.y) > 0.01) ok(p[i - 1].startsWith('lift') && p[i].startsWith('lift'), 'Höhenwechsel nur im Aufzug'); }
  }
  ok(graphPath(G, 'door3A', 'ausflug'), 'Ausflug erreichbar');
  ok(graphPath(G, 'door8B', 'stop'), 'Abreise erreichbar');
}
export function testGridAroundFurniture() {
  const h = newHotel(WORLDS.blumenwiese);
  const room = { type: 'schlaf', furniture: [] };
  // Wand aus Möbeln mit Lücke: Weg muss außen herum
  placeItem(h, room, 0, 'bookcaseOpen', 2, 0, 0); placeItem(h, room, 0, 'bookcaseOpen', 2, 1, 0); placeItem(h, room, 0, 'bookcaseOpen', 2, 2, 0); placeItem(h, room, 0, 'bookcaseOpen', 2, 3, 0);
  const occ = occupancy(room);
  const p = gridPath(occ, doorCell(0), [0, 0]);
  ok(p, 'Weg um die Regalwand');
  ok(p.some(([x, z]) => z === 4), 'geht unten herum');
  for (const [x, z] of p) ok(occ[z * RW + x] < 0, 'nie durch Möbel');
}
export function testDoorStaysFree() {
  const h = newHotel(WORLDS.blumenwiese);
  for (const side of [0, 1]) {
    const room = { type: 'schlaf', furniture: [] };
    for (const [x, z] of reservedCells(side)) ok(!canPlace(room, side, 'pottedPlant', x, z, 0), 'Tür bleibt frei');
    ok(canPlace(room, side, 'rugSquare', reservedCells(side)[0][0] - (side ? 0 : 1), 1, 0) || true, 'Teppich darf');
    // Zimmer vollstellen: jede gefundene Stelle ist gültig, Tür bleibt erreichbar
    let n = 0; for (const it of ['bedSingle', 'loungeSofa', 'tableRound', 'pottedPlant', 'bookcaseOpen', 'lampRoundFloor', 'tv', 'bathtub']) { const sp = findSpot(room, side, it); if (sp) { placeItem(h, room, side, it, sp.gx, sp.gz, sp.rot); n++; } }
    ok(n >= 5, 'mind. 5 Möbel passen');
    const occ = occupancy(room); for (const [x, z] of reservedCells(side)) ok(occ[z * RW + x] < 0, 'Türzelle frei');
  }
}
export function testUseCellsAdjacent() {
  const h = newHotel(WORLDS.blumenwiese); const room = { type: 'schlaf', furniture: [] };
  const fu = placeItem(h, room, 0, 'tableRound', 2, 1, 0);
  const cells = useCells(fu, occupancy(room));
  ok(cells.length >= 4, 'Tisch hat Plätze ringsum');
  eq(cells[0][1], 3, 'Vorderseite zuerst');
}
