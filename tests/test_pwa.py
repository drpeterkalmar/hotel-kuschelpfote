# PWA: Service-Worker installiert, Version = src/build.js, offline neu laden startet das Spiel, Manifest installierbar.
# Optional: python3 tests/test_pwa.py <basis-url>  (z. B. die Live-Seite)
import sys, time, os, re, json
sys.path.insert(0, os.path.dirname(__file__))
from util import *
BUILD = re.search(r"'(\w+)'", open(os.path.join(ROOT, 'src', 'build.js')).read()).group(1)
def run(base):
    with sync_playwright() as pw:
        s = Session(pw, base, HOCH)
        s.pg.goto(base + 'index.html?slot=0&name=PWA&tutorial=0')
        s.pg.wait_for_function("window.__app && window.__app.mode === 'hotel'", timeout=60000)
        s.pg.wait_for_function("navigator.serviceWorker.controller || navigator.serviceWorker.ready.then(() => true)", timeout=30000)
        time.sleep(4)
        ver = s.ev("window.__app.build")
        cdp = s.ctx.new_cdp_session(s.pg)
        inst = cdp.send('Page.getInstallabilityErrors')
        s.ctx.set_offline(True); s.pg.reload()
        s.pg.wait_for_function("window.__app && window.__app.mode === 'hotel' && window.__app.frames > 5", timeout=60000)
        ok_off = s.ev("window.__app.frames > 3")
        r = {'build_live': ver, 'build_lokal': BUILD, 'offline_start': ok_off, 'installierbar': inst.get('installabilityErrors', []), 'fehler': s.errors[:3] + s.ev('window.__errors')[:3]}
        s.close()
        return r
if len(sys.argv) > 1: print(json.dumps(run(sys.argv[1])))
else:
    with Server() as srv: print(json.dumps(run(srv.base)))
