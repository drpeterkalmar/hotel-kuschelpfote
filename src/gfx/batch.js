// Instanzierte Modelle: je Teil-Art EIN InstancedMesh (gleiche Möbel/Blumen/Steine teilen sich einen Draw-Call).
// Material: Vertexfarbe (sRGB gebacken) + Umfärben nur der Stoff-Flächen (aMat.x) per instanceColor + Leuchten (aMat.y).
import * as THREE from 'three';

let sharedMat = null;
export function propMaterial() { return sharedMat || (sharedMat = makePropMaterial()); }
export function makePropMaterial(opts = {}) {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, ...opts });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 aMat;\nvarying float vGlow;')
      .replace('#include <color_vertex>', `
#if defined( USE_COLOR_ALPHA )
  vColor = vec4( 1.0 );
  vColor.rgb *= pow( color.rgb, vec3( 2.2 ) );
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )
  vColor = vec3( 1.0 );
#endif
#if defined( USE_COLOR ) && ! defined( USE_COLOR_ALPHA )
  vColor *= pow( color.xyz, vec3( 2.2 ) );
#endif
#ifdef USE_INSTANCING_COLOR
  float tinted = step( 0.01, aMat.x ) * step( instanceColor.r + instanceColor.g + instanceColor.b, 2.995 );
  vColor.rgb = mix( vColor.rgb, instanceColor.rgb * mix( 1.0, aMat.x, 0.9 ), tinted );
#endif
vGlow = aMat.y;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vGlow;')
      .replace('#include <opaque_fragment>', 'outgoingLight += diffuseColor.rgb * vGlow * 1.6;\n#include <opaque_fragment>');
  };
  m.customProgramCacheKey = () => 'propmat1';
  return m;
}
const WHITE = new THREE.Color(1, 1, 1);
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Euler();

export class PropLayer {
  constructor(parent, { cast = true, receive = true, material = null } = {}) {
    this.parent = parent; this.meshes = {}; this.cast = cast; this.receive = receive; this.mat = material || propMaterial();
    this.parts = {};
  }
  addParts(bundleName, parts) { for (const [id, p] of Object.entries(parts)) this.parts[bundleName + '/' + id] = p; }
  // list: [{ model: 'moebel/bedSingle', x, y, z, rotY, scale, color, sy (Quetsch-Faktor) }]
  set(list) {
    const groups = {};
    for (const it of list) (groups[it.model] ||= []).push(it);
    for (const [k, m] of Object.entries(this.meshes)) if (!groups[k]) { m.count = 0; m.visible = false; }
    for (const [k, arr] of Object.entries(groups)) {
      const part = this.parts[k]; if (!part) continue;
      let m = this.meshes[k];
      if (!m || m.instanceMatrix.count < arr.length) {
        if (m) { this.parent.remove(m); m.dispose(); }
        const cap = Math.max(4, Math.ceil(arr.length * 1.5));
        m = new THREE.InstancedMesh(part.geo, this.mat, cap);
        m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3);
        m.castShadow = this.cast; m.receiveShadow = this.receive; m.frustumCulled = false;
        this.parent.add(m); this.meshes[k] = m;
      }
      m.visible = true; m.count = arr.length;
      arr.forEach((it, i) => {
        _e.set(0, it.rotY || 0, 0); _q.setFromEuler(_e);
        const s = it.scale || 1; _s.set(s * (it.sx || 1), s * (it.sy || 1), s * (it.sx || 1)); _p.set(it.x, it.y || 0, it.z);
        _m.compose(_p, _q, _s).multiply(part.local);
        m.setMatrixAt(i, _m);
        m.setColorAt(i, it.color ? (it.color.isColor ? it.color : new THREE.Color(it.color)) : WHITE);
      });
      m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true;
    }
  }
  drawCalls() { return Object.values(this.meshes).filter((m) => m.visible && m.count).length; }
}
