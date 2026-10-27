// Mond-Ausflug „Mondsprung": ein Gast im Raumanzug hüpft über den Mond. Tippen = riesiger Mondsprung (bei 1/6 g ~5 s
// in der Luft), Finger links halten = nach links laufen. Mondsteine und Sternenstaub einsammeln. Rover mit anderen Gästen.
import * as THREE from 'three';
import { CFG } from '../config.js';
import { makeStarsAndEarth, moonGround, moonHeight } from '../gfx/env_mond.js';
import { makeLights } from '../gfx/env_common.js';
import { PropLayer } from '../gfx/batch.js';
import { PetLayer, PET_SCALE } from '../gfx/pets.js';
import { FX, P } from '../gfx/fx.js';
import { seeded } from '../gfx/env_common.js';

// Absprung so gewählt, dass bei Mond-Schwerkraft (1/6 g) ~5 s Flugzeit entstehen; ?schwerkraft= ändert die Flugzeit
export const JUMP_V = 9.81 / 6 * 5.0 / 2;
export const WALK_V = 1.7, AIR_VX = 2.5, HOP_T = 1.1;
const CR = [[8, 1.5, 3], [22, -2, 4], [40, 2, 3.5], [58, -1, 5], [80, 3, 4], [-14, 2, 3]];
const H = (x) => moonHeight(x, 0, CR) * 0.6 + 0.0;

export async function create(ctx) {
  const { bundles, world, species, avatar, sfx } = ctx;
  const look = world.look;
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(look.nebel, 0.004);
  const sky = makeStarsAndEarth(scene, look);
  sky.earth.position.set(-30, 40, -120);
  const glowFollow = () => { scene.traverse((o) => { if (o.isSprite) o.position.copy(sky.earth.position).add(new THREE.Vector3(0, 0, 1)); }); };
  const lights = makeLights(scene, look); lights.sun.shadow.camera.left = -40; lights.sun.shadow.camera.right = 40;
  const ground = moonGround(look, 200);
  // Boden folgt der gleichen Höhe wie die Figur (Linie z = 0 mit eigenen Kratern)
  const pos = ground.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i); pos.setY(i, moonHeight(x, z, CR) * 0.6); }
  ground.geometry.computeVertexNormals(); scene.add(ground);
  const props = new PropLayer(scene); props.addParts('mond', bundles.mond);
  const r = seeded(9), list = [];
  for (let i = 0; i < 60; i++) { const x = -30 + r() * 140, z = -6 - r() * 30; list.push({ model: 'mond/' + ['rocks', 'rocks2', 'rockLarge', 'rockLarge2', 'meteor', 'crystals'][Math.floor(r() * 6)], x, y: moonHeight(x, z, CR) * 0.6, z, rotY: r() * 6, scale: 2 + r() * 2 }); }
  for (let i = 0; i < 16; i++) { const x = -20 + r() * 120, z = 3 + r() * 6; list.push({ model: 'mond/rocks', x, y: moonHeight(x, z, CR) * 0.6, z, rotY: r() * 6, scale: 1.5 }); }
  list.push({ model: 'mond/hangar', x: -9, y: 0, z: -5, scale: 2.6, rotY: 0.3 }, { model: 'mond/gate', x: -7, y: 0, z: -2.4, scale: 2.4, rotY: 0.3 }, { model: 'mond/dish', x: -14, y: 0, z: -9, scale: 3, rotY: 0.6 },
    { model: 'mond/rocket', x: 30, y: 0, z: -22, scale: 3.4 }, { model: 'mond/platform', x: 30, y: 0, z: -22, scale: 3.4 });
  props.set(list);
  // Flagge am Start
  const flag = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3), new THREE.MeshLambertMaterial({ color: 0xe6e9f2 })); pole.position.y = 1.5; flag.add(pole);
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.9), new THREE.MeshLambertMaterial({ color: 0xff8fb0, side: THREE.DoubleSide })); cloth.position.set(0.72, 2.5, 0); flag.add(cloth);
  flag.position.set(-3, H(-3), -1.5); scene.add(flag);
  // Rover (fährt im Hintergrund hin und her, mit Gästen)
  const rover = new THREE.Group(); const rp = bundles.mond.rover;
  const rm = new THREE.Mesh(rp.geo, props.mat); rm.applyMatrix4(rp.local); const rs = new THREE.Group(); rs.scale.setScalar(5); rs.add(rm); rover.add(rs); scene.add(rover);
  // Figuren
  const pets = new PetLayer(scene);
  const me = species[0] || avatar;
  const riders = species.slice(1, 3);
  for (const sp of new Set([me, ...riders])) await pets.ensure(sp);
  pets.add('me', me); riders.forEach((sp, i) => pets.add('r' + i, sp));
  const fx = new FX(scene);
  // Sammelsachen: Mondsteine (Kristalle) + Sternenstaub (leuchtende Kugeln)
  const items = [];
  const stoneGeo = bundles.mond.crystals;
  const stones = new THREE.InstancedMesh(stoneGeo.geo, props.mat, 60); stones.frustumCulled = false; scene.add(stones);
  stones.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(180).fill(1), 3);
  const dust = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.22, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.9, 1.1) }), 120); dust.frustumCulled = false; scene.add(dust);
  const ir = seeded(4);
  for (let x = 4; x < 150; x += 2.6 + ir() * 2.2) {
    const big = ir() < 0.35;
    const h = big ? 2.2 + ir() * 3.2 : 0.7 + ir() * 1.2;
    items.push({ x, y: H(x) + h, kind: big ? 'stone' : 'dust', got: false, t: ir() * 6 });
    if (big) for (let k = 1; k <= 3; k++) items.push({ x: x + k * 0.9, y: H(x) + h - k * 0.35 + 0.2, kind: 'dust', got: false, t: ir() * 6 });
  }
  const cam = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.3, 700);
  const st = { x: 0, y: H(0), vy: 0, vx: WALK_V, air: false, dir: 1, hold: 0, hopT: 0, sq: 0, airT: 0, lastAir: 0, maxH: 0, jumps: 0, roverX: -6 };
  const g = () => CFG.g * CFG.schwerkraft;
  ctx.hint('Tippen = Mondsprung! 🚀  Links halten = zurück');
  const game = {
    scene, cam, st,
    jump() {
      if (st.air) return false;
      st.air = true; st.vy = JUMP_V; st.airT = 0; st.jumps++; st.y0 = st.y; st.maxH = 0;
      sfx('boing'); fx.emit(P.DUST, { x: st.x, y: st.y + 0.05, z: 0 }, { n: 10, up: 0.6, vx: 3, vz: 2, size: 0.8, life: 1.8, color: [0.9, 0.9, 0.95] });
      return true;
    },
    down(x, y) { this._down = { x, y, t: performance.now() }; if (x < innerWidth * 0.33) st.hold = -1; },
    up(x, y) { const d = this._down; this._down = null; if (st.hold && x < innerWidth * 0.33 && d && performance.now() - d.t > 250) { st.hold = 0; return; } st.hold = 0; this.jump(); },
    update(dt, t) {
      // Laufen/Fliegen
      st.dir = st.hold < 0 ? -1 : 1;
      const vx = (st.air ? AIR_VX : WALK_V) * st.dir;
      st.x = Math.max(-8, st.x + vx * dt);
      const gy = H(st.x);
      if (st.air) {
        st.vy -= g() * dt; st.y += st.vy * dt; st.airT += dt; st.maxH = Math.max(st.maxH, st.y - st.y0);
        if (st.y <= gy && st.vy < 0) { st.y = gy; st.air = false; st.lastAir = st.airT; st.sq = 1; sfx('land'); fx.emit(P.DUST, { x: st.x, y: gy + 0.05, z: 0 }, { n: 14, up: 0.5, vx: 4, vz: 3, size: 1.0, life: 2.2, color: [0.9, 0.9, 0.95], drag: 0.7 }); }
      } else {
        // kleine Laufhüpfer (auch nach Schwerkraft)
        st.hopT += dt; const k = (st.hopT % HOP_T) / HOP_T; st.y = gy + 4 * (g() * HOP_T * HOP_T / 8) * 0.5 * k * (1 - k);
        if (st.hopT % HOP_T < dt) fx.emit(P.DUST, { x: st.x, y: gy + 0.05, z: 0 }, { n: 2, up: 0.3, vx: 1, vz: 1, size: 0.5, life: 1.2, color: [0.9, 0.9, 0.95] });
      }
      st.sq = Math.max(0, st.sq - dt * 3);
      // Einsammeln
      let n = 0;
      for (const it of items) {
        if (it.got) continue;
        if (Math.hypot(it.x - st.x, it.y - (st.y + 0.7)) < 1.25) {
          it.got = true; n++;
          sfx('collect', { rate: it.kind === 'stone' ? 0.85 : 1.1 + Math.random() * 0.2 });
          fx.emit(it.kind === 'stone' ? P.STAR : P.SPARK, { x: it.x, y: it.y, z: 0 }, { n: it.kind === 'stone' ? 8 : 4, up: 1.2, size: 0.6 });
        }
      }
      if (n && game.onCollect) game.onCollect(n);
      // Darstellung
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
      let si = 0, di = 0;
      for (const it of items) {
        if (it.got || Math.abs(it.x - st.x) > 30) continue;
        const bob = Math.sin(t * 2 + it.t) * 0.15;
        if (it.kind === 'stone') { q.setFromEuler(new THREE.Euler(0, t + it.t, 0)); stones.setMatrixAt(si, m4.compose(new THREE.Vector3(it.x, it.y + bob - 0.25, 0), q, new THREE.Vector3(1.6, 1.6, 1.6)).multiply(stoneGeo.local)); stones.setColorAt(si++, new THREE.Color(1, 1, 1)); }
        else if (di < 120) { const s = 1 + Math.sin(t * 6 + it.t) * 0.25; dust.setMatrixAt(di++, m4.compose(new THREE.Vector3(it.x, it.y + bob, 0), q.identity(), new THREE.Vector3(s, s, s))); }
      }
      stones.count = si; dust.count = di; stones.instanceMatrix.needsUpdate = true; dust.instanceMatrix.needsUpdate = true;
      // Rover fährt mit
      st.roverX += (st.x - 4 - st.roverX) * Math.min(1, dt * 0.4) + dt * 0.4;
      const rz = -4.5, ry = moonHeight(st.roverX, rz, CR) * 0.6;
      rover.position.set(st.roverX, ry, rz); rover.rotation.y = Math.PI / 2;
      const states = new Map();
      const air = st.air ? Math.min(1, st.airT / 0.4) : 0;
      states.set('me', { scale: 1.3, x: st.x, y: st.y, z: 0, yaw: st.dir > 0 ? Math.PI / 2 : -Math.PI / 2, anim: st.air ? 'idle' : 'walk', suit: true, tilt: st.air ? -0.15 * air : 0,
        sy: 1 - Math.sin(st.sq * Math.PI) * 0.2, sx: 1 + Math.sin(st.sq * Math.PI) * 0.12, roll: st.air ? Math.sin(t * 1.5) * 0.08 : 0 });
      riders.forEach((sp, i) => states.set('r' + i, { x: st.roverX - 0.5 + i * 1.0, y: ry + 1.3 + Math.abs(Math.sin(t * 3 + i)) * 0.15, z: rz, yaw: Math.PI / 2, anim: 'dance', suit: true, scale: 0.85 }));
      pets.update(dt, states);
      fx.update(dt, ctx.renderer.H / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2)));
      sky.stars.material.uniforms.t.value = t; sky.stars.material.uniforms.px.value = ctx.renderer.dpr;
      // Kamera: seitlich, folgt; Hochformat weiter weg, damit der ganze Bogen ins Bild passt
      const portrait = innerHeight > innerWidth;
      const dist = portrait ? 17 : 13.5;
      const gy0 = H(st.x);
      // Kamera folgt der Höhe nur wenig → man sieht den Gast hoch hinaus fliegen
      const ty = gy0 + (portrait ? 4.6 : 3.2) + Math.max(0, st.y - gy0) * 0.3;
      const tx = st.x + (portrait ? 0.6 : 3.0) * st.dir;
      cam.position.lerp(new THREE.Vector3(tx, ty + 0.8, dist), 1 - Math.exp(-3 * dt));
      cam.lookAt(cam.position.x, cam.position.y - (portrait ? 1.6 : 1.2), 0);
      sky.earth.position.set(cam.position.x - (portrait ? 6 : 26), portrait ? 34 : 26, -110);
      glowFollow();
      lights.setFocus(0); lights.sun.target.position.set(st.x, 0, 0); lights.sun.position.set(st.x + 30, 40, 30);
      if (Math.floor(t * 2) !== this._sh) { this._sh = Math.floor(t * 2); ctx.renderer.r.shadowMap.needsUpdate = true; }
    },
    dispose() { scene.traverse((o) => { if (o.geometry && o !== ground) o.geometry.dispose?.(); }); },
    debug() { return { x: st.x, y: st.y, air: st.air, airT: st.airT, lastAir: st.lastAir, maxH: st.maxH, jumps: st.jumps, got: items.filter((i) => i.got).length, g: g(), v0: JUMP_V }; },
  };
  void PET_SCALE;
  return game;
}
