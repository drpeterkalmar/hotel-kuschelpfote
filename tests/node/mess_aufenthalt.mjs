// Messung (Peter 29.10.: "Tiere verweilen zu lange bis sie zahlen"): Sekunden vom Einchecken bis zur Bezahlung.
import { newSlot } from '../../src/core/save.js';
import { Sim, rngFrom } from '../../src/core/sim.js';
import { WORLDS, WORLD_LIST } from '../../src/worlds/index.js';
import { AutoPlayer } from '../../src/core/autoplay.js';

export function messeAufenthalt(seed = 7, sek = 900) {
  const slot = newSlot('A', 'bunny', WORLD_LIST);
  const sim = new Sim(slot, WORLDS.blumenwiese, { rng: rngFrom(seed) }); const ap = new AutoPlayer(sim);
  const ein = new Map(); const dauer = [];
  const orig = sim.assign.bind(sim);
  sim.assign = (gid, id) => { const r = orig(gid, id); if (r && r.ok !== false) ein.set(gid, sim.t); return r; };
  sim.on ? sim.on('rating', (e) => { if (ein.has(e.guest.id)) dauer.push(sim.t - ein.get(e.guest.id)); }) : null;
  const origCo = sim.checkout.bind(sim);
  if (!sim.on) sim.checkout = (g) => { if (ein.has(g.id)) dauer.push(sim.t - ein.get(g.id)); return origCo(g); };
  for (let t = 0; t < sek; t += 0.1) { sim.step(0.1); ap.tick(0.1); }
  dauer.sort((a, b) => a - b);
  return { n: dauer.length, median: dauer[Math.floor(dauer.length / 2)], min: dauer[0], max: dauer[dauer.length - 1] };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const s of [3, 7, 11]) console.log('seed', s, JSON.stringify(messeAufenthalt(s)));
}
