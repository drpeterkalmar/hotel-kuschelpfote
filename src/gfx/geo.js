// Kleiner Geometrie-Baukasten: Quader und unterteilte Flächen mit Vertexfarbe, gebackener Umgebungsverdeckung (AO)
// und UVs in einen Atlas (4×4 Kacheln). Alles einer Etage wird zu EINEM Mesh verschmolzen (wenige Draw-Calls).
import * as THREE from 'three';

export const ATLAS_N = 4;
const PAD = 0.035;   // Rand je Kachel gegen Mipmap-Bluten
export function tileUV(tile, u, v) {
  const tx = tile % ATLAS_N, ty = Math.floor(tile / ATLAS_N);
  const s = 1 / ATLAS_N;
  return [(tx + PAD + u * (1 - 2 * PAD)) * s, 1 - (ty + PAD + (1 - v) * (1 - 2 * PAD)) * s];
}
export class GeoBuilder {
  constructor() { this.p = []; this.n = []; this.uv = []; this.c = []; this.i = []; }
  // Fläche: Ursprung o, Kantenvektoren a (u-Richtung) und b (v-Richtung), Unterteilung su×sv, Farbe, Kachel, ao(u,v)→Faktor
  quad(o, a, b, color, tile = 0, su = 1, sv = 1, ao = null, uvScale = [1, 1]) {
    const nrm = new THREE.Vector3().crossVectors(new THREE.Vector3(...a), new THREE.Vector3(...b)).normalize();
    const base = this.p.length / 3;
    const col = new THREE.Color(color);
    for (let j = 0; j <= sv; j++) for (let i = 0; i <= su; i++) {
      const u = i / su, v = j / sv;
      this.p.push(o[0] + a[0] * u + b[0] * v, o[1] + a[1] * u + b[1] * v, o[2] + a[2] * u + b[2] * v);
      this.n.push(nrm.x, nrm.y, nrm.z);
      const t = tileUV(tile, (u * uvScale[0]) % 1.0000001, (v * uvScale[1]) % 1.0000001);
      this.uv.push(t[0], t[1]);
      const f = ao ? ao(u, v) : 1;
      this.c.push(col.r * f, col.g * f, col.b * f);
    }
    for (let j = 0; j < sv; j++) for (let i = 0; i < su; i++) {
      const k = base + j * (su + 1) + i;
      this.i.push(k, k + 1, k + su + 2, k, k + su + 2, k + su + 1);
    }
  }
  // Quader (x0..x1, y0..y1, z0..z1); faces: welche Seiten (px,nx,py,ny,pz,nz)
  box(x0, y0, z0, x1, y1, z1, color, tile = 0, faces = 'pxnxpynypznz', shade = true) {
    const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
    const sh = (f) => (shade ? f : 1);
    if (faces.includes('pz')) this.quad([x0, y0, z1], [dx, 0, 0], [0, dy, 0], color, tile, 1, 1, () => sh(1));
    if (faces.includes('nz')) this.quad([x1, y0, z0], [-dx, 0, 0], [0, dy, 0], color, tile, 1, 1, () => sh(0.9));
    if (faces.includes('px')) this.quad([x1, y0, z1], [0, 0, -dz], [0, dy, 0], color, tile, 1, 1, () => sh(0.95));
    if (faces.includes('nx')) this.quad([x0, y0, z0], [0, 0, dz], [0, dy, 0], color, tile, 1, 1, () => sh(0.95));
    if (faces.includes('py')) this.quad([x0, y1, z1], [dx, 0, 0], [0, 0, -dz], color, tile, 1, 1, () => 1);
    if (faces.includes('ny')) this.quad([x0, y0, z0], [dx, 0, 0], [0, 0, dz], color, tile, 1, 1, () => sh(0.8));
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setIndex(this.i);
    g.computeBoundingSphere();
    return g;
  }
}
// sRGB-Hex → lineare Farbe (three Color macht das automatisch mit ColorManagement)
export const col = (hex) => new THREE.Color(hex);
