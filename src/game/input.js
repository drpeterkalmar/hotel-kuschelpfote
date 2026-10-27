// Eingabe auf der 3D-Fläche: Hotel = Wischen scrollt, Pinch/Mausrad zoomt, Tippen wählt Gast/Zimmer.
// Einrichten und Mitmach-Spiel bekommen die Zeiger-Ereignisse weitergereicht.
import * as THREE from 'three';
import { FH, HALF_W, LIFT, ROOM_D } from '../core/layout.js';
import { roomId } from '../core/hotel.js';
import { PET_SCALE } from '../gfx/pets.js';

const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
export class Input {
  constructor(app) {
    this.app = app; this.ptrs = new Map(); this.moved = 0; this.pinch = null; this.vel = { x: 0, y: 0 };
    const c = document.getElementById('c');
    c.addEventListener('pointerdown', (e) => this.down(e));
    addEventListener('pointermove', (e) => this.move(e));
    addEventListener('pointerup', (e) => this.up(e));
    addEventListener('pointercancel', (e) => this.up(e, true));
    c.addEventListener('wheel', (e) => { e.preventDefault(); if (app.mode === 'hotel') app.camCtl.zoomBy(Math.exp(e.deltaY * 0.0012), { x: e.clientX, y: e.clientY }); }, { passive: false });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  down(e) {
    const app = this.app;
    try { e.target.setPointerCapture(e.pointerId); } catch (err) { /* synthetische Ereignisse */ }
    this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now() });
    if (this.ptrs.size === 1) this.moved = 0;
    if (this.ptrs.size === 2) { const [a, b] = [...this.ptrs.values()]; this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) }; }
    if (app.mode === 'furnish') app.furnish.pointerDown(e);
    if (app.mode === 'trip') app.trip.pointerDown(e);
  }
  move(e) {
    const app = this.app, p = this.ptrs.get(e.pointerId);
    if (app.mode === 'furnish') app.furnish.pointerMove(e);
    if (app.mode === 'trip') app.trip.pointerMove?.(e);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    this.moved = Math.max(this.moved, Math.hypot(e.clientX - p.x0, e.clientY - p.y0));
    if (app.mode !== 'hotel') return;
    if (this.ptrs.size >= 2 && this.pinch) {
      const [a, b] = [...this.ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
      app.camCtl.zoomBy(this.pinch.d / Math.max(10, d), { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }); this.pinch.d = d;
      app.camCtl.panBy(dx / 2, dy / 2);
    } else if (this.moved > 8) { app.camCtl.panBy(dx, dy); }
  }
  up(e, cancel = false) {
    const app = this.app, p = this.ptrs.get(e.pointerId);
    if (app.mode === 'furnish') app.furnish.pointerUp(e, cancel);
    if (app.mode === 'trip') app.trip.pointerUp?.(e);
    if (!p) return;
    this.ptrs.delete(e.pointerId);
    if (this.ptrs.size < 2) this.pinch = null;
    if (!cancel && app.mode === 'hotel' && this.moved < 10 && performance.now() - p.t0 < 600 && this.ptrs.size === 0) this.tapAt(e.clientX, e.clientY);
  }
  rayAt(x, y) { ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1); ray.setFromCamera(ndc, this.app.cam); return ray.ray; }
  // Zimmer unter dem Finger: Schnitt mit der Ebene z = 0 (Zimmermitte)
  roomAt(x, y) {
    const r = this.rayAt(x, y); if (Math.abs(r.direction.z) < 1e-4) return null;
    const t = (0.6 - r.origin.z) / r.direction.z; const px = r.origin.x + r.direction.x * t, py = r.origin.y + r.direction.y * t;
    const f = Math.floor(py / FH); const h = this.app.sim.hotel;
    if (f < 1 || f > h.floors.length || Math.abs(px) > HALF_W || Math.abs(px) < LIFT / 2) return null;
    return roomId(f, px < 0 ? 0 : 1);
  }
  guestAt(x, y) {
    const app = this.app; let best = null, bd = 46;
    for (const g of app.sim.guests) {
      const v = app.guestVis.get(g.id); if (!v) continue;
      const h = (app.pets.species[g.species]?.height || 1.5) * PET_SCALE * 0.5;
      const p = new THREE.Vector3(v.x, v.y + h, v.z).project(app.cam);
      const d = Math.hypot((p.x + 1) / 2 * innerWidth - x, (1 - p.y) / 2 * innerHeight - y);
      if (d < bd) { bd = d; best = g; }
    }
    return best;
  }
  tapAt(x, y) {
    const app = this.app, ov = app.overlay;
    const g = this.guestAt(x, y);
    if (g && (g.state === 'queue' || g.state === 'toQueue')) { ov.selectGuest(g.id); return 'guest'; }
    const rid = this.roomAt(x, y);
    if (ov.selected !== null && rid) { ov.assignTo(rid); return 'assign'; }
    if (g) { app.sim.poke(g.id); return 'poke'; }
    if (rid) {
      const r = app.sim.hotel.floors[parseInt(rid, 10) - 1].rooms[rid.endsWith('B') ? 1 : 0];
      if (!r.type) { app.screens.roomTypePicker(rid); return 'build'; }
      app.furnish.open(rid); return 'furnish';
    }
    if (ov.selected !== null) { ov.selected = null; return 'deselect'; }
    return null;
  }
}
void ROOM_D;
