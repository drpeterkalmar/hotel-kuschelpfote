# A/B der Nachbearbeitung (Bloom/Grading) an derselben Szene
import sys, time
sys.path.insert(0, __import__('os').path.dirname(__file__))
from util import *
with Server() as srv, sync_playwright() as pw:
    s = Session(pw, srv.base, HOCH); s.open('?nosw&slot=0&name=Test&tutorial=0')
    s.frames(10); time.sleep(1)
    for name, js in [('a_now', ''), ('b_nobloom', 'app.renderer.grade.bloom=0'), ('c_nopost', 'app.renderer.post=false'), ('d_nofog', 'app.renderer.post=true; app.renderer.grade.bloom=0; app.scene.fog=null')]:
        s.ev(f"(() => {{ const app = window.__app; {js}; }})()"); s.frames(4); time.sleep(0.4)
        s.shot(name, 'ab')
    print(s.errors)
    s.close()
