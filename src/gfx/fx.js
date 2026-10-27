// Partikel (Herzchen, Funkeln, Staubwölkchen, Münzen, Noten, Zzz) – ein Points-Draw-Call mit Bild-Atlas.
import * as THREE from 'three';

export const P = { HEART: 0, SPARK: 1, DUST: 2, COIN: 3, NOTE: 4, ZZZ: 5, STAR: 6, PETAL: 7 };
function atlas() {
  const S = 64, cv = document.createElement('canvas'); cv.width = S * 4; cv.height = S * 2; const c = cv.getContext('2d');
  const at = (i, fn) => { c.save(); c.translate((i % 4) * S + S / 2, Math.floor(i / 4) * S + S / 2); fn(c); c.restore(); };
  const heart = (k, r, col) => { k.fillStyle = col; k.beginPath(); k.moveTo(0, r * 0.9); k.bezierCurveTo(-r * 1.4, -r * 0.1, -r * 0.7, -r * 1.2, 0, -r * 0.45); k.bezierCurveTo(r * 0.7, -r * 1.2, r * 1.4, -r * 0.1, 0, r * 0.9); k.fill(); };
  at(P.HEART, (k) => { heart(k, 26, '#ff6f91'); k.fillStyle = 'rgba(255,255,255,0.7)'; k.beginPath(); k.ellipse(-9, -10, 5, 3, -0.6, 0, 7); k.fill(); });
  at(P.SPARK, (k) => { const g = k.createRadialGradient(0, 0, 0, 0, 0, 30); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,240,180,0.9)'); g.addColorStop(1, 'rgba(255,220,120,0)'); k.fillStyle = g; k.beginPath(); for (let a = 0; a < 8; a++) { const r = a % 2 ? 7 : 30; k.lineTo(Math.cos(a * Math.PI / 4) * r, Math.sin(a * Math.PI / 4) * r); } k.fill(); });
  at(P.DUST, (k) => { const g = k.createRadialGradient(0, 0, 0, 0, 0, 30); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.6, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); k.fillStyle = g; k.beginPath(); k.arc(0, 0, 30, 0, 7); k.fill(); });
  at(P.COIN, (k) => { k.fillStyle = '#f2b632'; k.beginPath(); k.arc(0, 0, 24, 0, 7); k.fill(); k.fillStyle = '#ffd95e'; k.beginPath(); k.arc(-2, -2, 19, 0, 7); k.fill(); k.fillStyle = '#f2b632'; k.font = 'bold 26px sans-serif'; k.textAlign = 'center'; k.textBaseline = 'middle'; k.fillText('★', -1, 0); });
  at(P.NOTE, (k) => { k.fillStyle = '#7b6cf0'; k.beginPath(); k.ellipse(-6, 14, 11, 8, -0.4, 0, 7); k.fill(); k.fillRect(3, -22, 5, 36); k.beginPath(); k.moveTo(8, -22); k.quadraticCurveTo(26, -14, 20, 2); k.quadraticCurveTo(20, -10, 8, -12); k.fill(); });
  at(P.ZZZ, (k) => { k.fillStyle = '#7fa8ff'; k.font = 'bold 40px "Trebuchet MS", sans-serif'; k.textAlign = 'center'; k.textBaseline = 'middle'; k.fillText('z', 0, 2); });
  at(P.STAR, (k) => { k.fillStyle = '#ffd24a'; k.beginPath(); for (let a = 0; a < 10; a++) { const r = a % 2 ? 11 : 27; k.lineTo(Math.cos(a * Math.PI / 5 - 1.57) * r, Math.sin(a * Math.PI / 5 - 1.57) * r); } k.fill(); k.fillStyle = 'rgba(255,255,255,0.6)'; k.beginPath(); k.arc(-6, -6, 5, 0, 7); k.fill(); });
  at(P.PETAL, (k) => { k.fillStyle = '#ffb3c7'; k.beginPath(); k.ellipse(0, 0, 18, 10, 0.6, 0, 7); k.fill(); });
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const MAX = 600;
export class FX {
  constructor(parent) {
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(MAX * 3); this.size = new Float32Array(MAX); this.col = new Float32Array(MAX * 4); this.tile = new Float32Array(MAX);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aCol', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aTile', new THREE.BufferAttribute(this.tile, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: atlas() }, scale: { value: 600 } },
      vertexShader: `attribute float aSize; attribute vec4 aCol; attribute float aTile; varying vec4 vCol; varying float vTile; uniform float scale;
        void main(){ vCol = aCol; vTile = aTile; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = aSize * scale / max(0.1, -mv.z); }`,
      fragmentShader: `uniform sampler2D map; varying vec4 vCol; varying float vTile;
        void main(){ vec2 uv = gl_PointCoord; uv.y = 1.0 - uv.y; vec2 t = vec2(mod(vTile, 4.0), 1.0 - floor(vTile / 4.0)); vec4 c = texture2D(map, (t + uv) / vec2(4.0, 2.0));
          c.rgb = pow(c.rgb, vec3(2.2)) * vCol.rgb * 1.15; c.a *= vCol.a; if (c.a < 0.01) discard; gl_FragColor = c; }`,
      transparent: true, depthWrite: false,
    });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; this.points.renderOrder = 10;
    parent.add(this.points);
    this.ps = []; this.geo = g;
  }
  // kind, Position, Optionen {n, spread, up, life, size, color, grav}
  emit(kind, at, o = {}) {
    const n = o.n || 1;
    for (let i = 0; i < n && this.ps.length < MAX; i++) {
      const sp = o.spread ?? 0.4, a = Math.random() * Math.PI * 2;
      this.ps.push({ k: kind, x: at.x + Math.cos(a) * sp * Math.random(), y: at.y + (o.dy || 0), z: at.z + Math.sin(a) * sp * Math.random(),
        vx: (Math.random() - 0.5) * (o.vx ?? 0.8), vy: (o.up ?? 1.2) * (0.7 + Math.random() * 0.6), vz: (Math.random() - 0.5) * (o.vz ?? 0.8),
        t: 0, life: (o.life || 1.4) * (0.8 + Math.random() * 0.4), s: (o.size || 0.45) * (0.8 + Math.random() * 0.4), g: o.grav ?? 0, c: o.color || [1, 1, 1], drag: o.drag ?? 0.6, wob: Math.random() * 6 });
    }
  }
  update(dt, camScale) {
    this.mat.uniforms.scale.value = camScale;
    let j = 0;
    for (const p of this.ps) {
      p.t += dt; if (p.t >= p.life) continue;
      p.vy -= p.g * dt; const d = Math.exp(-p.drag * dt); p.vx *= d; p.vz *= d; if (!p.g) p.vy *= d;
      p.x += p.vx * dt + (p.k === P.HEART || p.k === P.ZZZ || p.k === P.NOTE ? Math.sin(p.t * 4 + p.wob) * 0.004 : 0); p.y += p.vy * dt; p.z += p.vz * dt;
      const k = p.t / p.life;
      const grow = p.k === P.DUST ? 0.6 + k * 1.2 : Math.min(1, p.t * 7) * (1 + 0.15 * Math.sin(p.t * 9));
      this.pos[j * 3] = p.x; this.pos[j * 3 + 1] = p.y; this.pos[j * 3 + 2] = p.z;
      this.size[j] = p.s * grow; this.tile[j] = p.k;
      this.col[j * 4] = p.c[0]; this.col[j * 4 + 1] = p.c[1]; this.col[j * 4 + 2] = p.c[2]; this.col[j * 4 + 3] = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      this.ps[j++] = p;
    }
    this.ps.length = j;
    this.geo.setDrawRange(0, j);
    for (const n of ['position', 'aSize', 'aCol', 'aTile']) this.geo.attributes[n].needsUpdate = true;
  }
}
