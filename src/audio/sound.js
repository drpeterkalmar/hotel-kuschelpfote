// Ton: alle Klänge einmal per OfflineAudioContext vorgerendert (kein Live-Synth → kein Ruckeln), weich, Mittelton.
// Musik je Welt: leise Spieluhr-/Glas-Melodie aus vorgerenderten Tönen, nur in der Hotel-Ansicht, nie im Menü.
// iPhone: audioSession 'ambient' (Lautlos-Schalter wird respektiert). Haptik nur bei großen Momenten.
let ctx = null, master = null, musicGain = null, buffers = {}, ready = false, enabled = true, musicOn = true;
let musicTimer = null, musicWorld = null, nextNote = 0, step = 0, lastVib = 0;
const SR = 44100;

export function setEnabled(on) { enabled = on; if (master) master.gain.value = on ? 0.8 : 0; if (!on) stopMusic(); }
export function isEnabled() { return enabled; }
export function setMusic(on) { musicOn = on; if (!on) stopMusic(); }

async function render(dur, fn) {
  const oc = new OfflineAudioContext(1, Math.ceil(dur * SR), SR);
  fn(oc, oc.destination);
  return oc.startRendering();
}
function env(g, t0, a, d, peak = 1) { g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(peak, t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d); }
function bell(oc, out, t0, f, d = 0.9, v = 0.5, bright = 1) {
  const o = oc.createOscillator(), m = oc.createOscillator(), mg = oc.createGain(), g = oc.createGain();
  o.frequency.value = f; m.frequency.value = f * 3.5; mg.gain.setValueAtTime(f * 1.2 * bright, t0); mg.gain.exponentialRampToValueAtTime(1, t0 + d);
  m.connect(mg); mg.connect(o.frequency); o.connect(g); g.connect(out); env(g, t0, 0.005, d, v);
  o.start(t0); m.start(t0); o.stop(t0 + d + 0.1); m.stop(t0 + d + 0.1);
}
function sweep(oc, out, t0, f0, f1, d, v = 0.5, type = 'sine') {
  const o = oc.createOscillator(), g = oc.createGain(); o.type = type;
  o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(f1, t0 + d);
  o.connect(g); g.connect(out); env(g, t0, 0.008, d, v); o.start(t0); o.stop(t0 + d + 0.05);
}
function noise(oc, out, t0, d, v, f = 800, q = 0.8) {
  const b = oc.createBuffer(1, Math.ceil(d * SR), SR), x = b.getChannelData(0); for (let i = 0; i < x.length; i++) x[i] = Math.random() * 2 - 1;
  const s = oc.createBufferSource(); s.buffer = b; const bp = oc.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q;
  const g = oc.createGain(); s.connect(bp); bp.connect(g); g.connect(out); env(g, t0, 0.01, d, v); s.start(t0);
}
const SOUNDS = {
  tap: [0.12, (oc, o) => sweep(oc, o, 0, 720, 520, 0.07, 0.35)],
  pop: [0.18, (oc, o) => { sweep(oc, o, 0, 520, 880, 0.09, 0.4); }],
  plop: [0.3, (oc, o) => { sweep(oc, o, 0, 430, 250, 0.16, 0.6); noise(oc, o, 0, 0.05, 0.08, 1200); }],
  undo: [0.25, (oc, o) => sweep(oc, o, 0, 260, 470, 0.14, 0.45)],
  nope: [0.4, (oc, o) => { bell(oc, o, 0, 466, 0.25, 0.3, 0.4); bell(oc, o, 0.14, 392, 0.3, 0.3, 0.4); }],
  chime: [1.4, (oc, o) => { [523, 659, 784].forEach((f, i) => bell(oc, o, i * 0.11, f, 0.9, 0.32)); }],
  coin: [0.7, (oc, o) => { bell(oc, o, 0, 988, 0.4, 0.22, 0.5); bell(oc, o, 0.07, 1319, 0.5, 0.2, 0.5); }],
  star: [2.2, (oc, o) => { [523, 659, 784, 1046, 1319].forEach((f, i) => bell(oc, o, i * 0.1, f, 1.2, 0.28)); for (let i = 0; i < 6; i++) bell(oc, o, 0.55 + i * 0.07, 1568 + i * 90, 0.5, 0.06, 0.3); }],
  build: [1.0, (oc, o) => { noise(oc, o, 0, 0.35, 0.12, 500, 0.6); sweep(oc, o, 0.25, 220, 440, 0.25, 0.5, 'triangle'); bell(oc, o, 0.45, 659, 0.5, 0.25); }],
  boing: [0.7, (oc, o) => { const os = oc.createOscillator(), g = oc.createGain(), lfo = oc.createOscillator(), lg = oc.createGain(); os.type = 'triangle';
    os.frequency.setValueAtTime(260, 0); os.frequency.exponentialRampToValueAtTime(560, 0.45); lfo.frequency.value = 9; lg.gain.value = 18; lfo.connect(lg); lg.connect(os.frequency);
    os.connect(g); g.connect(o); env(g, 0, 0.02, 0.55, 0.4); os.start(0); lfo.start(0); os.stop(0.65); lfo.stop(0.65); }],
  land: [0.4, (oc, o) => { sweep(oc, o, 0, 190, 90, 0.18, 0.5); noise(oc, o, 0, 0.25, 0.1, 400); }],
  collect: [0.6, (oc, o) => { bell(oc, o, 0, 1046, 0.35, 0.25, 0.6); bell(oc, o, 0.06, 1568, 0.45, 0.2, 0.6); }],
  toot: [0.9, (oc, o) => { sweep(oc, o, 0, 523, 523, 0.3, 0.18, 'triangle'); sweep(oc, o, 0, 659, 659, 0.3, 0.14, 'triangle'); sweep(oc, o, 0.36, 523, 523, 0.4, 0.16, 'triangle'); sweep(oc, o, 0.36, 659, 659, 0.4, 0.12, 'triangle'); }],
  squeak: [0.35, (oc, o) => { sweep(oc, o, 0, 560, 820, 0.12, 0.35, 'triangle'); sweep(oc, o, 0.12, 820, 640, 0.12, 0.25, 'triangle'); }],
  hm: [0.4, (oc, o) => { sweep(oc, o, 0, 420, 330, 0.25, 0.3, 'triangle'); }],
  zzz: [0.6, (oc, o) => { noise(oc, o, 0, 0.5, 0.05, 700, 2); }],
  open: [0.4, (oc, o) => { sweep(oc, o, 0, 392, 523, 0.12, 0.3); sweep(oc, o, 0.09, 523, 784, 0.12, 0.25); }],
};
// Musik-Töne: Spieluhr (hell) und Glas (Mond) als je ein vorgerenderter Ton, per playbackRate transponiert
const NOTES = {
  spieluhr: [1.6, (oc, o) => bell(oc, o, 0, 523.25, 1.5, 0.5, 0.9)],
  glas: [2.2, (oc, o) => { bell(oc, o, 0, 523.25, 2.0, 0.4, 0.35); const os = oc.createOscillator(), g = oc.createGain(); os.frequency.value = 1046.5; os.connect(g); g.connect(o); env(g, 0, 0.02, 1.6, 0.08); os.start(0); os.stop(1.8); }],
  bass: [1.8, (oc, o) => { const os = oc.createOscillator(), g = oc.createGain(), lp = oc.createBiquadFilter(); os.type = 'triangle'; os.frequency.value = 130.81; lp.type = 'lowpass'; lp.frequency.value = 600; os.connect(lp); lp.connect(g); g.connect(o); env(g, 0, 0.03, 1.6, 0.45); os.start(0); os.stop(1.8); }],
};

export function unlockAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try {
    if (navigator.audioSession) navigator.audioSession.type = 'ambient';
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = enabled ? 0.8 : 0;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 2.5;
    master.connect(comp); comp.connect(ctx.destination);
    musicGain = ctx.createGain(); musicGain.gain.value = 0.16; musicGain.connect(master);
    const b = ctx.createBuffer(1, 1, 22050), s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start(0);
    (async () => {
      for (const [k, [d, fn]] of Object.entries({ ...SOUNDS, ...Object.fromEntries(Object.entries(NOTES).map(([k, v]) => ['n_' + k, v])) })) buffers[k] = await render(d, fn);
      ready = true;
      if (musicWorld) startMusic(musicWorld);
    })();
  } catch (e) { ctx = null; }
}
export function sfx(name, { rate = 1, vol = 1 } = {}) {
  if (!enabled || !ready || !ctx || ctx.state !== 'running') return;
  const b = buffers[name]; if (!b) return;
  const s = ctx.createBufferSource(); s.buffer = b; s.playbackRate.value = rate;
  const g = ctx.createGain(); g.gain.value = vol; s.connect(g); g.connect(master); s.start();
  s.onended = () => { s.disconnect(); g.disconnect(); };
}
export function startMusic(world) {
  musicWorld = world;
  if (!ready || !ctx || !musicOn || !enabled) return;
  stopMusic(true);
  const m = world.musik; const beat = 60 / m.tempo;
  nextNote = ctx.currentTime + 0.3; step = 0;
  let deg = 2;
  musicTimer = setInterval(() => {
    if (!ctx || ctx.state !== 'running') return;
    while (nextNote < ctx.currentTime + 0.6) {
      const bar = Math.floor(step / 8);
      if (step % 8 === 0) playNote('n_bass', [0, 5, 3, 4][bar % 4], m, nextNote, 0.55, -12);
      const rest = (step % 8 === 7) || Math.random() < 0.22;
      if (!rest) {
        deg = Math.max(0, Math.min(m.tonleiter.length * 2 - 1, deg + [-2, -1, -1, 1, 1, 2, 0][Math.floor(Math.random() * 7)]));
        const oct = Math.floor(deg / m.tonleiter.length), semi = m.tonleiter[deg % m.tonleiter.length] + oct * 12;
        playNoteSemi('n_' + m.klang, semi + (m.grundton - 72), nextNote, 0.5 + Math.random() * 0.25);
      }
      nextNote += beat / 2; step++;
    }
  }, 150);
}
function playNote(buf, degree, m, t, vol, shift = 0) { const semi = m.tonleiter[degree % m.tonleiter.length] + shift + (m.grundton - 72) + 12; playNoteSemi(buf, semi - 12, t, vol, 0); }
function playNoteSemi(buf, semi, t, vol, base = 0) {
  const b = buffers[buf]; if (!b) return;
  const s = ctx.createBufferSource(); s.buffer = b; s.playbackRate.value = Math.pow(2, (semi + base) / 12);
  const g = ctx.createGain(); g.gain.value = vol; s.connect(g); g.connect(musicGain); s.start(t);
  s.onended = () => { s.disconnect(); g.disconnect(); };
}
export function stopMusic(keepWorld = false) { if (musicTimer) clearInterval(musicTimer); musicTimer = null; if (!keepWorld) musicWorld = null; }
// Vibration nur bei großen Momenten, 30 ms, mind. 4 s Abstand (iPhone hat keine Vibrations-API)
export function haptic() { const now = Date.now(); if (now - lastVib < 4000) return; lastVib = now; try { navigator.vibrate && navigator.vibrate(30); } catch (e) { /* egal */ } }
export function audioState() { return { ctx: ctx ? ctx.state : 'none', ready, enabled, music: !!musicTimer, session: navigator.audioSession ? navigator.audioSession.type : 'n/a' }; }
