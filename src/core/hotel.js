// Hotel-Zustand (wird gespeichert) + Bau-/Einricht-Aktionen. Reine Logik.
import { BAL, CFG } from '../config.js';
import { ITEM, ITEMS, footprint, ROOM_STARTER, WISHES } from './catalog.js';
import { RW, RD, reservedCells } from './layout.js';

export function newHotel(world) {
  const h = { world: world.id, floors: [], ausflug: false, hearts: 0, stars: 0, served: 0, happy: 0, uid: 1, lobby: [] };
  // Start: Etage 1 mit einem fertigen Schlafzimmer (Bett) und einem leeren Platz → erster Gast sofort möglich
  h.floors.push({ rooms: [makeRoom(h, 'schlaf', world), makeRoom(h, null, world)] });
  return h;
}
function makeRoom(h, type, world) {
  const r = { type, furniture: [], wall: null };
  if (type) for (const s of (world?.starter?.[type] || ROOM_STARTER[type])) r.furniture.push({ uid: h.uid++, item: s.item, gx: s.gx, gz: s.gz, rot: s.rot, color: s.color ?? null });
  return r;
}
export const roomId = (floor, side) => floor + (side ? 'B' : 'A');
export function parseRoomId(id) { return { floor: parseInt(id, 10), side: id.endsWith('B') ? 1 : 0 }; }
export function getRoom(h, id) { const { floor, side } = parseRoomId(id); return h.floors[floor - 1]?.rooms[side] || null; }
export function allRooms(h) {
  const out = [];
  h.floors.forEach((fl, i) => fl.rooms.forEach((r, s) => out.push({ id: roomId(i + 1, s), floor: i + 1, side: s, room: r })));
  return out;
}
export function floorPrice(h) { return BAL.etagePreis[Math.min(BAL.etagePreis.length - 1, h.floors.length - 1)]; }
export function canBuildFloor(h) { return h.floors.length < BAL.maxEtagen && (CFG.alles || h.stars >= starsForFloor(h.floors.length + 1)); }
// Etagen-Freischaltung: Etage 2 sofort, Etage 3 ab 1 Stern, 4 ab 2 … (sanft steigend)
export function starsForFloor(n) { return Math.max(0, n - 2); }
export function roomPrice(type) { return BAL.zimmerPreis[type] || 30; }

export function itemAvailable(h, itemId, worldId) {
  const it = ITEM[itemId]; if (!it) return false;
  if (it.welt && it.welt !== worldId) return false;
  return CFG.alles || h.stars >= it.stars;
}
export function catalogFor(h, worldId) { return ITEMS.filter((it) => !it.welt || it.welt === worldId).map((it) => ({ ...it, locked: !itemAvailable(h, it.id, worldId) })); }

// Platzieren prüfen: im Raster, keine Überlappung (Teppiche nur mit Teppichen), Tür frei
export function canPlace(room, side, itemId, gx, gz, rot, ignoreUid = null) {
  const [fw, fd] = footprint(itemId, rot);
  if (gx < 0 || gz < 0 || gx + fw > RW || gz + fd > RD) return false;
  const boden = ITEM[itemId].layer === 'boden';
  if (!boden) for (const [rx, rz] of reservedCells(side)) if (rx >= gx && rx < gx + fw && rz >= gz && rz < gz + fd) return false;
  for (const fu of room.furniture) {
    if (fu.uid === ignoreUid) continue;
    if ((ITEM[fu.item].layer === 'boden') !== boden) continue;
    const [w2, d2] = footprint(fu.item, fu.rot);
    if (gx < fu.gx + w2 && fu.gx < gx + fw && gz < fu.gz + d2 && fu.gz < gz + fd) return false;
  }
  return true;
}
// erste freie Stelle (Autopilot, „hinstellen per Tipp")
export function findSpot(room, side, itemId, prefer = null) {
  const cands = [];
  for (let rot = 0; rot < 4; rot++) for (let gz = 0; gz < RD; gz++) for (let gx = 0; gx < RW; gx++) {
    if (!canPlace(room, side, itemId, gx, gz, rot)) continue;
    let score = gz * 1.0 + rot * 0.3;                                 // lieber an die Rückwand
    if (prefer) score = Math.hypot(gx - prefer[0], gz - prefer[1]) + rot * 0.2;
    cands.push({ gx, gz, rot, score });
  }
  cands.sort((a, b) => a.score - b.score);
  return cands[0] || null;
}
export function placeItem(h, room, side, itemId, gx, gz, rot, color = null) {
  if (!canPlace(room, side, itemId, gx, gz, rot)) return null;
  const fu = { uid: h.uid++, item: itemId, gx, gz, rot, color };
  room.furniture.push(fu);
  return fu;
}
export function roomHasTag(room, tag) { return room.furniture.some((f) => ITEM[f.item]?.tags.includes(tag)); }
export function roomHasBed(room) { return roomHasTag(room, 'bett'); }
export function isGuestRoom(room) { return room && room.type === 'schlaf' && roomHasBed(room); }

// Wunsch erfüllt? (für Wertung und Vorschau beim Zuweisen)
export function wishMet(h, wishId, room, guest) {
  const w = WISHES[wishId]; if (!w) return false;
  if (w.wo === 'zimmer') return !!room && roomHasTag(room, w.need);
  if (w.wo === 'hotel') return allRooms(h).some((r) => r.room.type && roomHasTag(r.room, w.need));
  if (w.wo === 'ausflug') return guest ? !!guest.didAusflug : h.ausflug;
  return false;
}
// Kann ein Wunsch mit dem, was man kaufen/bauen kann, überhaupt erfüllt werden?
export function wishPossible(h, wishId, worldId) {
  const w = WISHES[wishId]; if (!w) return false;
  if (w.wo === 'ausflug') return true;
  return ITEMS.some((it) => it.tags.includes(w.need) && itemAvailable(h, it.id, worldId));
}
export function heartsFor(h, guest, room) {
  const met = guest.wishes.filter((w) => wishMet(h, w, room, guest)).length;
  let hearts = 2 + 3 * (guest.wishes.length ? met / guest.wishes.length : 1);
  if (room && room.furniture.length >= 5) hearts += 0.5;   // liebevoll eingerichtet
  if (guest.didAusflug) hearts += 1;
  return { hearts: Math.max(1, Math.min(5, Math.round(hearts))), met };
}
export function starsFromHearts(hearts) { return BAL.sterneHerzen.filter((x) => hearts >= x).length; }
