// Kamera der 3D-Draufsicht: schräg von oben (≈55°), perspektivisch. Ein Finger verschiebt, Pinch zoomt, zwei Finger drehen
// (rastet beim Loslassen auf 45° ein) und kippen. Weit raus = flacher (man sieht den Himmel/die Erde), nah = steiler.
// Einrichten passiert in derselben Ansicht: die Kamera fliegt aufs Zimmer, Bildmitte rückt in den freien Bereich.
import * as THREE from 'three';
import { HALF_W, ROOM_W, ROOM_D, LOBBY_Z1, backZ, FH } from '../core/layout.js';

const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const STEP = Math.PI / 4;
export class CamCtl {
  constructor() {
    this.cam = new THREE.PerspectiveCamera(34, 1, 0.3, 900);
    this.mode = 'hotel';
    // x/z = Zielpunkt am Boden, y = Ebene, yaw 0 = von vorn (+z), pitch = Neigung über dem Boden
    this.h = { x: 0, z: -2, y: 0, dist: 34, yaw: 0, pitch: 0.96, tx: 0, tz: -2, ty: 0, tdist: 34, tyaw: 0, tilt: 0, ttilt: 0 };
    this.f = null; this.free = { x: 0, y: 0, w: 1, h: 1 }; this.wings = 1; this.topY = 3;
  }
  resize(w, h) { this.W = w; this.H = h; this.cam.aspect = w / h; this.cam.updateProjectionMatrix(); if (this.f) this.f.dist = null; }
  portrait() { return this.H > this.W; }
  limits() { const p = this.portrait(); return { minD: 7, maxD: p ? 70 : 56 }; }
  // Abstand, bei dem das ganze Gelände (Hotel + etwas Garten) ins Bild passt
  overviewDist() {
    const depth = LOBBY_Z1 - backZ(this.wings) + 3, width = HALF_W * 2 + 4;
    const vf = THREE.MathUtils.degToRad(this.cam.fov), hf = 2 * Math.atan(Math.tan(vf / 2) * this.cam.aspect);
    const dW = width / 2 / Math.tan(hf / 2), dD = depth * Math.sin(this.h.pitch) / 2 / Math.tan(vf / 2);
    return Math.min(this.limits().maxD, Math.max(dW, dD) * 1.02);
  }
  setWings(n) { this.wings = Math.max(1, Math.min(4, n)); }
  resetHotel(topY, focusY = null) {
    this.topY = topY;
    const zc = (LOBBY_Z1 + backZ(this.wings)) / 2 + 0.5;
    this.h.tx = 0; this.h.tz = zc; this.h.tdist = this.overviewDist() * 0.92;
    if (focusY !== null) this.h.ty = focusY;
  }
  get pitchNow() { // weit draußen flacher (Himmel sichtbar), nah steiler
    const { minD, maxD } = this.limits(); const k = THREE.MathUtils.clamp((this.h.dist - minD) / (maxD - minD), 0, 1);
    return THREE.MathUtils.clamp(1.02 - k * 0.42 + this.h.tilt, 0.32, 1.32);
  }
  right() { return new THREE.Vector2(Math.cos(this.h.yaw), -Math.sin(this.h.yaw)); }
  fwd() { return new THREE.Vector2(-Math.sin(this.h.yaw), -Math.cos(this.h.yaw)); }
  // Blickrichtung waagerecht (Kamera → Ziel) für das Absenken der Wände
  viewDir() { const f = this.fwd(); return { x: f.x, z: f.y }; }
  panBy(dxPx, dyPx) {
    const vf = THREE.MathUtils.degToRad(this.cam.fov);
    const mpp = 2 * Math.tan(vf / 2) * this.h.dist / this.H;
    const r = this.right(), f = this.fwd(), sp = Math.max(0.45, Math.sin(this.pitchNow));
    this.h.tx += -r.x * dxPx * mpp + f.x * dyPx * mpp / sp;
    this.h.tz += -r.y * dxPx * mpp + f.y * dyPx * mpp / sp;
    this.clamp();
  }
  zoomBy(k) { const { minD, maxD } = this.limits(); this.h.tdist = THREE.MathUtils.clamp(this.h.tdist * k, minD, maxD); }
  rotateBy(rad) { this.h.tyaw += rad; this.h.yaw += rad; }      // während der Geste direkt
  rotateStep(n) { this.h.tyaw = Math.round(this.h.tyaw / STEP) * STEP + n * STEP; }
  snapYaw() { this.h.tyaw = Math.round(this.h.yaw / STEP) * STEP; }
  tiltBy(d) { this.h.ttilt = THREE.MathUtils.clamp(this.h.ttilt + d, -0.45, 0.3); }
  clamp() {
    const zMin = backZ(this.wings) - 6, zMax = LOBBY_Z1 + 10;
    this.h.tx = THREE.MathUtils.clamp(this.h.tx, -HALF_W - 9, HALF_W + 12);
    this.h.tz = THREE.MathUtils.clamp(this.h.tz, zMin, zMax);
  }
  focusRoom(c, free) { this.mode = 'furnish'; this.free = free; this.f = { c: c.clone(), dist: null }; }
  focusHotel() { this.mode = 'hotel'; this.f = null; this.cam.clearViewOffset(); }
  // Abstand numerisch einpassen: Ecken des Zimmers (Boden + halbe Wandhöhe) im freien Bildbereich
  fitRoom(tl, dir, fr) {
    const c = this.f.c, hw = ROOM_W / 2 + 0.3, hd = ROOM_D / 2 + 0.3, pts = [];
    for (const x of [-hw, hw]) for (const z of [-hd, hd]) for (const y of [0, 1.4]) pts.push(new THREE.Vector3(c.x + x, c.y + y, c.z + z));
    const cam = this.cam.clone(); cam.clearViewOffset(); cam.aspect = this.W / this.H; cam.updateProjectionMatrix();
    const fits = (d) => {
      cam.position.copy(tl).addScaledVector(dir, d); cam.lookAt(tl); cam.updateMatrixWorld();
      for (const p of pts) { const v = p.clone().project(cam); if (v.z > 1 || Math.abs(v.x) * this.W / 2 > fr.w / 2 * 0.95 || Math.abs(v.y) * this.H / 2 > fr.h / 2 * 0.95) return false; }
      return true;
    };
    let lo = 3, hi = 80; for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (fits(m)) hi = m; else lo = m; }
    return hi;
  }
  update(dt) {
    const h = this.h, k = 7;
    h.yaw = damp(h.yaw, h.tyaw, 8, dt); h.tilt = damp(h.tilt, h.ttilt, 8, dt);
    if (this.mode === 'furnish' && this.f) {
      const pitch = 0.98, fr = this.free;
      const dir = new THREE.Vector3(Math.sin(h.yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(h.yaw) * Math.cos(pitch));
      const tl = this.f.c.clone().add(new THREE.Vector3(0, 0.4, 0));
      if (!this.f.dist || Math.abs(this.f.yaw - h.yaw) > 0.02) { this.f.dist = this.fitRoom(tl, dir, fr); this.f.yaw = h.yaw; }
      h.x = damp(h.x, tl.x, k, dt); h.z = damp(h.z, tl.z, k, dt); h.y = damp(h.y, this.f.c.y, k, dt); h.dist = damp(h.dist, this.f.dist, k, dt);
      h.tx = h.x; h.tz = h.z; h.tdist = h.dist; h.ty = this.f.c.y;
      const p = new THREE.Vector3(h.x, h.y + 0.4, h.z);
      this.cam.position.copy(p).addScaledVector(dir, h.dist); this.cam.lookAt(p);
      const cx = fr.x + fr.w / 2, cy = fr.y + fr.h / 2;
      this.cam.setViewOffset(this.W, this.H, -(cx - this.W / 2), -(cy - this.H / 2), this.W, this.H);
      return;
    }
    h.dist = damp(h.dist, h.tdist, k, dt); h.x = damp(h.x, h.tx, k, dt); h.z = damp(h.z, h.tz, k, dt); h.y = damp(h.y, h.ty, k, dt);
    const pitch = this.pitchNow;
    const dir = new THREE.Vector3(Math.sin(h.yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(h.yaw) * Math.cos(pitch));
    const tgt = new THREE.Vector3(h.x, h.y + 0.6, h.z);
    this.cam.position.copy(tgt).addScaledVector(dir, h.dist); this.cam.lookAt(tgt);
    this.cam.clearViewOffset();
  }
  snap() { for (let i = 0; i < 4; i++) this.update(10); }
}
void FH;
