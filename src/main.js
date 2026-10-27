// Hotel Kuschelpfote – App: Start, Welten, Spielschleife, Gäste-Darstellung, Ereignisse → Partikel/Ton/Anzeige.
import * as THREE from 'three';
import { CFG, URLQ, BAL } from './config.js';
import { BUILD } from './build.js';
import { Renderer } from './gfx/renderer.js';
import { loadBundle, preloadPets } from './gfx/assets.js';
import { HotelView } from './gfx/hotel.js';
import { PropLayer } from './gfx/batch.js';
import { BlobLayer } from './gfx/blobs.js';
import { PetLayer } from './gfx/pets.js';
import { FX, P } from './gfx/fx.js';
import { CamCtl } from './game/camera.js';
import { Sim } from './core/sim.js';
import { AutoPlayer } from './core/autoplay.js';
import { ITEM, FS, CELL, footprint, itemHeight } from './core/catalog.js';
import { SIZES } from './core/sizes.js';
const furnSize = (model) => SIZES['moebel/' + model] || [0.5, 0.5, 0.5];
import { allRooms, parseRoomId, getRoom } from './core/hotel.js';
import { FH, cellCenter, LOBBY } from './core/layout.js';
import { furnitureCenter } from './core/path.js';
import { WORLDS, WORLD_LIST, worldUnlocked } from './worlds/index.js';
import { newSlot, loadSlot, saveSlot, setLastSlot } from './core/save.js';
import * as snd from './audio/sound.js';
import { Overlay } from './ui/overlay.js';
import { Screens } from './ui/screens.js';
import { Furnish } from './game/furnish.js';
import { Input } from './game/input.js';
import { Tutorial } from './game/tutorial.js';
import { Trip } from './game/trip.js';

const canvas = document.getElementById('c');
const app = window.__app = { ready: false, frames: 0, t: 0, mode: 'menu', build: BUILD };
app.renderer = new Renderer(canvas);
app.renderer.r.info.autoReset = false;
app.scene = new THREE.Scene();
app.camCtl = new CamCtl();
app.cam = app.camCtl.cam;
app.bundles = {};
app.guestVis = new Map();
app.dirtyFurniture = true;
app.sound = snd;
snd.setEnabled(CFG.ton);

function setLoad(p) { const b = document.querySelector('#loadBar i'); if (b) b.style.width = Math.round(p * 100) + '%'; }
function resize() { app.renderer.resize(); app.camCtl.resize(innerWidth, innerHeight); app.overlay && app.overlay.layout(); if (app.mode === 'hotel') app.camCtl.clamp(); app.furnish?.relayout(); }
addEventListener('resize', resize);
addEventListener('orientationchange', () => setTimeout(resize, 200));
for (const ev of ['pointerup', 'touchend', 'click', 'keydown']) addEventListener(ev, () => { snd.unlockAudio(); if (app.mode === 'hotel' && app.world && !app.musicStarted) { app.musicStarted = true; snd.startMusic(app.world); } }, { capture: true });

async function boot() {
  setLoad(0.15);
  const [m, w, mo] = await Promise.all([loadBundle('moebel'), loadBundle('wiese'), loadBundle('mond')]);
  app.bundles = { moebel: m, wiese: w, mond: mo };
  setLoad(0.6);
  app.overlay = new Overlay(app);
  app.screens = new Screens(app);
  app.furnish = new Furnish(app);
  app.input = new Input(app);
  app.tutorial = new Tutorial(app);
  app.trip = new Trip(app);
  resize();
  setLoad(1);
  app.ready = true;
  document.getElementById('loading').classList.add('hidden');
  const direct = URLQ.get('slot');
  if (direct !== null) enterSlot(+direct, { name: URLQ.get('name') || 'Test', avatar: URLQ.get('avatar') || 'bunny' });
  else app.screens.showStart();
  requestAnimationFrame(loop);
}

// ---------- Spielstand / Welt ----------
export async function enterSlot(i, fresh = null) {
  let s = loadSlot(i, WORLD_LIST);
  if (!s) s = newSlot(fresh?.name || '', fresh?.avatar || 'bunny', WORLD_LIST);
  if (fresh && fresh.name && !s.name) s.name = fresh.name;
  app.slotIdx = i; app.slot = s; setLastSlot(i); saveSlot(i, s);
  const w = URLQ.get('welt');
  await enterWorld(w && WORLDS[w] ? w : s.world);
}
app.enterSlot = enterSlot;
export async function enterWorld(id) {
  const world = WORLDS[id];
  if (!worldUnlocked(app.slot, world)) return;
  document.getElementById('loading').classList.remove('hidden'); setLoad(0.3);
  app.mode = 'loading';
  // alte Welt weg
  if (app.worldGroup) { app.scene.remove(app.worldGroup); app.worldGroup = null; }
  app.scene.clear();
  app.slot.world = id; app.world = world;
  app.renderer.setGrade(world.look);
  const root = app.worldGroup = new THREE.Group(); app.scene.add(root);
  app.fx = new FX(root);
  const envMod = world.umgebung === 'mond' ? await import('./gfx/env_mond.js') : await import('./gfx/env_wiese.js');
  app.env = envMod.build({ scene: root, look: world.look, bundles: app.bundles, fx: app.fx, world, renderer: app.renderer });
  app.scene.fog = root.fog || app.scene.fog; if (root.fog) app.scene.fog = root.fog;
  app.hotelView = new HotelView(root, world);
  app.furn = new PropLayer(root, { cast: false }); app.furn.addParts('moebel', app.bundles.moebel);
  app.furnBlobs = new BlobLayer(root, 300); app.petBlobs = new BlobLayer(root, 40);
  app.ghostLayer = new PropLayer(root, { cast: false }); app.ghostLayer.addParts('moebel', app.bundles.moebel);
  app.pets = new PetLayer(root);
  setLoad(0.5);
  const species = [...new Set([...world.gaeste.map((g) => g.art), ...(world.ueberraschung ? [world.ueberraschung.art] : []), app.slot.avatar])];
  await preloadPets(species); for (const sp of species) await app.pets.ensure(sp);
  setLoad(0.9);
  app.sim = new Sim(app.slot, world);
  hookSim(app.sim);
  app.guestVis.clear();
  // Gastgeber = gewählter Avatar hinter der Rezeption
  app.pets.add('host', app.slot.avatar);
  app.hotelView.rebuild(app.sim.hotel);
  app.env.setAusflug(app.sim.hotel.ausflug);
  app.dirtyFurniture = true; app.shadowDirty = 3;
  app.camCtl.focusHotel(); app.camCtl.resetHotel(app.hotelView.topY); app.camCtl.snap();
  app.env.lights.setFocus(app.hotelView.topY * 0.45);
  app.mode = 'hotel';
  app.screens.showHud(); app.overlay.reset();
  document.getElementById('loading').classList.add('hidden');
  snd.stopMusic(); app.musicStarted = false; if (snd.audioState().ctx === 'running') { app.musicStarted = true; snd.startMusic(world); }
  if (world.id === 'blumenwiese' && !app.slot.tutorial.done) app.tutorial.start();
  saveSlot(app.slotIdx, app.slot);
}
app.enterWorld = enterWorld;
app.save = () => { if (app.slot) saveSlot(app.slotIdx, app.slot); };
setInterval(() => { if (app.mode === 'hotel' || app.mode === 'furnish') app.save(); }, 8000);
document.addEventListener('visibilitychange', () => { if (document.hidden) app.save(); });

// ---------- Ereignisse der Simulation ----------
function hookSim(sim) {
  const at = (g, dy = 1.4) => ({ x: g.pos.x, y: g.pos.y + dy, z: g.pos.z });
  sim.on('arrive', (g) => { app.pets.add(g.id, g.species); snd.sfx('pop', { vol: 0.5 }); if (g.surprise) app.screens.toast('🐝', 'Überraschung! Eine Biene ist da!'); });
  sim.on('depart', (g) => { app.pets.remove(g.id); app.guestVis.delete(g.id); });
  sim.on('checkin', (g) => { snd.sfx('chime', { vol: 0.5 }); app.fx.emit(P.SPARK, at(g), { n: 6, up: 1.2, size: 0.5 }); app.tutorial.event('checkin'); });
  sim.on('rating', (r) => {
    const g = r.guest; snd.sfx('chime'); setTimeout(() => snd.sfx('coin', { vol: 0.7 }), 350);
    app.fx.emit(P.HEART, at(g, 1.5), { n: 2 + r.hearts * 2, up: 1.6, size: 0.55, spread: 0.5 });
    app.fx.emit(P.COIN, at(g, 1.3), { n: 3, up: 2.2, size: 0.45, grav: 4 });
    app.overlay.rating(r); app.screens.updateHud(); app.save();
    const v = app.guestVis.get(g.id); if (v) v.celebrate = 1.6;
  });
  sim.on('star', (s) => { snd.sfx('star'); snd.haptic(); app.screens.starCelebrate(s.stars); app.save(); });
  sim.on('coins', () => app.screens.updateHud());
  sim.on('album', (a) => app.screens.toast('📖', 'Neu im Album: ' + (sim.world.gaeste.find((x) => x.art === a.species)?.name || sim.world.ueberraschung?.name || a.species)));
  sim.on('floor', (f) => { app.hotelView.rebuild(sim.hotel, f.floor); app.dirtyFurniture = true; app.shadowDirty = 3; app.camCtl.topY = app.hotelView.topY; snd.sfx('build'); app.fx.emit(P.SPARK, { x: 0, y: f.floor * FH + 1.5, z: 2 }, { n: 18, spread: 5, up: 2, size: 0.7 }); app.tutorial.event('floor'); app.save(); app.env.lights.setFocus(app.hotelView.topY * 0.45); });
  sim.on('room', (r) => { app.hotelView.rebuild(sim.hotel); app.dirtyFurniture = true; app.shadowDirty = 3; snd.sfx('build'); const { floor, side } = parseRoomId(r.id); const c = cellCenter(floor, side, 3, 2); app.fx.emit(P.SPARK, { x: c.x - 0.4, y: c.y + 1.2, z: c.z }, { n: 14, spread: 2, size: 0.6 }); app.tutorial.event('room'); app.save(); });
  sim.on('placed', () => { app.dirtyFurniture = true; app.shadowDirty = 2; });
  sim.on('removed', () => { app.dirtyFurniture = true; app.shadowDirty = 2; });
  sim.on('ausflugGebaut', () => { app.env.setAusflug(true); app.shadowDirty = 2; snd.sfx('build'); const p = sim.world.ausflug.punkt; app.fx.emit(P.SPARK, { x: p.x, y: 1, z: p.z }, { n: 20, spread: 2, size: 0.7 }); app.save(); });
  sim.on('vehicle', (v) => { if (v.state === 'in') snd.sfx(sim.world.fahrzeug === 'blumenzug' ? 'toot' : 'open', { vol: 0.45 }); });
  sim.on('poke', (g) => { snd.sfx(g.reactKind === 'dance' ? 'squeak' : 'hm', { rate: 0.85 + (g.id % 5) * 0.08 }); app.fx.emit(g.reactKind === 'dance' ? P.HEART : P.NOTE, at(g, 1.5), { n: 3, size: 0.45 }); });
  sim.on('ausflugStart', (g) => { const v = app.guestVis.get(g.id); if (v) v.suitT = 0; });
}

// ---------- Möbel-Liste (Zimmer + Lobby-Deko + Geist beim Einrichten) ----------
function furnitureList(maxFloor = 99) {
  const h = app.sim.hotel, list = [];
  for (const r of allRooms(h)) {
    if (r.floor > maxFloor) continue;
    for (const fu of r.room.furniture) {
      if (app.furnish.hiddenUid === fu.uid) continue;
      list.push(furnPlacement(r.floor, r.side, fu));
    }
  }
  for (const d of app.world.lobbyDeko) list.push({ model: 'moebel/' + ITEM[d.item].model, x: d.x, y: 0, z: d.z, rotY: d.rot || 0, scale: FS });
  return list;
}
export function furnPlacement(floor, side, fu) {
  const c = furnitureCenter(floor, side, fu);
  const it = ITEM[fu.item];
  const bounce = app.furnish.bounce.get(fu.uid);
  let sy = 1, sx = 1;
  if (bounce) { const k = Math.min(1, bounce.t / 0.5); sy = 1 + Math.sin(k * Math.PI * 2.5) * 0.22 * (1 - k); sx = 1 - (sy - 1) * 0.5; }
  return { model: 'moebel/' + it.model, x: c.x, y: c.y + 0.004, z: c.z, rotY: -fu.rot * Math.PI / 2, scale: FS, color: fu.color, sy, sx, uid: fu.uid };
}
app.furnPlacement = furnPlacement;

// ---------- Gäste-Darstellung: Blickrichtung, Hüpfen (Mond), Reaktionen, Raumanzug ----------
const HOP_IN = 1.05, HOP_OUT = 1.9;
function guestStates(dt) {
  const states = new Map(), sim = app.sim, phys = app.world.physik;
  const gEff = CFG.g * (phys.schwerkraft || 1);
  const moon = phys.huepfen > 0;
  for (const g of sim.guests) {
    let v = app.guestVis.get(g.id);
    if (!v) { v = { yaw: g.dir, hop: 0, hopT: 0, sq: 0, lastY: g.pos.y, celebrate: 0, wasOnto: false, blink: Math.random() * 4, sleepFx: 0 }; app.guestVis.set(g.id, v); }
    // Blickrichtung weich
    let dy = g.dir - v.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
    v.yaw += dy * (1 - Math.exp(-10 * dt));
    let y = g.pos.y, anim = g.anim, animSpeed = 1, sy = 1, sx = 1, tilt = 0;
    const walking = g.path && g.pi < g.path.length && !g.inLift && !['queue', 'use', 'ausflug', 'waitRide', 'idleRoom'].includes(g.state);
    // Mond: Hüpfbögen beim Laufen, Höhe aus der Schwerkraft (h = g·T²/8)
    const outside = Math.abs(g.pos.x) > 5.8 || g.pos.z > 2.3;
    if (moon && walking) {
      const T = outside ? HOP_OUT : HOP_IN; const amp = outside ? 1 : (phys.drinnen ?? 0.4);
      v.hopT += dt; const k = (v.hopT % T) / T;
      const h = gEff * T * T / 8 * amp;
      y += 4 * h * k * (1 - k);
      if (v.hopT % T < dt && v.hopT > dt) { v.sq = 1; if (outside || amp > 0.3) app.fx.emit(P.DUST, { x: g.pos.x, y: g.pos.y + 0.05, z: g.pos.z }, { n: 3, up: 0.3, vx: 1.2, vz: 1.2, size: 0.5, life: 1.2, color: [0.9, 0.9, 0.95] }); }
      anim = k < 0.12 || k > 0.88 ? 'walk' : 'idle'; tilt = (0.5 - k) * 0.25;
    } else if (moon && !walking) { y += Math.sin(app.t * 1.6 + g.id) * 0.05 + 0.05; v.hopT = 0; }   // drinnen leicht schwebend
    else if (walking) { animSpeed = 1.15; }
    // Landen auf Möbel / herunter: kleiner Hüpfer
    if (g.onto !== v.wasOnto) { v.sq = 1; v.wasOnto = g.onto; }
    if (v.sq > 0) { v.sq = Math.max(0, v.sq - dt * 3.5); const s = Math.sin(v.sq * Math.PI); sy = 1 - s * 0.18; sx = 1 + s * 0.12; }
    // Blinzeln = kurzes Stauchen
    v.blink -= dt; if (v.blink < 0) { v.blink = 2.5 + Math.random() * 3; v.blinkT = 0.12; }
    if (v.blinkT > 0) { v.blinkT -= dt; sy *= 0.94; sx *= 1.02; }
    // Reaktionen
    if (g.react > 0) { anim = g.reactKind || 'dance'; y += Math.abs(Math.sin(g.react * 9)) * 0.25; }
    if (v.celebrate > 0) { v.celebrate -= dt; anim = 'dance'; y += Math.abs(Math.sin(v.celebrate * 8)) * 0.35; }
    if (g.state === 'queue' && app.overlay.selected === g.id) { anim = 'gesture-positive'; y += Math.abs(Math.sin(app.t * 6)) * 0.12; }
    // Schlafen: Zzz
    if (g.state === 'use' && g.act?.use === 'schlafen') { anim = 'idle'; animSpeed = 0.4; v.sleepFx -= dt; if (v.sleepFx < 0) { v.sleepFx = 1.3; app.fx.emit(P.ZZZ, { x: g.pos.x + 0.2, y: g.pos.y + 1.3, z: g.pos.z }, { n: 1, up: 0.5, size: 0.4, life: 2, vx: 0.2, vz: 0 }); } }
    if (g.state === 'use' && g.act?.use === 'tanzen') { v.sleepFx -= dt; if (v.sleepFx < 0) { v.sleepFx = 0.9; app.fx.emit(P.NOTE, { x: g.pos.x, y: g.pos.y + 1.4, z: g.pos.z }, { n: 1, up: 0.6, size: 0.4, life: 1.6 }); } }
    if (g.state === 'use' && g.act?.use === 'baden') { v.sleepFx -= dt; if (v.sleepFx < 0) { v.sleepFx = 0.5; app.fx.emit(P.DUST, { x: g.pos.x + (Math.random() - 0.5) * 0.6, y: g.pos.y + 0.7, z: g.pos.z }, { n: 1, up: 0.5, size: 0.35, life: 1.5, color: [0.85, 0.95, 1] }); } }
    // Ausflug: im Ausflugsort herumtollen (Mond: Raumanzug + hohe Sprünge)
    let suit = false, x = g.pos.x, z = g.pos.z;
    if (g.state === 'ausflug') {
      const P0 = app.world.ausflug.punkt;
      const ph = g.t * 0.5 + g.id * 1.7;
      x = P0.x + Math.cos(ph) * 1.6; z = P0.z + Math.sin(ph * 1.3) * 1.2;
      v.yaw = -ph + Math.PI;
      if (app.world.ausflug.anzug) {
        suit = true; const T = 2.6; const k = (g.t % T) / T; const hgt = gEff * T * T / 8;
        y = g.pos.y + 4 * hgt * k * (1 - k); anim = 'idle';
        if (g.t % T < dt) app.fx.emit(P.DUST, { x, y: 0.05, z }, { n: 4, up: 0.3, vx: 1.5, vz: 1.5, size: 0.6, life: 1.4, color: [0.9, 0.9, 0.95] });
      } else { anim = Math.sin(ph * 3) > 0.3 ? 'dance' : 'eat'; }
    }
    if (g.inLift) { anim = 'idle'; }
    states.set(g.id, { x, y, z, yaw: v.yaw, anim, animSpeed, sy, sx, tilt, suit });
    v.y = y; v.x = x; v.z = z;
  }
  // Gastgeber hinter der Theke
  const hostAnim = app.t % 11 < 1.4 ? 'gesture-positive' : 'idle';
  states.set('host', { x: LOBBY.desk.x, y: (app.world.physik.huepfen ? 0.06 + Math.sin(app.t * 1.4) * 0.05 : 0), z: LOBBY.desk.z - 0.55, yaw: -0.25, anim: hostAnim, scale: 0.95 });
  return states;
}
app.guestScreen = (g) => { const v = app.guestVis.get(g.id); return v ? new THREE.Vector3(v.x, v.y, v.z) : new THREE.Vector3(g.pos.x, g.pos.y, g.pos.z); };

// ---------- Lift-Plattformen (eine je fahrendem Gast) ----------
let liftMesh = null;
function liftPads() {
  if (!liftMesh) {
    liftMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.62, 0.62, 0.12, 24), new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x332a20 }), 16);
    liftMesh.frustumCulled = false;
  }
  if (liftMesh.parent !== app.worldGroup) app.worldGroup.add(liftMesh);
  let n = 0; const m = new THREE.Matrix4();
  for (const g of app.sim.guests) if (g.inLift && n < 16) { m.makeTranslation(g.pos.x, g.pos.y - 0.04, g.pos.z); liftMesh.setMatrixAt(n++, m); }
  liftMesh.count = n; liftMesh.instanceMatrix.needsUpdate = true;
}

// ---------- Schleife ----------
let last = performance.now(), autoplayer = null;
function loop(now) {
  requestAnimationFrame(loop);
  const rdt = Math.min(0.1, (now - last) / 1000); last = now;
  if (app.frozen) { app.renderer.render(app.scene, app.cam); app.frames++; return; }
  app.t += rdt; app.frames++;
  try { frame(rdt); } catch (e) { window.__errors.push('frame: ' + (e.stack || e)); console.error(e); app.frozen = true; }
}
function frame(rdt) {
  app.renderer.r.info.reset();
  if (app.mode === 'trip') { app.trip.update(rdt); app.renderer.render(app.trip.scene, app.trip.cam); return; }
  if (!app.sim || app.mode === 'loading' || app.mode === 'menu' && !app.sim) { app.renderer.render(app.scene, app.cam); return; }
  const dt = rdt * CFG.tempo * (app.timeScale ?? 1);
  // Simulation in festen Teilschritten
  let rest = dt; while (rest > 1e-6) { const s = Math.min(rest, 0.05); app.sim.step(s); if (autoplayer) autoplayer.tick(s); rest -= s; }
  app.sim.playSeconds = (app.slot.playSeconds += rdt);
  app.furnish.update(rdt);
  if (app.dirtyFurniture) {
    const fl = furnitureList(app.mode === 'furnish' ? app.furnish.floor : 99);
    app.furn.set(fl);
    app.furnBlobs.set(fl.filter((f) => !/^moebel\/rug/.test(f.model)).map((f) => { const sz = app.bundles.moebel[f.model.slice(7)]; const it = f.uid ? null : null; void it;
      const s = furnSize(f.model.slice(7)); const r = Math.abs(Math.round(f.rotY / (Math.PI / 2))) % 2; return { x: f.x, y: f.y, z: f.z, w: (r ? s[2] : s[0]) * FS * 1.25 + 0.25, d: (r ? s[0] : s[2]) * FS * 1.25 + 0.25 }; }));
    app.dirtyFurniture = false;
  }
  const states = guestStates(rdt);
  if (app.mode === 'furnish') for (const [id, s] of states) { const g = app.sim.guests.find((x) => x.id === id); if (g && g.pos.y > app.furnish.floor * FH + 1.5) s.visible = false; }
  app.pets.update(rdt * (app.timeScale ?? 1), states);
  const pb = []; for (const [id, st] of states) { if (st.visible === false) continue; const g = id === 'host' ? null : app.sim.guests.find((x) => x.id === id);
    const gy = g ? (g.onto ? g.pos.y : Math.floor((g.pos.y + 0.5) / FH) * FH) : 0; const lift = Math.max(0, st.y - gy); const k = 1 / (1 + lift * 0.6);
    pb.push({ x: st.x, y: gy, z: st.z, w: 1.25 * k, d: 1.1 * k }); }
  app.petBlobs.set(pb);
  liftPads();
  app.hotelView.update(rdt);
  app.env.update(rdt, app.t, app.sim.vehicle);
  app.camCtl.update(rdt);
  app.fx.update(rdt, app.renderer.H / (2 * Math.tan(THREE.MathUtils.degToRad(app.cam.fov) / 2)));
  if (app.hotelView.blink) app.hotelView.blink.material.color.setHSL(0.02, 1, 0.55 + 0.25 * Math.sin(app.t * 3));
  if (app.shadowDirty > 0) { app.renderer.r.shadowMap.needsUpdate = true; app.shadowDirty--; }
  app.renderer.render(app.scene, app.cam);
  app.overlay.update(rdt);
  app.tutorial.update(rdt);
}

// ---------- Debug-/Test-API ----------
window.__game = {
  app, THREE, CFG, BAL,
  state: () => ({ mode: app.mode, world: app.world?.id, coins: app.slot?.coins, stars: app.sim?.hotel.stars, hearts: app.sim?.hotel.hearts, floors: app.sim?.hotel.floors.length,
    guests: app.sim?.guests.map((g) => ({ id: g.id, sp: g.species, st: g.state, room: g.room, wishes: g.wishes, pos: g.pos })), served: app.sim?.hotel.served, happy: app.sim?.hotel.happy,
    stats: app.sim?.stats, stuck: app.sim?.stuckGuests().length, audio: snd.audioState(), build: BUILD, errors: window.__errors.slice() }),
  autoplay(on = true) { autoplayer = on ? new AutoPlayer(app.sim) : null; return !!autoplayer; },
  autoLog: () => autoplayer?.log || [],
  sim: () => app.sim,
  renderInfo: () => { const i = app.renderer.r.info; return { calls: i.render.calls, tris: i.render.triangles, tex: i.memory.textures, geo: i.memory.geometries }; },
  freeze(on = true) { app.frozen = on; },
  step(sec, dt = 0.05) { for (let t = 0; t < sec; t += dt) { app.sim.step(dt); if (autoplayer) autoplayer.tick(dt); } app.dirtyFurniture = true; },
  setCam(o) { Object.assign(app.camCtl.h, o); if (o.dist) app.camCtl.h.tdist = o.dist; if (o.x !== undefined) app.camCtl.h.tx = o.x; if (o.y !== undefined) app.camCtl.h.ty = o.y; app.camCtl.snap(); },
  enterWorld: (id) => enterWorld(id),
  openRoom: (id) => app.furnish.open(id),
  closeRoom: () => app.furnish.close(),
  startTrip: () => app.trip.start(),
  trip: () => app.trip,
  tap: (x, y) => app.input.tapAt(x, y),
  project(p) { const v = new THREE.Vector3(p.x, p.y, p.z).project(app.cam); return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight }; },
  roomScreen(id) { const { floor, side } = parseRoomId(id); const c = cellCenter(floor, side, 2.5, 2); return this.project({ x: c.x, y: c.y + 1.2, z: c.z }); },
  timeScale(s) { app.timeScale = s; },
  closeModal() { const m = document.getElementById('modal'); if (!m.classList.contains('hidden')) m.click(); document.querySelectorAll('#modal .close').forEach((b) => b.click()); },
};
// Service-Worker (offline spielbar). Neu laden nur, wenn schon vorher einer aktiv war und man im Startbildschirm ist.
if ('serviceWorker' in navigator && !URLQ.has('nosw') && location.protocol.startsWith('http')) {
  const had = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').catch(() => {});
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (had && app.mode === 'menu') location.reload(); });
}
boot().catch((e) => { window.__errors.push('boot: ' + (e.stack || e)); console.error(e); });
