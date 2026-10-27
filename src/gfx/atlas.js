// Tapeten-/Boden-/Fassaden-Atlas, zur Laufzeit gemalt (keine Bilddatei). Muster hell auf Weiß → Vertexfarbe gibt den Pastellton.
import * as THREE from 'three';
import { ATLAS_N } from './geo.js';

export const T = { PLAIN: 0, STRIPES: 1, DOTS: 2, FLOWERS: 3, WOOD: 4, BATH: 5, STARS: 6, LOBBY: 7, SIDING: 8, ROOF: 9, METAL: 10, WINDOW: 11, NIGHTWIN: 12, SIGN: 13, DESK: 14, BLANKET: 15 };
let tex = null;
export function atlasTexture() {
  if (tex) return tex;
  const S = 256, N = ATLAS_N, cv = document.createElement('canvas'); cv.width = cv.height = S * N;
  const c = cv.getContext('2d');
  const tile = (i, fn) => { const x = (i % N) * S, y = Math.floor(i / N) * S; c.save(); c.beginPath(); c.rect(x, y, S, S); c.clip(); c.translate(x, y); fn(c); c.restore(); };
  const fill = (k, col) => { k.fillStyle = col; k.fillRect(0, 0, S, S); };
  tile(T.PLAIN, (k) => { fill(k, '#ffffff'); for (let i = 0; i < 400; i++) { k.fillStyle = `rgba(0,0,0,${Math.random() * 0.025})`; k.fillRect(Math.random() * S, Math.random() * S, 3, 3); } });
  tile(T.STRIPES, (k) => { fill(k, '#ffffff'); k.fillStyle = '#ecebe8'; for (let x = 0; x < S; x += 32) k.fillRect(x, 0, 14, S); k.fillStyle = '#f5f3ef'; for (let x = 20; x < S; x += 32) k.fillRect(x, 0, 3, S); });
  tile(T.DOTS, (k) => { fill(k, '#ffffff'); k.fillStyle = '#e8e6e2'; for (let y = 0; y < S + 32; y += 32) for (let x = (y / 32) % 2 ? 16 : 0; x < S + 32; x += 32) { k.beginPath(); k.arc(x, y, 6, 0, 7); k.fill(); } });
  tile(T.FLOWERS, (k) => { fill(k, '#ffffff'); k.fillStyle = '#ebe6e6';
    for (let y = 22; y < S; y += 52) for (let x = (y % 104 < 52 ? 26 : 0); x < S + 26; x += 52) { for (let a = 0; a < 5; a++) { k.beginPath(); k.arc(x + Math.cos(a * 1.257) * 7, y + Math.sin(a * 1.257) * 7, 5.5, 0, 7); k.fill(); } k.fillStyle = '#e0dcd6'; k.beginPath(); k.arc(x, y, 4, 0, 7); k.fill(); k.fillStyle = '#ebe6e6'; } });
  tile(T.WOOD, (k) => { fill(k, '#f4ede4'); const h = S / 7; for (let i = 0; i < 7; i++) { k.fillStyle = i % 2 ? '#efe5d8' : '#f7f0e6'; k.fillRect(0, i * h, S, h - 2); k.fillStyle = '#d9cbb8'; k.fillRect(0, i * h + h - 2, S, 2); const o = (i * 97) % S; k.fillRect(o, i * h, 2, h); k.fillRect((o + 128) % S, i * h, 2, h); } });
  tile(T.BATH, (k) => { fill(k, '#ffffff'); k.fillStyle = '#e4ecee'; for (let i = 0; i <= S; i += 32) { k.fillRect(i - 1, 0, 2, S); k.fillRect(0, i - 1, S, 2); } });
  tile(T.STARS, (k) => { fill(k, '#ffffff'); k.fillStyle = '#e6e8f2'; const star = (x, y, r) => { k.beginPath(); for (let a = 0; a < 10; a++) { const rr = a % 2 ? r * 0.45 : r; k.lineTo(x + Math.cos(a * Math.PI / 5 - 1.57) * rr, y + Math.sin(a * Math.PI / 5 - 1.57) * rr); } k.fill(); };
    for (let y = 20; y < S; y += 48) for (let x = (y % 96 < 48 ? 24 : 0); x < S + 24; x += 48) star(x, y, 9); });
  tile(T.LOBBY, (k) => { fill(k, '#ffffff'); k.fillStyle = '#efe9e2'; const s = 32; for (let y = 0; y < S; y += s) for (let x = 0; x < S; x += s) if ((x + y) / s % 2) k.fillRect(x, y, s, s); });
  tile(T.SIDING, (k) => { fill(k, '#ffffff'); for (let y = 0; y < S; y += 21) { k.fillStyle = '#e9e6e1'; k.fillRect(0, y + 17, S, 4); } });
  tile(T.ROOF, (k) => { fill(k, '#ffffff'); for (let y = 0; y < S + 30; y += 26) for (let x = (y / 26) % 2 ? 0 : 16; x < S + 32; x += 32) { k.fillStyle = '#e6dcd8'; k.beginPath(); k.arc(x, y + 14, 16, 0, Math.PI); k.fill(); k.fillStyle = '#ffffff'; k.beginPath(); k.arc(x, y + 11, 14, 0, Math.PI); k.fill(); } });
  tile(T.METAL, (k) => { fill(k, '#ffffff'); k.fillStyle = '#e4e6ec'; for (let i = 0; i < S; i += 64) { k.fillRect(i, 0, 3, S); k.fillRect(0, i, S, 3); } k.fillStyle = '#d8dbe3'; for (let y = 8; y < S; y += 64) for (let x = 8; x < S; x += 64) { k.beginPath(); k.arc(x, y, 3, 0, 7); k.fill(); k.beginPath(); k.arc(x + 48, y, 3, 0, 7); k.fill(); } });
  tile(T.WINDOW, (k) => { const g = k.createLinearGradient(0, 0, 0, S); g.addColorStop(0, '#8ccaf2'); g.addColorStop(0.7, '#d9f0ff'); g.addColorStop(1, '#bfe7a6'); k.fillStyle = g; k.fillRect(0, 0, S, S);
    k.fillStyle = 'rgba(255,255,255,0.95)'; for (const [x, y, r] of [[60, 70, 22], [88, 62, 28], [116, 74, 20], [190, 120, 16], [210, 112, 20]]) { k.beginPath(); k.arc(x, y, r, 0, 7); k.fill(); }
    k.fillStyle = '#9fd77f'; k.beginPath(); k.ellipse(80, S, 140, 50, 0, 0, 7); k.fill(); k.fillStyle = '#8fcf6f'; k.beginPath(); k.ellipse(220, S + 6, 120, 44, 0, 0, 7); k.fill(); });
  tile(T.NIGHTWIN, (k) => { const g = k.createLinearGradient(0, 0, 0, S); g.addColorStop(0, '#070a24'); g.addColorStop(1, '#27306a'); k.fillStyle = g; k.fillRect(0, 0, S, S);
    for (let i = 0; i < 70; i++) { k.fillStyle = `rgba(255,255,255,${0.4 + Math.random() * 0.6})`; k.beginPath(); k.arc(Math.random() * S, Math.random() * S * 0.8, Math.random() * 1.8 + 0.4, 0, 7); k.fill(); }
    k.fillStyle = '#4f8ee0'; k.beginPath(); k.arc(190, 70, 26, 0, 7); k.fill(); k.fillStyle = '#7fd07a'; k.beginPath(); k.arc(182, 62, 10, 0, 7); k.fill(); k.beginPath(); k.arc(200, 82, 8, 0, 7); k.fill();
    k.fillStyle = '#9c9ea8'; k.beginPath(); k.ellipse(128, S + 10, 200, 60, 0, 0, 7); k.fill(); });
  tile(T.SIGN, (k) => { fill(k, '#fff7ef'); k.strokeStyle = '#f2a0b4'; k.lineWidth = 10; k.strokeRect(8, 8, S - 16, S - 16);
    k.fillStyle = '#e46f8f'; k.textAlign = 'center'; k.font = 'bold 52px "Trebuchet MS", system-ui, sans-serif'; k.fillText('Hotel', S / 2, 98);
    k.font = 'bold 40px "Trebuchet MS", system-ui, sans-serif'; k.fillText('Kuschel-', S / 2, 152); k.fillText('pfote', S / 2, 196);
    k.font = '34px serif'; k.fillText('🐾', S / 2 - 70, 70); k.fillText('🐾', S / 2 + 70, 70); });
  tile(T.DESK, (k) => { fill(k, '#ffffff'); k.fillStyle = '#f1e6da'; for (let x = 0; x < S; x += 42) k.fillRect(x, 0, 6, S); k.fillStyle = '#e8d8c6'; k.fillRect(0, 0, S, 18); k.fillRect(0, S - 22, S, 22); });
  tile(T.BLANKET, (k) => { fill(k, '#ffffff'); const s = 32; for (let y = 0; y < S; y += s) for (let x = 0; x < S; x += s) { const a = (x / s) % 2, b = (y / s) % 2; k.fillStyle = a && b ? '#e85a6a' : a || b ? '#f3a2aa' : '#ffffff'; k.fillRect(x, y, s, s); } });
  tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}
// Tapeten zur Auswahl (Kachel + Farbe), Index = room.wall
export const WALLPAPERS = [
  { tile: T.STRIPES, color: '#ffd9df' }, { tile: T.DOTS, color: '#d6ecff' }, { tile: T.FLOWERS, color: '#dff5da' }, { tile: T.STRIPES, color: '#fff0c4' },
  { tile: T.DOTS, color: '#eadfff' }, { tile: T.FLOWERS, color: '#ffe2cf' }, { tile: T.STARS, color: '#dfe6ff' }, { tile: T.PLAIN, color: '#fff6ee' },
];
export const DEFAULT_WALL = { schlaf: 0, restaurant: 3, spa: 1, spiel: 4 };
export const FLOOR_TILE = { schlaf: [T.WOOD, '#f0cfa6'], restaurant: [T.LOBBY, '#f2dcc0'], spa: [T.BATH, '#d5eef2'], spiel: [T.WOOD, '#f7d39a'] };
