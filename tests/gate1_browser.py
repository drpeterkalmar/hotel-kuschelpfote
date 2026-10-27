# Gate 1 im Browser: Autopilot spielt 10 Spielminuten Blumenwiese über die echte Spielschleife (?tempo=8 → 75 s echt).
# Erwartet: ≥ 8 Gäste glücklich abgereist, ≥ 2 Etagen gebaut, nie ein Gast festhängend, 0 Fehler.
import sys, time, os, json
sys.path.insert(0, os.path.dirname(__file__))
from util import *
TEMPO = 8
with Server() as srv, sync_playwright() as pw:
    s = Session(pw, srv.base, HOCH)
    s.open(f'?nosw&slot=0&name=Gate&tutorial=0&tempo={TEMPO}')
    s.ev("__game.autoplay(true)")
    s.ev("window.__maxStuck = 0; window.__happyAbreise = 0; __game.sim().on('rating', r => { if (r.hearts >= 3) window.__happyAbreise++; }); setInterval(() => { window.__maxStuck = Math.max(window.__maxStuck, __game.sim().stuckGuests().length); }, 200)")
    t0 = time.time(); shots = 0
    while True:
        st = s.ev("__game.sim().t")
        if st >= 600: break
        if time.time() - t0 > 400: print('Zeitüberschreitung bei Spielzeit', st); break
        time.sleep(5); s.ev("__game.closeModal()")
        if shots < 3 and st > 150 * (shots + 1): s.shot(f'gate1_{shots}', 'gate'); shots += 1
    r = s.ev("({ t: __game.sim().t, happy: window.__happyAbreise, departed: __game.sim().stats.departed, floors: __game.sim().hotel.floors.length - 1, stars: __game.sim().hotel.stars, maxStuck: window.__maxStuck, coins: __app.slot.coins, fps: __app.frames })")
    r['echtSek'] = round(time.time() - t0); r['errors'] = s.errors[:3] + s.ev('window.__errors')[:3]
    s.shot('gate1_ende', 'gate')
    print(json.dumps(r))
    ok = r['happy'] >= 8 and r['floors'] >= 2 and r['maxStuck'] == 0 and not r['errors']
    print('GATE 1', 'BESTANDEN' if ok else 'NICHT bestanden')
    s.close()
