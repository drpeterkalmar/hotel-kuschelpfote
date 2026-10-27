# Rauchtest: Start, Spielstand anlegen, Hotel hoch/quer/Desktop, Gäste kommen, Einrichten öffnen, 0 Fehler.
import sys, time, json
sys.path.insert(0, __import__('os').path.dirname(__file__))
from util import *

def run():
    with Server() as srv, sync_playwright() as pw:
        b = pw.chromium.launch(args=GPU_ARGS)
        for name, dev in [('hoch', HOCH), ('quer', QUER), ('desktop', DESKTOP)]:
            s = Session(pw, srv.base, dev, browser=b)
            s.open('?nosw&slot=0&name=Test&tutorial=0&tempo=4')
            s.frames(20); time.sleep(2.5)
            st = s.state(); print(name, 'boot', round(s.boot_s, 1), 's', 'Gäste', len(st['guests']), 'Fehler', st['errors'][:3])
            s.shot(f'smoke_{name}_hotel')
            s.ev("__game.openRoom('1A')"); time.sleep(1.5); s.shot(f'smoke_{name}_furnish')
            s.ev("__game.closeRoom()"); time.sleep(0.5)
            print('  kleine Knöpfe', s.small_buttons()[:6])
            print('  render', s.ev("__game.renderInfo()"))
            print('  errors', s.errors[:5], s.ev('window.__errors')[:5])
            s.close()
        b.close()
run()
