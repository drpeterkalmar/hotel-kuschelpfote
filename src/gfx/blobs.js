// Weiche Kontaktschatten (gebacken statt Schattenkarte): ein instanzierter Kreis-Verlauf unter jedem Möbel und jedem Tier.
// Fällt nie durch Decken (Schattenkarte hätte Möbel-Schatten auf die Etage darunter geworfen).
import * as THREE from 'three';
let tex = null;
function blobTex() {
  if (tex) return tex;
  const c = document.createElement('canvas'); c.width = c.height = 64; const k = c.getContext('2d');
  const g = k.createRadialGradient(32, 32, 2, 32, 32, 31); g.addColorStop(0, 'rgba(70,40,50,0.55)'); g.addColorStop(0.55, 'rgba(70,40,50,0.32)'); g.addColorStop(1, 'rgba(70,40,50,0)');
  k.fillStyle = g; k.fillRect(0, 0, 64, 64);
  return (tex = new THREE.CanvasTexture(c));
}
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)), _p = new THREE.Vector3(), _s = new THREE.Vector3();
export class BlobLayer {
  constructor(parent, cap = 400) {
    this.mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: blobTex(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), cap);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 2; this.mesh.count = 0; parent.add(this.mesh);
  }
  // list: [{x,y,z,w,d,a}] (Breite/Tiefe in Metern, a = Stärke 0..1 über die Größe)
  set(list) {
    const n = Math.min(list.length, this.mesh.instanceMatrix.count);
    for (let i = 0; i < n; i++) { const b = list[i]; _p.set(b.x, b.y + 0.012, b.z); _s.set(b.w, b.d, 1); this.mesh.setMatrixAt(i, _m.compose(_p, _q, _s)); }
    this.mesh.count = n; this.mesh.instanceMatrix.needsUpdate = true;
  }
}
