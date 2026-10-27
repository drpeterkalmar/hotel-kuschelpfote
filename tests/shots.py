# Bilder für die Vision-Prüfung: Lobby/Hotel nach etwas Spielzeit, Einrichten, Mond – je hoch + quer.
import sys, time, os
sys.path.insert(0, os.path.dirname(__file__))
from util import *
only = sys.argv[1] if len(sys.argv) > 1 else ''
def scene(s, tag, sub):
    # 4 Minuten Autopilot vorspulen, dann ein paar echte Sekunden laufen lassen
    s.ev("__game.autoplay(true)"); s.ev("__game.step(240)"); s.ev("__game.autoplay(false)")
    s.frames(30); time.sleep(3); s.ev("__game.closeModal()"); time.sleep(0.4)
    s.shot(f'{tag}_hotel', sub)
    s.ev("__game.setCam({dist: 22, y: 1.8, x: 0})"); time.sleep(1.2); s.shot(f'{tag}_lobby', sub)
    s.ev("__game.setCam({dist: 22, y: 5.0, x: -2.8})"); time.sleep(1.2); s.shot(f'{tag}_zimmer', sub)
    s.ev("__game.openRoom('1A')"); time.sleep(2.0); s.shot(f'{tag}_einrichten', sub)
    s.ev("__game.closeRoom()"); time.sleep(0.5)
with Server() as srv, sync_playwright() as pw:
    b = pw.chromium.launch(args=GPU_ARGS)
    for dname, dev in [('hoch', HOCH), ('quer', QUER)]:
        for welt in ['blumenwiese', 'mond']:
            if only and only not in (welt, dname): continue
            s = Session(pw, srv.base, dev, browser=b)
            s.open(f'?nosw&slot=0&name=Test&tutorial=0&alles=1&welt={welt}')
            scene(s, f'{welt}_{dname}', 'look')
            print(welt, dname, 'Fehler', s.errors[:3], s.ev('window.__errors')[:3], s.ev('__game.renderInfo()'))
            s.close()
    b.close()
