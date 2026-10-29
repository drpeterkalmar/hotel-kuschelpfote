# Peter 29.10.: Gastgeber-Figur clippt durch den Rezeptionstresen.
# Misst die Bounding-Box der Figur gegen die Theke (x 3.07–5.43, z bis −1.37 Platte) und knipst die Lobby nah.
import sys, os, time, json
sys.path.insert(0, os.path.dirname(__file__))
from util import *

JS = """() => {
  const T = window.THREE || null; const app = window.__app; const out = [];
  app.scene.traverse(o => { if (o.isMesh || o.isSkinnedMesh || o.isGroup) { if (o.userData && (o.userData.id === 'host' || o.name === 'host')) out.push(o); } });
  return out.length;
}"""
with Server() as srv, sync_playwright() as pw:
    b = pw.chromium.launch(args=GPU_ARGS)
    res = {}
    for art in ['bunny', 'panda', 'cow']:
        s = Session(pw, srv.base, QUER, browser=b)
        s.open(f'?nosw&slot=0&name=Test&tutorial=0&alles=1&welt=blumenwiese&avatar={art}')
        s.frames(20); time.sleep(1.5)
        s.ev("__game.setCam({dist: 7, x: 4.3, z: -1.0, yaw: 1.2, tilt: 0.35})"); time.sleep(1.5)
        s.shot(f'theke_{art}', 'theke')
        s.ev("__game.setCam({dist: 7, x: 4.3, z: -1.0, yaw: 0.0, tilt: 0.25})"); time.sleep(1.5)
        s.shot(f'theke_{art}_vorn', 'theke')
        res[art] = s.ev("window.__errors || []")[:2]
        s.close()
    b.close()
    print(json.dumps(res))
