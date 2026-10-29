# Bounding-Box der Gastgeber-Figur (je Avatar) in Weltkoordinaten – gegen die Theke (z-Rückkante −1.37, Wand −2.0)
import sys, os, time, json
sys.path.insert(0, os.path.dirname(__file__))
from util import *
JS = """() => { const a = window.__app; const p = a.pets.pets.get('host'); if (!p) return null;
  let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9,y1=-1e9; const v = new p.rig.position.constructor();
  for (const n of p.nodes) { n.updateMatrixWorld(true); const g = n.geometry; }
  p.rig.updateMatrixWorld(true);
  p.rig.traverse(n => { const e = n.matrixWorld.elements; x0=Math.min(x0,e[12]);x1=Math.max(x1,e[12]);z0=Math.min(z0,e[14]);z1=Math.max(z1,e[14]);y1=Math.max(y1,e[13]); });
  return {x0,x1,z0,z1,y1, h: p.S.height, pos: p.rig.position.toArray()}; }"""
with Server() as srv, sync_playwright() as pw:
    b = pw.chromium.launch(args=GPU_ARGS); out = {}
    for art in sys.argv[1:] or ['bunny']:
        s = Session(pw, srv.base, QUER, browser=b)
        s.open(f'?nosw&slot=0&name=Test&tutorial=0&alles=1&welt=blumenwiese&avatar={art}'); s.frames(10)
        out[art] = s.ev(JS); s.close()
    b.close(); print(json.dumps(out, indent=0))
