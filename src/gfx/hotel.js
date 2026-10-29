// Das Hotel in der 3D-Draufsicht: Lobby vorn, Mittelgang mit Zimmern links/rechts, Flügel nach hinten, 1. Stock über
// den Flügeln 1–4. Keine Decken. Wände, die zwischen Kamera und einem Raum stehen, werden abgesenkt (Sims-Cutaway);
// nur Außenwände auf der kameraabgewandten Seite bleiben hoch (mit Fenstern). Je Ebene EIN verschmolzenes Mesh.
import * as THREE from 'three';
import { GeoBuilder } from './geo.js';
import { atlasTexture, T, WALLPAPERS, DEFAULT_WALL, FLOOR_TILE } from './atlas.js';
import { DESK_FRONT, DESK_DEPTH, FH, HALF_W, CORR, ROOM_W, ROOM_D, LOBBY_Z0, LOBBY_Z1, roomX0, roomZ0, wingLevel, wingRow, wingZc, ROWS_PER_LEVEL, DOOR_GZ } from '../core/layout.js';
import { CELL } from '../core/catalog.js';

const WH = 2.25, WT = 0.16, LOW = 0.38, DOOR_H = 2.05, SLAB = 0.22;
const edgeAO = (d, r = 0.55, s = 0.3) => 1 - s * Math.exp(-Math.max(0, d) / r * 2.2);

export class HotelView {
  constructor(scene, world) {
    this.scene = scene; this.world = world; this.look = world.look;
    this.group = new THREE.Group(); scene.add(this.group);
    this.mat = new THREE.MeshLambertMaterial({ vertexColors: true, map: atlasTexture() });
    this.levelGroups = []; this.anims = []; this.view = { x: 0, z: -1 }; this.viewKey = ''; this.showLevel = 99;
    this.glassMat = new THREE.MeshLambertMaterial({ color: 0xd8ecff, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide, emissive: 0x223355 });
    this.domeOpacity = 0.16;
  }
  dispose() { this.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); this.scene.remove(this.group); }
  // Blickrichtung (Kamera → Ziel, waagerecht). Baut die Wände neu, wenn sich die 45°-Richtung ändert.
  setView(dx, dz) {
    const a = Math.atan2(dx, dz), k = Math.round(a / (Math.PI / 4));
    const key = String(((k % 8) + 8) % 8);
    this.view = { x: dx, z: dz };
    if (key !== this.viewKey && this.hotel) { this.viewKey = key; this.rebuild(this.hotel); return true; }
    this.viewKey = key; return false;
  }
  rebuild(hotel, newWing = -1) {
    this.hotel = hotel;
    for (const g of this.levelGroups) { g.traverse((o) => o.geometry && o.geometry.dispose()); this.group.remove(g); }
    this.levelGroups = []; this.domes = [];
    const n = hotel.floors.length, levels = n ? wingLevel(n) + 1 : 1;
    for (let L = 0; L < levels; L++) {
      const g = new THREE.Group(); g.userData.level = L;
      const m = new THREE.Mesh(this.buildLevel(hotel, L), this.mat); m.receiveShadow = true; m.castShadow = true;
      g.add(m); g.position.y = L * FH;
      if (this.look.dachForm === 'kuppel') g.add(this.buildDomes(hotel, L));
      this.group.add(g); this.levelGroups.push(g);
    }
    this.topY = (levels - 1) * FH + WH;
    this.levels = levels;
    if (newWing > 0) {
      const g = this.levelGroups[wingLevel(newWing)];
      this.anims.push({ t: 0, dur: 0.7, fn: (k) => { g.position.y = wingLevel(newWing) * FH - (1 - k) * (1 - k) * 0.25; } });
    }
    this.showUpTo(this.showLevel);
  }
  update(dt) {
    for (const a of this.anims) { a.t += dt; a.fn(Math.min(1, a.t / a.dur)); }
    this.anims = this.anims.filter((a) => a.t < a.dur);
    if (this.domes) for (const d of this.domes) d.material.opacity = this.domeOpacity;
  }
  // Ebenen oberhalb ausblenden (Etagen-Knöpfe, Einrichten)
  showUpTo(L) { this.showLevel = L; this.levelGroups.forEach((g, i) => (g.visible = i <= L)); }

  // ---------- Grundriss → Wände ----------
  wallFace(space) {
    if (space === 'out') return { color: this.look.wand, tile: this.look.fassade === 'metall' ? T.METAL : T.SIDING };
    if (space === 'corr') return { color: this.look.sterne ? '#e9ecf8' : '#fff3e6', tile: T.PLAIN };
    if (space === 'lobby') return { color: this.look.sterne ? '#e3e8fb' : '#fff0dc', tile: this.look.sterne ? T.STARS : T.STRIPES };
    const r = space.room, type = r.type;
    if (!type) return { color: '#efe8df', tile: T.PLAIN };
    const wp = WALLPAPERS[r.wall ?? ((DEFAULT_WALL[type] ?? 7) + (type === 'schlaf' ? (space.w * 2 + space.side) % 6 : 0)) % WALLPAPERS.length] || WALLPAPERS[7];
    return { color: wp.color, tile: wp.tile };
  }
  // Wand entlang x (konstantes z) oder entlang z (konstantes x). plus/minus = Raum auf der +/− Seite der Normalen.
  wall(b, axis, c, a0, a1, plus, minus, opts = {}) {
    // Absenken: steht die Wand quer zur Blickrichtung, verdeckt sie den Raum dahinter → tief, außer dahinter ist draußen
    const d = axis === 'z' ? this.view.z : this.view.x;          // Normale der Wand zeigt entlang 'axis'
    let h = WH;
    if (Math.abs(d) > 0.38) { const far = d < 0 ? minus : plus; if (far !== 'out') h = LOW; }
    if (opts.forceLow) h = LOW;
    const fP = this.wallFace(plus), fM = this.wallFace(minus), top = h < WH ? this.look.akzent : '#ffffff';
    const pieces = [];
    let s = a0;
    for (const o of (opts.doors || []).sort((x, y) => x.a - y.a)) { if (o.a > s) pieces.push([s, o.a, 0, h]); if (h > (o.h || DOOR_H)) pieces.push([o.a, o.b, o.h || DOOR_H, h]); s = o.b; }
    if (a1 > s) pieces.push([s, a1, 0, h]);
    for (const [p0, p1, y0, y1] of pieces) {
      const L = p1 - p0, H = y1 - y0;
      if (axis === 'z') {   // Wand bei z = c, verläuft entlang x
        const z0 = c - WT / 2, z1 = c + WT / 2;
        b.quad([p0, y0, z1], [L, 0, 0], [0, H, 0], fP.color, fP.tile, Math.max(1, Math.round(L * 1.5)), 3, (u, v) => this.wallAO(v * H + y0, u * L, L), [L / ROOM_W, H / WH]);
        b.quad([p1, y0, z0], [-L, 0, 0], [0, H, 0], fM.color, fM.tile, Math.max(1, Math.round(L * 1.5)), 3, (u, v) => this.wallAO(v * H + y0, u * L, L), [L / ROOM_W, H / WH]);
        b.box(p0, y1 - 0.0, z0, p1, y1 + 0.05, z1, top, T.PLAIN, 'py', false);
        b.box(p0, y0, z0, p0 + 0.001, y1, z1, '#f4ece4', T.PLAIN, 'nx'); b.box(p1 - 0.001, y0, z0, p1, y1, z1, '#f4ece4', T.PLAIN, 'px');
        if (y0 > 0) b.box(p0, y0 - 0.001, z0, p1, y0, z1, '#f4ece4', T.PLAIN, 'ny');
      } else {              // Wand bei x = c, verläuft entlang z
        const x0 = c - WT / 2, x1 = c + WT / 2;
        b.quad([x1, y0, p1], [0, 0, -L], [0, H, 0], fP.color, fP.tile, Math.max(1, Math.round(L * 1.5)), 3, (u, v) => this.wallAO(v * H + y0, u * L, L), [L / ROOM_D, H / WH]);
        b.quad([x0, y0, p0], [0, 0, L], [0, H, 0], fM.color, fM.tile, Math.max(1, Math.round(L * 1.5)), 3, (u, v) => this.wallAO(v * H + y0, u * L, L), [L / ROOM_D, H / WH]);
        b.box(x0, y1, p0, x1, y1 + 0.05, p1, top, T.PLAIN, 'py', false);
        b.box(x0, y0, p0, x1, y1, p0 + 0.001, '#f4ece4', T.PLAIN, 'nz'); b.box(x0, y0, p1 - 0.001, x1, y1, p1, '#f4ece4', T.PLAIN, 'pz');
        if (y0 > 0) b.box(x0, y0 - 0.001, p0, x1, y0, p1, '#f4ece4', T.PLAIN, 'ny');
      }
    }
    // Türrahmen
    for (const o of opts.doors || []) if (!o.noFrame) {
      const fy = Math.min(h, (o.h || DOOR_H) + 0.08), A = this.look.akzent;
      if (axis === 'z') { for (const px of [o.a - 0.07, o.b]) b.box(px, 0, c - WT / 2 - 0.03, px + 0.07, fy, c + WT / 2 + 0.03, A, T.PLAIN, 'pxnxpznzpy'); }
      else { for (const pz of [o.a - 0.07, o.b]) b.box(c - WT / 2 - 0.03, 0, pz, c + WT / 2 + 0.03, fy, pz + 0.07, A, T.PLAIN, 'pxnxpznzpy'); }
    }
    // Fenster auf hohen Außenwänden (Innenseite)
    if (h === WH && opts.window && (plus === 'out' || minus === 'out')) {
      const inPlus = minus === 'out';            // Innenraum auf der +Seite
      const mid = (a0 + a1) / 2, ww = Math.min(1.6, (a1 - a0) * 0.4), wy = 0.85, wh = 0.95;
      const win = this.look.sterne ? T.NIGHTWIN : T.WINDOW, off = (WT / 2 + 0.012) * (inPlus ? 1 : -1);
      if (axis === 'z') {
        if (inPlus) b.quad([mid - ww / 2, wy, c + off], [ww, 0, 0], [0, wh, 0], '#ffffff', win, 1, 1); else b.quad([mid + ww / 2, wy, c + off], [-ww, 0, 0], [0, wh, 0], '#ffffff', win, 1, 1);
        b.box(mid - ww / 2 - 0.08, wy - 0.08, c + off - 0.04, mid + ww / 2 + 0.08, wy, c + off + 0.04, '#ffffff', T.PLAIN, 'pypznz');
      } else {
        if (inPlus) b.quad([c + off, wy, mid + ww / 2], [0, 0, -ww], [0, wh, 0], '#ffffff', win, 1, 1); else b.quad([c + off, wy, mid - ww / 2], [0, 0, ww], [0, wh, 0], '#ffffff', win, 1, 1);
        b.box(c + off - 0.04, wy - 0.08, mid - ww / 2 - 0.08, c + off + 0.04, wy, mid + ww / 2 + 0.08, '#ffffff', T.PLAIN, 'pypxnx');
      }
    }
  }
  wallAO(y, u, L) { return edgeAO(y, 0.45, 0.3) * edgeAO(u, 0.5, 0.18) * edgeAO(L - u, 0.5, 0.18) * (0.9 + 0.1 * Math.min(1, y / WH)); }
  floorQuad(b, x0, z0, w, d, color, tile, uvs = [1, 1]) {
    b.quad([x0, 0.002, z0 + d], [w, 0, 0], [0, 0, -d], color, tile, Math.max(2, Math.round(w * 2)), Math.max(2, Math.round(d * 2)),
      (u, v) => edgeAO(u * w) * edgeAO((1 - u) * w) * edgeAO(v * d) * edgeAO((1 - v) * d), uvs);
  }
  // ---------- eine Ebene ----------
  buildLevel(hotel, L) {
    const b = new GeoBuilder(), Lk = this.look;
    const wings = hotel.floors.map((f, i) => ({ w: i + 1, f })).filter((x) => wingLevel(x.w) === L);
    const rows = wings.length;
    const zBack = LOBBY_Z0 - rows * ROOM_D;
    // Sockel / Boden-Platte unter der Ebene
    if (L === 0) b.box(-HALF_W - 0.35, -0.3, zBack - 0.35, HALF_W + 0.35, 0.0, LOBBY_Z1 + 0.35, Lk.sockel, T.PLAIN, 'pxnxpznzpy');
    else if (rows) b.box(-HALF_W - 0.1, -SLAB, zBack - 0.1, HALF_W + 0.1, 0, LOBBY_Z0 + 0.1, Lk.sockel, T.PLAIN, 'pxnxpznzpyny');
    // Lobby (nur Erdgeschoss)
    if (L === 0) this.buildLobby(b);
    // Flügel
    for (const { w, f } of wings) {
      const r = wingRow(w), z0 = roomZ0(w), z1 = z0 + ROOM_D, last = r === rows;
      f.rooms.forEach((room, side) => {
        const [ft, fc] = room.type ? FLOOR_TILE[room.type] : [T.PLAIN, '#e7ddd2'];
        this.floorQuad(b, roomX0(side), z0, ROOM_W, ROOM_D, fc, ft);
        if (!room.type) for (let i = 0; i < 8; i++) b.box(roomX0(side) + 0.25 + i * 0.56, 0.004, z1 - 0.32, roomX0(side) + 0.53 + i * 0.56, 0.02, z1 - 0.22, '#f2c46d', T.PLAIN, 'py');
      });
      // Gang mit Läufer
      this.floorQuad(b, -CORR / 2, z0, CORR, ROOM_D, Lk.sterne ? '#e6e9f5' : '#f6ece2', T.PLAIN);
      b.box(-0.42, 0.003, z0, 0.42, 0.012, z1, Lk.akzent, T.LOBBY, 'py');
      const A = { room: f.rooms[0], w, side: 0 }, B = { room: f.rooms[1], w, side: 1 };
      const dz0 = z0 + DOOR_GZ * CELL, dz1 = dz0 + CELL;
      // Außenwände links/rechts (mit Fenster), Gangwände mit Türen
      this.wall(b, 'x', -HALF_W, z0, z1, A, 'out', { window: true });
      this.wall(b, 'x', HALF_W, z0, z1, 'out', B, { window: true });
      this.wall(b, 'x', -CORR / 2, z0, z1, 'corr', A, { doors: [{ a: dz0 + 0.06, b: dz1 - 0.06 }] });
      this.wall(b, 'x', CORR / 2, z0, z1, B, 'corr', { doors: [{ a: dz0 + 0.06, b: dz1 - 0.06 }] });
      // Trennwand nach hinten (bzw. Rückwand außen beim letzten Flügel)
      const behind = last ? 'out' : null;
      this.wall(b, 'z', z0, -HALF_W, -CORR / 2, A, behind || { room: hotel.floors[w].rooms[0], w: w + 1, side: 0 }, { window: last });
      this.wall(b, 'z', z0, CORR / 2, HALF_W, B, behind || { room: hotel.floors[w].rooms[1], w: w + 1, side: 1 }, { window: last });
      if (last) this.wall(b, 'z', z0, -CORR / 2, CORR / 2, 'corr', 'out', { window: true });
      // vorn: im Erdgeschoss Flügel 1 an der Lobby-Rückwand (baut buildLobby), sonst Wand zum vorderen Flügel bzw. außen
      if (r === 1 && L > 0) {
        this.wall(b, 'z', z1, -HALF_W, -CORR / 2, 'out', A, {});
        this.wall(b, 'z', z1, CORR / 2, HALF_W, 'out', B, {});
        this.wall(b, 'z', z1, -CORR / 2, CORR / 2, 'out', 'corr', {});
      }
    }
    // nächster Bauplatz (Erdgeschoss): gestrichelter Umriss auf dem Rasen
    const nx = hotel.floors.length + 1;
    if (L === 0 && nx <= ROWS_PER_LEVEL) {
      const z1p = roomZ0(nx) + ROOM_D, z0p = roomZ0(nx);
      for (let x = -HALF_W; x < HALF_W - 0.1; x += 0.7) { b.box(x, 0.01, z0p - 0.06, x + 0.4, 0.05, z0p + 0.06, '#ffd27a', T.PLAIN, 'py'); }
      for (let z = z0p; z < z1p - 0.1; z += 0.7) for (const x of [-HALF_W, HALF_W]) b.box(x - 0.06, 0.01, z, x + 0.06, 0.05, z + 0.4, '#ffd27a', T.PLAIN, 'py');
    }
    // Aufzug am Gang-Anfang (wenn es einen 1. Stock gibt oder geben wird): Glas-Pfosten + Plattform
    if (rows) {
      const zl = LOBBY_Z0 - 0.7;
      for (const [x, z] of [[-0.62, zl - 0.55], [0.62, zl - 0.55], [-0.62, zl + 0.55], [0.62, zl + 0.55]]) b.box(x - 0.05, 0, z - 0.05, x + 0.05, WH * 0.9, z + 0.05, '#ffffff', T.PLAIN, 'pxnxpznz');
      b.box(-0.62, WH * 0.9, zl - 0.6, 0.62, WH * 0.9 + 0.08, zl + 0.6, Lk.akzent, T.PLAIN, 'py');
    }
    return b.build();
  }
  buildLobby(b) {
    const Lk = this.look, z0 = LOBBY_Z0, z1 = LOBBY_Z1;
    this.floorQuad(b, -HALF_W, z0, HALF_W * 2, z1 - z0, '#fbf3ea', T.LOBBY, [3, 1]);
    // Teppich-Weg vom Eingang zur Theke
    b.box(-5.3, 0.003, 0.25, 3.0, 0.012, 0.95, Lk.akzent, T.LOBBY, 'py');
    // Rückwand zur Flügel-Reihe 1 (Durchgang zum Gang in der Mitte), Seitenwände (links Eingang), Front (außen)
    const n = this.hotel.floors.length;
    const f1 = n ? this.hotel.floors[0] : null;
    const backA = f1 ? { room: f1.rooms[0], w: 1, side: 0 } : 'out', backB = f1 ? { room: f1.rooms[1], w: 1, side: 1 } : 'out';
    this.wall(b, 'z', z0, -HALF_W, -CORR / 2, 'lobby', backA, { window: !f1 });
    this.wall(b, 'z', z0, CORR / 2, HALF_W, 'lobby', backB, { window: !f1 });
    if (!f1) this.wall(b, 'z', z0, -CORR / 2, CORR / 2, 'lobby', 'out', {});
    this.wall(b, 'x', -HALF_W, z0, z1, 'lobby', 'out', { doors: [{ a: 0.0, b: 1.25, h: 2.2 }], window: false });
    this.wall(b, 'x', HALF_W, z0, z1, 'out', 'lobby', { window: true });
    this.wall(b, 'z', z1, -HALF_W, HALF_W, 'out', 'lobby', { window: true });
    // Vordach über dem Eingang
    b.box(-HALF_W - 1.2, 2.3, -0.3, -HALF_W - 0.05, 2.42, 1.55, Lk.dach, T.STRIPES, 'pynynxpznz');
    // Rezeption: Theke mit Holzfront + Platte + Klingel, Schild
    // Peter 29.10.: Gastgeber clippte durch die Theke (zwischen Theke und Rückwand nur 0,63 m) → Theke schmaler + nach vorn
    const dx0 = 3.15, dx1 = 5.35, dz = DESK_FRONT, dd = DESK_DEPTH;
    b.box(dx0, 0, dz - dd, dx1, 1.0, dz, '#f6dfc6', T.DESK, 'pzpxnxnz', true);
    b.box(dx0 - 0.08, 1.0, dz - dd - 0.07, dx1 + 0.08, 1.1, dz + 0.1, Lk.akzent, T.PLAIN, 'pypzpxnxny');
    b.box(4.0, 1.1, dz - 0.3, 4.16, 1.2, dz - 0.14, '#ffd36b', T.PLAIN, 'pypzpxnx');
    // Hotelschild im Vorgarten (zur Standard-Blickrichtung)
    b.box(-1.55, 0, z1 + 1.9, -1.45, 1.2, z1 + 2.0, '#ffffff', T.PLAIN, 'pxnxpznz'); b.box(1.45, 0, z1 + 1.9, 1.55, 1.2, z1 + 2.0, '#ffffff', T.PLAIN, 'pxnxpznz');
    b.box(-1.75, 1.15, z1 + 1.85, 1.75, 2.75, z1 + 2.02, Lk.akzent, T.PLAIN, 'pxnxnzpy');
    b.quad([-1.65, 1.22, z1 + 2.03], [3.3, 0, 0], [0, 1.46, 0], '#ffffff', T.SIGN, 1, 1);
  }
  // Mond: Glaskuppeln über den Räumen (ausgeblendet beim Heranzoomen, Deckkraft setzt die App)
  buildDomes(hotel, L) {
    const g = new THREE.Group(); this.domes = this.domes || [];
    const geo = new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    const add = (x, z, w, d, h) => { const m = new THREE.Mesh(geo, this.glassMat); m.scale.set(w / 2, h, d / 2); m.position.set(x, 0, z); m.renderOrder = 6; g.add(m); this.domes.push(m); };
    if (L === 0) add(0, 0, HALF_W * 2 + 1.2, LOBBY_Z1 - LOBBY_Z0 + 1.4, 3.2);
    hotel.floors.forEach((f, i) => { const w = i + 1; if (wingLevel(w) !== L) return; add(0, wingZc(w), HALF_W * 2 + 0.8, ROOM_D + 0.6, 2.9); });
    return g;
  }
}
void ROWS_PER_LEVEL;
