// Gäste-Simulation: Anreise, Warten, Zimmer, Möbel benutzen, Einrichtungen besuchen, Ausflug, Abreise, Wertung.
// Reine Logik mit festem Zeitschritt; die Grafik liest nur guests[], vehicle und Ereignisse.
import { BAL, CFG } from '../config.js';
import { ITEM, WISHES, CELL, itemHeight } from './catalog.js';
import { RW, RD, LOBBY, cellCenter, doorCell } from './layout.js';
import { buildGraph, graphPath, occupancy, gridPath, useCells, furnitureCenter } from './path.js';
import { getRoom, allRooms, roomId, parseRoomId, isGuestRoom, heartsFor, wishMet, wishPossible, starsFromHearts, floorPrice, canBuildFloor, roomPrice, placeItem, canPlace } from './hotel.js';

export function rngFrom(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

const STAY_STATES = new Set(['queue', 'use', 'ausflug', 'waitRide', 'idleRoom']);
const SIT_USES = new Set(['schlafen', 'sitzen', 'baden']);

// Pfad ab dem Abschnitt beginnen, auf dem der Gast gerade steht (sonst läuft er beim Umplanen erst zurück)
function trimPath(pts, pos) {
  if (pts.length < 2) return pts;
  let best = 0, bd = 1e9;
  for (let i = 0; i < Math.min(pts.length - 1, 6); i++) {
    const a = pts[i], b = pts[i + 1];
    const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z, l2 = abx * abx + aby * aby + abz * abz || 1e-9;
    const t = Math.max(0, Math.min(1, ((pos.x - a.x) * abx + (pos.y - a.y) * aby + (pos.z - a.z) * abz) / l2));
    const d = Math.hypot(a.x + abx * t - pos.x, a.y + aby * t - pos.y, a.z + abz * t - pos.z);
    if (d < bd - 1e-6) { bd = d; best = i; }
  }
  return pts.slice(best + 1);
}

export class Sim {
  constructor(slot, world, opts = {}) {
    this.slot = slot; this.world = world;
    this.hotel = slot.worlds[world.id];
    this.rng = opts.rng || Math.random;
    this.t = 0; this.guests = []; this.nextId = 1;
    this.nextArrival = BAL.ersteAnreise;
    this.vehicle = { state: 'away', t: 0, drop: [], pick: [] };
    this.listeners = {};
    this.stats = { arrived: 0, departed: 0, happy: 0, stuck: 0, maxStuckT: 0 };
    this.paused = false;
    this.rebuildGraph();
  }
  on(ev, fn) { (this.listeners[ev] ||= []).push(fn); }
  emit(ev, data) { for (const fn of this.listeners[ev] || []) fn(data); }
  rebuildGraph() { this.G = buildGraph(this.hotel.floors.length, this.world.ausflug && this.hotel.ausflug ? this.world.ausflug.punkt : null); }
  get coins() { return this.slot.coins; }
  spend(n) { if (CFG.alles) return true; if (this.slot.coins < n) return false; this.slot.coins -= n; this.emit('coins', { delta: -n }); return true; }
  earn(n, at) { this.slot.coins += n; this.emit('coins', { delta: n, at }); }

  // ---------- Bauen ----------
  buildFloor() {
    const h = this.hotel;
    if (!canBuildFloor(h)) return { ok: false, why: 'sterne' };
    if (!this.spend(floorPrice(h))) return { ok: false, why: 'geld' };
    h.floors.push({ rooms: [{ type: null, furniture: [], wall: null }, { type: null, furniture: [], wall: null }] });
    this.rebuildGraph();
    this.emit('floor', { floor: h.floors.length });
    return { ok: true };
  }
  buildRoom(id, type) {
    const r = getRoom(this.hotel, id); if (!r || r.type) return { ok: false };
    if (!this.spend(roomPrice(type))) return { ok: false, why: 'geld' };
    r.type = type; const { side } = parseRoomId(id);
    const starter = this.world.starter?.[type] || { schlaf: [{ item: 'bedSingle', gx: 0, gz: 0, rot: 0 }], restaurant: [{ item: 'tableRound', gx: 1, gz: 1, rot: 0 }], spa: [{ item: 'bathtub', gx: 0, gz: 0, rot: 0 }], spiel: [{ item: 'toyBox', gx: 0, gz: 0, rot: 0 }, { item: 'rugRound', gx: 1, gz: 1, rot: 0 }] }[type];
    for (const s of starter) { const gx = side === 1 ? RW - s.gx - 2 : s.gx; placeItem(this.hotel, r, side, s.item, Math.max(0, gx), s.gz, s.rot) || placeItem(this.hotel, r, side, s.item, s.gx, s.gz, s.rot); }
    this.emit('room', { id, type });
    return { ok: true };
  }
  buildAusflug() {
    const a = this.world.ausflug; if (!a || this.hotel.ausflug) return { ok: false };
    if (!this.spend(a.preis ?? BAL.ausflugPreis)) return { ok: false, why: 'geld' };
    this.hotel.ausflug = true; this.rebuildGraph(); this.emit('ausflugGebaut', {});
    return { ok: true };
  }

  // ---------- Einrichten (gleiche Wege für UI und Autopilot) ----------
  buy(id, itemId, gx, gz, rot, color = null) {
    const r = getRoom(this.hotel, id); const { side } = parseRoomId(id); const it = ITEM[itemId];
    if (!r || !it || !canPlace(r, side, itemId, gx, gz, rot)) return null;
    if (!this.spend(it.price)) return null;
    const fu = placeItem(this.hotel, r, side, itemId, gx, gz, rot, color);
    this.furnitureChanged(id); this.emit('placed', { id, fu });
    return fu;
  }
  moveItem(id, uid, gx, gz, rot) {
    const r = getRoom(this.hotel, id); const { side } = parseRoomId(id);
    const fu = r?.furniture.find((f) => f.uid === uid); if (!fu) return false;
    if (!canPlace(r, side, fu.item, gx, gz, rot, uid)) return false;
    fu.gx = gx; fu.gz = gz; fu.rot = rot; this.furnitureChanged(id); this.emit('placed', { id, fu });
    return true;
  }
  recolor(id, uid, color) { const fu = getRoom(this.hotel, id)?.furniture.find((f) => f.uid === uid); if (fu) { fu.color = color; this.emit('placed', { id, fu }); } }
  removeItem(id, uid) {
    const r = getRoom(this.hotel, id); const i = r ? r.furniture.findIndex((f) => f.uid === uid) : -1; if (i < 0) return false;
    const [fu] = r.furniture.splice(i, 1);
    if (!CFG.alles) this.earn(ITEM[fu.item].price, null);     // volles Geld zurück – kein Frust beim Umräumen
    this.furnitureChanged(id); this.emit('removed', { id, fu });
    return true;
  }

  // ---------- Gäste ----------
  spawnGuest() {
    const w = this.world, h = this.hotel;
    let def = w.gaeste[Math.floor(this.rng() * w.gaeste.length)];
    const u = w.ueberraschung;
    if (u && h.served >= u.ab && (h.served === u.sicherBei && !this.guests.some((g) => g.species === u.art) || this.rng() < u.chance)) def = u;
    // Wünsche: am Anfang nur einer (schnelle Erfolge), später 1–3, nur erfüllbare
    const pool = def.wuensche.filter((x) => wishPossible(h, x, w.id) && (x !== 'ausflug' || h.ausflug || h.stars >= 1 || CFG.alles));
    const maxN = h.served < 3 ? 1 : h.stars < 2 ? 2 : 3;
    const n = Math.max(1, Math.min(pool.length, 1 + Math.floor(this.rng() * maxN)));
    const wishes = [];
    while (wishes.length < n && pool.length) wishes.push(pool.splice(Math.floor(this.rng() * pool.length), 1)[0]);
    const g = { id: this.nextId++, species: def.art, name: def.name, wishes, state: 'arrive', pos: { ...LOBBY.stop }, dir: 0, path: [], pi: 0,
      anim: 'walk', t: 0, room: null, loc: { kind: 'node', id: 'stop' }, plan: [], stayLeft: 0, didAusflug: false, lastMove: this.t, act: null,
      surprise: def === u, onto: false, react: 0, spawnT: this.t };
    this.guests.push(g);
    this.stats.arrived++;
    if (!this.slot.album[def.art]) { this.slot.album[def.art] = 1; this.emit('album', { species: def.art }); }
    this.emit('arrive', g);
    this.toQueue(g);
    return g;
  }
  queueGuests() { return this.guests.filter((g) => g.state === 'queue' || g.state === 'toQueue').sort((a, b) => a.q - b.q); }
  toQueue(g) {
    const used = new Set(this.guests.filter((o) => o !== g && (o.state === 'queue' || o.state === 'toQueue')).map((o) => o.q));
    let q = 0; while (used.has(q)) q++;
    g.q = Math.min(q, LOBBY.queue.length - 1); g.state = 'toQueue';
    this.walkTo(g, { kind: 'node', id: 'q' + g.q });
  }
  waitingCount() { return this.guests.filter((g) => ['arrive', 'toQueue', 'queue'].includes(g.state)).length + this.vehicle.drop.length; }
  freeGuestRooms() {
    const busy = new Set(this.guests.filter((g) => g.room).map((g) => g.room));
    return allRooms(this.hotel).filter((r) => isGuestRoom(r.room) && !busy.has(r.id));
  }
  // Vorschau beim Zuweisen: wie viele Wünsche das Zimmer erfüllt
  previewHearts(g, id) { const r = getRoom(this.hotel, id); return heartsFor(this.hotel, g, r).hearts; }
  assign(gid, id) {
    const g = this.guests.find((x) => x.id === gid);
    const r = getRoom(this.hotel, id);
    if (!g || !(g.state === 'queue' || g.state === 'toQueue')) return { ok: false, why: 'gast' };
    if (!r || !r.type) return { ok: false, why: 'leer' };
    if (r.type !== 'schlaf') return { ok: false, why: 'typ' };
    if (!isGuestRoom(r)) return { ok: false, why: 'bett' };
    if (this.guests.some((o) => o.room === id)) return { ok: false, why: 'belegt' };
    g.room = id; g.state = 'toRoom'; g.q = -1;
    g.stayLeft = BAL.aufenthalt[0] + this.rng() * (BAL.aufenthalt[1] - BAL.aufenthalt[0]);
    g.plan = this.makePlan(g);
    const { side } = parseRoomId(id); const dc = doorCell(side);
    this.walkTo(g, { kind: 'room', id, cell: dc });
    this.emit('checkin', g);
    this.compactQueue();
    return { ok: true };
  }
  compactQueue() {
    const q = this.guests.filter((g) => g.state === 'queue' || g.state === 'toQueue').sort((a, b) => a.q - b.q);
    q.forEach((g, i) => { if (g.q !== i) { g.q = i; g.state = 'toQueue'; this.walkTo(g, { kind: 'node', id: 'q' + i }); } });
  }
  // Aktivitäten-Plan für den Aufenthalt
  makePlan(g) {
    const h = this.hotel, plan = [];
    const own = getRoom(h, g.room);
    // Einrichtungen für Hotel-Wünsche
    for (const w of g.wishes) {
      const W = WISHES[w];
      if (W.wo === 'hotel') {
        const cand = allRooms(h).filter((r) => r.room.type && r.room.furniture.some((f) => ITEM[f.item].tags.includes(W.need)));
        cand.sort((a, b) => (a.id === g.room ? -1 : 0) - (b.id === g.room ? -1 : 0));
        if (cand.length) { const r = cand[0]; const fi = r.room.furniture.findIndex((f) => ITEM[f.item].tags.includes(W.need)); plan.push({ room: r.id, uid: r.room.furniture[fi].uid }); }
      }
      if (W.wo === 'ausflug' && h.ausflug) plan.push({ ausflug: true });
    }
    if (!plan.some((p) => p.ausflug) && h.ausflug && this.rng() < 0.3) plan.push({ ausflug: true });
    // eigenes Zimmer: benutzbare Möbel (Bett zuletzt = schlafen)
    const uses = own.furniture.filter((f) => ITEM[f.item].use && ITEM[f.item].use !== 'schlafen');
    for (const f of uses.slice(0, 2)) plan.push({ room: g.room, uid: f.uid });
    // gemischt, Bett am Ende
    for (let i = plan.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [plan[i], plan[j]] = [plan[j], plan[i]]; }
    const bed = own.furniture.find((f) => ITEM[f.item].use === 'schlafen');
    if (bed) plan.push({ room: g.room, uid: bed.uid, long: true });
    return plan;
  }

  // ---------- Wege ----------
  // Zielarten: {kind:'node', id}, {kind:'room', id, cell:[gx,gz], onto?:uid}
  roomGeom(id) { const { floor, side } = parseRoomId(id); return { floor, side, room: getRoom(this.hotel, id) }; }
  pointsInRoom(id, cells) { const { floor, side } = this.roomGeom(id); return cells.map((c) => ({ ...cellCenter(floor, side, c[0], c[1]) })); }
  routeTo(g, target) {
    const pts = [];
    let from = g.loc;
    // 1) aus dem Zimmer zur Tür (falls Ziel woanders)
    if (from.kind === 'room' && !(target.kind === 'room' && target.id === from.id)) {
      const { side, room } = this.roomGeom(from.id);
      const occ = occupancy(room); const dc = doorCell(side);
      const p = gridPath(occ, from.cell, dc) || [from.cell, dc];
      pts.push(...this.pointsInRoom(from.id, p));
      const { floor } = this.roomGeom(from.id);
      from = { kind: 'node', id: 'door' + floor + (side ? 'B' : 'A') };
    }
    // 2) Gebäude-Graph
    if (from.kind === 'node') {
      let goalNode = target.kind === 'node' ? target.id : (() => { const { floor, side } = this.roomGeom(target.id); return 'door' + floor + (side ? 'B' : 'A'); })();
      const gp = graphPath(this.G, from.id, goalNode);
      if (!gp) return null;
      for (const n of gp) pts.push({ ...this.G.N[n], lift: n.startsWith('lift') });
      if (target.kind === 'room') {
        const { side, room } = this.roomGeom(target.id);
        const occ = occupancy(room); const dc = doorCell(side);
        const p = gridPath(occ, dc, target.cell) || [dc];
        pts.push(...this.pointsInRoom(target.id, p));
      }
    } else if (from.kind === 'room') {
      // gleiches Zimmer
      const { room } = this.roomGeom(from.id);
      const p = gridPath(occupancy(room), from.cell, target.cell);
      if (!p) return null;
      pts.push(...this.pointsInRoom(from.id, p));
    }
    return pts;
  }
  walkTo(g, target, onto = null) {
    let pts = this.routeTo(g, target);
    if (!pts) { pts = [{ ...g.pos }]; }
    if (g.onto) { g.onto = false; }   // vom Möbel herunter (Grafik: Hüpfer)
    if (onto) pts.push({ ...onto, onto: true });
    g.path = trimPath(pts, g.pos); g.pi = 0; g.target = target; g.anim = 'walk'; g.lastMove = this.t;
  }
  // ---------- Takt ----------
  step(dt) {
    if (this.paused) return;
    this.t += dt;
    this.stepVehicle(dt);
    this.nextArrival -= dt;
    if (this.nextArrival <= 0 && this.vehicle.state === 'away') {
      if (this.waitingCount() < BAL.maxWartend) this.callVehicle(true);
      this.nextArrival = BAL.anreiseAbstand[0] + this.rng() * (BAL.anreiseAbstand[1] - BAL.anreiseAbstand[0]);
    }
    for (const g of [...this.guests]) this.stepGuest(g, dt);
  }
  callVehicle(withGuest) {
    if (this.vehicle.state !== 'away') return;
    this.vehicle.state = 'in'; this.vehicle.t = 0; this.vehicle.drop = withGuest ? [1] : [];
    if (withGuest && this.freeGuestRooms().length >= 3 && this.waitingCount() + 2 <= BAL.maxWartend && this.rng() < 0.35) this.vehicle.drop.push(1);
    this.emit('vehicle', { state: 'in' });
  }
  stepVehicle(dt) {
    const v = this.vehicle; v.t += dt;
    const T_IN = 3.2, T_WAIT = 2.4, T_OUT = 3.2;
    if (v.state === 'in' && v.t >= T_IN) { v.state = 'wait'; v.t = 0; for (const _ of v.drop) this.spawnGuest(); v.drop = []; this.emit('vehicle', { state: 'wait' }); }
    else if (v.state === 'wait') {
      for (const g of this.guests.filter((x) => x.state === 'waitRide')) this.removeGuest(g);
      if (v.t >= T_WAIT) { v.state = 'out'; v.t = 0; this.emit('vehicle', { state: 'out' }); }
    } else if (v.state === 'out' && v.t >= T_OUT) { v.state = 'away'; v.t = 0; }
    else if (v.state === 'away' && this.guests.some((g) => g.state === 'waitRide' && this.t - g.t0 > 1.2)) this.callVehicle(false);
  }
  removeGuest(g) { this.guests.splice(this.guests.indexOf(g), 1); this.stats.departed++; this.emit('depart', g); }
  speed(g, seg) {
    const f = (this.world.physik?.laufFaktor || 1);
    return seg.lift ? BAL.liftTempo : BAL.laufTempo * f;
  }
  move(g, dt) {
    // läuft den Pfad ab; true = angekommen
    let rest = dt;
    while (rest > 0 && g.pi < g.path.length) {
      const p = g.path[g.pi];
      const dx = p.x - g.pos.x, dy = p.y - g.pos.y, dz = p.z - g.pos.z;
      const d = Math.hypot(dx, dy, dz);
      const v = this.speed(g, p.lift && Math.abs(dy) > 0.01 ? p : {});
      g.inLift = Math.abs(dy) > 0.01 && p.lift;
      if (d < 1e-4) { g.pi++; continue; }
      if (Math.hypot(dx, dz) > 0.02) g.dir = Math.atan2(dx, dz);
      const s = v * rest;
      if (s >= d) { g.pos.x = p.x; g.pos.y = p.y; g.pos.z = p.z; rest -= d / v; g.pi++; if (p.onto) g.onto = true; }
      else { g.pos.x += dx / d * s; g.pos.y += dy / d * s; g.pos.z += dz / d * s; rest = 0; }
      g.lastMove = this.t;
    }
    if (g.pi >= g.path.length) { g.inLift = false; return true; }
    return false;
  }
  setLocAfterWalk(g) {
    const t = g.target; if (!t) return;
    g.loc = t.kind === 'room' ? { kind: 'room', id: t.id, cell: t.cell } : { kind: 'node', id: t.id };
  }
  stepGuest(g, dt) {
    g.t += dt; if (g.react > 0) g.react -= dt;
    const moving = !STAY_STATES.has(g.state);
    if (moving) {
      const arrived = this.move(g, dt);
      if (this.t - g.lastMove > 8) { g.stuck = true; }
      if (!arrived) return;
      this.setLocAfterWalk(g);
    }
    switch (g.state) {
      case 'toQueue': g.state = 'queue'; g.anim = 'idle'; g.dir = Math.PI; g.t = 0; g.dir = g.q === 0 ? Math.PI : Math.PI * 0.62; break;
      case 'queue': g.anim = g.t % 9 < 1.2 ? 'gesture-positive' : 'idle'; break;   // fröhlich warten, ab und zu winken
      case 'toRoom': g.state = 'idleRoom'; g.t = 0; g.anim = 'idle'; this.emit('inRoom', g); break;
      case 'idleRoom': if (g.t > (g.plan.length ? 0.6 : 2.5)) this.nextActivity(g); break;
      case 'toUse': g.state = 'use'; g.t = 0; g.anim = g.act.anim; if (g.act.face !== undefined) g.dir = g.act.face; break;
      case 'use':
        if (g.t >= g.act.dur) { this.nextActivity(g); } break;
      case 'toAusflug': g.state = 'ausflug'; g.t = 0; g.anim = 'walk'; this.emit('ausflugStart', g); break;
      case 'ausflug': if (g.t >= BAL.ausflugDauer) { g.didAusflug = true; g.state = 'back'; this.emit('ausflugEnde', g); this.goHomeRoom(g); } break;
      case 'back': g.state = 'idleRoom'; g.t = 0; break;
      case 'checkout': g.state = 'waitRide'; g.t0 = this.t; g.anim = 'idle'; break;
    }
    if (g.room && ['use', 'idleRoom'].includes(g.state)) g.stayLeft -= dt;
    if (g.state === 'waitRide' && this.t - g.t0 > 30) this.removeGuest(g);   // Sicherheitsnetz
  }
  goHomeRoom(g) {
    const { side, room } = this.roomGeom(g.room);
    const occ = occupancy(room); const dc = doorCell(side);
    let cell = dc;
    const free = []; for (let z = 0; z < RD; z++) for (let x = 0; x < RW; x++) if (occ[z * RW + x] < 0) free.push([x, z]);
    if (free.length) cell = free[Math.floor(this.rng() * free.length)];
    if (!gridPath(occ, dc, cell)) cell = dc;
    this.walkTo(g, { kind: 'room', id: g.room, cell });
  }
  nextActivity(g) {
    if (g.stayLeft <= 0 && !(g.act && g.act.long && g.state === 'use' && g.t < g.act.dur)) return this.checkout(g);
    const a = g.plan.shift();
    if (!a) {
      // nichts mehr geplant: im Zimmer bummeln bis zur Abreise
      if (g.stayLeft <= 0) return this.checkout(g);
      g.state = 'toRoomWander'; this.goHomeRoom(g); g.state = 'back'; g.act = null; return;
    }
    if (a.ausflug) {
      if (!this.hotel.ausflug) return this.nextActivity(g);
      g.state = 'toAusflug'; this.walkTo(g, { kind: 'node', id: 'ausflug' }); return;
    }
    const { floor, side, room } = this.roomGeom(a.room);
    const fu = room?.furniture.find((f) => f.uid === a.uid);
    if (!fu) return this.nextActivity(g);
    const it = ITEM[fu.item];
    const occ = occupancy(room);
    const dc = doorCell(side);
    const cells = useCells(fu, occ).filter((c) => gridPath(occ, dc, c));
    if (!cells.length) return this.nextActivity(g);    // nicht erreichbar → überspringen (nie festhängen)
    const cell = cells[0];
    const anim = { schlafen: 'idle', sitzen: 'idle', baden: 'idle', essen: 'eat', tanzen: 'dance', spielen: 'gesture-positive' }[it.use] || 'idle';
    let onto = null, face;
    const c = furnitureCenter(floor, side, fu);
    if (SIT_USES.has(it.use)) onto = { x: c.x, y: c.y + Math.min(0.62, itemHeight(fu.item) * 0.62), z: c.z };
    else { const p = cellCenter(floor, side, cell[0], cell[1]); face = Math.atan2(c.x - p.x, c.z - p.z); }
    g.act = { uid: fu.uid, room: a.room, anim, dur: a.long ? Math.max(BAL.besuchDauer * 2, 10) : BAL.besuchDauer, face, use: it.use, long: a.long, item: fu.item };
    g.state = 'toUse';
    this.walkTo(g, { kind: 'room', id: a.room, cell }, onto);
  }
  checkout(g) {
    const room = getRoom(this.hotel, g.room);
    const { hearts, met } = heartsFor(this.hotel, g, room);
    const coins = BAL.grundMuenzen + BAL.muenzenJeHerz * hearts;
    const h = this.hotel;
    h.hearts += hearts; h.served++;
    if (hearts >= 3) { h.happy++; this.stats.happy++; }
    const st = starsFromHearts(h.hearts);
    const pos = { ...g.pos };
    this.earn(coins, pos);
    this.emit('rating', { guest: g, hearts, coins, met, pos });
    if (st > h.stars) { h.stars = st; this.emit('star', { stars: st }); }
    g.room = null; g.state = 'checkout'; g.act = null; g.plan = [];
    this.walkTo(g, { kind: 'node', id: 'stop' });
  }
  // Möbel im Zimmer geändert (Einrichten): Gäste dort sauber vom Möbel holen und neu planen lassen
  furnitureChanged(id) {
    for (const g of this.guests) {
      const inRoom = g.loc.kind === 'room' && g.loc.id === id;
      if (!(inRoom || g.act?.room === id) || !['use', 'toUse', 'idleRoom', 'back'].includes(g.state)) continue;
      if (g.state === 'toUse' && g.act?.room !== id) continue;
      if (inRoom) { const { floor, side } = this.roomGeom(id); const c = cellCenter(floor, side, g.loc.cell[0], g.loc.cell[1]); g.pos = { ...c }; }
      g.onto = false; g.path = []; g.pi = 0; g.state = 'idleRoom'; g.t = 0; g.act = null; g.anim = 'idle'; g.lastMove = this.t;
    }
  }
  // Tippen auf einen Gast: kleine Reaktion (Grafik/Ton hören auf das Ereignis)
  poke(gid) { const g = this.guests.find((x) => x.id === gid); if (!g) return; g.react = 1.2; g.reactKind = this.rng() < 0.8 ? 'dance' : 'gesture-negative'; this.emit('poke', g); }
  // Sicherheits-Check (Tests): hängt jemand fest?
  stuckGuests() { return this.guests.filter((g) => g.stuck || (!STAY_STATES.has(g.state) && this.t - g.lastMove > 8) || (g.state === 'use' && g.t > 90) || (g.state === 'ausflug' && g.t > BAL.ausflugDauer + 20)); }
}
export { roomId, getRoom, allRooms, floorPrice, canPlace };
