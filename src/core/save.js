// 3 Spielstände in localStorage, mit Versionsfeld + Migration (alte Stände laden immer).
import { CFG } from '../config.js';
import { newHotel } from './hotel.js';

export const SAVE_VERSION = 1;
export const SLOTS = 3;
const KEY = (i) => 'kuschelpfote.slot.' + i;
export const AVATARS = ['bunny', 'cat', 'panda', 'chick', 'dog', 'pig', 'penguin', 'cow', 'fox', 'koala', 'bee', 'monkey'];

export function newSlot(name, avatar, worlds) {
  const s = { v: SAVE_VERSION, name: name || '', avatar: avatar || 'bunny', coins: CFG.startGeld, worlds: {}, album: {}, tutorial: { done: !CFG.tutorial, step: 0 },
    settings: { ton: true, musik: true }, world: 'blumenwiese', created: Date.now(), updated: Date.now(), playSeconds: 0 };
  for (const w of worlds) s.worlds[w.id] = newHotel(w);
  return s;
}
// Migration: v0 (Prototyp ohne Versionsfeld: geld, hotel, entdeckt) → v1
export function migrate(d, worlds) {
  if (!d || typeof d !== 'object') return null;
  let s = d;
  if (!s.v) {
    s = { v: 1, name: d.name || d.spieler || '', avatar: d.avatar || 'bunny', coins: d.coins ?? d.geld ?? CFG.startGeld, worlds: {}, album: {},
      tutorial: { done: true, step: 0 }, settings: { ton: d.ton !== false, musik: true }, world: 'blumenwiese', created: d.created || Date.now(), updated: Date.now(), playSeconds: d.playSeconds || 0 };
    if (d.hotel) s.worlds.blumenwiese = d.hotel;
    for (const a of d.entdeckt || []) s.album[a] = 1;
  }
  // fehlende Felder ergänzen (neue Welten, neue Felder) – idempotent
  for (const w of worlds) if (!s.worlds[w.id]) s.worlds[w.id] = newHotel(w);
  for (const h of Object.values(s.worlds)) {
    h.floors ||= []; h.hearts ||= 0; h.stars ||= 0; h.served ||= 0; h.happy ||= 0; h.uid ||= 1; h.ausflug = !!h.ausflug;
    for (const f of h.floors) for (const r of f.rooms) { r.furniture ||= []; for (const fu of r.furniture) { if (!fu.uid) fu.uid = h.uid++; fu.rot ||= 0; fu.color ??= null; } }
  }
  s.album ||= {}; s.settings ||= { ton: true, musik: true }; s.tutorial ||= { done: true, step: 0 };
  if (!worlds.some((w) => w.id === s.world)) s.world = 'blumenwiese';
  s.v = SAVE_VERSION;
  return s;
}
function store() { try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch (e) { return null; } }
export function loadSlot(i, worlds) {
  const ls = store(); if (!ls) return null;
  try { const raw = ls.getItem(KEY(i)); return raw ? migrate(JSON.parse(raw), worlds) : null; } catch (e) { return null; }
}
export function saveSlot(i, s) {
  const ls = store(); if (!ls || !s) return false;
  s.updated = Date.now();
  try { ls.setItem(KEY(i), JSON.stringify(s)); return true; } catch (e) { return false; }
}
export function deleteSlot(i) { const ls = store(); if (ls) ls.removeItem(KEY(i)); }
export function lastSlot() { const ls = store(); const v = ls ? parseInt(ls.getItem('kuschelpfote.last') || '-1', 10) : -1; return v; }
export function setLastSlot(i) { const ls = store(); if (ls) ls.setItem('kuschelpfote.last', String(i)); }
