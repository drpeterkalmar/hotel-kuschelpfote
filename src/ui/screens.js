// Bildschirme und Fenster: Start (3 Spielstände), Leiste, Zimmer-Typ-Wahl, Etage, Ausflug, Album, Welten, Menü, Credits.
import { BAL, CFG } from '../config.js';
import { BUILD } from '../build.js';
import { ROOM_TYPES, ITEMS } from '../core/catalog.js';
import { floorPrice, canBuildFloor, starsForFloor, roomPrice } from '../core/hotel.js';
import { WORLD_LIST, SOON, ALL_SPECIES, SPECIES_NAME, worldUnlocked } from '../worlds/index.js';
import { loadSlot, deleteSlot, AVATARS, SLOTS } from '../core/save.js';

const $ = (id) => document.getElementById(id);
const thumb = (sp) => `assets/thumbs/${sp}.png`;
export class Screens {
  constructor(app) {
    this.app = app;
    $('bMenu').onclick = () => this.menu();
    $('bFloor').onclick = () => this.buildFloor();
    $('bTrip').onclick = () => this.tripButton();
    $('bAlbum').onclick = () => this.album();
    $('bWorlds').onclick = () => this.worlds();
  }
  tap() { this.app.sound.sfx('tap'); }
  // ---------- Start ----------
  showStart() {
    const app = this.app; app.mode = 'menu';
    const st = $('start'); st.classList.remove('hidden'); $('hud').classList.add('hidden'); $('bar').classList.add('hidden');
    const slots = [];
    for (let i = 0; i < SLOTS; i++) slots.push(loadSlot(i, WORLD_LIST));
    const chosen = slots.map((s, i) => s?.avatar || AVATARS[i * 2 % AVATARS.length]);
    const render = () => {
      st.innerHTML = `<h1>🐾 Hotel Kuschelpfote</h1><div class="sub">Wer spielt?</div><div class="slots">${slots.map((s, i) => `
        <div class="slot" data-i="${i}">
          <img src="${thumb(chosen[i])}" alt="">
          ${s && s.name ? `<b style="font-size:20px">${esc(s.name)}</b><div class="info">⭐ ${Object.values(s.worlds).reduce((a, h) => a + h.stars, 0)} · 🪙 ${s.coins} · 📖 ${Object.keys(s.album).length}/24</div>`
          : `<input maxlength="14" placeholder="Dein Name" data-i="${i}" value="${s?.name ? esc(s.name) : ''}"><div class="avs">${AVATARS.slice(0, 8).map((a) => `<button data-av="${a}" data-i="${i}" class="${a === chosen[i] ? 'on' : ''}"><img src="${thumb(a)}" alt="${a}"></button>`).join('')}</div>`}
          <button class="big ok play" data-i="${i}" style="width:100%;flex-direction:row;gap:8px"><span>▶️</span><b>${s && s.name ? 'Weiter' : 'Los!'}</b></button>
          ${s && s.name ? `<button class="big del" data-i="${i}" style="height:48px;width:100%;flex-direction:row;font-size:13px;font-weight:800;gap:6px"><span style="font-size:18px">🗑️</span>Neu anfangen</button>` : ''}
        </div>`).join('')}</div><div class="ver">Version ${BUILD}</div>`;
      st.querySelectorAll('[data-av]').forEach((b) => (b.onclick = () => { chosen[+b.dataset.i] = b.dataset.av; const inp = st.querySelector(`input[data-i="${b.dataset.i}"]`); const v = inp?.value; render(); if (v) st.querySelector(`input[data-i="${b.dataset.i}"]`).value = v; this.tap(); }));
      st.querySelectorAll('.play').forEach((b) => (b.onclick = () => {
        const i = +b.dataset.i; const inp = st.querySelector(`input[data-i="${i}"]`);
        const name = inp ? inp.value.trim() : slots[i]?.name;
        if (!name) { inp.focus(); inp.style.borderColor = '#e46f8f'; this.app.sound.sfx('nope'); return; }
        st.classList.add('hidden'); this.tap();
        app.enterSlot(i, { name, avatar: chosen[i] });
      }));
      st.querySelectorAll('.del').forEach((b) => (b.onclick = () => this.confirm('🗑️', `Spielstand von ${esc(slots[+b.dataset.i].name)} löschen und neu anfangen?`, () => { deleteSlot(+b.dataset.i); slots[+b.dataset.i] = null; render(); })));
    };
    render();
  }
  showHud() { $('hud').classList.remove('hidden'); $('bar').classList.remove('hidden'); $('start').classList.add('hidden'); this.updateHud(); }
  updateHud() {
    const app = this.app; if (!app.slot) return;
    const c = $('coinN'); const n = CFG.alles ? '∞' : String(app.slot.coins);
    if (c.textContent !== n) { c.textContent = n; $('coins').classList.remove('bump'); void $('coins').offsetWidth; $('coins').classList.add('bump'); }
    const h = app.sim?.hotel; if (!h) return;
    $('starRow').textContent = '⭐'.repeat(h.stars) + '☆'.repeat(Math.max(0, 5 - h.stars));
    const th = BAL.sterneHerzen, lo = h.stars ? th[h.stars - 1] : 0, hi = th[h.stars] ?? th[th.length - 1];
    $('starBar').firstElementChild.style.width = (h.stars >= th.length ? 100 : Math.round((h.hearts - lo) / (hi - lo) * 100)) + '%';
    $('worldName').textContent = app.world.icon + ' ' + app.world.name;
    const fb = $('bFloor'); const can = canBuildFloor(h) && h.floors.length < BAL.maxEtagen;
    fb.innerHTML = can ? `<span>🏗️</span><small>🪙${floorPrice(h)}</small>` : `<span>🏗️</span><small>🔒</small>`;
    $('bTrip').innerHTML = `<span>${app.world.ausflug.icon}</span><small>${h.ausflug ? 'Ausflug' : '🪙' + app.world.ausflug.preis}</small>`;
  }
  toast(icon, text) {
    const d = document.createElement('div'); d.className = 'toast'; d.innerHTML = `<span class="e">${icon}</span>${text}`;
    const t = $('toasts'); t.appendChild(d); while (t.children.length > 3) t.firstChild.remove();
    setTimeout(() => d.remove(), 2900);
  }
  modal(html, onClose) {
    const m = $('modal'); m.classList.remove('hidden'); const c = m.querySelector('.card'); c.innerHTML = html;
    const close = () => { m.classList.add('hidden'); c.innerHTML = ''; onClose && onClose(); };
    m.onclick = (e) => { if (e.target === m) close(); };
    c.querySelectorAll('.close').forEach((b) => (b.onclick = () => { this.tap(); close(); }));
    this.app.sound.sfx('open', { vol: 0.5 });
    return { card: c, close };
  }
  confirm(icon, text, yes) {
    const { card, close } = this.modal(`<h2>${icon}</h2><p style="font-weight:800">${text}</p><div class="row"><button class="big ok yes"><span>✔️</span><small>Ja</small></button><button class="big close"><span>✖️</span><small>Nein</small></button></div>`);
    card.querySelector('.yes').onclick = () => { close(); yes(); };
  }
  // ---------- Bauen ----------
  roomTypePicker(roomId) {
    const app = this.app; if (app.mode !== 'hotel') return;
    const coins = app.slot.coins;
    const opts = Object.entries(ROOM_TYPES).map(([k, t]) => { const pr = roomPrice(k), ok = CFG.alles || coins >= pr;
      return `<button class="opt ${ok ? '' : 'no'}" data-t="${k}"><span class="e">${t.icon}</span><b>${t.name}</b><span class="pr">🪙 ${pr}</span></button>`; }).join('');
    const { card, close } = this.modal(`<h2>Was soll hier hin?</h2><div class="row">${opts}</div><button class="big close"><span>✖️</span><small>Zu</small></button>`);
    card.querySelectorAll('.opt').forEach((b) => (b.onclick = () => {
      const r = app.sim.buildRoom(roomId, b.dataset.t);
      if (!r.ok) { app.sound.sfx('nope'); this.toast('🪙', 'Noch nicht genug Münzen – Gäste bringen mehr!'); return; }
      close(); this.updateHud();
    }));
  }
  buildFloor() {
    const app = this.app; if (app.mode !== 'hotel') return;
    const h = app.sim.hotel;
    if (h.floors.length >= BAL.maxEtagen) { this.toast('🏨', 'Das Hotel ist schon riesig!'); return; }
    if (!canBuildFloor(h)) { app.sound.sfx('nope'); this.toast('⭐', `Neue Etage ab ${starsForFloor(h.floors.length + 1)} Sternen`); return; }
    const r = app.sim.buildFloor();
    if (!r.ok) { app.sound.sfx('nope'); this.toast('🪙', `Eine Etage kostet ${floorPrice(h)} Münzen`); return; }
    app.camCtl.h.ty = Math.min(app.camCtl.h.ty + 2, app.hotelView.topY);
    this.updateHud();
  }
  tripButton() {
    const app = this.app; if (app.mode !== 'hotel') return;
    const a = app.world.ausflug, h = app.sim.hotel;
    if (!h.ausflug) {
      const { card, close } = this.modal(`<h2>${a.icon} ${a.name}</h2><p>${a.text}</p><div class="row"><button class="big ok yes" style="min-width:140px"><span>🏗️</span><small>Bauen · 🪙${a.preis}</small></button><button class="big close"><span>✖️</span><small>Später</small></button></div>`);
      card.querySelector('.yes').onclick = () => { const r = app.sim.buildAusflug(); if (!r.ok) { app.sound.sfx('nope'); this.toast('🪙', 'Noch nicht genug Münzen'); return; } close(); this.updateHud(); };
      return;
    }
    const { card, close } = this.modal(`<h2>${a.icon} ${a.name}</h2><p>${a.anzug ? 'Raumanzug an! Tippe = riesiger Mondsprung. Sammle Mondsteine!' : 'Tippe auf Schmetterlinge und Leckereien!'}</p><div class="row"><button class="big ok yes" style="min-width:150px"><span>▶️</span><small>Mitmachen!</small></button><button class="big close"><span>✖️</span><small>Später</small></button></div>`);
    card.querySelector('.yes').onclick = () => { close(); app.trip.start(); };
  }
  // ---------- Album + Welten ----------
  album() {
    const app = this.app; const al = app.slot.album;
    const n = Object.keys(al).length;
    const cells = ALL_SPECIES.map((sp) => `<div class="animal ${al[sp] ? '' : 'unk'}"><img src="${thumb(sp)}" alt="">${al[sp] ? SPECIES_NAME[sp] : '?'}</div>`).join('');
    this.modal(`<h2>📖 Sammelalbum · ${n}/24</h2><div class="grid">${cells}</div>${this.worldTiles()}<button class="big close"><span>✖️</span><small>Zu</small></button>`);
  }
  worldTiles(clickable = false) {
    const app = this.app;
    const tiles = WORLD_LIST.map((w) => { const open = worldUnlocked(app.slot, w); const cur = app.world?.id === w.id;
      const bg = w.id === 'mond' ? 'linear-gradient(160deg,#1d2148,#5a5f9e 60%,#b9bccb)' : 'linear-gradient(160deg,#8fcdf2,#bfe7a6 60%,#ffd9df)';
      return `<button class="wtile" data-w="${w.id}" style="background:${bg}"><span class="e">${w.icon}</span>${w.name}${cur ? '<span class="tag">Hier bist du</span>' : open ? '' : `<span class="tag">🔒 ⭐${w.frei.sterne} in ${WORLD_LIST.find((x) => x.id === w.frei.welt).name}</span>`}</button>`; }).join('');
    const soon = SOON.map((s) => `<div class="wtile soon" style="background:linear-gradient(160deg,${s.farben.join(',')})"><span class="e">${s.icon}</span>${s.name}<span class="tag">bald</span></div>`).join('');
    return `<h2 style="margin-top:16px">🌍 Welten</h2><div class="worlds">${tiles}${soon}</div>`;
  }
  worlds() {
    const app = this.app;
    const { card, close } = this.modal(this.worldTiles(true) + '<button class="big close"><span>✖️</span><small>Zu</small></button>');
    card.querySelectorAll('[data-w]').forEach((b) => (b.onclick = () => {
      const w = WORLD_LIST.find((x) => x.id === b.dataset.w);
      if (!worldUnlocked(app.slot, w)) { app.sound.sfx('nope'); this.toast('🔒', `Erst ${w.frei.sterne} Sterne in der Blumenwiese sammeln!`); return; }
      close(); if (w.id !== app.world.id) { app.save(); app.enterWorld(w.id); }
    }));
  }
  starCelebrate(stars) {
    const app = this.app; const h = app.sim.hotel;
    const items = ITEMS.filter((i) => i.stars === stars && (!i.welt || i.welt === app.world.id)).map((i) => i.icon).join(' ');
    const mond = WORLD_LIST.find((w) => w.frei.welt === app.world.id && w.frei.sterne === stars);
    const { card, close } = this.modal(`<h2>⭐ Neuer Stern! ⭐</h2><p style="font-size:34px">${'⭐'.repeat(stars)}</p>${items ? `<p>Neu im Katalog: <span style="font-size:26px">${items}</span></p>` : ''}
      ${starsForFloor(h.floors.length + 1) === stars ? '<p>🏗️ Du kannst eine neue Etage bauen!</p>' : ''}
      ${mond ? `<p style="font-size:20px;font-weight:900">${mond.icon} Das ${mond.name} ist offen!</p><div class="row"><button class="big ok go" style="min-width:150px"><span>🚀</span><small>Hinfliegen</small></button><button class="big close"><span>👍</span><small>Später</small></button></div>` : '<button class="big ok close"><span>👍</span><small>Super!</small></button>'}`);
    if (mond) { card.querySelector('.go').onclick = () => { close(); app.save(); app.enterWorld(mond.id); }; app.sound.haptic(); }
    app.fx.emit(6, { x: 0, y: app.hotelView.topY, z: 2 }, { n: 24, spread: 5, up: 2.5, size: 0.8 });
    this.updateHud();
  }
  menu() {
    const app = this.app;
    const on = app.sound.isEnabled();
    const { card, close } = this.modal(`<h2>☰ Menü</h2><div class="menu">
      <button class="big snd"><span>${on ? '🔊' : '🔇'}</span>Ton ${on ? 'an' : 'aus'}</button>
      <button class="big tut"><span>🎓</span>Anleitung zeigen</button>
      <button class="big slots"><span>👧</span>Spielstand wechseln</button>
      <button class="big cred"><span>💛</span>Danke &amp; Lizenzen</button>
      <button class="big close"><span>✖️</span>Weiterspielen</button></div><p class="ver" style="font-size:11px;opacity:.6">Version ${BUILD} · ${esc(app.slot.name)}</p>`);
    card.querySelector('.snd').onclick = () => { app.sound.setEnabled(!on); app.slot.settings.ton = !on; if (!on) { app.sound.unlockAudio(); app.sound.startMusic(app.world); } close(); this.menu(); };
    card.querySelector('.tut').onclick = () => { close(); app.tutorial.start(true); };
    card.querySelector('.slots').onclick = () => { close(); app.save(); app.sound.stopMusic(); this.showStart(); };
    card.querySelector('.cred').onclick = () => { close(); this.credits(); };
  }
  credits() {
    this.modal(`<h2>💛 Danke!</h2><div class="credits">
      <p><b>Hotel Kuschelpfote</b> – gebaut für Alessia, Emilia und Livia.</p>
      <p>3D-Modelle: <b>Kenney</b> (kenney.nl) – Cube Pets, Furniture Kit, Space Kit, Nature Kit, Food Kit. Lizenz: CC0 (frei verwendbar). Vielen Dank, Kenney!</p>
      <p>3D-Technik: three.js (MIT-Lizenz).</p>
      <p>Töne und Musik: im Spiel erzeugt.</p>
      <p>Rezeption, Aufzug, Raumanzug, Blumen-Zug, Hotel-Gebäude: selbst gebaut.</p></div><button class="big close"><span>👍</span><small>Zu</small></button>`);
  }
}
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
