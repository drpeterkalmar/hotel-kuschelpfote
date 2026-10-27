# Ausflüge: Picknick (antippen) und Mondsprung (Burst-Fotos vom Sprungbogen, Flugzeit/Höhe gemessen), hoch + quer.
import sys, time, os, json
sys.path.insert(0, os.path.dirname(__file__))
from util import *
res = {}
with Server() as srv, sync_playwright() as pw:
    b = pw.chromium.launch(args=GPU_ARGS)
    for dname, dev in [('hoch', HOCH), ('quer', QUER)]:
        for welt in ['blumenwiese', 'mond']:
            s = Session(pw, srv.base, dev, browser=b)
            s.open(f'?nosw&slot=0&name=Test&tutorial=0&alles=1&welt={welt}')
            s.ev("__game.sim().buildAusflug()"); time.sleep(0.5)
            s.ev("__game.startTrip()")
            s.pg.wait_for_function("window.__app.mode === 'trip'", timeout=20000)
            time.sleep(2.5)
            if welt == 'blumenwiese':
                for i in range(6):
                    s.ev("__game.trip().game.tapNearest()"); time.sleep(0.5)
                time.sleep(0.6); s.shot(f'picknick_{dname}', 'trip')
                res[f'picknick_{dname}'] = s.ev("__game.trip().game.debug()")
            else:
                s.shot(f'mond_{dname}_start', 'trip')
                s.ev("__game.trip().game.jump()")
                t0 = time.time(); k = 0
                while time.time() - t0 < 5.6:
                    s.shot(f'mond_{dname}_burst{k}', 'trip'); k += 1; time.sleep(0.55)
                time.sleep(1.2)
                res[f'mond_{dname}'] = s.ev("__game.trip().game.debug()")
            # Ende per Zeit
            s.ev("__game.trip().t = 999"); time.sleep(0.8); s.shot(f'{welt}_{dname}_ende', 'trip')
            s.ev("__game.closeModal()"); time.sleep(0.5)
            res[f'{welt}_{dname}_mode'] = s.ev("window.__app.mode")
            res[f'{welt}_{dname}_err'] = s.errors[:3] + s.ev('window.__errors')[:3]
            s.close()
    b.close()
print(json.dumps(res, indent=1))
