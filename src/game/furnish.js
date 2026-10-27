// Einrichten-Ansicht: Zimmer schräg von oben, großes Raster, Möbel aus dem Katalog ziehen (oder antippen = automatisch
// hinstellen), Geist mit grüner/roter Fläche, Einrasten zur nächsten freien Stelle, drehen, umfärben, entfernen, Rückgängig.
import * as THREE from 'three';
import { CFG } from '../config.js';
import { ITEM, ITEMS, CATS, PALETTE, CELL, FS, footprint, tintable, WISHES, ROOM_TYPES } from '../core/catalog.js';
import { canPlace, findSpot, getRoom, parseRoomId, itemAvailable } from '../core/hotel.js';
import { RW, RD, FH, roomX0, reservedCells, cellCenter, ROOM_W, ROOM_D, roomZ0, wingY, wingZc, wingLevel } from '../core/layout.js';
import { PropLayer, makePropMaterial } from '../gfx/batch.js';
import { WALLPAPERS, DEFAULT_WALL } from '../gfx/atlas.js';
import { P } from '../gfx/fx.js';

const $ = (id) => document.getElementById(id);
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();

export class Furnish {
  constructor(app) {
    this.app = app; this.bounce = new Map(); this.hiddenUid = null; this.roomId = null; this.tab = 'schlafen';
    this.sel = null; this.drag = null; this.undo = [];
    $('fDone').onclick = () => { app.sound.sfx('tap'); this.close(); };
    $('fUndo').onclick = () => this.doUndo();
    $('fWall').onclick = () => this.cycleWall();
    $('sRot').onclick = () => this.rotateSel();
    $('sDel').onclick = () => this.deleteSel();
    $('sCol').onclick = () => { $('palette').classList.toggle('hidden'); app.sound.sfx('tap'); };
    $('palette').innerHTML = PALETTE.map((c) => `<button data-c="${c}" style="background:${c}"></button>`).join('') + '<button data-c="" style="background:conic-gradient(#f4a7b9,#ffd98a,#a9e3b4,#9fd3f2,#c8b6f2,#f4a7b9)" title="Original"></button>';
    $('palette').querySelectorAll('button').forEach((b) => (b.onclick = () => this.colorSel(b.dataset.c || null)));
    $('cTabs').innerHTML = CATS.map((c) => `<button data-t="${c.id}" aria-label="${c.name}">${c.icon}</button>`).join('');
    $('cTabs').querySelectorAll('button').forEach((b) => (b.onclick = () => { this.tab = b.dataset.t; app.sound.sfx('tap'); this.renderList(); }));
  }
  get room() { return this.roomId ? getRoom(this.app.sim.hotel, this.roomId) : null; }
  open(id) {
    const app = this.app; if (app.mode !== 'hotel') return;
    const { floor, side } = parseRoomId(id);
    this.roomId = id; this.floor = floor; this.side = side; this.undo = []; this.sel = null; this.drag = null;
    app.mode = 'furnish'; app.overlay.selected = null;
    $('furnish').classList.remove('hidden'); $('hud').classList.add('hidden'); $('bar').classList.add('hidden'); $('camBtns').classList.add('hidden'); $('fSel').classList.add('hidden');
    const r = this.room;
    $('fTitle').textContent = (ROOM_TYPES[r.type]?.icon || '') + ' ' + (ROOM_TYPES[r.type]?.name || 'Zimmer');
    this.tab = { schlaf: 'schlafen', restaurant: 'essen', spa: 'bad', spiel: 'spiel' }[r.type] || 'schlafen';
    app.hotelView.showUpTo(wingLevel(floor));
    app.dirtyFurniture = true; app.shadowDirty = 2;
    this.buildGrid();
    this.renderList(); this.relayout();
    app.sound.sfx('open');
    app.tutorial.event('furnish');
  }
  close() {
    const app = this.app; if (app.mode !== 'furnish') return;
    this.cancelDrag(); this.sel = null;
    app.mode = 'hotel'; $('furnish').classList.add('hidden'); app.screens.showHud();
    app.hotelView.showUpTo(app.level ?? 99); app.camCtl.focusHotel();
    app.camCtl.h.tdist = Math.max(app.camCtl.h.dist * 1.7, 20); app.camCtl.clamp();
    if (this.grid) { this.grid.parent.remove(this.grid); this.grid = null; }
    if (this.foot) this.foot.visible = false;
    this.roomId = null; app.dirtyFurniture = true; app.shadowDirty = 2; app.save();
  }
  relayout() {
    if (!this.roomId) return;
    const cat = $('catalog').getBoundingClientRect(), W = innerWidth, H = innerHeight;
    const land = W > H && H < 560;
    const top = 70;
    const free = land ? { x: 0, y: top, w: Math.max(200, cat.left), h: H - top } : { x: 0, y: top, w: W, h: Math.max(160, cat.top - top - 70) };
    const c = new THREE.Vector3(roomX0(this.side) + ROOM_W / 2, wingY(this.floor), wingZc(this.floor));
    this.app.camCtl.focusRoom(c, free);
  }
  // Raster als Textur über dem Boden (Türzellen gelb = frei lassen)
  buildGrid() {
    const app = this.app; if (this.grid) this.grid.parent.remove(this.grid);
    const S = 64, cv = document.createElement('canvas'); cv.width = RW * S; cv.height = RD * S; const k = cv.getContext('2d');
    k.clearRect(0, 0, cv.width, cv.height);
    for (const [x, z] of reservedCells(this.side)) { k.fillStyle = 'rgba(255,214,110,0.42)'; k.fillRect(x * S + 3, z * S + 3, S - 6, S - 6); k.font = '28px sans-serif'; k.textAlign = 'center'; k.textBaseline = 'middle'; k.fillText('🚪', x * S + S / 2, z * S + S / 2); }
    k.strokeStyle = 'rgba(255,255,255,0.85)'; k.lineWidth = 3; k.setLineDash([10, 8]);
    for (let x = 0; x <= RW; x++) { k.beginPath(); k.moveTo(x * S, 0); k.lineTo(x * S, RD * S); k.stroke(); }
    for (let z = 0; z <= RD; z++) { k.beginPath(); k.moveTo(0, z * S); k.lineTo(RW * S, z * S); k.stroke(); }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, ROOM_D), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, opacity: 0.9 }));
    m.rotation.x = -Math.PI / 2; m.position.set(roomX0(this.side) + ROOM_W / 2, wingY(this.floor) + 0.012, wingZc(this.floor)); m.renderOrder = 3;
    app.worldGroup.add(m); this.grid = m;
    if (!this.foot) {
      this.foot = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x66dd88, transparent: true, opacity: 0.45, depthWrite: false }));
      this.foot.rotation.x = -Math.PI / 2; this.foot.renderOrder = 4;
      this.ghost = new PropLayer(app.worldGroup, { cast: false, material: makePropMaterial({ transparent: true, opacity: 0.82 }) }); this.ghost.addParts('moebel', app.bundles.moebel);
    }
    if (this.foot.parent !== app.worldGroup) { app.worldGroup.add(this.foot); this.ghost = new PropLayer(app.worldGroup, { cast: false, material: makePropMaterial({ transparent: true, opacity: 0.82 }) }); this.ghost.addParts('moebel', app.bundles.moebel); }
    this.foot.visible = false;
  }
  // ---------- Katalog ----------
  wanted() {
    const sim = this.app.sim, tags = new Set();
    for (const g of sim.guests) if (g.state === 'queue' || g.room === this.roomId) for (const w of g.wishes) if (WISHES[w].need) tags.add(WISHES[w].need);
    return tags;
  }
  renderList() {
    const app = this.app, h = app.sim.hotel, want = this.wanted();
    $('cTabs').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.t === this.tab));
    const items = ITEMS.filter((it) => it.cat === this.tab && (!it.welt || it.welt === app.world.id));
    items.sort((a, b) => a.stars - b.stars || a.price - b.price);
    const L = $('cList');
    L.innerHTML = items.map((it) => {
      const locked = !itemAvailable(h, it.id, app.world.id), poor = !CFG.alles && app.slot.coins < it.price;
      const w = it.tags.some((t) => want.has(t));
      return `<div class="item ${locked ? 'locked' : ''} ${poor && !locked ? 'poor' : ''} ${w && !locked ? 'want' : ''}" data-id="${it.id}" data-lock="🔒 ⭐${it.stars}"><div class="ic">${it.icon}</div><div class="nm">${it.name}</div><div class="pr">🪙 ${it.price}</div></div>`;
    }).join('');
    L.scrollLeft = 0; L.scrollTop = 0;
    L.querySelectorAll('.item').forEach((el) => {
      el.addEventListener('pointerdown', (e) => this.itemDown(e, el.dataset.id));
    });
  }
  itemDown(e, id) {
    const it = ITEM[id];
    this.pending = { id, x0: e.clientX, y0: e.clientY, pid: e.pointerId, t0: performance.now(), type: e.pointerType };
    const onMove = (ev) => {
      if (!this.pending || ev.pointerId !== this.pending.pid) return;
      const dx = ev.clientX - this.pending.x0, dy = ev.clientY - this.pending.y0;
      const land = innerWidth > innerHeight && innerHeight < 560;
      const out = land ? dx < -16 && Math.abs(dx) > Math.abs(dy) * 0.8 : dy < -16 && Math.abs(dy) > Math.abs(dx) * 0.8;
      if (out) { const p = this.pending; this.pending = null; cleanup(); this.startNewDrag(p.id, ev); }
    };
    const onUp = (ev) => {
      if (!this.pending || ev.pointerId !== this.pending.pid) return;
      const p = this.pending; this.pending = null; cleanup();
      if (Math.hypot(ev.clientX - p.x0, ev.clientY - p.y0) < 12) this.autoPlace(p.id);
    };
    const cleanup = () => { removeEventListener('pointermove', onMove); removeEventListener('pointerup', onUp); removeEventListener('pointercancel', onUp); };
    addEventListener('pointermove', onMove); addEventListener('pointerup', onUp); addEventListener('pointercancel', onUp);
    void it;
  }
  checkBuy(id) {
    const app = this.app, it = ITEM[id];
    if (!itemAvailable(app.sim.hotel, id, app.world.id)) { app.sound.sfx('nope'); app.screens.toast('⭐', `${it.name}: ab ${it.stars} Stern${it.stars > 1 ? 'en' : ''}`); return false; }
    if (!CFG.alles && app.slot.coins < it.price) { app.sound.sfx('nope'); app.screens.toast('🪙', 'Noch nicht genug Münzen'); return false; }
    return true;
  }
  autoPlace(id) {
    if (!this.checkBuy(id)) return;
    const center = [Math.floor(RW / 2) - 1, 1];
    const sp = findSpot(this.room, this.side, id, center);
    if (!sp) { this.app.sound.sfx('nope'); this.app.screens.toast('📦', 'Kein Platz mehr – räum etwas weg!'); return; }
    this.pushUndo();
    const fu = this.app.sim.buy(this.roomId, id, sp.gx, sp.gz, sp.rot);
    if (fu) this.placedFx(fu, true);
  }
  // ---------- Ziehen ----------
  startNewDrag(id, ev) {
    if (!this.checkBuy(id)) return;
    this.drag = { kind: 'new', id, rot: 0, type: ev.pointerType, pid: ev.pointerId };
    this.select(null);
    this.app.sound.sfx('pop');
    this.dragTo(ev.clientX, ev.clientY);
  }
  startMoveDrag(fu, ev) {
    this.drag = { kind: 'move', id: fu.item, uid: fu.uid, rot: fu.rot, type: ev.pointerType, pid: ev.pointerId, from: { gx: fu.gx, gz: fu.gz, rot: fu.rot } };
    this.hiddenUid = fu.uid; this.app.dirtyFurniture = true;
    this.dragTo(ev.clientX, ev.clientY);
  }
  floorPoint(x, y) {
    ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1); ray.setFromCamera(ndc, this.app.cam);
    plane.constant = -wingY(this.floor);
    return ray.ray.intersectPlane(plane, hit) ? hit.clone() : null;
  }
  dragTo(x, y) {
    const d = this.drag; if (!d) return;
    const off = d.type === 'touch' || d.type === 'pen' ? 58 : 0;   // Finger verdeckt sonst das Möbel
    const p = this.floorPoint(x, y - off); if (!p) return;
    const [fw, fd] = footprint(d.id, d.rot);
    let gx = Math.round((p.x - roomX0(this.side)) / CELL - fw / 2), gz = Math.round((p.z - roomZ0(this.floor)) / CELL - fd / 2);
    gx = Math.max(0, Math.min(RW - fw, gx)); gz = Math.max(0, Math.min(RD - fd, gz));
    d.over = p.x > roomX0(this.side) - 1.2 && p.x < roomX0(this.side) + ROOM_W + 1.2 && p.z > roomZ0(this.floor) - 1.5 && p.z < roomZ0(this.floor) + ROOM_D + 1.5;
    // Einrasten: nächste gültige Stelle im Umkreis von einer Zelle
    let ok = canPlace(this.room, this.side, d.id, gx, gz, d.rot, d.uid);
    if (!ok) {
      let best = null;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const nx = gx + dx, nz = gz + dz; if (canPlace(this.room, this.side, d.id, nx, nz, d.rot, d.uid)) { const s = Math.abs(dx) + Math.abs(dz); if (!best || s < best.s) best = { nx, nz, s }; } }
      if (best) { gx = best.nx; gz = best.nz; ok = true; }
    }
    d.gx = gx; d.gz = gz; d.ok = ok && d.over;
  }
  endDrag() {
    const d = this.drag; if (!d) return; this.drag = null;
    const app = this.app; this.hiddenUid = null; app.dirtyFurniture = true;
    if (!d.ok) { app.sound.sfx('nope'); this.foot.visible = false; this.ghost.set([]); if (d.kind === 'move') this.select(this.room.furniture.find((f) => f.uid === d.uid)); return; }
    this.pushUndo();
    if (d.kind === 'new') { const fu = app.sim.buy(this.roomId, d.id, d.gx, d.gz, d.rot); if (fu) this.placedFx(fu, true); }
    else { if (app.sim.moveItem(this.roomId, d.uid, d.gx, d.gz, d.rot)) { const fu = this.room.furniture.find((f) => f.uid === d.uid); this.placedFx(fu, false); } else this.undo.pop(); }
    this.foot.visible = false; this.ghost.set([]);
  }
  cancelDrag() { this.drag = null; this.hiddenUid = null; if (this.foot) this.foot.visible = false; this.ghost?.set([]); }
  placedFx(fu, isNew) {
    const app = this.app;
    this.bounce.set(fu.uid, { t: 0 }); app.dirtyFurniture = true; app.shadowDirty = 2;
    app.sound.sfx('plop', { rate: 0.9 + Math.random() * 0.2 });
    const c = app.furnPlacement(this.floor, this.side, fu);
    app.fx.emit(P.SPARK, { x: c.x, y: c.y + 0.4, z: c.z }, { n: isNew ? 8 : 4, up: 1.2, size: 0.45, spread: 0.6 });
    if (isNew) app.fx.emit(P.HEART, { x: c.x, y: c.y + 0.8, z: c.z }, { n: 2, size: 0.4 });
    this.select(fu); this.renderList();
    app.tutorial.event('placed');
  }
  // ---------- Auswahl ----------
  select(fu) {
    this.sel = fu ? fu.uid : null;
    $('fSel').classList.toggle('hidden', !fu); $('palette').classList.add('hidden');
    if (fu) $('sCol').style.display = tintable(fu.item) ? '' : 'none';
  }
  selFu() { return this.sel !== null ? this.room?.furniture.find((f) => f.uid === this.sel) : null; }
  rotateSel() {
    const fu = this.selFu(); if (!fu) return;
    const nr = (fu.rot + 1) % 4;
    let spot = canPlace(this.room, this.side, fu.item, fu.gx, fu.gz, nr, fu.uid) ? { gx: fu.gx, gz: fu.gz } : null;
    if (!spot) for (let r = 1; r <= 2 && !spot; r++) for (let dz = -r; dz <= r && !spot; dz++) for (let dx = -r; dx <= r && !spot; dx++) if (canPlace(this.room, this.side, fu.item, fu.gx + dx, fu.gz + dz, nr, fu.uid)) spot = { gx: fu.gx + dx, gz: fu.gz + dz };
    if (!spot) { this.app.sound.sfx('nope'); this.app.screens.toast('🔄', 'Zum Drehen ist hier kein Platz'); return; }
    this.pushUndo(); this.app.sim.moveItem(this.roomId, fu.uid, spot.gx, spot.gz, nr); this.placedFx(fu, false);
  }
  deleteSel() {
    const fu = this.selFu(); if (!fu) return;
    this.pushUndo(); const c = this.app.furnPlacement(this.floor, this.side, fu);
    this.app.sim.removeItem(this.roomId, fu.uid); this.select(null);
    this.app.sound.sfx('undo'); this.app.fx.emit(P.DUST, { x: c.x, y: c.y + 0.3, z: c.z }, { n: 8, up: 0.8, size: 0.7, spread: 0.6 });
    this.renderList();
  }
  colorSel(col) { const fu = this.selFu(); if (!fu) return; this.pushUndo(); this.app.sim.recolor(this.roomId, fu.uid, col); this.placedFx(fu, false); $('palette').classList.add('hidden'); }
  cycleWall() {
    const r = this.room; this.pushUndo();
    const cur = r.wall ?? ((DEFAULT_WALL[r.type] ?? 7) + (r.type === 'schlaf' ? (this.floor * 2 + this.side) % 6 : 0)) % WALLPAPERS.length; r.wall = (cur + 1) % WALLPAPERS.length;
    this.app.hotelView.rebuild(this.app.sim.hotel); this.app.hotelView.showUpTo(wingLevel(this.floor)); this.app.shadowDirty = 2;
    this.app.sound.sfx('pop'); this.app.fx.emit(P.SPARK, { x: roomX0(this.side) + ROOM_W / 2, y: wingY(this.floor) + 1.6, z: roomZ0(this.floor) + 0.3 }, { n: 10, spread: 2, size: 0.5 });
  }
  pushUndo() { const r = this.room; this.undo.push({ f: JSON.stringify(r.furniture), coins: this.app.slot.coins, wall: r.wall }); if (this.undo.length > 40) this.undo.shift(); }
  doUndo() {
    const u = this.undo.pop(); const app = this.app;
    if (!u) { app.sound.sfx('nope'); return; }
    const r = this.room; r.furniture = JSON.parse(u.f); app.slot.coins = u.coins;
    if (r.wall !== u.wall) { r.wall = u.wall; app.hotelView.rebuild(app.sim.hotel); app.hotelView.showUpTo(wingLevel(this.floor)); }
    app.sim.furnitureChanged(this.roomId); this.select(null); app.dirtyFurniture = true; app.shadowDirty = 2;
    app.sound.sfx('undo'); app.screens.updateHud(); this.renderList();
  }
  // ---------- Zeiger auf der 3D-Fläche ----------
  cellAt(x, y) {
    const p = this.floorPoint(x, y); if (!p) return null;
    const gx = Math.floor((p.x - roomX0(this.side)) / CELL), gz = Math.floor((p.z - roomZ0(this.floor)) / CELL);
    return gx >= 0 && gz >= 0 && gx < RW && gz < RD ? [gx, gz] : null;
  }
  itemAtCell(c) {
    if (!c) return null; let rug = null;
    for (const fu of this.room.furniture) {
      const [w, d] = footprint(fu.item, fu.rot);
      if (c[0] >= fu.gx && c[0] < fu.gx + w && c[1] >= fu.gz && c[1] < fu.gz + d) { if (ITEM[fu.item].layer === 'boden') rug = fu; else return fu; }
    }
    return rug;
  }
  pointerDown(e) {
    if (this.drag) return;
    const fu = this.itemAtCell(this.cellAt(e.clientX, e.clientY));
    this.press = { x0: e.clientX, y0: e.clientY, fu, pid: e.pointerId, type: e.pointerType };
  }
  pointerMove(e) {
    if (this.drag && e.pointerId === this.drag.pid) { this.dragTo(e.clientX, e.clientY); return; }
    const p = this.press; if (!p || p.pid !== e.pointerId) return;
    if (p.fu && Math.hypot(e.clientX - p.x0, e.clientY - p.y0) > 10) { this.press = null; this.select(p.fu); this.startMoveDrag(p.fu, e); }
  }
  pointerUp(e) {
    if (this.drag && e.pointerId === this.drag.pid) { this.endDrag(); return; }
    const p = this.press; this.press = null; if (!p || p.pid !== e.pointerId) return;
    if (p.fu) { this.select(p.fu); this.bounce.set(p.fu.uid, { t: 0.25 }); this.app.dirtyFurniture = true; this.app.sound.sfx('tap'); }
    else this.select(null);
  }
  // ---------- je Bild ----------
  update(dt) {
    for (const [k, b] of this.bounce) { b.t += dt; this.app.dirtyFurniture = true; if (b.t > 0.6) this.bounce.delete(k); }
    if (this.app.mode !== 'furnish' || !this.foot) return;
    const d = this.drag;
    if (d && d.gx !== undefined) {
      const [fw, fd] = footprint(d.id, d.rot);
      const x = roomX0(this.side) + (d.gx + fw / 2) * CELL, z = roomZ0(this.floor) + (d.gz + fd / 2) * CELL, y = wingY(this.floor);
      this.foot.visible = true; this.foot.position.set(x, y + 0.02, z); this.foot.scale.set(fw * CELL - 0.06, fd * CELL - 0.06, 1);
      this.foot.material.color.set(d.ok ? 0x5fdc84 : 0xff6b7d);
      const fu = { item: d.id, gx: d.gx, gz: d.gz, rot: d.rot, color: d.kind === 'move' ? this.room.furniture.find((f) => f.uid === d.uid)?.color : null };
      const pl = this.app.furnPlacement(this.floor, this.side, fu); pl.y += 0.18 + Math.sin(this.app.t * 8) * 0.05;
      this.ghost.set([pl]);
    } else if (this.sel !== null) {
      const fu = this.selFu(); if (!fu) { this.select(null); return; }
      const [fw, fd] = footprint(fu.item, fu.rot);
      this.foot.visible = true; this.foot.material.color.set(0x8fc8ff);
      this.foot.position.set(roomX0(this.side) + (fu.gx + fw / 2) * CELL, wingY(this.floor) + 0.02, roomZ0(this.floor) + (fu.gz + fd / 2) * CELL);
      const pulse = 1 + Math.sin(this.app.t * 5) * 0.03; this.foot.scale.set((fw * CELL - 0.06) * pulse, (fd * CELL - 0.06) * pulse, 1);
    } else this.foot.visible = false;
  }
}
void FS; void cellCenter;
