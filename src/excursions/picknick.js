// Blumenwiese-Ausflug „Blumenpicknick": Gäste picknicken auf der Decke, Schmetterlinge und Leckereien schweben vorbei –
// antippen = einsammeln (fliegt in den Korb). Kein Verlieren, nur Sammeln.
import * as THREE from 'three';
import { makeSky, makeLights, makeGround, noise2, seeded } from '../gfx/env_common.js';
import { PropLayer } from '../gfx/batch.js';
import { PetLayer } from '../gfx/pets.js';
import { FX, P } from '../gfx/fx.js';
import { GeoBuilder } from '../gfx/geo.js';
import { atlasTexture, T } from '../gfx/atlas.js';

function butterflyTex(col) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const k = cv.getContext('2d');
  k.fillStyle = col; k.beginPath(); k.ellipse(36, 22, 24, 18, -0.3, 0, 7); k.fill(); k.beginPath(); k.ellipse(30, 48, 16, 12, 0.4, 0, 7); k.fill();
  k.fillStyle = 'rgba(255,255,255,0.75)'; k.beginPath(); k.arc(40, 20, 6, 0, 7); k.fill(); k.beginPath(); k.arc(30, 47, 4, 0, 7); k.fill();
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export async function create(ctx) {
  const { bundles, world, species, avatar, sfx, renderer } = ctx;
  const look = world.look;
  const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(look.nebel, 0.018);
  scene.add(makeSky(look));
  const lights = makeLights(scene, look); lights.setFocus(0);
  const cA = new THREE.Color(look.boden), cB = new THREE.Color(look.bodenRand);
  scene.add(makeGround(120, 40, (x, z) => cA.clone().lerp(cB, noise2(x * 0.2, z * 0.2)), (x, z) => (Math.hypot(x, z) > 18 ? (Math.hypot(x, z) - 18) * 0.06 : 0)));
  const props = new PropLayer(scene); props.addParts('wiese', bundles.wiese);
  const r = seeded(21), list = [];
  const fl = ['flowerRed', 'flowerYellow', 'flowerPurple', 'flowerRed2', 'flowerYellow2', 'flowerPurple2'];
  for (let i = 0; i < 260; i++) { const a = r() * 6.28, d = 3.2 + r() * 22, x = Math.cos(a) * d, z = Math.sin(a) * d * 0.8 - 2; list.push({ model: 'wiese/' + fl[Math.floor(noise2(x * 0.4, z * 0.4) * 6) % 6], x, y: 0, z, rotY: r() * 6, scale: 2.6 + r() }); }
  for (const [x, z, s] of [[-6, -6, 4], [7, -7, 4.4], [-11, -2, 3.6], [12, -1, 3.8], [0, -11, 4]]) list.push({ model: 'wiese/treeOak', x, y: 0, z, rotY: x, scale: s });
  list.push({ model: 'wiese/apple', x: -0.6, y: 0.04, z: 0.5, scale: 1.6 }, { model: 'wiese/cake', x: 0.2, y: 0.04, z: -0.2, scale: 1.0 }, { model: 'wiese/sandwich', x: 0.9, y: 0.04, z: 0.4, scale: 1.3 }, { model: 'wiese/strawberry', x: -1.1, y: 0.04, z: -0.4, scale: 2.2 });
  props.set(list);
  const b = new GeoBuilder(); b.quad([-1.8, 0.03, 1.4], [3.6, 0, 0], [0, 0, -2.8], '#ffffff', T.BLANKET, 1, 1);
  b.box(1.9, 0.0, -1.3, 2.7, 0.55, -0.7, '#d6a46b', T.WOOD, 'pxnxpzpy'); b.box(1.85, 0.55, -1.35, 2.75, 0.62, -0.65, '#c48b52', T.PLAIN, 'py');
  const blanket = new THREE.Mesh(b.build(), new THREE.MeshLambertMaterial({ vertexColors: true, map: atlasTexture() })); blanket.receiveShadow = true; blanket.castShadow = true; scene.add(blanket);
  const basket = new THREE.Vector3(2.3, 0.8, -1.0);
  // Gäste auf der Decke
  const pets = new PetLayer(scene);
  const crew = [...new Set([avatar, ...species])].slice(0, 4);
  for (const sp of crew) await pets.ensure(sp);
  const seats = [[-1.0, -0.6, 0.4], [0.6, -0.9, -0.3], [-0.2, 0.9, 2.8], [1.2, 0.6, -0.9]];
  crew.forEach((sp, i) => pets.add('c' + i, sp));
  const fx = new FX(scene);
  // Sammelsachen: Schmetterlinge (2 Flügel), schwebende Leckereien
  const wingGeo = new THREE.PlaneGeometry(0.5, 0.5); wingGeo.translate(0.25, 0, 0);
  const cols = ['#ff9fc0', '#ffd36b', '#9fd3ff', '#c8a8ff', '#ffb38a'];
  const flies = [];
  const treats = ['apple', 'strawberry', 'cherries', 'cupcake', 'carrot'];
  const treatLayer = new PropLayer(scene, { cast: false }); treatLayer.addParts('wiese', bundles.wiese);
  const cam = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.3, 500);
  let spawnT = 0, got = 0;
  const ray = new THREE.Raycaster(), v = new THREE.Vector3();
  function spawn() {
    const isFly = Math.random() < 0.6;
    const side = Math.random() < 0.5 ? -1 : 1;
    const o = { kind: isFly ? 'fly' : 'treat', x: side * (7 + Math.random() * 2), y: 1.2 + Math.random() * 2.6, z: -1 + Math.random() * 3, vx: -side * (0.7 + Math.random() * 0.6), t: Math.random() * 6, got: 0 };
    if (isFly) {
      const m = new THREE.MeshBasicMaterial({ map: butterflyTex(cols[Math.floor(Math.random() * cols.length)]), transparent: true, side: THREE.DoubleSide, depthWrite: false, alphaTest: 0.1 });
      const g = new THREE.Group(); const l = new THREE.Mesh(wingGeo, m), rr = new THREE.Mesh(wingGeo, m); rr.rotation.y = Math.PI; g.add(l, rr); g.scale.setScalar(1.6);
      o.g = g; o.l = l; o.r = rr; scene.add(g);
    } else o.model = treats[Math.floor(Math.random() * treats.length)];
    flies.push(o);
  }
  ctx.hint('Tippe auf Schmetterlinge und Leckereien! 🦋🍓');
  const game = {
    scene, cam,
    down(x, y) { this._d = { x, y }; },
    up(x, y) {
      // nächstes Ding am Finger (großzügig)
      let best = null, bd = 70;
      for (const o of flies) { if (o.got) continue; v.set(o.x, o.y, o.z).project(cam); const d = Math.hypot((v.x + 1) / 2 * innerWidth - x, (1 - v.y) / 2 * innerHeight - y); if (d < bd) { bd = d; best = o; } }
      if (best) { best.got = 0.001; got++; game.onCollect && game.onCollect(1); sfx('collect', { rate: 0.95 + Math.random() * 0.2 }); fx.emit(P.SPARK, { x: best.x, y: best.y, z: best.z }, { n: 6, up: 1, size: 0.5 }); fx.emit(P.HEART, { x: best.x, y: best.y, z: best.z }, { n: 1, size: 0.4 }); }
      void ray;
    },
    tapNearest() { const o = flies.find((f) => !f.got && Math.abs(f.x) < 5); if (!o) return false; v.set(o.x, o.y, o.z).project(cam); this.up((v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight); return true; },
    update(dt, t) {
      spawnT -= dt; if (spawnT < 0 && flies.filter((f) => !f.got).length < 8) { spawn(); spawnT = 0.9 + Math.random() * 0.6; }
      const tl = [];
      for (const o of flies) {
        o.t += dt;
        if (o.got) { // in den Korb fliegen
          o.got += dt * 1.4; const k = Math.min(1, o.got);
          o.x += (basket.x - o.x) * k * 0.2; o.y += (basket.y + Math.sin(k * Math.PI) * 0.8 - o.y) * k * 0.2; o.z += (basket.z - o.z) * k * 0.2;
          if (o.got >= 1) { o.dead = true; if (o.g) scene.remove(o.g); fx.emit(P.SPARK, basket, { n: 3, size: 0.4 }); }
        } else {
          o.x += o.vx * dt; o.y += Math.sin(o.t * 1.7) * 0.4 * dt; o.z += Math.cos(o.t * 1.3) * 0.25 * dt;
          if (Math.abs(o.x) > 10) { o.dead = true; if (o.g) scene.remove(o.g); }
        }
        if (o.g) { o.g.position.set(o.x, o.y, o.z); o.g.rotation.y = o.vx > 0 ? 0 : Math.PI; const f = Math.sin(t * 18 + o.t) * 1.0; o.l.rotation.y = f; o.r.rotation.y = Math.PI - f; if (o.got) o.g.scale.setScalar(1.6 * (1 - Math.min(1, o.got) * 0.7)); }
        else if (!o.dead) tl.push({ model: 'wiese/' + o.model, x: o.x, y: o.y - 0.15, z: o.z, rotY: o.t * 1.5, scale: (o.model === 'carrot' ? 1.0 : 1.9) * (o.got ? 1 - Math.min(1, o.got) * 0.6 : 1) });
      }
      for (let i = flies.length - 1; i >= 0; i--) if (flies[i].dead) flies.splice(i, 1);
      treatLayer.set(tl);
      const states = new Map();
      crew.forEach((sp, i) => { const s = seats[i]; const party = Math.sin(t * 0.8 + i * 2) > 0.4; states.set('c' + i, { x: s[0], y: 0.04 + (party ? Math.abs(Math.sin(t * 7 + i)) * 0.12 : 0), z: s[1], yaw: s[2], anim: party ? 'dance' : 'eat' }); });
      pets.update(dt, states);
      fx.update(dt, renderer.H / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2)));
      const portrait = innerHeight > innerWidth;
      cam.position.set(0, portrait ? 6.8 : 4.6, portrait ? 13.5 : 9.5); cam.lookAt(0, portrait ? 1.6 : 1.3, 0);
    },
    dispose() {},
    debug() { return { got, open: flies.filter((f) => !f.got).length }; },
  };
  void lights;
  return game;
}
