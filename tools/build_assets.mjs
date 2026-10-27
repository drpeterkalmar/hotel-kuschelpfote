// Asset-Pipeline: Kenney-GLBs (CC0) → wenige, kleine Bündel fürs Spiel.
//  - Möbel/Deko: jedes Teil zu EINEM Mesh verschmolzen, Materialfarbe als Vertexfarbe (COLOR_0) gebacken,
//    dazu _MAT (x = Umfärb-Faktor für Stoffe, y = Leuchten für Lampen/Kristalle). Ursprung = Mitte unten.
//    → im Spiel 1 InstancedMesh je Teil-Art, Farbe je Instanz (instanceColor).
//  - Tiere: Cube-Pets-GLB unverändert in der Struktur (Knoten-Animation), meshopt + Quantisierung.
// Aufruf: node tools/build_assets.mjs   (Quellen: ~/.hermes/cache/scratch/hotel/src/{pets,furn,space,nature,food})
import { NodeIO, Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { meshopt, quantize, dedup, prune, weld } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { BUNDLES, PETS } from './asset_list.mjs';

const SRC = path.join(os.homedir(), '.hermes/cache/scratch/hotel/src');
const OUT = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'assets');
await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

// Material → Umfärb-Faktor / Leuchten
const TINT = { carpet: 1, carpetBlue: 1, carpetDarker: 0.72, fur: 0 };
const GLOW = { lamp: 1, crystal: 0.8 };
const texCache = {};
async function texPixels(img) {
  const key = img.getURI() + img.getImage().length;
  if (texCache[key]) return texCache[key];
  const { data, info } = await sharp(Buffer.from(img.getImage())).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return (texCache[key] = { data, w: info.width, h: info.height });
}
function mulMat(m, v, w) {
  return [m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12] * w, m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13] * w, m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14] * w];
}
// Alle Primitive einer Quelldatei als Dreiecksliste (Welt-Koordinaten), Farbe je Vertex
async function loadParts(file, opt = {}) {
  const doc = await io.read(file);
  const out = { pos: [], nor: [], col: [], mat: [] };
  const recolor = opt.recolor || {};
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh(); if (!mesh) continue;
    const M = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      const P = prim.getAttribute('POSITION'), N = prim.getAttribute('NORMAL'), UV = prim.getAttribute('TEXCOORD_0');
      const mat = prim.getMaterial(); const mname = mat ? mat.getName() : '';
      let base = mat ? mat.getBaseColorFactor().slice(0, 3) : [1, 1, 1];
      if (recolor[mname]) base = recolor[mname];
      const tex = mat && mat.getBaseColorTexture() ? await texPixels(mat.getBaseColorTexture()) : null;
      const idx = prim.getIndices() ? prim.getIndices().getArray() : [...Array(P.getCount()).keys()];
      const tint = opt.noTint ? 0 : (TINT[mname] || 0), glow = GLOW[mname] || 0;
      const p = [], n = [], uv = [];
      for (const i of idx) {
        P.getElement(i, p); const wp = mulMat(M, p, 1);
        N.getElement(i, n); const wn = mulMat(M, n, 0); const l = Math.hypot(...wn) || 1;
        out.pos.push(...wp); out.nor.push(wn[0] / l, wn[1] / l, wn[2] / l);
        let c = base;
        if (tex && UV) {
          UV.getElement(i, uv);
          const x = Math.min(tex.w - 1, Math.max(0, Math.floor((uv[0] % 1 + 1) % 1 * tex.w))), y = Math.min(tex.h - 1, Math.max(0, Math.floor((uv[1] % 1 + 1) % 1 * tex.h)));
          const o = (y * tex.w + x) * 4;
          const s2l = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
          c = [s2l(tex.data[o]) * base[0], s2l(tex.data[o + 1]) * base[1], s2l(tex.data[o + 2]) * base[2]];
          if (recolor.__tex) c = recolor.__tex(c);
        }
        out.col.push(...c); out.mat.push(tint, glow);
      }
    }
  }
  return out;
}
function bbox(pos) {
  const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (let i = 0; i < pos.length; i += 3) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], pos[i + k]); mx[k] = Math.max(mx[k], pos[i + k]); }
  return { mn, mx };
}
// Teile zusammensetzen: [{src, at:[x,y,z], rotY, scale, onTop, recolor}]
async function buildItem(def, kitDir) {
  const parts = Array.isArray(def.parts) ? def.parts : [{ src: def.src }];
  const acc = { pos: [], nor: [], col: [], mat: [] };
  let topY = 0, runTop = 0;
  for (const part of parts) {
    const dir = part.kit ? path.join(SRC, part.kit) : kitDir;
    const g = await loadParts(path.join(dir, part.src + '.glb'), { recolor: { ...(def.recolor || {}), ...(part.recolor || {}) }, noTint: part.noTint });
    // Teil auf eigene Mitte unten normieren
    const b = bbox(g.pos); const cx = (b.mn[0] + b.mx[0]) / 2, cz = (b.mn[2] + b.mx[2]) / 2;
    const s = part.scale || 1, r = part.rotY || 0, cs = Math.cos(r), sn = Math.sin(r);
    const at = part.at || [0, 0, 0]; const y0 = part.stack ? runTop : part.onTop ? topY : 0;
    for (let i = 0; i < g.pos.length; i += 3) {
      const x = (g.pos[i] - cx) * s, y = (g.pos[i + 1] - b.mn[1]) * s, z = (g.pos[i + 2] - cz) * s;
      acc.pos.push(x * cs + z * sn + at[0], y + y0 + at[1], -x * sn + z * cs + at[2]);
      const nx = g.nor[i], nz = g.nor[i + 2];
      acc.nor.push(nx * cs + nz * sn, g.nor[i + 1], -nx * sn + nz * cs);
    }
    acc.col.push(...g.col); acc.mat.push(...g.mat);
    // onTop: auf die Oberkante des letzten Grundteils (Geschwister nebeneinander); stack: auf das vorige Teil (Rakete)
    runTop = y0 + (b.mx[1] - b.mn[1]) * s + at[1];
    if (!part.onTop && !part.stack) topY = runTop;
  }
  // Gesamt: Mitte unten, Zielmaßstab
  const b = bbox(acc.pos); const cx = (b.mn[0] + b.mx[0]) / 2, cz = (b.mn[2] + b.mx[2]) / 2;
  const S = def.scale || 1;
  for (let i = 0; i < acc.pos.length; i += 3) { acc.pos[i] = (acc.pos[i] - cx) * S; acc.pos[i + 1] = (acc.pos[i + 1] - b.mn[1]) * S; acc.pos[i + 2] = (acc.pos[i + 2] - cz) * S; }
  const bb = bbox(acc.pos);
  return { ...acc, size: [bb.mx[0] - bb.mn[0], bb.mx[1] - bb.mn[1], bb.mx[2] - bb.mn[2]].map((v) => +v.toFixed(3)) };
}

async function buildBundle(name, bundle) {
  const doc = new Document(); const buf = doc.createBuffer();
  const scene = doc.createScene(name); const meta = {};
  const mat = doc.createMaterial('vc').setBaseColorFactor([1, 1, 1, 1]).setRoughnessFactor(1).setMetallicFactor(0);
  for (const [id, def] of Object.entries(bundle.items)) {
    const g = await buildItem(bundle.recolor ? { ...def, recolor: { ...bundle.recolor, ...(def.recolor || {}) } } : def, path.join(SRC, bundle.kit));
    const nv = g.pos.length / 3;
    const col = new Uint8Array(nv * 4), mt = new Uint8Array(nv * 2);
    for (let i = 0; i < nv; i++) {
      // linear → sRGB-Byte (COLOR_0 ist linear in glTF; normalisierte Bytes linear sind zu grob für dunkle Töne → wir speichern sRGB
      // und kennzeichnen das per extras; der Lader wandelt zurück)
      for (let k = 0; k < 3; k++) { const v = g.col[i * 3 + k]; const s = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055; col[i * 4 + k] = Math.round(Math.min(1, s) * 255); }
      col[i * 4 + 3] = 255; mt[i * 2] = Math.round(g.mat[i * 2] * 255); mt[i * 2 + 1] = Math.round(g.mat[i * 2 + 1] * 255);
    }
    const prim = doc.createPrimitive()
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(g.pos)).setBuffer(buf))
      .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(new Float32Array(g.nor)).setBuffer(buf))
      .setAttribute('COLOR_0', doc.createAccessor().setType('VEC4').setArray(col).setNormalized(true).setBuffer(buf))
      .setAttribute('_MAT', doc.createAccessor().setType('VEC2').setArray(mt).setNormalized(true).setBuffer(buf))
      .setMaterial(mat);
    const mesh = doc.createMesh(id).addPrimitive(prim);
    scene.addChild(doc.createNode(id).setMesh(mesh));
    meta[id] = { size: g.size, tris: nv / 3, tint: g.mat.some((v, i) => i % 2 === 0 && v > 0) ? 1 : 0 };
  }
  await doc.transform(weld(), dedup(), prune(), quantize({ quantizeNormal: 8, quantizePosition: 14, quantizeColor: 8 }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  const f = path.join(OUT, 'models', name + '.glb');
  fs.mkdirSync(path.dirname(f), { recursive: true });
  await io.write(f, doc);
  fs.writeFileSync(path.join(OUT, 'models', name + '.json'), JSON.stringify(meta));
  const tris = Object.values(meta).reduce((a, b) => a + b.tris, 0);
  console.log(name.padEnd(12), Object.keys(meta).length, 'Teile', (fs.statSync(f).size / 1024).toFixed(0), 'KB', tris, 'Dreiecke');
  return meta;
}

async function buildPets() {
  fs.mkdirSync(path.join(OUT, 'pets'), { recursive: true });
  let total = 0;
  for (const p of PETS) {
    const doc = await io.read(path.join(SRC, 'pets', 'animal-' + p + '.glb'));
    // static-Animation brauchen wir nicht
    for (const a of doc.getRoot().listAnimations()) if (a.getName() === 'static') a.dispose();
    await doc.transform(dedup(), prune(), quantize({ quantizePosition: 14, quantizeNormal: 8, quantizeTexcoord: 12 }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
    const f = path.join(OUT, 'pets', p + '.glb');
    await io.write(f, doc); total += fs.statSync(f).size;
  }
  console.log('Tiere', PETS.length, (total / 1024).toFixed(0), 'KB');
}

const only = process.argv[2];
const allMeta = {};
for (const [name, b] of Object.entries(BUNDLES)) if (!only || only === name) allMeta[name] = await buildBundle(name, b);
if (!only || only === 'pets') await buildPets();
// Maße als JS-Modul für die Spiel-Logik (Raster-Fußabdruck ohne geladene Modelle, auch in Node-Tests)
if (!only) {
  const sizes = {};
  for (const [b, m] of Object.entries(allMeta)) for (const [k, v] of Object.entries(m)) sizes[b + '/' + k] = [...v.size, v.tint];
  fs.writeFileSync(path.join(OUT, '..', 'src', 'core', 'sizes.js'), '// erzeugt von tools/build_assets.mjs – nicht von Hand ändern\nexport const SIZES = ' + JSON.stringify(sizes) + ';\n');
}
