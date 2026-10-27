// Kulisse Mond: grauer Kraterboden, Sternenhimmel mit Erde, Raumstation-Module (Space Kit), Landeplatz mit Mond-Shuttle,
// Luftschleuse als Ausflugsort. Auch für den Mond-Ausflug (Mitmach-Spiel) wiederverwendet (sky/ground/earth).
import * as THREE from 'three';
import { makeLights, makeGround, noise2, seeded, freeSpot } from './env_common.js';
import { PropLayer, propMaterial } from './batch.js';
import { LOBBY } from '../core/layout.js';

export const CRATERS = [[-16, -9, 4.2], [14, -12, 5.5], [24, 6, 3.5], [-26, 4, 6], [6, 16, 3], [-8, 20, 4.5], [32, -20, 8], [-34, -22, 7], [0, -26, 6], [18, 24, 5]];
export function moonHeight(x, z, craters = CRATERS) {
  let h = (noise2(x * 0.08, z * 0.08) - 0.5) * 0.7 + (noise2(x * 0.3, z * 0.3) - 0.5) * 0.18;
  for (const [cx, cz, r] of craters) {
    const d = Math.hypot(x - cx, z - cz) / r;
    if (d < 1.6) h += d < 1 ? -0.55 * r * 0.25 * (1 - d * d) : 0.35 * r * 0.2 * Math.exp(-((d - 1.05) ** 2) * 18);
  }
  const r = Math.hypot(x, z); h *= Math.min(1, Math.max(0, (r - 13.5) / 8));   // Bauplatz eben
  return h;
}
export function makeStarsAndEarth(group, look) {
  // Himmel: dunkler Verlauf
  const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), new THREE.ShaderMaterial({
    uniforms: { top: { value: new THREE.Color(look.himmelOben) }, bot: { value: new THREE.Color(look.himmelUnten) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bot; varying vec3 vP; void main(){ float h = clamp(vP.y * 2.2, 0.0, 1.0); gl_FragColor = vec4(mix(bot, top, sqrt(h)), 1.0); }',
    side: THREE.BackSide, depthWrite: false, fog: false }));
  sky.renderOrder = -10; sky.frustumCulled = false; group.add(sky);
  // Sterne (funkeln im Shader)
  const n = 1600, pos = new Float32Array(n * 3), sz = new Float32Array(n), r = seeded(5);
  for (let i = 0; i < n; i++) { const a = r() * Math.PI * 2, y = Math.pow(r(), 0.6) * 0.95 + 0.02, rr = Math.sqrt(1 - y * y); pos.set([Math.cos(a) * rr * 280, y * 280, Math.sin(a) * rr * 280], i * 3); sz[i] = 0.6 + Math.pow(r(), 6) * 3.4; }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); sg.setAttribute('aS', new THREE.BufferAttribute(sz, 1));
  const sm = new THREE.ShaderMaterial({ uniforms: { t: { value: 0 }, px: { value: 1 } }, transparent: true, depthWrite: false, fog: false,
    vertexShader: 'attribute float aS; uniform float t; uniform float px; varying float vA; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv; vA = 0.6 + 0.4 * sin(t * (1.0 + aS) + position.x * 0.3); gl_PointSize = aS * px * (0.8 + 0.4 * vA); }',
    fragmentShader: 'varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(vec3(1.0, 0.97, 0.92) * 1.6, vA * smoothstep(0.5, 0.0, d)); }' });
  const stars = new THREE.Points(sg, sm); stars.frustumCulled = false; stars.renderOrder = -9; group.add(stars);
  // Erde: gemalte Kugel + Atmosphären-Leuchten
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256; const k = cv.getContext('2d');
  k.fillStyle = '#2f7fd8'; k.fillRect(0, 0, 512, 256);
  const er = seeded(11);
  k.fillStyle = '#6cc46a';
  for (let i = 0; i < 14; i++) { const x = er() * 512, y = 40 + er() * 176; k.beginPath(); for (let a = 0; a < 7; a += 0.5) k.lineTo(x + Math.cos(a) * (18 + er() * 34), y + Math.sin(a) * (12 + er() * 22)); k.fill(); }
  k.fillStyle = 'rgba(255,255,255,0.85)'; for (let i = 0; i < 26; i++) { k.beginPath(); k.ellipse(er() * 512, er() * 256, 20 + er() * 40, 4 + er() * 6, er() - 0.5, 0, 7); k.fill(); }
  k.fillStyle = '#ffffff'; k.fillRect(0, 0, 512, 14); k.fillRect(0, 242, 512, 14);
  const et = new THREE.CanvasTexture(cv); et.colorSpace = THREE.SRGBColorSpace;
  const earth = new THREE.Mesh(new THREE.SphereGeometry(9, 40, 24), new THREE.MeshLambertMaterial({ map: et, emissive: 0x0b1c3a, fog: false }));
  earth.position.set(-55, 62, -150); earth.rotation.z = 0.4; group.add(earth);
  const gc = document.createElement('canvas'); gc.width = gc.height = 128; const gk = gc.getContext('2d');
  const gg = gk.createRadialGradient(64, 64, 30, 64, 64, 64); gg.addColorStop(0, 'rgba(120,180,255,0.75)'); gg.addColorStop(0.55, 'rgba(90,150,255,0.25)'); gg.addColorStop(1, 'rgba(80,140,255,0)');
  gk.fillStyle = gg; gk.fillRect(0, 0, 128, 128);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(gc), transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
  glow.scale.set(30, 30, 1); glow.position.copy(earth.position).add(new THREE.Vector3(0, 0, 1)); group.add(glow);
  return { sky, stars, earth };
}
export function moonGround(look, radius = 160) {
  const cA = new THREE.Color(look.boden), cB = new THREE.Color(look.bodenRand), tmp = new THREE.Color();
  return makeGround(radius, 56, (x, z) => { const n = noise2(x * 0.15, z * 0.15) * 0.7 + noise2(x * 0.7, z * 0.7) * 0.3; tmp.copy(cA).lerp(cB, n); const h = moonHeight(x, z); tmp.multiplyScalar(1 + h * 0.08); return tmp.clone(); }, moonHeight);
}

export function build(ctx) {
  const { scene, look, bundles, fx } = ctx;
  const group = new THREE.Group(); scene.add(group);
  scene.fog = new THREE.FogExp2(look.nebel, look.nebelDichte);
  const sky = makeStarsAndEarth(group, look);
  const lights = makeLights(scene, look);
  const ground = moonGround(look); group.add(ground);
  const props = new PropLayer(group); props.addParts('mond', bundles.mond); props.addParts('moebel', bundles.moebel);
  const rnd = seeded(3), list = [];
  const keep = [[-8, -3.6, 8, 16], [-16, 1.5, -6, 16], [7.5, -2.5, 16, 16]];
  for (let i = 0; i < 70; i++) {
    const a = rnd() * Math.PI * 2, rr = 8 + Math.pow(rnd(), 0.8) * 40, x = Math.cos(a) * rr, z = Math.sin(a) * rr * 0.85 - 3;
    if (!freeSpot(x, z, keep)) continue;
    const kinds = ['rocks', 'rocks2', 'rockLarge', 'rockLarge2', 'crater', 'craterLarge', 'meteor', 'crystals'];
    const kd = kinds[Math.floor(rnd() * kinds.length)];
    list.push({ model: 'mond/' + kd, x, y: moonHeight(x, z) - 0.05, z, rotY: rnd() * 6, scale: (kd.startsWith('crater') ? 4 : 2.2) * (0.7 + rnd() * 0.8) });
  }
  // Raumstation rund ums Hotel
  const station = [['hangarGlass', -15, -6, 2.2, 0.3], ['hangar', 15.5, -5.5, 2.4, -0.4], ['hangarRound', -22, -14, 2.4, 0.6], ['dish', 11, -9, 3.2, -0.6], ['dishSmall', -11.5, -2.5, 2.4, 0.8],
    ['rocket', 20, -16, 3.2, 0], ['platform', 20, -16, 3.2, 0], ['machine', 9.4, -4.2, 2.2, 0.2], ['generator', -9.6, -4.6, 2.2, 0], ['structure', 23, -4, 2.4, 0.3], ['barrels', -10, 5.2, 2.2, 0.4],
    ['platform', LOBBY.stop.x - 0.8, LOBBY.stop.z + 0.6, 2.6, 0], ['pipeRing', -18, 4, 2.4, 1.2], ['cargo', -24, -2, 2.2, 0.9]];
  for (const [m, x, z, s, r] of station) list.push({ model: 'mond/' + m, x, y: m === 'platform' ? 0.02 : 0, z, rotY: r, scale: s });
  props.set(list);
  // Luftschleuse (Ausflugsort) + Rover + Flagge, sichtbar wenn gebaut
  const P = ctx.world.ausflug.punkt;
  const ex = new PropLayer(group); ex.addParts('mond', bundles.mond); ex.addParts('moebel', bundles.moebel);
  const exList = [{ model: 'mond/hangar', x: P.x + 1.6, y: 0, z: P.z - 2.6, scale: 2.4, rotY: -0.3 }, { model: 'mond/gate', x: P.x + 0.4, y: 0, z: P.z - 1.0, scale: 2.4, rotY: -0.3 },
    { model: 'mond/rover', x: P.x + 3.4, y: 0, z: P.z + 1.2, scale: 4.2, rotY: -1.2 }];
  const flag = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.6), new THREE.MeshLambertMaterial({ color: 0xe6e9f2 })); pole.position.y = 1.3; flag.add(pole);
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.75, 6, 1), new THREE.MeshLambertMaterial({ color: 0xff8fb0, side: THREE.DoubleSide }));
  cloth.position.set(0.62, 2.2, 0); flag.add(cloth);
  const paw = new THREE.Mesh(new THREE.CircleGeometry(0.2, 16), new THREE.MeshBasicMaterial({ color: 0xffffff })); paw.position.set(0.62, 2.2, 0.01); flag.add(paw);
  flag.position.set(P.x - 1.8, 0, P.z - 1.4); group.add(flag); flag.visible = false;
  // Mond-Shuttle (Space Kit „craft_speederA", groß)
  const shuttle = new THREE.Group(); group.add(shuttle);
  const sp = bundles.mond.speeder; const sm = new THREE.Mesh(sp.geo, propMaterial()); sm.applyMatrix4(sp.local); sm.castShadow = true;
  const sh = new THREE.Group(); sh.scale.setScalar(2.4); sh.add(sm); shuttle.add(sh);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.2, 12), new THREE.MeshBasicMaterial({ color: 0xffc56b, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
  flame.rotation.x = Math.PI; flame.position.set(0, -0.2, 0); shuttle.add(flame);
  const pad = { x: LOBBY.stop.x - 0.8, z: LOBBY.stop.z + 0.6 };
  let dustT = 0;
  return {
    group, lights, ground, props,
    setAusflug(on) { flag.visible = on; ex.set(on ? exList : []); },
    update(dt, t, vehicle) {
      sky.stars.material.uniforms.t.value = t; sky.stars.material.uniforms.px.value = ctx.renderer.dpr;
      sky.earth.rotation.y += dt * 0.02;
      cloth.position.y = 2.2; cloth.rotation.y = Math.sin(t * 0.7) * 0.15;   // kein Wind auf dem Mond – nur leichtes Nachschwingen
      const v = vehicle; let y = 40, x = pad.x - 30, on = true;
      if (v.state === 'in') { const k = Math.min(1, v.t / 3.2), e = 1 - Math.pow(1 - k, 3); x = pad.x - 30 * (1 - e); y = 0.6 + 22 * Math.pow(1 - e, 1.6); }
      else if (v.state === 'wait') { x = pad.x; y = 0.6 + Math.sin(t * 2) * 0.05; }
      else if (v.state === 'out') { const k = Math.min(1, v.t / 3.2), e = k * k; x = pad.x - 30 * e; y = 0.6 + 26 * e; }
      else on = false;
      shuttle.visible = on; shuttle.position.set(x, y, pad.z); shuttle.rotation.z = v.state === 'in' ? -0.15 * (1 - Math.min(1, v.t / 3.2)) : v.state === 'out' ? -0.2 * Math.min(1, v.t / 3.2) : 0;
      flame.visible = on && v.state !== 'wait'; flame.scale.y = 0.8 + Math.random() * 0.5;
      if (on && v.state !== 'wait' && y < 4) { dustT -= dt; if (dustT < 0) { dustT = 0.07; fx.emit(2, { x: x + (Math.random() - 0.5) * 2, y: moonHeight(x, pad.z) + 0.1, z: pad.z + (Math.random() - 0.5) * 2 }, { n: 2, up: 0.5, vx: 3, vz: 3, size: 1.4, life: 2.2, color: [0.85, 0.85, 0.9], drag: 0.8 }); } }
    },
  };
}
