// Eingabe auf der 3D-Fläche: Hotel = Wischen scrollt, Pinch/Mausrad zoomt, Tippen wählt Gast/Zimmer.
// Einrichten und Mitmach-Spiel bekommen die Zeiger-Ereignisse weitergereicht.
import * as THREE from 'three';
import { FH, HALF_W, LIFT, ROOM_D, roomZ0, wingLevel } from '../core/layout.js';
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
    c.addEventListener('wheel', (e) => { e.preventDefault(); if (app.mode === 'hotel') app.camCtl.zoomBy(Math.exp(e.deltaY * 0.0012)); }, { passive: false });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    // Desktop: Q/E drehen, R/F kippen, Pfeile verschieben, +/- zoomen
    addEventListener('keydown', (e) => {
      if (app.mode !== 'hotel' || e.target.tagName === 'INPUT') return;
      const k = e.key.toLowerCase(), cc = app.camCtl;
      if (k === 'q') cc.rotateStep(-1); else if (k === 'e') cc.rotateStep(1);
      else if (k === 'r') cc.tiltBy(-0.1); else if (k === 'f') cc.tiltBy(0.1);
      else if (k === 'arrowleft') cc.panBy(60, 0); else if (k === 'arrowright') cc.panBy(-60, 0); else if (k === 'arrowup') cc.panBy(0, 60); else if (k === 'arrowdown') cc.panBy(0, -60);
      else if (k === '+' || k === '=') cc.zoomBy(0.85); else if (k === '-') cc.zoomBy(1.18);
    });
  }
  down(e) {
    const app = this.app;
    try { e.target.setPointerCapture(e.pointerId); } catch (err) { /* synthetische Ereignisse */ }
    this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now() });
    if (this.ptrs.size === 1) this.moved = 0;
    if (this.ptrs.size === 2) { const [a, b] = [...this.ptrs.values()]; this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), ang: Math.atan2(b.y - a.y, b.x - a.x), my: (a.y + b.y) / 2 }; }
    this.button = e.button;
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
      // zwei Finger: Abstand = Zoom, Winkel = Drehen, gemeinsames Hoch/Runter = Kippen
      const [a, b] = [...this.ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y), ang = Math.atan2(b.y - a.y, b.x - a.x), my = (a.y + b.y) / 2;
      app.camCtl.zoomBy(this.pinch.d / Math.max(10, d));
      let da = ang - this.pinch.ang; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
      app.camCtl.rotateBy(-da);
      app.camCtl.tiltBy((my - this.pinch.my) * 0.004);
      this.pinch.d = d; this.pinch.ang = ang; this.pinch.my = my; this.rotated = true;
    } else if (this.moved > 8) {
      if (this.button === 2) { app.camCtl.rotateBy(-dx * 0.008); app.camCtl.tiltBy(dy * 0.003); this.rotated = true; }   // Maus rechts = drehen/kippen
      else app.camCtl.panBy(dx, dy);
    }
  }
  up(e, cancel = false) {
    const app = this.app, p = this.ptrs.get(e.pointerId);
    if (app.mode === 'furnish') app.furnish.pointerUp(e, cancel);
    if (app.mode === 'trip') app.trip.pointerUp?.(e);
    if (!p) return;
    this.ptrs.delete(e.pointerId);
    if (this.ptrs.size < 2) this.pinch = null;
    if (this.ptrs.size === 0 && this.rotated) { app.camCtl.snapYaw(); this.rotated = false; }
    if (!cancel && app.mode === 'hotel' && this.moved < 10 && performance.now() - p.t0 < 600 && this.ptrs.size === 0) this.tapAt(e.clientX, e.clientY);
  }
  rayAt(x, y) { ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1); ray.setFromCamera(ndc, this.app.cam); return ray.ray; }
  // Zimmer unter dem Finger: Schnitt mit dem Boden der angezeigten Ebene (oberste zuerst)
  roomAt(x, y) {
    const r = this.rayAt(x, y), h = this.app.sim.hotel, n = h.floors.length;
    for (let L = Math.min(this.app.hotelView.showLevel, wingLevel(Math.max(1, n))); L >= 0; L--) {
      if (Math.abs(r.direction.y) < 1e-4) return null;
      const t = (L * FH + 0.3 - r.origin.y) / r.direction.y; if (t < 0) continue;
      const px = r.origin.x + r.direction.x * t, pz = r.origin.z + r.direction.z * t;
      if (Math.abs(px) > HALF_W || Math.abs(px) < LIFT / 2) continue;
      for (let w = 1; w <= n; w++) { if (wingLevel(w) !== L) continue; const z0 = roomZ0(w); if (pz >= z0 && pz <= z0 + ROOM_D) return roomId(w, px < 0 ? 0 : 1); }
    }
    return null;
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
