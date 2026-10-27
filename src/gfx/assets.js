// Laden der Modell-Bündel (meshopt) und Tiere. Ein Bündel = Szene mit je einem Knoten pro Teil;
// die Entquantisierung steckt in der Knoten-Matrix (gltf-transform quantize) → wir behalten Geometrie + Matrix.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
const cache = {};
export const loadStats = { bytes: 0, files: 0 };

function load(url) {
  if (!cache[url]) cache[url] = new Promise((res, rej) => loader.load(url, (g) => { loadStats.files++; res(g); }, undefined, rej));
  return cache[url];
}
// Bündel → { id: { geo, local: Matrix4 } }
export async function loadBundle(name) {
  const g = await load(`assets/models/${name}.glb`);
  if (g.parts) return g.parts;
  const parts = {};
  g.scene.updateMatrixWorld(true);
  g.scene.traverse((o) => {
    if (!o.isMesh) return;
    let n = o; while (n.parent && n.parent !== g.scene && !n.name) n = n.parent;
    const id = (o.name && !/^mesh_\d|^\d/.test(o.name) ? o.name : n.name) || o.parent.name;
    const geo = o.geometry;
    if (geo.attributes._mat) { geo.setAttribute('aMat', geo.attributes._mat); geo.deleteAttribute('_mat'); }
    parts[id] = { geo, local: o.matrixWorld.clone() };
  });
  g.parts = parts;
  return parts;
}
export async function loadPet(species) { return load(`assets/pets/${species}.glb`); }
export function preloadPets(list) { return Promise.all(list.map((s) => loadPet(s).catch(() => null))); }
