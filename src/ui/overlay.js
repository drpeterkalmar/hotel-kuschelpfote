// HTML-Ebene über dem 3D: Wunsch-Sprechblasen der wartenden Gäste, Zimmer-Marken (Herz-Vorschau beim Zuweisen,
// „Zimmer bauen", „Bett fehlt"), „+ Etage"-Knopf über dem Dach, Ausflug-Marke, Wertungen beim Abreisen.
import * as THREE from 'three';
import { WISHES, ROOM_TYPES } from '../core/catalog.js';
import { allRooms, isGuestRoom, floorPrice, canBuildFloor, starsForFloor, wishMet, getRoom } from '../core/hotel.js';
import { cellCenter, FH, HALF_W } from '../core/layout.js';
import { PET_SCALE } from '../gfx/pets.js';

const v3 = new THREE.Vector3();
export class Overlay {
  constructor(app) {
    this.app = app; this.root = document.getElementById('overlay');
    this.els = new Map(); this.selected = null; this.drag = null;
  }
  reset() { for (const e of this.els.values()) e.remove(); this.els.clear(); this.selected = null; }
  layout() {}
  proj(x, y, z) {
    v3.set(x, y, z).project(this.app.cam);
    return { x: (v3.x + 1) / 2 * innerWidth, y: (1 - v3.y) / 2 * innerHeight, vis: v3.z < 1 && v3.x > -1.2 && v3.x < 1.2 && v3.y > -1.2 && v3.y < 1.2 };
  }
  el(key, cls, html, onTap) {
    let e = this.els.get(key);
    if (!e) {
      e = document.createElement('div'); e.className = cls; this.root.appendChild(e); this.els.set(key, e);
      if (onTap) {
        e.addEventListener('pointerdown', (ev) => { ev.stopPropagation(); e._down = { x: ev.clientX, y: ev.clientY, t: performance.now(), id: ev.pointerId }; try { e.setPointerCapture(ev.pointerId); } catch (err) { /* Test-Ereignisse */ } });
        e.addEventListener('pointermove', (ev) => { if (e._down && e._drag) e._drag(ev); else if (e._down && Math.hypot(ev.clientX - e._down.x, ev.clientY - e._down.y) > 14 && e._dragStart) { e._dragStart(ev); } });
        e.addEventListener('pointerup', (ev) => { ev.stopPropagation(); const d = e._down; e._down = null; if (e._drag) { const f = e._dragEnd; e._drag = null; f && f(ev); return; } if (d) onTap(ev); });
        e.addEventListener('pointercancel', () => { e._down = null; e._drag = null; });
      }
    }
    if (e._html !== html) { e.innerHTML = html; e._html = html; }
    e._seen = true; e.className = cls;
    return e;
  }
  place(e, p, dy = 0) { e.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y + dy)}px) translate(-50%, -100%)`; e.style.display = p.vis ? '' : 'none'; }
  update() {
    const app = this.app, sim = app.sim; if (!sim) return;
    for (const e of this.els.values()) e._seen = false;
    const inHotel = app.mode === 'hotel';
    if (inHotel) {
      const sel = this.selected !== null ? sim.guests.find((g) => g.id === this.selected && (g.state === 'queue' || g.state === 'toQueue')) : null;
      if (!sel) this.selected = null;
      // Sprechblasen
      for (const g of sim.guests) {
        if (!(g.state === 'queue' || g.state === 'toQueue')) continue;
        const v = app.guestVis.get(g.id); const pos = v ? { x: v.x, y: v.y, z: v.z } : g.pos;
        const h = (app.pets.species[g.species]?.height || 1.6) * PET_SCALE + 0.25;
        const p = this.proj(pos.x, pos.y + h, pos.z);
        const icons = g.wishes.map((w) => `<span class="w">${WISHES[w].icon}</span>`).join('');
        const e = this.el('g' + g.id, 'bub' + (this.selected === g.id ? ' sel' : ''), icons, () => this.selectGuest(g.id));
        e._dragStart = (ev) => this.startBubbleDrag(e, g, ev);
        if (!e._drag) this.place(e, p, -4);
      }
      // Zimmer-Marken
      const free = new Set(sim.freeGuestRooms().map((r) => r.id));
      for (const r of allRooms(sim.hotel)) {
        const c = cellCenter(r.floor, r.side, 2.5, 2);
        const p = this.proj(c.x, c.y + (sel ? 2.3 : 2.35), c.z + 1.4);
        if (!r.room.type) {
          this.place(this.el('r' + r.id, 'badge build', '<b>＋</b> Zimmer', () => app.screens.roomTypePicker(r.id)), p);
        } else if (sel && r.room.type === 'schlaf') {
          if (free.has(r.id)) {
            const n = sim.previewHearts(sel, r.id);
            this.place(this.el('r' + r.id, 'badge go', '❤️'.repeat(Math.min(5, n)) || '❤️', () => this.assignTo(r.id)), p);
          } else if (!isGuestRoom(r.room)) this.place(this.el('r' + r.id, 'badge need', '🛏️❓', () => app.furnish.open(r.id)), p);
        } else if (!sel && r.room.type === 'schlaf' && !isGuestRoom(r.room)) {
          this.place(this.el('r' + r.id, 'badge need', '🛏️❓', () => app.furnish.open(r.id)), p);
        }
      }
      // + Etage über dem Dach
      const top = app.hotelView.topY;
      const can = canBuildFloor(sim.hotel), price = floorPrice(sim.hotel);
      if (sim.hotel.floors.length < 8) {
        const html = can ? `🏗️ <span>＋ Etage</span> <span style="color:#b07a20">🪙${price}</span>` : `🔒 ⭐${starsForFloor(sim.hotel.floors.length + 1)}`;
        const p = this.proj(-HALF_W + 3.2, top + (app.world.look.dachForm === 'kuppel' ? 0.6 : 0.2), 2.6);
        this.place(this.el('floor', 'badge floor', html, () => app.screens.buildFloor()), p);
      }
      // Ausflugsort
      const a = app.world.ausflug;
      if (a) {
        const p = this.proj(a.punkt.x, 2.6, a.punkt.z);
        const html = sim.hotel.ausflug ? `${a.icon} <span>Mitmachen!</span>` : `${a.icon} <span>＋</span> <span style="color:#b07a20">🪙${a.preis}</span>`;
        this.place(this.el('trip', 'badge ' + (sim.hotel.ausflug ? 'go' : 'build'), html, () => app.screens.tripButton()), p);
      }
    }
    for (const [k, e] of this.els) if (!e._seen) { e.remove(); this.els.delete(k); }
  }
  selectGuest(id) {
    const app = this.app;
    if (this.selected === id) { this.selected = null; return; }
    this.selected = id; app.sound.sfx('pop');
    const g = app.sim.guests.find((x) => x.id === id);
    app.tutorial.event('select');
    if (!app.sim.freeGuestRooms().length) app.screens.toast('🛏️', 'Alle Zimmer sind voll – bau ein neues Schlafzimmer!');
    void g;
  }
  assignTo(roomId) {
    const app = this.app; if (this.selected === null) return false;
    const r = app.sim.assign(this.selected, roomId);
    if (r.ok) { this.selected = null; return true; }
    app.sound.sfx('nope');
    const msg = { bett: ['🛏️', 'Da fehlt noch ein Bett!'], belegt: ['🙈', 'Das Zimmer ist schon belegt.'], typ: ['🛏️', 'Gäste schlafen nur in Schlafzimmern.'], leer: ['🏗️', 'Hier ist noch kein Zimmer.'] }[r.why];
    if (msg) app.screens.toast(...msg);
    return false;
  }
  startBubbleDrag(e, g, ev) {
    this.selected = g.id;
    e._drag = (mv) => { e.style.transform = `translate(${mv.clientX}px, ${mv.clientY}px) translate(-50%, -110%) scale(1.15)`; };
    e._dragEnd = (up) => { const id = this.app.input.roomAt(up.clientX, up.clientY); if (id) this.assignTo(id); };
    e._drag(ev);
  }
  rating(r) {
    const g = r.guest; const v = this.app.guestVis.get(g.id); const pos = v ? { x: v.x, y: v.y, z: v.z } : g.pos;
    const p = this.proj(pos.x, pos.y + 1.9, pos.z);
    const d = document.createElement('div'); d.className = 'rate';
    d.innerHTML = '❤️'.repeat(r.hearts) + '🤍'.repeat(5 - r.hearts) + `<br><span style="color:#b07a20">+${r.coins} 🪙</span>`;
    d.style.left = p.x + 'px'; d.style.top = p.y + 'px'; d.style.textAlign = 'center';
    this.root.appendChild(d); setTimeout(() => d.remove(), 2700);
  }
}
void ROOM_TYPES; void wishMet; void getRoom; void FH;
