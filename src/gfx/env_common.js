// Gemeinsames für Kulissen: Himmelskuppel (Verlauf), Licht (Sonne mit gebackenem Schatten, Himmel/Boden), Boden-Scheibe.
import * as THREE from 'three';

export function makeSky(look, radius = 260) {
  const m = new THREE.ShaderMaterial({
    uniforms: { top: { value: new THREE.Color(look.himmelOben) }, bot: { value: new THREE.Color(look.himmelUnten) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bot; varying vec3 vP; void main(){ float h = clamp(vP.y * 3.2 + 0.18, 0.0, 1.0); gl_FragColor = vec4(mix(bot, top, pow(h, 0.8)), 1.0); }',
    side: THREE.BackSide, depthWrite: false, fog: false,
  });
  const s = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 16), m); s.renderOrder = -10; s.frustumCulled = false;
  return s;
}
export function makeLights(scene, look) {
  const hemi = new THREE.HemisphereLight(look.himmelLicht, look.bodenLicht, look.huelle ?? 1.2);
  const sun = new THREE.DirectionalLight(look.sonne, look.sonneStaerke ?? 2);
  const d = new THREE.Vector3(...look.sonneRichtung).normalize();
  sun.position.copy(d).multiplyScalar(60); sun.target.position.set(0, 8, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const c = sun.shadow.camera; c.left = -22; c.right = 22; c.top = 26; c.bottom = -18; c.near = 10; c.far = 130;
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03; sun.shadow.radius = 5; sun.shadow.blurSamples = 12;
  const fill = new THREE.DirectionalLight(look.himmelLicht, 0.35); fill.position.set(-d.x * 30, 20, 40);
  scene.add(hemi, sun, sun.target, fill);
  return { hemi, sun, fill, setFocus(y) { sun.target.position.set(0, y, 0); sun.position.copy(d).multiplyScalar(60).add(sun.target.position); } };
}
// Boden-Scheibe mit Vertexfarben (Farbflecken), Höhe per Funktion
export function makeGround(radius, seg, colorFn, heightFn) {
  const g = new THREE.CircleGeometry(radius, seg * 2, 0, Math.PI * 2);
  // Kreis feiner unterteilen: eigenes Raster (Polar) statt CircleGeometry
  const rings = seg, sectors = seg * 2, pos = [], col = [], idx = [];
  pos.push(0, heightFn(0, 0), 0); const c0 = colorFn(0, 0); col.push(c0.r, c0.g, c0.b);
  for (let r = 1; r <= rings; r++) {
    const rr = radius * Math.pow(r / rings, 1.7);
    for (let s = 0; s < sectors; s++) {
      const a = s / sectors * Math.PI * 2, x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      pos.push(x, heightFn(x, z), z); const c = colorFn(x, z); col.push(c.r, c.g, c.b);
    }
  }
  for (let s = 0; s < sectors; s++) idx.push(0, 1 + ((s + 1) % sectors), 1 + s);
  for (let r = 1; r < rings; r++) for (let s = 0; s < sectors; s++) {
    const a = 1 + (r - 1) * sectors + s, b = 1 + (r - 1) * sectors + (s + 1) % sectors, c = 1 + r * sectors + s, d = 1 + r * sectors + (s + 1) % sectors;
    idx.push(a, b, c, b, d, c);
  }
  g.dispose();
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.setIndex(idx);
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  m.receiveShadow = true;
  return m;
}
// einfache Rausch-Funktion (Wertrauschen) für Flecken
export function noise2(x, z) {
  const h = (i, j) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); };
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  return (h(xi, zi) * (1 - u) + h(xi + 1, zi) * u) * (1 - v) + (h(xi, zi + 1) * (1 - u) + h(xi + 1, zi + 1) * u) * v;
}
export function seeded(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
// Ist ein Punkt frei (nicht Hotel, nicht Weg)? Für das Verteilen von Deko
export function freeSpot(x, z, keep) { for (const k of keep) if (x > k[0] && x < k[2] && z > k[1] && z < k[3]) return false; return true; }
