// Kameras: Hotel-Ansicht (Puppenhaus von vorn, Wischen = scrollen, Pinch = Zoom) und Einrichten-Ansicht (schräg von oben,
// Zimmer füllt den freien Bildbereich neben/über dem Katalog). Weiche Übergänge, Bildbereich per setViewOffset verschoben.
import * as THREE from 'three';
import { HALF_W, FH, ROOM_W, ROOM_D } from '../core/layout.js';

const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
export class CamCtl {
  constructor() {
    this.cam = new THREE.PerspectiveCamera(30, 1, 0.3, 700);
    this.mode = 'hotel';
    this.h = { x: 0, y: 4, dist: 30, tx: 0, ty: 4, tdist: 30 };   // Hotel
    this.f = null;                                                    // Einrichten-Ziel
    this.pos = new THREE.Vector3(0, 6, 30); this.look = new THREE.Vector3(0, 4, 0);
    this.free = { x: 0, y: 0, w: 1, h: 1 };                            // freier Bildbereich (px)
    this.topY = 8; this.vx = 0; this.vy = 0; this.shake = 0;
  }
  resize(w, h) { this.W = w; this.H = h; this.cam.aspect = w / h; this.cam.updateProjectionMatrix(); }
  portrait() { return this.H > this.W; }
  // Abstand, bei dem eine Breite bw und Höhe bh (Meter) in den Bildbereich passen
  fitDist(bw, bh, areaW, areaH) {
    const vf = THREE.MathUtils.degToRad(this.cam.fov);
    const dH = (bh / 2) / Math.tan(vf / 2) * (this.H / areaH);
    const dW = (bw / 2) / Math.tan(vf / 2) / this.cam.aspect * (this.W / areaW);
    return Math.max(dH, dW);
  }
  hotelLimits() {
    const p = this.portrait();
    const fitW = this.fitDist(HALF_W * 2 + (p ? 1.6 : 6), 1, this.W, this.H);
    const minD = p ? fitW * 0.42 : 9, maxD = Math.max(fitW * 1.15, p ? 34 : 30);
    return { minD, maxD, fitW };
  }
  resetHotel(topY, focusY = null) {
    this.topY = topY;
    const { fitW } = this.hotelLimits();
    const p = this.portrait();
    this.h.tdist = p ? fitW : Math.min(26, fitW * 1.0);
    this.h.tx = 0; this.h.ty = focusY ?? Math.min(topY * 0.42, 4.5);
  }
  panBy(dxPx, dyPx) {
    // Bildschirm-Pixel → Meter auf Höhe des Hotels
    const vf = THREE.MathUtils.degToRad(this.cam.fov);
    const mpp = 2 * Math.tan(vf / 2) * this.h.dist / this.H;
    this.h.tx -= dxPx * mpp; this.h.ty += dyPx * mpp;
    this.clamp();
  }
  zoomBy(f, aroundPx = null) {
    const { minD, maxD } = this.hotelLimits();
    const nd = THREE.MathUtils.clamp(this.h.tdist * f, minD, maxD);
    if (aroundPx) { // zum Finger hin zoomen
      const vf = THREE.MathUtils.degToRad(this.cam.fov);
      const mpp = 2 * Math.tan(vf / 2) * this.h.tdist / this.H, mpp2 = 2 * Math.tan(vf / 2) * nd / this.H;
      const ox = aroundPx.x - this.W / 2, oy = aroundPx.y - this.H / 2;
      this.h.tx += ox * (mpp - mpp2); this.h.ty -= oy * (mpp - mpp2);
    }
    this.h.tdist = nd; this.clamp();
  }
  clamp() {
    const { fitW } = this.hotelLimits();
    const slack = Math.max(0, (fitW - this.h.tdist) / fitW) * (HALF_W + 1.5) + (this.portrait() ? 0 : 5);
    this.h.tx = THREE.MathUtils.clamp(this.h.tx, -slack - 1, slack + 1);
    this.h.ty = THREE.MathUtils.clamp(this.h.ty, 1.2, Math.max(2.5, this.topY + 1.5));
  }
  // Einrichten: Zimmer (Mitte c) in freien Bereich einpassen
  focusRoom(c, free) {
    this.mode = 'furnish';
    this.free = free;
    this.f = { c: c.clone() };
  }
  focusHotel() { this.mode = 'hotel'; this.cam.clearViewOffset(); }
  update(dt) {
    const k = 7;
    if (this.mode === 'hotel') {
      this.h.dist = damp(this.h.dist, this.h.tdist, k, dt); this.h.x = damp(this.h.x, this.h.tx, k, dt); this.h.y = damp(this.h.y, this.h.ty, k, dt);
      const tp = new THREE.Vector3(this.h.x, this.h.y + this.h.dist * 0.11, this.h.dist), tl = new THREE.Vector3(this.h.x, this.h.y, 0);
      this.pos.lerp(tp, 1 - Math.exp(-6 * dt)); this.look.lerp(tl, 1 - Math.exp(-6 * dt));
      this.cam.clearViewOffset();
    } else if (this.mode === 'furnish' && this.f) {
      const fr = this.free;
      const pitch = 0.78, yaw = 0;   // ~45° von oben
      const dist = this.fitDist(ROOM_W + 0.7, ROOM_D * Math.sin(pitch) + 2.6 * Math.cos(pitch), fr.w, fr.h) * 1.0;
      const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
      const tl = this.f.c.clone().add(new THREE.Vector3(0, 1.05, 0.15));
      const tp = tl.clone().addScaledVector(dir, dist);
      this.pos.lerp(tp, 1 - Math.exp(-6 * dt)); this.look.lerp(tl, 1 - Math.exp(-6 * dt));
      // Bildmitte in die Mitte des freien Bereichs schieben
      const cx = fr.x + fr.w / 2, cy = fr.y + fr.h / 2;
      this.cam.setViewOffset(this.W, this.H, -(cx - this.W / 2), -(cy - this.H / 2), this.W, this.H);
    } else if (this.mode === 'fixed') {
      this.cam.clearViewOffset();
    }
    if (this.shake > 0) { this.shake = Math.max(0, this.shake - dt * 2); }
    this.cam.position.copy(this.pos);
    if (this.shake > 0) this.cam.position.x += Math.sin(performance.now() * 0.05) * this.shake * 0.08;
    this.cam.lookAt(this.look);
  }
  snap() { this.update(10); this.update(10); }
}
