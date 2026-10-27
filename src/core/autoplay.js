// Autopilot: spielt das Hotel selbst (Gate-Test „10 Spielminuten ohne Hänger" und __game.autoplay()).
// Nutzt nur dieselben Aktionen wie die Bedienung (assign, buildFloor, buildRoom, buy, buildAusflug).
import { ITEMS, WISHES } from './catalog.js';
import { allRooms, isGuestRoom, floorPrice, canBuildFloor, roomPrice, findSpot, itemAvailable, getRoom, parseRoomId } from './hotel.js';

export class AutoPlayer {
  constructor(sim) { this.sim = sim; this.cool = 0; this.log = []; }
  act(what) { this.log.push({ t: +this.sim.t.toFixed(1), what }); }
  tick(dt) {
    this.cool -= dt; if (this.cool > 0) return; this.cool = 0.7;
    const s = this.sim, h = s.hotel, w = s.world;
    const waiting = s.guests.filter((g) => g.state === 'queue');
    // 1) Gäste zuweisen: Zimmer mit den meisten erfüllten Wünschen
    for (const g of waiting) {
      const free = s.freeGuestRooms(); if (!free.length) break;
      // vorher Wünsche fürs Zimmer kaufen, wenn möglich
      free.sort((a, b) => s.previewHearts(g, b.id) - s.previewHearts(g, a.id));
      const best = free[0];
      this.furnishFor(g, best.id);
      if (s.assign(g.id, best.id).ok) this.act('assign ' + g.species + ' → ' + best.id);
    }
    const rooms = allRooms(h);
    const empty = rooms.filter((r) => !r.room.type);
    const bedrooms = rooms.filter((r) => r.room.type === 'schlaf').length;
    // 2) leeren Platz bebauen
    if (empty.length) {
      const has = (t) => rooms.some((r) => r.room.type === t);
      let type = 'schlaf';
      if (bedrooms >= 2 && !has('restaurant')) type = 'restaurant';
      else if (bedrooms >= 3 && !has('spa')) type = 'spa';
      else if (bedrooms >= 4 && !has('spiel')) type = 'spiel';
      if (s.coins >= roomPrice(type) + 10 && s.buildRoom(empty[0].id, type).ok) { this.act('room ' + empty[0].id + ' ' + type); this.furnishFacility(empty[0].id, type); }
    } else if (canBuildFloor(h) && s.coins >= floorPrice(h) && (waiting.length || s.coins >= floorPrice(h) + 60)) {
      if (s.buildFloor().ok) this.act('floor ' + h.floors.length);
    }
    // 3) Ausflugsort
    if (w.ausflug && !h.ausflug && bedrooms >= 3 && s.coins >= (w.ausflug.preis || 120) + 30 && s.buildAusflug().ok) this.act('ausflug');
  }
  bestItemFor(tag) {
    const s = this.sim;
    return ITEMS.filter((it) => it.tags.includes(tag) && itemAvailable(s.hotel, it.id, s.world.id)).sort((a, b) => a.price - b.price)[0];
  }
  furnishFor(g, id) {
    const s = this.sim; const r = getRoom(s.hotel, id); const { side } = parseRoomId(id);
    for (const wid of g.wishes) {
      const W = WISHES[wid];
      if (W.wo !== 'zimmer' || r.furniture.some((f) => ITEMS.find((i) => i.id === f.item).tags.includes(W.need))) continue;
      const it = this.bestItemFor(W.need); if (!it || s.coins < it.price) continue;
      const spot = findSpot(r, side, it.id); if (!spot) continue;
      if (s.buy(id, it.id, spot.gx, spot.gz, spot.rot)) this.act('buy ' + it.id + ' ' + id);
    }
  }
  furnishFacility(id, type) {
    const s = this.sim; const r = getRoom(s.hotel, id); const { side } = parseRoomId(id);
    const want = { restaurant: ['cakeTable', 'carrotTable', 'fruitBuffet', 'honeyTable', 'fishTable'], spa: ['shower'], spiel: ['tv', 'bear'], schlaf: [] }[type] || [];
    for (const itemId of want) {
      const it = ITEMS.find((i) => i.id === itemId);
      if (!itemAvailable(s.hotel, itemId, s.world.id) || s.coins < it.price) continue;
      const spot = findSpot(r, side, itemId); if (spot && s.buy(id, itemId, spot.gx, spot.gz, spot.rot)) this.act('buy ' + itemId + ' ' + id);
    }
  }
}
