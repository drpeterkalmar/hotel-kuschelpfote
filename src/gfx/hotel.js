// Das Puppenhaus: je Etage ein verschmolzenes Mesh (Boden, Tapeten, Wände, Aufzug, Fassade) mit gebackener AO,
// dazu Dach je Welt (Giebel bzw. Glaskuppel), Rezeption und Schilder. Neue Etagen „wachsen" mit Federanimation.
import * as THREE from 'three';
import { GeoBuilder } from './geo.js';
import { atlasTexture, T, WALLPAPERS, DEFAULT_WALL, FLOOR_TILE } from './atlas.js';
import { FH, HALF_W, LIFT, ROOM_W, ROOM_D, Z0, roomX0, DOOR_GZ } from '../core/layout.js';
import { CELL } from '../core/catalog.js';

const WT = 0.2, SLAB = 0.24, DOOR_H = 2.15;
const ZF = ROOM_D / 2;                     // Vorderkante
const DOOR_Z0 = Z0 + DOOR_GZ * CELL, DOOR_Z1 = DOOR_Z0 + CELL;
const smooth = (x) => x * x * (3 - 2 * x);
// AO-Funktionen: Abdunkeln an Kanten (d in Metern)
const edgeAO = (d, r = 0.55, s = 0.32) => 1 - s * Math.exp(-Math.max(0, d) / r * 2.2);

export class HotelView {
  constructor(scene, world) {
    this.scene = scene; this.world = world; this.look = world.look;
    this.group = new THREE.Group(); scene.add(this.group);
    this.mat = new THREE.MeshLambertMaterial({ vertexColors: true, map: atlasTexture() });
    this.floorGroups = []; this.roof = null; this.anims = [];
    this.glassMat = new THREE.MeshLambertMaterial({ color: 0xcfe9ff, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide, emissive: 0x334466 });
  }
  dispose() { this.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); this.scene.remove(this.group); }
  // komplett neu aufbauen (Etagen-/Zimmeränderung). animateFloor = neu gebaute Etage wächst
  rebuild(hotel, animateFloor = -1) {
    for (const g of this.floorGroups) { g.traverse((o) => o.geometry && o.geometry.dispose()); this.group.remove(g); }
    if (this.roof) { this.roof.traverse((o) => o.geometry && o.geometry.dispose()); this.group.remove(this.roof); }
    this.floorGroups = [];
    const n = hotel.floors.length;
    for (let f = 0; f <= n; f++) {
      const g = new THREE.Group(); g.userData.floor = f;
      const mesh = new THREE.Mesh(f === 0 ? this.buildLobby() : this.buildFloor(f, hotel.floors[f - 1]), this.mat);
      mesh.receiveShadow = true; mesh.castShadow = false;
      g.add(mesh); g.position.y = f * FH;
      this.group.add(g); this.floorGroups.push(g);
    }
    this.roof = this.buildRoof(); this.roof.position.y = (n + 1) * FH; this.group.add(this.roof);
    this.topY = (n + 1) * FH;
    if (animateFloor > 0) {
      const g = this.floorGroups[animateFloor];
      this.anims.push({ t: 0, dur: 0.9, fn: (k) => { const s = k < 1 ? Math.max(0.02, 1 - Math.cos(k * Math.PI * 1.6) * Math.exp(-k * 4.2)) : 1; g.scale.set(1, s, 1); } });
      const r = this.roof; const y1 = r.position.y;
      this.anims.push({ t: 0, dur: 0.9, fn: (k) => { r.position.y = y1 - FH * (1 - Math.min(1, k < 1 ? 1 - Math.cos(k * Math.PI * 1.6) * Math.exp(-k * 4.2) : 1)); } });
    }
  }
  update(dt) {
    for (const a of this.anims) { a.t += dt; a.fn(Math.min(1, a.t / a.dur)); }
    this.anims = this.anims.filter((a) => a.t < a.dur);
  }
  // Etagen oberhalb ausblenden (Einrichten-Ansicht von schräg oben)
  showUpTo(f) { this.floorGroups.forEach((g, i) => (g.visible = i <= f)); if (this.roof) this.roof.visible = f >= 99; }

  // ---------- Bausteine ----------
  facadeTile() { return this.look.fassade === 'metall' ? T.METAL : T.SIDING; }
  buildShell(b, y0, h, f) {
    const L = this.look;
    // Decke/Boden-Platte (Vorderkante als Zierleiste in Akzentfarbe)
    b.box(-HALF_W - WT, -SLAB, Z0 - WT, HALF_W + WT, 0, ZF + 0.12, L.sockel, T.PLAIN, 'pxnxny');
    b.box(-HALF_W - WT - 0.05, -SLAB - 0.02, ZF + 0.02, HALF_W + WT + 0.05, 0.03, ZF + 0.16, L.akzent, T.PLAIN, 'pzpyny');
    // Außenwände (Fassade außen, Tapete innen kommt je Zimmer)
    for (const sx of [-1, 1]) {
      const x0 = sx < 0 ? -HALF_W - WT : HALF_W, x1 = x0 + WT;
      b.box(x0, 0, Z0 - WT, x1, h, ZF, L.wand, this.facadeTile(), sx < 0 ? 'nxpz' : 'pxpz', true);
      b.box(x0 - 0.02, 0, ZF - 0.02, x1 + 0.02, h, ZF + 0.1, L.wand, T.PLAIN, 'pz');
    }
    // Rückwand außen (sieht man nur von oben/Seite)
    b.box(-HALF_W - WT, 0, Z0 - WT, HALF_W + WT, h, Z0, L.wand, this.facadeTile(), 'pyny', true);
    // Stützen vorn am Aufzug (Pfeiler zwischen den Zimmern)
    for (const sx of [-1, 1]) b.box(sx * LIFT / 2 - 0.08, 0, ZF - 0.12, sx * LIFT / 2 + 0.08, h, ZF + 0.06, L.wand, T.PLAIN, 'pzpxnx');
  }
  roomInterior(b, side, room, f) {
    const x0 = roomX0(side), x1 = x0 + ROOM_W, h = FH - SLAB;
    const type = room.type;
    const wp = WALLPAPERS[room.wall ?? ((DEFAULT_WALL[type] ?? 7) + (type === 'schlaf' ? (f * 2 + side) % 6 : 0)) % WALLPAPERS.length] || WALLPAPERS[7];
    const wallCol = type ? wp.color : '#efe8df';
    const [ft, fc] = type ? FLOOR_TILE[type] : [T.PLAIN, '#e7ddd2'];
    // Boden mit AO an Rück- und Seitenwänden
    b.quad([x0, 0.002, ZF], [ROOM_W, 0, 0], [0, 0, -ROOM_D], fc, ft, 10, 8, (u, v) => edgeAO(v * ROOM_D) * edgeAO(u * ROOM_W) * edgeAO((1 - u) * ROOM_W) * (0.92 + 0.08 * u), [1, 1]);
    // Rückwand (Tapete), AO an Boden/Decke/Ecken
    b.quad([x0, 0, Z0 + 0.001], [ROOM_W, 0, 0], [0, h, 0], wallCol, type ? wp.tile : T.PLAIN, 10, 6, (u, v) => edgeAO(v * h, 0.5, 0.36) * edgeAO((1 - v) * h, 0.4, 0.22) * edgeAO(u * ROOM_W) * edgeAO((1 - u) * ROOM_W));
    // Seitenwände innen: außen voll, zum Aufzug mit Tür
    const outerX = side === 0 ? x0 : x1, innerX = side === 0 ? x1 : x0, dirO = side === 0 ? 1 : -1;
    const sideAO = (u, v) => edgeAO(v * h, 0.5, 0.36) * edgeAO((1 - v) * h, 0.4, 0.22) * edgeAO(u * ROOM_D, 0.6, 0.3);
    // Außenwand innen (Normale zeigt ins Zimmer)
    if (side === 0) b.quad([outerX + 0.001, 0, Z0], [0, 0, ROOM_D], [0, h, 0], wallCol, type ? wp.tile : T.PLAIN, 8, 6, sideAO);
    else b.quad([outerX - 0.001, 0, ZF], [0, 0, -ROOM_D], [0, h, 0], wallCol, type ? wp.tile : T.PLAIN, 8, 6, (u, v) => sideAO(1 - u, v));
    // Innenwand mit Türöffnung (3 Teile: hinten, vorn, Sturz) als dünne Quader
    const wx0 = side === 0 ? innerX - 0.1 : innerX, wx1 = wx0 + 0.1;
    b.box(wx0, 0, Z0, wx1, h, DOOR_Z0, wallCol, T.PLAIN, 'pxnxpz', true);
    b.box(wx0, 0, DOOR_Z1, wx1, h, ZF, wallCol, T.PLAIN, 'pxnxnzpz', true);
    b.box(wx0, DOOR_H, DOOR_Z0, wx1, h, DOOR_Z1, wallCol, T.PLAIN, 'pxnxny', true);
    // Türrahmen in Akzentfarbe
    const L = this.look; const fx0 = wx0 - 0.03, fx1 = wx1 + 0.03;
    b.box(fx0, 0, DOOR_Z0 - 0.08, fx1, DOOR_H + 0.08, DOOR_Z0, L.akzent, T.PLAIN, 'pxnxpz');
    b.box(fx0, 0, DOOR_Z1, fx1, DOOR_H + 0.08, DOOR_Z1 + 0.08, L.akzent, T.PLAIN, 'pxnxnzpz');
    b.box(fx0, DOOR_H, DOOR_Z0, fx1, DOOR_H + 0.08, DOOR_Z1, L.akzent, T.PLAIN, 'pxnxny');
    // Fenster in der Rückwand: Rahmen + Ausblick
    const wxC = x0 + ROOM_W / 2, ww = 1.5, wh = 1.1, wy = 1.15;
    const win = this.look.sterne ? T.NIGHTWIN : T.WINDOW;
    b.quad([wxC - ww / 2, wy, Z0 + 0.01], [ww, 0, 0], [0, wh, 0], '#ffffff', win, 1, 1);
    b.box(wxC - ww / 2 - 0.09, wy - 0.09, Z0, wxC + ww / 2 + 0.09, wy, Z0 + 0.09, '#ffffff', T.PLAIN, 'pypzny');
    b.box(wxC - ww / 2 - 0.09, wy + wh, Z0, wxC + ww / 2 + 0.09, wy + wh + 0.09, Z0 + 0.06, '#ffffff', T.PLAIN, 'pzny');
    b.box(wxC - ww / 2 - 0.09, wy, Z0, wxC - ww / 2, wy + wh, Z0 + 0.06, '#ffffff', T.PLAIN, 'pzpx');
    b.box(wxC + ww / 2, wy, Z0, wxC + ww / 2 + 0.09, wy + wh, Z0 + 0.06, '#ffffff', T.PLAIN, 'pznx');
    b.box(wxC - 0.03, wy, Z0, wxC + 0.03, wy + wh, Z0 + 0.04, '#ffffff', T.PLAIN, 'pz');
    // Decke (Unterseite der nächsten Platte) heller
    b.quad([x0, h - 0.001, Z0], [ROOM_W, 0, 0], [0, 0, ROOM_D], '#fffaf4', T.PLAIN, 6, 4, (u, v) => edgeAO(v * ROOM_D, 0.5, 0.2) * 0.95);
    // Fußleiste
    b.box(x0, 0, Z0, x1, 0.12, Z0 + 0.05, '#ffffff', T.PLAIN, 'pzpy');
    // leeres Zimmer: Baustellen-Markierung (gestrichelte Kante)
    if (!type) for (let i = 0; i < 8; i++) b.box(x0 + 0.25 + i * 0.56, 0.004, ZF - 0.32, x0 + 0.53 + i * 0.56, 0.02, ZF - 0.22, '#f2c46d', T.PLAIN, 'py');
  }
  liftColumn(b, f, top) {
    const L = this.look, h = FH - SLAB;
    // Schacht-Rückwand + Schienen + Landefläche
    b.quad([-LIFT / 2, 0, Z0 + 0.002], [LIFT, 0, 0], [0, h, 0], L.akzent, T.PLAIN, 3, 4, (u, v) => 0.86 + 0.14 * Math.sin(u * Math.PI));
    for (const sx of [-0.45, 0.45]) b.box(sx - 0.04, 0, Z0, sx + 0.04, h, Z0 + 0.1, '#ffffff', T.PLAIN, 'pzpxnx');
    b.quad([-LIFT / 2, 0.003, ZF], [LIFT, 0, 0], [0, 0, -ROOM_D], f === 0 ? '#f5ece2' : '#f6efe7', T.LOBBY, 2, 5, (u, v) => edgeAO(v * ROOM_D, 0.5, 0.25));
    // Aufzugtür-Rahmen (Bogen angedeutet)
    b.box(-0.62, 0, Z0 + 0.6, -0.52, 2.2, Z0 + 0.72, '#ffffff', T.PLAIN, 'pzpxnx');
    b.box(0.52, 0, Z0 + 0.6, 0.62, 2.2, Z0 + 0.72, '#ffffff', T.PLAIN, 'pzpxnx');
    b.box(-0.62, 2.2, Z0 + 0.6, 0.62, 2.34, Z0 + 0.72, '#ffffff', T.PLAIN, 'pzpyny');
    // Etagen-Licht über der Tür (leuchtet über Bloom)
    b.box(-0.12, 2.42, Z0 + 0.62, 0.12, 2.56, Z0 + 0.7, '#fff3b0', T.PLAIN, 'pz', false);
  }
  buildFloor(f, fl) {
    const b = new GeoBuilder();
    this.buildShell(b, f * FH, FH - SLAB, f);
    fl.rooms.forEach((r, s) => this.roomInterior(b, s, r, f));
    this.liftColumn(b, f);
    return b.build();
  }
  buildLobby() {
    const b = new GeoBuilder(), L = this.look, h = FH - SLAB;
    // Sockel unter dem Erdgeschoss
    b.box(-HALF_W - WT - 0.1, -0.45, Z0 - WT - 0.1, HALF_W + WT + 0.1, 0, ZF + 0.25, L.sockel, T.PLAIN, 'pxnxpzpy');
    // Boden
    b.quad([-HALF_W, 0.002, ZF], [HALF_W * 2, 0, 0], [0, 0, -ROOM_D], '#fbf3ea', T.LOBBY, 14, 8, (u, v) => edgeAO(v * ROOM_D) * edgeAO(u * HALF_W * 2) * edgeAO((1 - u) * HALF_W * 2), [1, 1]);
    // Rückwand mit zwei Fenstern
    const wall = this.look.sterne ? '#e3e8fb' : '#fff0dc';
    b.quad([-HALF_W, 0, Z0 + 0.001], [HALF_W * 2, 0, 0], [0, h, 0], wall, this.look.sterne ? T.STARS : T.STRIPES, 18, 6, (u, v) => edgeAO(v * h, 0.5, 0.36) * edgeAO((1 - v) * h, 0.4, 0.2) * edgeAO(u * HALF_W * 2) * edgeAO((1 - u) * HALF_W * 2));
    const win = this.look.sterne ? T.NIGHTWIN : T.WINDOW;
    for (const cx of [-3.2]) {
      b.quad([cx - 0.9, 1.0, Z0 + 0.01], [1.8, 0, 0], [0, 1.2, 0], '#ffffff', win, 1, 1);
      b.box(cx - 1.0, 0.9, Z0, cx + 1.0, 1.0, Z0 + 0.1, '#ffffff', T.PLAIN, 'pypz');
      b.box(cx - 1.0, 2.2, Z0, cx + 1.0, 2.3, Z0 + 0.06, '#ffffff', T.PLAIN, 'pzny');
      b.box(cx - 1.0, 1.0, Z0, cx - 0.9, 2.2, Z0 + 0.06, '#ffffff', T.PLAIN, 'pz');
      b.box(cx + 0.9, 1.0, Z0, cx + 1.0, 2.2, Z0 + 0.06, '#ffffff', T.PLAIN, 'pz');
    }
    // Außenwände: links mit Eingangstür (z 0..1.2), rechts voll
    const x0 = -HALF_W - WT, dz0 = 0.0, dz1 = 1.25;
    b.box(x0, 0, Z0 - WT, -HALF_W, h, dz0, L.wand, this.facadeTile(), 'nxpxpz', true);
    b.box(x0, 0, dz1, -HALF_W, h, ZF, L.wand, this.facadeTile(), 'nxpxnzpz', true);
    b.box(x0, 2.3, dz0, -HALF_W, h, dz1, L.wand, this.facadeTile(), 'nxpxny', true);
    b.box(x0 - 0.06, 0, dz0 - 0.1, -HALF_W + 0.04, 2.38, dz0, L.akzent, T.PLAIN, 'nxpzpx');
    b.box(x0 - 0.06, 0, dz1, -HALF_W + 0.04, 2.38, dz1 + 0.1, L.akzent, T.PLAIN, 'nxnzpzpx');
    b.box(x0 - 0.06, 2.3, dz0 - 0.1, -HALF_W + 0.04, 2.42, dz1 + 0.1, L.akzent, T.PLAIN, 'nxpyny');
    // Vordach über dem Eingang (gestreift)
    b.box(x0 - 1.1, 2.5, dz0 - 0.35, x0, 2.62, dz1 + 0.35, L.dach, T.STRIPES, 'pynynxpznz');
    b.box(-HALF_W - 0.02, 0, ZF - 0.02, -HALF_W + 0.02, h, ZF, L.wand, T.PLAIN, 'pz');
    b.box(HALF_W, 0, Z0 - WT, HALF_W + WT, h, ZF, L.wand, this.facadeTile(), 'pxnxpz', true);
    b.box(-HALF_W - WT - 0.02, h - 0.02, ZF - 0.04, HALF_W + WT + 0.02, h + 0.0, ZF + 0.1, L.akzent, T.PLAIN, 'pz');
    // Innen: Wände an den Seiten innen tapeziert
    b.quad([-HALF_W + 0.001, 0, Z0], [0, 0, dz0 - Z0], [0, h, 0], wall, T.PLAIN, 3, 4, (u, v) => edgeAO(v * h, 0.5, 0.3));
    b.quad([HALF_W - 0.001, 0, ZF], [0, 0, -ROOM_D], [0, h, 0], wall, T.PLAIN, 6, 4, (u, v) => edgeAO(v * h, 0.5, 0.3) * edgeAO((1 - u) * ROOM_D, 0.6, 0.25));
    b.quad([-HALF_W, h - 0.001, Z0], [HALF_W * 2, 0, 0], [0, 0, ROOM_D], '#fffaf4', T.PLAIN, 10, 4, (u, v) => edgeAO(v * ROOM_D, 0.5, 0.2) * 0.95);
    b.box(-HALF_W, 0, Z0, HALF_W, 0.12, Z0 + 0.05, '#ffffff', T.PLAIN, 'pzpy');
    // Aufzug hinten in der Mitte
    b.quad([-LIFT / 2, 0, Z0 + 0.004], [LIFT, 0, 0], [0, h, 0], L.akzent, T.PLAIN, 2, 3, (u, v) => 0.86 + 0.14 * Math.sin(u * Math.PI));
    for (const sx of [-0.45, 0.45]) b.box(sx - 0.04, 0, Z0, sx + 0.04, h, Z0 + 0.1, '#ffffff', T.PLAIN, 'pzpxnx');
    b.box(-0.9, 0, Z0, -0.8, 2.4, Z0 + 0.7, '#ffffff', T.PLAIN, 'pzpxnx');
    b.box(0.8, 0, Z0, 0.9, 2.4, Z0 + 0.7, '#ffffff', T.PLAIN, 'pzpxnx');
    b.box(-0.9, 2.4, Z0, 0.9, 2.55, Z0 + 0.7, '#ffffff', T.PLAIN, 'pzpyny');
    // Rezeption: Theke mit Holzfront + Platte + Klingel, Schild darüber
    const dx0 = 3.15, dx1 = 5.35, dz = -0.55;
    b.box(dx0, 0, dz - 0.75, dx1, 1.0, dz, '#f6dfc6', T.DESK, 'pzpxnx', true);
    b.box(dx0 - 0.08, 1.0, dz - 0.82, dx1 + 0.08, 1.1, dz + 0.1, L.akzent, T.PLAIN, 'pypzpxnxny');
    b.box(4.0, 1.1, dz - 0.3, 4.16, 1.2, dz - 0.14, '#ffd36b', T.PLAIN, 'pypzpxnx');
    b.box(3.5, 2.05, Z0 + 0.02, 5.0, 2.65, Z0 + 0.08, '#ffffff', T.PLAIN, 'pz');
    b.quad([3.55, 2.1, Z0 + 0.085], [1.4, 0, 0], [0, 0.5, 0], '#ffffff', T.SIGN, 1, 1);
    return b.build();
  }
  buildRoof() {
    const g = new THREE.Group(), L = this.look, b = new GeoBuilder();
    const xr = HALF_W + 0.7, zb = Z0 - 0.7, zf = ZF + 0.7;
    if (L.dachForm === 'kuppel') {
      b.box(-HALF_W - WT - 0.2, -SLAB, Z0 - WT - 0.2, HALF_W + WT + 0.2, 0.3, ZF + 0.3, L.sockel, T.METAL, 'pxnxpzpyny');
      b.box(-HALF_W - WT - 0.25, 0.3, ZF + 0.25, HALF_W + WT + 0.25, 0.42, ZF + 0.38, L.dachKante, T.PLAIN, 'pzpy', false);
      // Schild
      b.box(-1.7, 0.3, 1.2, 1.7, 2.2, 1.35, '#ffffff', T.PLAIN, 'pznx');
      b.quad([-1.6, 0.4, 1.36], [3.2, 0, 0], [0, 1.7, 0], '#ffffff', T.SIGN, 1, 1);
      const m = new THREE.Mesh(b.build(), this.mat); m.castShadow = true; m.receiveShadow = true; g.add(m);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(4.6, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), this.glassMat);
      dome.scale.set(1.25, 0.75, 0.55); dome.position.set(0, 0.3, -0.6); dome.renderOrder = 5; g.add(dome);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(4.6, 0.12, 8, 48), new THREE.MeshLambertMaterial({ color: L.dachKante }));
      ring.rotation.x = Math.PI / 2; ring.scale.set(1.25, 0.55, 1); ring.position.set(0, 0.32, -0.6); g.add(ring);
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.6), new THREE.MeshLambertMaterial({ color: 0xdde3f0 }));
      ant.position.set(3.6, 3.4, -0.8); g.add(ant);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), new THREE.MeshBasicMaterial({ color: 0xff8a7a }));
      tip.position.set(3.6, 4.25, -0.8); g.add(tip); this.blink = tip;
      return g;
    }
    // Giebeldach: Traufe vorn/hinten, First in der Mitte
    const ridge = 2.7, y0 = -0.02;
    b.box(-HALF_W - WT, -SLAB, Z0 - WT, HALF_W + WT, 0.02, ZF + 0.12, L.sockel, T.PLAIN, 'pxnxny');
    const roofC = L.dach;
    // vordere Dachfläche (Normale nach vorn-oben)
    b.quad([-xr, y0, zf], [xr * 2, 0, 0], [0, ridge, (zb + zf) / 2 - zf], roofC, T.ROOF, 1, 1, null, [1, 1]);
    b.quad([xr, y0, zb], [-xr * 2, 0, 0], [0, ridge, (zb + zf) / 2 - zb], roofC, T.ROOF, 1, 1, () => 0.85);
    // Giebeldreiecke (als dünne Quader-Stufen)
    for (const sx of [-1, 1]) {
      const x = sx * (HALF_W + WT);
      for (let i = 0; i < 6; i++) { const t0 = i / 6, t1 = (i + 1) / 6; const hz = (zf - zb) / 2 * (1 - t0) - 0.65; b.box(sx < 0 ? x : x - 0.18, y0 + ridge * t0 * 0.92, (zb + zf) / 2 - hz, sx < 0 ? x + 0.18 : x, y0 + ridge * t1 * 0.92, (zb + zf) / 2 + hz, L.wand, T.SIDING, sx < 0 ? 'nxpz' : 'pxpz'); }
    }
    // Traufkante
    b.box(-xr - 0.05, y0 - 0.14, zf - 0.04, xr + 0.05, y0 + 0.08, zf + 0.12, L.dachKante, T.PLAIN, 'pzpyny', false);
    // Schornstein
    b.box(3.2, 0.9, -1.4, 3.9, 3.0, -0.7, '#f3c6a8', T.PLAIN, 'pxnxpzpy');
    b.box(3.1, 3.0, -1.5, 4.0, 3.2, -0.6, L.dachKante, T.PLAIN, 'pxnxpzpy');
    // Schild auf der Dachfläche
    b.box(-1.75, 0.45, 1.75, 1.75, 2.35, 1.95, '#ffffff', T.PLAIN, 'pzpxnxpy');
    b.quad([-1.65, 0.55, 1.96], [3.3, 0, 0], [0, 1.7, 0], '#ffffff', T.SIGN, 1, 1);
    const m = new THREE.Mesh(b.build(), this.mat); m.castShadow = true; m.receiveShadow = true; g.add(m);
    return g;
  }
}
