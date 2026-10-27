// Kulisse Blumenwiese: weiche Hügel, Blumenmeer, Bäume, Gleis mit Blumen-Zug, Picknick-Ausflugsort, Wolken.
import * as THREE from 'three';
import { makeSky, makeLights, makeGround, noise2, seeded, freeSpot } from './env_common.js';
import { PropLayer, propMaterial } from './batch.js';
import { GeoBuilder } from './geo.js';
import { atlasTexture, T } from './atlas.js';
import { LOBBY } from '../core/layout.js';

const TRACK_Z = 6.4;
export function build(ctx) {
  const { scene, look, bundles, fx } = ctx;
  const group = new THREE.Group(); scene.add(group);
  group.add(makeSky(look));
  scene.fog = new THREE.FogExp2(look.nebel, look.nebelDichte);
  const lights = makeLights(scene, look);
  const cA = new THREE.Color(look.boden), cB = new THREE.Color(look.bodenRand), cPath = new THREE.Color('#f1dcb5'), tmp = new THREE.Color();
  const pathD = (x, z) => {   // Abstand zum Weg Haltestelle → Tür
    const ax = LOBBY.stop.x, az = LOBBY.stop.z, bx = LOBBY.outDoor.x, bz = LOBBY.outDoor.z;
    const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / ((bx - ax) ** 2 + (bz - az) ** 2)));
    return Math.hypot(x - ax - (bx - ax) * t, z - az - (bz - az) * t);
  };
  const hill = (x, z) => { const r = Math.hypot(x, z); return r < 22 ? 0 : (r - 22) * 0.04 * (0.6 + noise2(x * 0.05, z * 0.05)) + Math.max(0, Math.sin(x * 0.06) * 3 + Math.cos(z * 0.05) * 2) * Math.min(1, (r - 22) / 30); };
  const ground = makeGround(170, 48, (x, z) => {
    const n = noise2(x * 0.18, z * 0.18) * 0.6 + noise2(x * 0.6, z * 0.6) * 0.4;
    tmp.copy(cA).lerp(cB, n * 0.8);
    const p = pathD(x, z); if (p < 0.9) tmp.lerp(cPath, Math.min(1, (0.9 - p) / 0.4));
    if (Math.abs(z - TRACK_Z) < 1.0 && x < -7) tmp.lerp(new THREE.Color('#d8c6a4'), 0.55);
    return tmp.clone();
  }, (x, z) => hill(x, z) - 0.02);
  group.add(ground);
  // Gleis (Schwellen + Schienen) nach links aus dem Bild
  const b = new GeoBuilder();
  for (let x = -70; x < -6.5; x += 0.7) b.box(x, 0, TRACK_Z - 0.75, x + 0.32, 0.08, TRACK_Z + 0.75, '#b98a62', T.PLAIN, 'pypzpxnx');
  for (const dz of [-0.48, 0.48]) b.box(-70, 0.08, TRACK_Z + dz - 0.05, -6.5, 0.18, TRACK_Z + dz + 0.05, '#c9ced8', T.PLAIN, 'pypz');
  b.box(-12.4, 0, TRACK_Z - 2.3, -7.6, 0.16, TRACK_Z - 1.0, '#f4e3c9', T.PLAIN, 'pypzpxnx');   // Bahnsteig
  b.box(-11.9, 0.16, TRACK_Z - 2.2, -11.75, 2.2, TRACK_Z - 2.05, '#ffffff', T.PLAIN, 'pzpxnx');
  b.box(-12.3, 2.2, TRACK_Z - 2.25, -10.4, 2.9, TRACK_Z - 2.05, '#f6a5b5', T.PLAIN, 'pzpy');
  const trk = new THREE.Mesh(b.build(), new THREE.MeshLambertMaterial({ vertexColors: true, map: atlasTexture() })); trk.receiveShadow = true; trk.castShadow = true; group.add(trk);

  // Deko verteilen (instanziert)
  const props = new PropLayer(group); props.addParts('wiese', bundles.wiese); props.addParts('moebel', bundles.moebel);
  const rnd = seeded(42), list = [];
  const keep = [[-7.6, -20.6, 7.6, 5.6], [-13, 4.2, 13, 8.2], [-80, TRACK_Z - 1.4, -6, TRACK_Z + 1.4], [7.5, -1.5, 13.8, 4.8]];
  const flowers = ['flowerRed', 'flowerYellow', 'flowerPurple', 'flowerRed2', 'flowerYellow2', 'flowerPurple2'];
  for (let i = 0; i < 420; i++) {
    const a = rnd() * Math.PI * 2, r = 4 + Math.pow(rnd(), 0.7) * 34, x = Math.cos(a) * r, z = Math.sin(a) * r * 0.8 - 2;
    if (!freeSpot(x, z, keep) || pathD(x, z) < 1.1) continue;
    // in Grüppchen
    const kind = flowers[Math.floor(noise2(x * 0.3, z * 0.3) * 6) % 6];
    list.push({ model: 'wiese/' + kind, x, y: hill(x, z), z, rotY: rnd() * 6, scale: 2.4 + rnd() * 1.4 });
  }
  for (let i = 0; i < 70; i++) { const a = rnd() * Math.PI * 2, r = 6 + rnd() * 30, x = Math.cos(a) * r, z = Math.sin(a) * r * 0.8 - 2; if (!freeSpot(x, z, keep)) continue; list.push({ model: 'wiese/' + (rnd() < 0.5 ? 'grass' : 'grassLarge'), x, y: hill(x, z), z, rotY: rnd() * 6, scale: 2.2 }); }
  const trees = [[-12, -6], [-16, -2], [13, -6.5], [17, -1], [-11.5, -11], [11.5, -12], [-20, -10], [21, -9], [-26, 2], [26, 4], [0, -26], [-7, -27], [7, -28], [16, 10], [-17, 12], [-31, -8], [30, -12], [-12.5, -18], [13, -20], [-19, -22], [20, -24]];
  const tkinds = ['treeOak', 'treeDefault', 'treeDetailed', 'treeFat'];
  trees.forEach(([x, z], i) => list.push({ model: 'wiese/' + tkinds[i % 4], x, y: hill(x, z), z, rotY: i * 1.7, scale: 3.0 + (i % 3) * 0.5 }));
  for (const [x, z] of [[-8, -3.5], [8.2, -3.8], [-7.6, 2.8], [7.7, -0.5], [-14, 9], [14.5, 9.5], [-3, 9.4], [3.5, 9.8]]) list.push({ model: 'wiese/bushDetailed', x, y: 0, z, rotY: x, scale: 2.4 });
  for (const [x, z] of [[-9.2, -1.2], [11.8, 7.5], [-21, 6]]) list.push({ model: 'wiese/mushroomGroup', x, y: 0, z, rotY: x, scale: 2.4 });
  // Zaun hinten
  for (let x = -12; x <= 12; x += 2) list.push({ model: 'wiese/fence', x, y: 0, z: -22.5, rotY: 0, scale: 2 });
  props.set(list);
  const picnic = new PropLayer(group); picnic.addParts('wiese', bundles.wiese);
  // Picknick-Platz (sichtbar, wenn gebaut)
  const P = LOBBY && ctx.world.ausflug.punkt;
  const pg = new THREE.Group(); pg.position.set(P.x, 0, P.z); group.add(pg);
  const bl = new GeoBuilder(); bl.quad([-1.6, 0.03, 1.2], [3.2, 0, 0], [0, 0, -2.4], '#ffffff', T.BLANKET, 1, 1);
  bl.box(0.9, 0.03, -0.9, 1.5, 0.45, -0.45, '#d6a46b', T.WOOD, 'pxnxpzpy'); bl.box(0.85, 0.45, -0.95, 1.55, 0.52, -0.4, '#c48b52', T.PLAIN, 'py');
  const blanket = new THREE.Mesh(bl.build(), new THREE.MeshLambertMaterial({ vertexColors: true, map: atlasTexture() })); blanket.receiveShadow = true; blanket.castShadow = true; pg.add(blanket);
  const picnicList = [{ model: 'wiese/apple', x: P.x - 0.4, y: 0.03, z: P.z + 0.2, scale: 1.4 }, { model: 'wiese/sandwich', x: P.x + 0.2, y: 0.03, z: P.z - 0.3, scale: 1.3 },
    { model: 'wiese/cupcake', x: P.x - 0.9, y: 0.03, z: P.z - 0.5, scale: 1.2 }, { model: 'wiese/strawberry', x: P.x + 0.6, y: 0.03, z: P.z + 0.5, scale: 2 },
    { model: 'wiese/treeOak', x: P.x + 2.4, y: 0, z: P.z - 2.6, scale: 3.6, rotY: 1 }];
  pg.visible = false;
  // Wolken (weiche Kugelhaufen)
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xfff4ea, emissiveIntensity: 0.55 });
  const clouds = [];
  const cr = seeded(7);
  for (let i = 0; i < 9; i++) {
    const g = new THREE.Group();
    for (let k = 0; k < 5; k++) { const s = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), cloudMat); s.position.set((k - 2) * 1.6 + cr(), cr() * 0.8, cr() * 0.6); const sc = 1.5 + cr() * 1.4 - Math.abs(k - 2) * 0.35; s.scale.set(sc, sc * 0.8, sc); g.add(s); }
    g.position.set(-90 + i * 22 + cr() * 8, 34 + cr() * 18, -70 - cr() * 40); g.scale.setScalar(2 + cr() * 1.5);
    group.add(g); clouds.push(g);
  }
  // Blumen-Zug
  const train = makeTrain(bundles);
  group.add(train);
  let puffT = 0;
  return {
    group, lights, ground, props,
    setAusflug(on) { pg.visible = on; picnic.set(on ? picnicList : []); },
    update(dt, t, vehicle) {
      for (const c of clouds) { c.position.x += dt * 0.6; if (c.position.x > 120) c.position.x = -120; }
      // Zug: rein (bremsen), warten, raus (anfahren)
      const v = vehicle; const stopX = LOBBY.stop.x + 1.2;
      let x;
      if (v.state === 'in') { const k = Math.min(1, v.t / 3.2); x = stopX - 46 * Math.pow(1 - k, 2.2); }
      else if (v.state === 'wait') x = stopX;
      else if (v.state === 'out') { const k = Math.min(1, v.t / 3.2); x = stopX - 46 * Math.pow(k, 2); }
      else x = -80;
      train.position.set(x, 0, TRACK_Z); train.visible = x > -75;
      if (v.state !== 'away') { train.userData.wheels.forEach((w) => (w.rotation.x -= dt * (v.state === 'wait' ? 0 : 6))); puffT -= dt; if (puffT < 0) { puffT = v.state === 'wait' ? 0.6 : 0.18; fx.emit(2, { x: x + 2.15, y: 2.55, z: TRACK_Z }, { n: 1, up: 1.4, size: 0.9, life: 1.6, spread: 0.1 }); } }
    },
  };
}
// Blumen-Zug aus einfachen runden Formen + Blumen aus dem Nature Kit (eigener Bau, CC0-Teile)
function makeTrain(bundles) {
  const g = new THREE.Group(); const L = (c) => new THREE.MeshLambertMaterial({ color: c });
  const add = (geo, mat, x, y, z, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; g.add(m); return m; };
  const box = new THREE.BoxGeometry(1, 1, 1), cyl = new THREE.CylinderGeometry(1, 1, 1, 18), sph = new THREE.SphereGeometry(1, 16, 12);
  // Lok
  add(cyl, L('#f6a5b5'), 1.2, 1.15, 0, 0.75, 1.9, 0.75).rotation.z = Math.PI / 2;
  add(box, L('#ffd2c2'), 0.0, 1.45, 0, 1.3, 1.9, 1.5);
  add(box, L('#f18f8f'), 0.0, 2.5, 0, 1.6, 0.2, 1.8);
  add(cyl, L('#8f7fd1'), 2.15, 2.15, 0, 0.22, 0.9, 0.22);
  add(cyl, L('#8f7fd1'), 2.15, 2.65, 0, 0.32, 0.14, 0.32);
  add(sph, L('#fff3b0'), 2.12, 1.15, 0, 0.18, 0.18, 0.18);
  add(box, L('#ffffff'), 0.0, 1.8, 0.76, 0.8, 0.6, 0.02);
  const wheels = [];
  for (const x of [-0.3, 0.9, 1.8, -2.6, -1.4]) for (const z of [-0.62, 0.62]) { const w = add(cyl, L('#7f7a96'), x, 0.42, z, 0.36, 0.12, 0.36); w.rotation.x = Math.PI / 2; wheels.push(w); }
  // Wagen mit Blumenkasten
  add(box, L('#a9e3b4'), -2.0, 0.95, 0, 2.1, 0.9, 1.5);
  add(box, L('#ffffff'), -2.0, 1.45, 0, 2.2, 0.12, 1.6);
  const fl = ['flowerRed', 'flowerYellow', 'flowerPurple'];
  for (let i = 0; i < 9; i++) {
    const p = bundles.wiese[fl[i % 3]]; const m = new THREE.Mesh(p.geo, propMaterial()); m.applyMatrix4(p.local); m.castShadow = true;
    const h = new THREE.Group(); h.scale.setScalar(2.6); h.position.set(-2.8 + (i % 3) * 0.75, 1.5, -0.45 + Math.floor(i / 3) * 0.45); h.add(m); g.add(h);
  }
  g.userData.wheels = wheels;
  g.rotation.y = 0;
  return g;
}
