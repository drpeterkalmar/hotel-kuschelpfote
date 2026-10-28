# Peter 28.10.: „Tutorial verlangt Nachtkästchen, aber ich hab kein Geld“ → Geschenk im Einrichten-Schritt + Sparschwein.
# Nachstellen: neuer Spielstand mit 0 Münzen (?geld=0), Tutorial bis zum Einrichten, erstes Möbel muss gratis gehen.
import sys, time
from util import Server, Session, HOCH
from playwright.sync_api import sync_playwright

FAIL = []
def check(c, msg):
    print(('OK  ' if c else 'FEHLER ') + msg)
    if not c: FAIL.append(msg)

with Server() as srv, sync_playwright() as pw:
    s = Session(pw, srv.base, HOCH)
    s.open('?nosw&geld=0&ton=0&slot=0&name=Test', wait_world=True)
    check(s.ev("__app.slot.coins") == 0, 'Start mit 0 Münzen')
    check(s.ev("__app.tutorial.i") >= 0, 'Tutorial läuft')
    s.ev("__app.tutorial.i = 2; __app.tutorial.show()")    # Schritt „Zimmer einrichten“
    check(s.ev("__app.sim.geschenk") == 1, 'Geschenk bereit')
    s.ev("__game.openRoom('1A')"); time.sleep(1.0)
    s.ev("__app.tutorial.event('furnish')"); time.sleep(0.3)
    txt = s.ev("document.querySelector('#tut .txt')?.textContent || ''")
    check('geschenkt' in txt, 'Tutorial-Text nennt Geschenk: ' + txt[:80])
    gratis = s.ev("[...document.querySelectorAll('#cList .item .pr')].filter(e => e.textContent.includes('gratis')).length")
    poor = s.ev("document.querySelectorAll('#cList .item.poor').length")
    check(gratis > 0 and poor == 0, f'Leiste zeigt gratis ({gratis}), nichts ausgegraut ({poor})')
    s.shot('geschenk_leiste', 'fix')
    n0 = s.ev("__game.sim().hotel.floors[0].rooms[0].furniture.length")
    s.ev("__app.furnish.autoPlace('cabinetBed')"); time.sleep(0.6)
    n1 = s.ev("__game.sim().hotel.floors[0].rooms[0].furniture.length")
    check(n1 == n0 + 1 and s.ev("__app.slot.coins") == 0, 'Nachttisch ohne Geld hingestellt (gratis)')
    check(s.ev("__app.sim.geschenk") == 0, 'Geschenk verbraucht')
    s.ev("__game.closeRoom()"); time.sleep(0.5)
    # Sparschwein: bei 0 Münzen nach ~3 s
    s.pg.wait_for_function("__app.slot.coins >= 30", timeout=20000)
    check(s.ev("__app.slot.coins") >= 30, 'Sparschwein hat nachgefüllt')
    errs = [e for e in s.errors if 'PAGEERROR' in e or 'CONSOLE' in e]
    check(not errs, 'keine Fehler ' + str(errs[:3]))
    s.ctx.close(); s.b.close()
sys.exit(1 if FAIL else 0)
