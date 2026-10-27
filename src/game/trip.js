// Ausflug-System (generisch): jede Welt nennt in ihren Daten ein Ausflug-Modul (src/excursions/<modul>.js).
// Ein Modul liefert create(ctx) → { scene, cam, update(dt), tap(x,y), hold(side), release(), result() }.
// Das Mitmach-Spiel dauert DAUER Sekunden, man kann nicht verlieren; gesammelte Dinge = Bonus-Münzen.
import { BAL } from '../config.js';
import { sfx } from '../audio/sound.js';

export const DAUER = 45;
const $ = (id) => document.getElementById(id);
export class Trip {
  constructor(app) { this.app = app; this.mod = null; this.game = null; this.t = 0; this.scene = null; this.cam = null; }
  async start(opts = {}) {
    const app = this.app; if (app.mode !== 'hotel') return;
    const a = app.world.ausflug;
    app.mode = 'loading';
    const mod = await import(`../excursions/${a.modul}.js`);
    const guests = app.sim.guests.filter((g) => g.room || g.state === 'ausflug').map((g) => g.species);
    const species = [...new Set([...guests, ...app.world.gaeste.map((g) => g.art)])].slice(0, 4);
    this.game = await mod.create({ app, world: app.world, bundles: app.bundles, renderer: app.renderer, species, avatar: app.slot.avatar, sfx, hint: (t) => ($('tripHint').textContent = t), ...opts });
    app.overlay.reset();
    this.scene = this.game.scene; this.cam = this.game.cam; this.t = 0; this.count = 0; this.done = false;
    this.game.onCollect = (n = 1) => { this.count += n; $('tripCount').textContent = '⭐ ' + this.count; };
    $('trip').classList.remove('hidden'); $('hud').classList.add('hidden'); $('bar').classList.add('hidden'); $('camBtns').classList.add('hidden'); $('tripCount').textContent = '⭐ 0';
    this.resize(); app.renderer.r.shadowMap.needsUpdate = true;
    app.mode = 'trip';
    this.dur = opts.dauer || DAUER;
  }
  resize() { if (this.cam) { this.cam.aspect = innerWidth / innerHeight; this.cam.updateProjectionMatrix(); } }
  update(dt) {
    if (!this.game || this.done) return;
    if (this.cam.aspect !== innerWidth / innerHeight) this.resize();
    this.t += dt * (this.app.timeScale ?? 1);
    this.game.update(dt * (this.app.timeScale ?? 1), this.t);
    $('tripTime').firstElementChild.style.width = Math.max(0, 100 - this.t / this.dur * 100) + '%';
    if (this.t >= this.dur) this.finish();
  }
  finish() {
    const app = this.app; if (this.done) return; this.done = true;
    const coins = this.count * BAL.minigameMuenzen;
    app.slot.coins += coins;
    // alle Gäste im Hotel freuen sich mit (Ausflug zählt für ihre Wertung)
    for (const g of app.sim.guests) if (g.room) g.didAusflug = true;
    sfx('star');
    const { card, close } = app.screens.modal(`<h2>${app.world.ausflug.icon} Toll gemacht!</h2><p style="font-size:30px">⭐ × ${this.count}</p><p style="font-weight:900;color:#b07a20">+${coins} 🪙</p><p>Deine Gäste kommen glücklich zurück ❤️</p><button class="big ok close"><span>🏨</span><small>Zum Hotel</small></button>`, () => this.exit());
    void card; void close;
  }
  exit() {
    const app = this.app;
    this.game?.dispose?.(); this.game = null; this.scene = null;
    $('trip').classList.add('hidden');
    app.mode = 'hotel'; app.screens.showHud(); app.shadowDirty = 3; app.save();
  }
  pointerDown(e) { if (this.game && !this.done) this.game.down?.(e.clientX, e.clientY, e); }
  pointerUp(e) { if (this.game && !this.done) this.game.up?.(e.clientX, e.clientY, e); }
  pointerMove(e) { if (this.game && !this.done) this.game.move?.(e.clientX, e.clientY, e); }
}
