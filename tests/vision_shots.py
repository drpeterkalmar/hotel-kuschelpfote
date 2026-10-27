# Gate-2-Bilder: Lobby, Einrichten, Mond-Ausflug – je hoch + quer (+ Hotel-Übersicht beider Welten).
import sys, time, os
sys.path.insert(0, os.path.dirname(__file__))
from util import *
with Server() as srv, sync_playwright() as pw:
    b = pw.chromium.launch(args=GPU_ARGS)
    for dname, dev in [('hoch', HOCH), ('quer', QUER)]:
        s = Session(pw, srv.base, dev, browser=b)
        s.open('?nosw&slot=0&name=Emilia&avatar=cat&tutorial=0&alles=1')
        s.ev("__game.autoplay(true)"); s.ev("__game.step(260)"); s.ev("__game.autoplay(false)"); s.ev("__game.closeModal()")
        s.frames(20); time.sleep(2.5); s.ev("__game.closeModal()")
        s.shot(f'hotel_wiese_{dname}', 'gate2')
        d = 15 if dname == 'quer' else 21
        s.ev("__game.step(25)"); s.ev(f"__game.setCam({{dist: {d}, x: 0.5, z: -0.5}})"); time.sleep(1.5); s.shot(f'lobby_{dname}', 'gate2')
        s.ev(f"__game.setCam({{dist: {d + 4}, x: 0, z: -6, yaw: 0.785}})"); time.sleep(1.5); s.shot(f'zimmer45_{dname}', 'gate2'); s.ev("__game.setCam({yaw: 0})")
        s.ev("__game.openRoom('1A')"); time.sleep(0.8)
        s.ev("(() => { const f = __app.furnish; f.select(f.room.furniture[0]); })()"); time.sleep(1.4); s.shot(f'einrichten_{dname}', 'gate2')
        s.ev("__game.closeRoom()"); time.sleep(0.3)
        s.ev("__game.enterWorld('mond')"); s.pg.wait_for_function("__app.mode === 'hotel' && __app.world.id === 'mond'", timeout=30000)
        s.ev("__game.autoplay(true)"); s.ev("__game.step(260)"); s.ev("__game.autoplay(false)"); s.ev("__game.closeModal()")
        time.sleep(2.5); s.ev("__game.closeModal()"); s.shot(f'hotel_mond_{dname}', 'gate2')
        s.ev("__game.sim().buildAusflug()"); time.sleep(0.3); s.ev("__game.closeModal()")
        s.ev("__game.startTrip()"); s.pg.wait_for_function("__app.mode === 'trip'", timeout=20000); time.sleep(2.0)
        s.ev("__game.trip().game.jump()"); time.sleep(2.4); s.shot(f'mondausflug_{dname}', 'gate2')
        print(dname, s.errors[:3], s.ev('window.__errors')[:3])
        s.close()
    b.close()
