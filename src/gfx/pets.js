// Kenney-Würfeltiere mit Knoten-Animation, instanziert: je Tierart und Körperteil EIN InstancedMesh.
// Jede Figur hat ein unsichtbares „Gerüst" (Klon der Knoten) + AnimationMixer; wir kopieren die Weltmatrizen
// der Teile in die Instanzen. Dazu Raumanzug (Glaskugelhelm + Rucksack) als eigene Instanzen.
import * as THREE from 'three';
import { loadPet } from './assets.js';

export const PET_SCALE = 0.8;
const _m = new THREE.Matrix4(), _inv = new THREE.Matrix4();
const HIDE = new THREE.Matrix4().makeScale(0, 0, 0);

export class PetLayer {
  constructor(parent) {
    this.parent = parent; this.species = {}; this.pets = new Map(); this.pending = {};
    this.root = new THREE.Group(); parent.add(this.root);
    this.mat = null;
    // Raumanzug
    this.helmetMat = new THREE.MeshPhongMaterial({ color: 0xdff2ff, transparent: true, opacity: 0.28, shininess: 120, specular: 0xffffff, depthWrite: false, side: THREE.FrontSide });
    this.helmet = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 24, 16), this.helmetMat, 24); this.helmet.count = 0; this.helmet.renderOrder = 4; this.helmet.frustumCulled = false;
    const pack = new THREE.BoxGeometry(1, 1, 1); pack.translate(0, 0, 0);
    this.pack = new THREE.InstancedMesh(pack, new THREE.MeshLambertMaterial({ color: 0xf2f4fa }), 24); this.pack.count = 0; this.pack.castShadow = false; this.pack.frustumCulled = false;
    this.ring = new THREE.InstancedMesh(new THREE.TorusGeometry(1, 0.12, 8, 24), new THREE.MeshLambertMaterial({ color: 0xffb35c }), 24); this.ring.count = 0; this.ring.frustumCulled = false;
    this.root.add(this.helmet, this.pack, this.ring);
  }
  async ensure(sp) {
    if (this.species[sp]) return this.species[sp];
    if (this.pending[sp]) return this.pending[sp];
    this.pending[sp] = (async () => {
      const gltf = await loadPet(sp);
      gltf.scene.updateMatrixWorld(true);
      const parts = [];
      gltf.scene.traverse((o) => {
        if (!o.isMesh) return;
        if (!this.mat) { const mp = o.material.map; if (mp) { mp.colorSpace = THREE.SRGBColorSpace; mp.magFilter = THREE.NearestFilter; mp.minFilter = THREE.LinearMipmapLinearFilter; } this.mat = new THREE.MeshLambertMaterial({ map: mp }); }
        const im = new THREE.InstancedMesh(o.geometry, this.mat, 16); im.count = 0; im.castShadow = false; im.frustumCulled = false;
        if (!o.material.map || o.material.map !== this.mat.map) im.material = new THREE.MeshLambertMaterial({ map: o.material.map });
        this.root.add(im);
        parts.push({ name: o.name, im, path: pathOf(o, gltf.scene) });
      });
      // Höhe (für Helm/Blasen): Kopf-Oberkante
      const box = new THREE.Box3().setFromObject(gltf.scene);
      const S = { gltf, parts, clips: Object.fromEntries(gltf.animations.map((a) => [a.name, a])), height: box.max.y, width: box.max.x - box.min.x };
      this.species[sp] = S;
      return S;
    })();
    return this.pending[sp];
  }
  add(id, sp) {
    const S = this.species[sp]; if (!S) { this.ensure(sp).then(() => this.add(id, sp)); return; }
    if (this.pets.has(id)) return;
    const rig = S.gltf.scene.clone(true);
    const nodes = S.parts.map((p) => findPath(rig, p.path));
    const mixer = new THREE.AnimationMixer(rig);
    const pet = { id, sp, rig, nodes, mixer, actions: {}, cur: null, S, phase: Math.random() * 10 };
    this.pets.set(id, pet);
    this.play(pet, 'idle');
  }
  remove(id) { const p = this.pets.get(id); if (p) { p.mixer.stopAllAction(); this.pets.delete(id); } }
  has(id) { return this.pets.has(id); }
  play(pet, name, speed = 1) {
    if (!pet.S.clips[name]) name = 'idle';
    let a = pet.actions[name];
    if (!a) { a = pet.actions[name] = pet.mixer.clipAction(pet.S.clips[name]); }
    a.timeScale = speed;
    if (pet.cur === name) return;
    const old = pet.cur ? pet.actions[pet.cur] : null;
    a.reset().setEffectiveWeight(1).play();
    if (old) old.crossFadeTo(a, 0.18, false);
    pet.cur = name;
  }
  // states: Map id → { x,y,z, yaw, scale, sx, sy, anim, animSpeed, visible, suit }
  update(dt, states) {
    const counts = new Map();
    let suits = 0;
    for (const S of Object.values(this.species)) for (const p of S.parts) p.im.count = 0;
    for (const [id, pet] of this.pets) {
      const st = states.get(id); if (!st || st.visible === false) continue;
      this.play(pet, st.anim || 'idle', st.animSpeed || 1);
      pet.mixer.update(dt);
      const r = pet.rig;
      const s = (st.scale || 1) * PET_SCALE;
      r.position.set(st.x, st.y, st.z); r.rotation.set(st.tilt || 0, st.yaw || 0, st.roll || 0);
      r.scale.set(s * (st.sx || 1), s * (st.sy || 1), s * (st.sx || 1));
      r.updateMatrixWorld(true);
      pet.S.parts.forEach((p, k) => { const i = p.im.count++; if (i < p.im.instanceMatrix.count) p.im.setMatrixAt(i, pet.nodes[k].matrixWorld); else p.im.count--; });
      if (st.suit && suits < 24) {
        // Helm: Kugel um den Würfelkopf, Rucksack hinten
        const h = pet.S.height * s;
        _m.compose(new THREE.Vector3(0, 0, 0), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
        const body = pet.nodes[0];
        const c = new THREE.Vector3(0, h * 0.55, 0.02 * s).applyMatrix4(new THREE.Matrix4().makeRotationY(st.yaw || 0)).add(r.position);
        const rad = Math.max(h * 0.58, pet.S.width * s * 0.62);
        this.helmet.setMatrixAt(suits, _m.compose(c, new THREE.Quaternion(), new THREE.Vector3(rad, rad * 0.95, rad)));
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(st.tilt || 0, st.yaw || 0, 0));
        const back = new THREE.Vector3(0, h * 0.38, -0.62 * s).applyQuaternion(q).add(r.position);
        this.pack.setMatrixAt(suits, _m.compose(back, q, new THREE.Vector3(0.7 * s, 0.75 * s, 0.32 * s)));
        const rp = new THREE.Vector3(0, h * 0.55 - rad * 0.78, 0.02 * s).applyQuaternion(q).add(r.position);
        const rq = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)); rq.premultiply(q);
        this.ring.setMatrixAt(suits, _m.compose(rp, rq, new THREE.Vector3(rad * 0.66, rad * 0.66, rad * 0.66)));
        suits++;
        void body;
      }
    }
    for (const S of Object.values(this.species)) for (const p of S.parts) p.im.instanceMatrix.needsUpdate = true;
    this.helmet.count = suits; this.pack.count = suits; this.ring.count = suits;
    this.helmet.instanceMatrix.needsUpdate = true; this.pack.instanceMatrix.needsUpdate = true; this.ring.instanceMatrix.needsUpdate = true;
  }
  drawCalls() { let n = 0; for (const S of Object.values(this.species)) for (const p of S.parts) if (p.im.count) n++; return n + (this.helmet.count ? 3 : 0); }
}
function pathOf(o, root) { const p = []; while (o && o !== root) { p.unshift(o.parent.children.indexOf(o)); o = o.parent; } return p; }
function findPath(root, path) { let o = root; for (const i of path) o = o.children[i]; return o; }
void HIDE; void _inv;
