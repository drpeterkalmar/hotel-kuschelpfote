// Wegfindung: (1) Wegpunkt-Graph fürs Gebäude (draußen, Lobby, Aufzug, Flure) mit A*,
// (2) Raster-A* im Zimmer um die Möbel herum. Reine Logik, in Node getestet.
import { CELL, ITEM, footprint } from './catalog.js';
import { RW, RD, LOBBY, liftPoint, landingPoint, doorPoint, doorCell, cellCenter } from './layout.js';

// ---------- Gebäude-Graph ----------
export function buildGraph(floors, ausflugPunkt) {
  const N = {}, E = {};
  const add = (id, p) => { N[id] = p; E[id] = E[id] || []; };
  const link = (a, b) => { E[a].push(b); E[b].push(a); };
  add('stop', LOBBY.stop); add('outDoor', LOBBY.outDoor); add('door', LOBBY.door); add('mid', LOBBY.mid);
  add('frontL', LOBBY.frontL); add('frontR', LOBBY.frontR);
  link('stop', 'outDoor'); link('outDoor', 'door'); link('door', 'mid'); link('stop', 'frontL'); link('frontL', 'frontR'); link('outDoor', 'frontL');
  LOBBY.queue.forEach((q, i) => { add('q' + i, q); link('q' + i, 'mid'); if (i) link('q' + i, 'q' + (i - 1)); });
  for (let f = 0; f <= floors; f++) {
    add('lift' + f, liftPoint(f));
    if (f > 0) {
      link('lift' + f, 'lift' + (f - 1));
      add('land' + f, landingPoint(f)); link('lift' + f, 'land' + f);
      for (const s of [0, 1]) { const id = 'door' + f + (s ? 'B' : 'A'); add(id, doorPoint(f, s)); link(id, 'land' + f); }
    }
  }
  link('lift0', 'mid');
  if (ausflugPunkt) { add('ausflug', ausflugPunkt); link('ausflug', 'frontR'); }
  return { N, E };
}
const d3 = (a, b) => Math.hypot(a.x - b.x, (a.y - b.y) * 1.2, a.z - b.z);
export function graphPath(G, from, to) {
  if (!G.N[from] || !G.N[to]) return null;
  const open = new Set([from]), g = { [from]: 0 }, f = { [from]: d3(G.N[from], G.N[to]) }, came = {};
  while (open.size) {
    let cur = null; for (const n of open) if (cur === null || f[n] < f[cur]) cur = n;
    if (cur === to) { const out = [cur]; while (came[out[0]]) out.unshift(came[out[0]]); return out; }
    open.delete(cur);
    for (const nb of G.E[cur]) {
      const t = g[cur] + d3(G.N[cur], G.N[nb]);
      if (g[nb] === undefined || t < g[nb]) { came[nb] = cur; g[nb] = t; f[nb] = t + d3(G.N[nb], G.N[to]); open.add(nb); }
    }
  }
  return null;
}

// ---------- Zimmer-Raster ----------
// belegte Zellen (Teppiche zählen nicht)
export function occupancy(room, w = RW, h = RD) {
  const occ = new Int16Array(w * h).fill(-1);
  (room.furniture || []).forEach((fu, i) => {
    if (ITEM[fu.item]?.layer === 'boden') return;
    const [fw, fd] = footprint(fu.item, fu.rot);
    for (let x = fu.gx; x < fu.gx + fw; x++) for (let z = fu.gz; z < fu.gz + fd; z++) if (x >= 0 && z >= 0 && x < w && z < h) occ[z * w + x] = i;
  });
  return occ;
}
export function gridPath(occ, start, goal, w = RW, h = RD) {
  const key = (x, z) => z * w + x;
  const free = (x, z) => x >= 0 && z >= 0 && x < w && z < h && (occ[key(x, z)] < 0 || (x === goal[0] && z === goal[1]) || (x === start[0] && z === start[1]));
  if (!free(...goal)) return null;
  const open = [[...start]], g = new Map([[key(...start), 0]]), came = new Map();
  const hh = (x, z) => Math.hypot(x - goal[0], z - goal[1]);
  const fs = new Map([[key(...start), hh(...start)]]);
  while (open.length) {
    let bi = 0; for (let i = 1; i < open.length; i++) if (fs.get(key(...open[i])) < fs.get(key(...open[bi]))) bi = i;
    const [cx, cz] = open.splice(bi, 1)[0];
    if (cx === goal[0] && cz === goal[1]) { const out = [[cx, cz]]; let k = key(cx, cz); while (came.has(k)) { k = came.get(k); out.unshift([k % w, Math.floor(k / w)]); } return out; }
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      if (!dx && !dz) continue;
      const nx = cx + dx, nz = cz + dz;
      if (!free(nx, nz)) continue;
      if (dx && dz && (!free(cx + dx, cz) || !free(cx, cz + dz))) continue;   // keine Ecken schneiden
      const t = g.get(key(cx, cz)) + (dx && dz ? 1.414 : 1);
      if (!g.has(key(nx, nz)) || t < g.get(key(nx, nz))) { g.set(key(nx, nz), t); fs.set(key(nx, nz), t + hh(nx, nz)); came.set(key(nx, nz), key(cx, cz)); if (!open.some((o) => o[0] === nx && o[1] === nz)) open.push([nx, nz]); }
    }
  }
  return null;
}
// freie Nachbarzellen eines Möbels (bevorzugt die Vorderseite gemäß Drehung)
export function useCells(fu, occ, w = RW, h = RD) {
  const [fw, fd] = footprint(fu.item, fu.rot);
  const out = [];
  const front = [[0, 1], [1, 0], [0, -1], [-1, 0]][fu.rot % 4];   // rot 0: Vorderseite +z
  const cand = [];
  for (let x = fu.gx - 1; x <= fu.gx + fw; x++) for (let z = fu.gz - 1; z <= fu.gz + fd; z++) {
    const inside = x >= fu.gx && x < fu.gx + fw && z >= fu.gz && z < fu.gz + fd;
    const corner = (x < fu.gx || x >= fu.gx + fw) && (z < fu.gz || z >= fu.gz + fd);
    if (inside || corner || x < 0 || z < 0 || x >= w || z >= h || occ[z * w + x] >= 0) continue;
    const isFront = (front[1] === 1 && z === fu.gz + fd) || (front[1] === -1 && z === fu.gz - 1) || (front[0] === 1 && x === fu.gx + fw) || (front[0] === -1 && x === fu.gx - 1);
    cand.push({ c: [x, z], s: isFront ? 0 : 1 });
  }
  cand.sort((a, b) => a.s - b.s);
  for (const c of cand) out.push(c.c);
  return out;
}
// Mitte eines Möbels in Welt-Koordinaten
export function furnitureCenter(floor, side, fu) {
  const [fw, fd] = footprint(fu.item, fu.rot);
  const a = cellCenter(floor, side, fu.gx, fu.gz);
  return { x: a.x + (fw - 1) * CELL / 2, y: a.y, z: a.z + (fd - 1) * CELL / 2 };
}
export { doorCell };
