// Gate 1: Autopilot spielt 10 Spielminuten Blumenwiese: ≥ 8 Gäste glücklich abgereist, ≥ 2 Etagen gebaut, kein Gast hängt fest.
import { newSlot } from '../../src/core/save.js';
import { Sim, rngFrom } from '../../src/core/sim.js';
import { AutoPlayer } from '../../src/core/autoplay.js';
import { WORLDS, WORLD_LIST } from '../../src/worlds/index.js';
import { ok } from './util.mjs';

export function runGate(world, seed, sec = 600) {
  const slot = newSlot('Test', 'bunny', WORLD_LIST);
  const sim = new Sim(slot, WORLDS[world], { rng: rngFrom(seed) }); const ap = new AutoPlayer(sim);
  let maxStuck = 0, departed = 0, happy = 0;
  sim.on('rating', (r) => { if (r.hearts >= 3) happy++; });
  sim.on('depart', () => departed++);
  for (let t = 0; t < sec; t += 0.1) { sim.step(0.1); ap.tick(0.1); maxStuck = Math.max(maxStuck, sim.stuckGuests().length); }
  return { sim, happy, departed, floorsBuilt: sim.hotel.floors.length - 1, maxStuck, coins: slot.coins, stars: sim.hotel.stars, log: ap.log };
}
export function testGate1Blumenwiese() {
  for (const seed of [1, 2, 3, 4, 5]) {
    const r = runGate('blumenwiese', seed);
    console.log(`   Seed ${seed}: glücklich ${r.happy}, abgereist ${r.departed}, Etagen gebaut ${r.floorsBuilt}, Sterne ${r.stars}, Münzen ${r.coins}, max hängend ${r.maxStuck}`);
    ok(r.happy >= 8, 'mind. 8 glückliche Gäste, waren ' + r.happy);
    ok(r.floorsBuilt >= 2, 'mind. 2 Etagen gebaut, waren ' + r.floorsBuilt);
    ok(r.maxStuck === 0, 'kein Gast hängt fest');
  }
}
export function testMondPlaysToo() {
  const r = runGate('mond', 9);
  console.log(`   Mond: glücklich ${r.happy}, Etagen ${r.floorsBuilt}, Ausflug ${r.sim.hotel.ausflug}`);
  ok(r.happy >= 6 && r.maxStuck === 0, 'Mond spielbar');
}
