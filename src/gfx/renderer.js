// Renderer + leichte Nachbearbeitung („Puppenhaus-Look"): MSAA-Szene in HalfFloat, Bloom (1/4-Auflösung, 2 Blur-Stufen),
// weiches Tonemapping, Pastell-Grading (Anheben der Schatten, Wärme, Sättigung) und Vignette in EINEM Ausgabe-Pass.
import * as THREE from 'three';

const FS_VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const BRIGHT = `uniform sampler2D tDiffuse; uniform float thr; varying vec2 vUv;
void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb; float l = max(c.r, max(c.g, c.b)); gl_FragColor = vec4(c * smoothstep(thr, thr + 0.6, l), 1.0); }`;
const BLUR = `uniform sampler2D tDiffuse; uniform vec2 dir; varying vec2 vUv;
void main(){ vec3 s = texture2D(tDiffuse, vUv).rgb * 0.2270;
  s += (texture2D(tDiffuse, vUv + dir * 1.3846).rgb + texture2D(tDiffuse, vUv - dir * 1.3846).rgb) * 0.3162;
  s += (texture2D(tDiffuse, vUv + dir * 3.2308).rgb + texture2D(tDiffuse, vUv - dir * 3.2308).rgb) * 0.0703;
  gl_FragColor = vec4(s, 1.0); }`;
const FINAL = `uniform sampler2D tDiffuse; uniform sampler2D tBloom; uniform sampler2D tBloom2; uniform float bloom; uniform vec3 lift; uniform float warm;
uniform float sat; uniform float vig; uniform float expo; uniform float fade; uniform vec3 fadeCol; varying vec2 vUv;
vec3 tone(vec3 color){ // Khronos PBR Neutral: Farben bis ~0.8 unverändert, nur Lichter weich komprimiert (Pastell bleibt Pastell)
  color *= expo;
  float x = min(color.r, min(color.g, color.b)); float off = x < 0.08 ? x - 6.25 * x * x : 0.04; color -= off;
  float peak = max(color.r, max(color.g, color.b)); if (peak < 0.76) return color;
  float d = 0.24; float np = 1.0 - d * d / (peak + d - 0.76); color *= np / peak;
  float g = 1.0 - 1.0 / (0.15 * (peak - np) + 1.0); return mix(color, vec3(np), g); }
void main(){
  vec3 c = texture2D(tDiffuse, vUv).rgb;
  vec3 b = texture2D(tBloom, vUv).rgb * 0.7 + texture2D(tBloom2, vUv).rgb * 0.6;
  c += b * bloom;
  c = tone(c);
  c = c * (1.0 - lift) + lift;                                    // Schatten anheben = pastellig
  c *= vec3(warm, 1.0, 2.0 - warm);
  float l = dot(c, vec3(0.299, 0.587, 0.114)); c = mix(vec3(l), c, sat);
  vec2 q = vUv - 0.5; c *= 1.0 - vig * dot(q, q) * 1.6;
  c = mix(c, fadeCol, fade);
  c = clamp(c, 0.0, 1.0);
  c = mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));   // linear → sRGB
  gl_FragColor = vec4(c, 1.0); }`;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    const r = this.r = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance', stencil: false });
    r.outputColorSpace = THREE.LinearSRGBColorSpace;   // Umrechnung macht der Ausgabe-Pass
    r.toneMapping = THREE.NoToneMapping;
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFShadowMap; r.shadowMap.autoUpdate = false;
    this.post = true;
    this.maxDpr = 1.75;
    this.grade = { lift: new THREE.Vector3(0.03, 0.025, 0.04), warm: 1.03, sat: 1.05, vig: 0.22, bloom: 0.3, expo: 1.0, thr: 0.78 };
    this.fade = 0; this.fadeCol = new THREE.Color(1, 0.97, 0.94);
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.qs = new THREE.Scene(); this.qs.add(this.quad);
    const mk = (frag, uni) => new THREE.ShaderMaterial({ vertexShader: FS_VERT, fragmentShader: frag, uniforms: uni, depthTest: false, depthWrite: false });
    this.mBright = mk(BRIGHT, { tDiffuse: { value: null }, thr: { value: 0.8 } });
    this.mBlur = mk(BLUR, { tDiffuse: { value: null }, dir: { value: new THREE.Vector2() } });
    this.mFinal = mk(FINAL, { tDiffuse: { value: null }, tBloom: { value: null }, tBloom2: { value: null }, bloom: { value: 0.3 }, lift: { value: this.grade.lift },
      warm: { value: 1 }, sat: { value: 1 }, vig: { value: 0.2 }, expo: { value: 1 }, fade: { value: 0 }, fadeCol: { value: this.fadeCol } });
    this.resize();
  }
  setGrade(look) {
    const g = look.grading || {};
    this.grade.lift.set(...(g.lift || [0.03, 0.025, 0.04])); this.grade.warm = g.waerme ?? 1.03; this.grade.sat = g.saettigung ?? 1.05;
    this.grade.vig = g.vignette ?? 0.22; this.grade.bloom = look.bloom ?? 0.3;
  }
  makeTargets(w, h) {
    for (const t of [this.rtMain, this.rtA, this.rtB, this.rtC, this.rtD]) t && t.dispose();
    const gl2 = this.r.capabilities.isWebGL2;
    const type = this.r.extensions.has('EXT_color_buffer_half_float') || gl2 ? THREE.HalfFloatType : THREE.UnsignedByteType;
    this.rtMain = new THREE.WebGLRenderTarget(w, h, { type, samples: gl2 ? 4 : 0, depthBuffer: true });
    const q = (d) => new THREE.WebGLRenderTarget(Math.max(1, w >> d), Math.max(1, h >> d), { type, depthBuffer: false });
    this.rtA = q(2); this.rtB = q(2); this.rtC = q(3); this.rtD = q(3);
  }
  resize() {
    const w = innerWidth, h = innerHeight;
    this.dpr = Math.min(devicePixelRatio || 1, this.maxDpr);
    this.r.setPixelRatio(this.dpr); this.r.setSize(w, h, false);
    this.canvas.style.width = w + 'px'; this.canvas.style.height = h + 'px';
    const W = Math.round(w * this.dpr), H = Math.round(h * this.dpr);
    this.W = W; this.H = H;
    this.makeTargets(W, H);
  }
  pass(mat, target) { this.quad.material = mat; this.r.setRenderTarget(target); this.r.render(this.qs, this.cam); }
  render(scene, camera) {
    const r = this.r;
    if (!this.post) { r.setRenderTarget(null); r.outputColorSpace = THREE.SRGBColorSpace; r.render(scene, camera); return; }
    r.setRenderTarget(this.rtMain); r.render(scene, camera);
    // Bloom
    this.mBright.uniforms.tDiffuse.value = this.rtMain.texture; this.mBright.uniforms.thr.value = this.grade.thr; this.pass(this.mBright, this.rtA);
    const bl = (src, dst, dx, dy, rt) => { this.mBlur.uniforms.tDiffuse.value = src.texture; this.mBlur.uniforms.dir.value.set(dx / rt.width, dy / rt.height); this.pass(this.mBlur, dst); };
    bl(this.rtA, this.rtB, 1, 0, this.rtA); bl(this.rtB, this.rtA, 0, 1, this.rtA);
    this.mBlur.uniforms.tDiffuse.value = this.rtA.texture; this.mBlur.uniforms.dir.value.set(1 / this.rtC.width, 0); this.pass(this.mBlur, this.rtC);
    bl(this.rtC, this.rtD, 0, 1, this.rtC); bl(this.rtD, this.rtC, 2, 0, this.rtC); bl(this.rtC, this.rtD, 0, 2, this.rtC);
    const u = this.mFinal.uniforms;
    u.tDiffuse.value = this.rtMain.texture; u.tBloom.value = this.rtA.texture; u.tBloom2.value = this.rtD.texture;
    u.bloom.value = this.grade.bloom; u.warm.value = this.grade.warm; u.sat.value = this.grade.sat; u.vig.value = this.grade.vig; u.expo.value = this.grade.expo;
    u.fade.value = this.fade;
    this.pass(this.mFinal, null);
  }
}
