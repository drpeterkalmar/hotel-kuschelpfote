import { newSlot } from '../../src/core/save.js';
import { Sim, rngFrom } from '../../src/core/sim.js';
import { WORLDS, WORLD_LIST, worldUnlocked } from '../../src/worlds/index.js';
import { heartsFor, starsFromHearts, floorPrice, getRoom, findSpot } from '../../src/core/hotel.js';
import { BAL, CFG } from '../../src/config.js';
import { ok, eq } from './util.mjs';

function run(sim, sec, dt = 0.1, each) { for (let t = 0; t < sec; t += dt) { sim.step(dt); each && each(); } }

export function testWishesDecideHearts() {
  const slot = newSlot('A', 'bunny', WORLD_LIST); const h = slot.worlds.blumenwiese;
  const room = getRoom(h, '1A');
  const g = { wishes: ['blumen'], didAusflug: false };
  eq(heartsFor(h, g, room).hearts, 2, 'ohne Blumen 2 Herzen (nie 0)');
  room.furniture.push({ uid: 99, item: 'flowerPot', gx: 3, gz: 0, rot: 0 });
  eq(heartsFor(h, g, room).hearts, 5, 'mit Blumen 5 Herzen');
  const g2 = { wishes: ['kuchen', 'blumen'], didAusflug: false };
  eq(heartsFor(h, g2, room).hearts, 4, 'halb erfüllt 3,5 → 4');
}
export function testStarsAndPrices() {
  eq(starsFromHearts(0), 0, '0 Herzen'); eq(starsFromHearts(BAL.sterneHerzen[0]), 1, 'erster Stern');
  const slot = newSlot('A', 'bunny', WORLD_LIST); const h = slot.worlds.blumenwiese;
  eq(floorPrice(h), BAL.etagePreis[0], 'erste Etage günstig');
  ok(!worldUnlocked(slot, WORLDS.mond), 'Mond anfangs zu');
  h.stars = 3; ok(worldUnlocked(slot, WORLDS.mond), 'Mond ab 3 Sternen');
}
export function testFirstFiveMinutes() {
  // Neuer Spieler: in den ersten 5 Minuten mind. 3 glückliche Gäste und 1 neue Etage (Autopilot = einfacher Spieler)
  return import('../../src/core/autoplay.js').then(({ AutoPlayer }) => {
    const slot = newSlot('A', 'bunny', WORLD_LIST);
    const sim = new Sim(slot, WORLDS.blumenwiese, { rng: rngFrom(7) }); const ap = new AutoPlayer(sim);
    run(sim, 300, 0.1, () => ap.tick(0.1));
    ok(sim.hotel.happy >= 3, '≥3 glückliche Gäste in 5 min, waren ' + sim.hotel.happy);
    ok(sim.hotel.floors.length >= 2, '≥1 neue Etage in 5 min');
  });
}
export function testNoLosingMoneyNeverNegative() {
  const slot = newSlot('A', 'bunny', WORLD_LIST); slot.coins = 3;
  const sim = new Sim(slot, WORLDS.blumenwiese, { rng: rngFrom(3) });
  ok(!sim.buildFloor().ok, 'zu wenig Geld → kein Bau'); eq(slot.coins, 3, 'Geld unverändert');
  ok(sim.buy('1A', 'bedDouble', 3, 0, 0) === null, 'Kauf ohne Geld scheitert sanft'); ok(slot.coins >= 0, 'nie negativ');
}
export function testRemoveRefunds() {
  const slot = newSlot('A', 'bunny', WORLD_LIST); const sim = new Sim(slot, WORLDS.blumenwiese);
  const c0 = slot.coins; const sp = findSpot(getRoom(sim.hotel, '1A'), 0, 'pottedPlant');
  const fu = sim.buy('1A', 'pottedPlant', sp.gx, sp.gz, sp.rot); ok(fu, 'gekauft'); ok(slot.coins < c0, 'bezahlt');
  sim.removeItem('1A', fu.uid); eq(slot.coins, c0, 'volles Geld zurück');
}
export function testWaitingGuestsStayHappy() {
  // Niemand weist zu: Gäste warten in der Lobby, es kommen höchstens maxWartend, keiner verschwindet/ärgert sich
  const slot = newSlot('A', 'bunny', WORLD_LIST); const sim = new Sim(slot, WORLDS.blumenwiese, { rng: rngFrom(11) });
  run(sim, 400);
  const q = sim.guests.filter((g) => g.state === 'queue');
  ok(q.length >= 2 && q.length <= BAL.maxWartend, 'Warteschlange begrenzt: ' + q.length);
  ok(sim.stuckGuests().length === 0, 'niemand hängt');
  eq(slot.coins, CFG.startGeld, 'keine Strafe');
}
