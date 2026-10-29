# Picknick-Ausflug: Foto ohne Antippen (Größe der Leckereien neben den Schmetterlingen), hoch.
import sys, time, os
sys.path.insert(0, os.path.dirname(__file__))
from util import *
with Server() as srv, sync_playwright() as pw:
    b = pw.chromium.launch(args=GPU_ARGS)
    s = Session(pw, srv.base, HOCH, browser=b)
    s.open('?nosw&slot=0&name=Test&tutorial=0&alles=1&welt=blumenwiese')
    s.ev("__game.sim().buildAusflug()"); time.sleep(0.5); s.ev("__game.startTrip()")
    s.pg.wait_for_function("window.__app.mode === 'trip'", timeout=20000)
    n = 0
    for i in range(60):
        time.sleep(0.5)
        k = s.ev("__game.trip().game.debug().treatsMitte")
        if k and k >= 2: s.shot(f'picknick_{n}', 'treats'); n += 1
        if n >= 2: break
    print('Fotos', n)
    print('Fehler', s.errors[:3], s.ev('window.__errors')[:3]); s.close(); b.close()
