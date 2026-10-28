// Tutorial: 5 kurze Bild-Schritte (Bild + ein Satz), nicht blockierend, überspringbar. Schritt geht weiter, wenn die
// passende Handlung passiert (Ereignis) oder per „Weiter".
const STEPS = [
  { pic: '🐰💬', txt: 'Ein Gast ist da! Tippe auf seine Sprechblase.', wait: 'select', hand: 'bubble' },
  { pic: '👆🛏️', txt: 'Jetzt tippe auf ein Zimmer mit ❤️ – dort schläft der Gast.', wait: 'checkin', hand: 'go' },
  { pic: '🛋️✨', txt: 'Tippe auf ein Zimmer, um es einzurichten.', wait: 'furnish', hand: 'room' },
  { pic: '🌸➡️🏠', txt: 'Zieh ein Möbel aus der Leiste ins Zimmer. Grün = passt! Das erste ist geschenkt 🎁', wait: 'placed', hand: 'catalog' },
  { pic: '✔️', txt: 'Fertig? Tippe auf ✔️. Erfüllte Wünsche bringen Herzen ❤️ und Münzen 🪙.', wait: 'hotel' },
  { pic: '🏗️⭐', txt: 'Mit Münzen baust du das Hotel weiter an. Herzen bringen Sterne ⭐ – und neue Welten! Mit ⟲ ⟳ drehst du die Ansicht.', wait: null },
];
export class Tutorial {
  constructor(app) { this.app = app; this.i = -1; this.el = document.getElementById('tut'); this.hand = null; }
  start(force = false) {
    if (!force && this.app.slot.tutorial.done) return;
    this.i = 0; this.show();
  }
  show() {
    const s = STEPS[this.i]; if (!s) return this.finish();
    // Peter 28.10.: Der Einrichten-Schritt darf nie am Geld scheitern → erstes Möbel gratis
    if ((s.wait === 'furnish' || s.wait === 'placed') && !this.gifted) { this.gifted = true; this.app.sim.geschenk = Math.max(this.app.sim.geschenk, 1); if (this.app.mode === 'furnish') this.app.furnish.refreshPrices(); }
    this.el.classList.remove('hidden');
    this.el.innerHTML = `<div class="pic">${s.pic}</div><div class="txt">${s.txt}<div class="dots">${STEPS.map((_, k) => (k === this.i ? '●' : '○')).join(' ')}</div></div>
      <div class="btns">${s.wait ? '' : '<button class="nx">👍 OK</button>'}<button class="sk">Über&shy;springen</button></div>`;
    const nx = this.el.querySelector('.nx'); if (nx) nx.onclick = () => { this.app.sound.sfx('tap'); this.next(); };
    this.el.querySelector('.sk').onclick = () => { this.app.sound.sfx('tap'); this.finish(); };
  }
  next() { this.i++; this.show(); }
  event(name) {
    if (this.i < 0) return;
    const s = STEPS[this.i]; if (!s) return;
    if (s.wait === name) { this.app.sound.sfx('pop', { rate: 1.2 }); this.next(); }
    // Vorgriff: Wer schon weiter ist, überspringt
    else if (name === 'checkin' && this.i === 0) { this.i = 2; this.show(); }
    else if (name === 'placed' && this.i === 2) { this.i = 4; this.show(); }
  }
  finish() { this.i = -1; this.el.classList.add('hidden'); this.app.slot.tutorial.done = true; this.app.save(); if (this.hand) { this.hand.remove(); this.hand = null; } }
  update() {
    if (this.i < 0) return;
    const s = STEPS[this.i], app = this.app;
    if (s?.wait === 'hotel' && app.mode === 'hotel') this.next();
    // Zeige-Hand
    let target = null;
    if (s?.hand === 'bubble') target = document.querySelector('#overlay .bub');
    if (s?.hand === 'go') target = document.querySelector('#overlay .badge.go');
    if (s?.hand === 'catalog' && app.mode === 'furnish') target = document.querySelector('#cList .item.want:not(.poor)') || document.querySelector('#cList .item:not(.locked):not(.poor)') || document.querySelector('#cList .item.want');
    if (s?.hand === 'room' && app.mode === 'hotel') { const p = window.__game.roomScreen('1A'); target = { getBoundingClientRect: () => ({ left: p.x - 20, top: p.y - 10, width: 40, height: 40 }) }; }
    if (target) {
      if (!this.hand) { this.hand = document.createElement('div'); this.hand.id = 'tutHand'; this.hand.textContent = '👆'; document.body.appendChild(this.hand); }
      const r = target.getBoundingClientRect(); this.hand.style.left = r.left + r.width / 2 + 'px'; this.hand.style.top = r.top + r.height * 0.7 + 'px'; this.hand.style.display = '';
    } else if (this.hand) this.hand.style.display = 'none';
  }
}
