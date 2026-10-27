# Bedien-Test mit echten Touch-Gesten (CDP): Start → Name → Gast zuweisen → Einrichten (Ziehen, Tippen, Drehen, Farbe,
# Weg, Rückgängig) → Etage bauen → Neu laden (Spielstand bleibt). Hoch und quer. Prüft auch Tippziele ≥ 48 px.
import sys, time, os, json
sys.path.insert(0, os.path.dirname(__file__))
from util import *
fails = []
def check(c, msg):
    print(('  ✓ ' if c else '  ✗ ') + msg); (None if c else fails.append(msg))
def touch_drag(s, pts, step_ms=40):
    cdp = s.ctx.new_cdp_session(s.pg)
    x, y = pts[0]
    cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x, 'y': y}]})
    for (x, y) in pts[1:]:
        time.sleep(step_ms / 1000); cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': x, 'y': y}]})
    time.sleep(0.1); cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
    time.sleep(0.3)
def lerp(a, b, n): return [(a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n) for i in range(n + 1)]

with Server() as srv, sync_playwright() as pw:
    b = pw.chromium.launch(args=GPU_ARGS)
    for dname, dev in [('hoch', HOCH), ('quer', QUER)]:
        print('==', dname)
        s = Session(pw, srv.base, dev, browser=b)
        s.open('?nosw&tempo=3', wait_world=False)
        s.pg.wait_for_selector('#start .slot input', timeout=10000)
        check(s.small_buttons() == [], 'Startbildschirm: alle Tippziele ≥ 48 px ' + str(s.small_buttons()[:3]))
        s.shot(f'start_{dname}', 'play')
        s.pg.fill('#start .slot input[data-i="0"]', 'Alessia')
        s.tap('#start .slot[data-i="0"] .avs button[data-av="cat"]')
        s.pg.fill('#start .slot input[data-i="0"]', 'Alessia')
        s.tap('#start .slot[data-i="0"] .play')
        s.pg.wait_for_function("window.__app.mode === 'hotel'", timeout=30000)
        check(s.ev("!document.getElementById('tut').classList.contains('hidden')"), 'Tutorial erscheint')
        s.shot(f'tutorial_{dname}', 'play')
        # Gast abwarten, Sprechblase antippen, grüne Zimmer-Marke antippen
        s.pg.wait_for_selector('#overlay .bub', timeout=30000); time.sleep(0.6)
        s.tap('#overlay .bub')
        check(s.ev("__app.overlay.selected !== null"), 'Gast per Tipp gewählt')
        s.pg.wait_for_selector('#overlay .badge.go', timeout=5000); time.sleep(0.3)
        s.shot(f'zuweisen_{dname}', 'play')
        s.tap('#overlay .badge.go'); time.sleep(0.4)
        st = s.state()
        check(any(g['room'] == '1A' for g in st['guests']), 'Gast hat Zimmer 1A')
        check(s.ev("document.querySelector('#tut .txt')?.textContent.includes('einzurichten')"), 'Tutorial ist bei Schritt 3')
        # Zimmer antippen → Einrichten
        for cell_ in [(1, 4), (4, 0), (0, 2)]:   # freie Stelle ohne Gast unter dem Finger (Gast antippen = Reaktion)
            p = s.ev(f"__game.cellScreen('1A', {cell_[0]}, {cell_[1]})"); s.tap_xy(p['x'], p['y']); time.sleep(1.5)
            if s.ev("__app.mode") == 'furnish': break
        check(s.ev("__app.mode") == 'furnish', 'Einrichten per Tipp aufs Zimmer')
        check(s.small_buttons() == [], 'Einrichten: Tippziele ≥ 48 px ' + str(s.small_buttons()[:3]))
        n0 = s.ev("__game.sim().hotel.floors[0].rooms[0].furniture.length"); c0 = s.ev("__app.slot.coins")
        # Möbel aus dem Katalog ins Zimmer ziehen (Deko-Reiter, Topfpflanze)
        s.tap('#cTabs button[data-t="deko"]'); time.sleep(0.3)
        box = s.pg.locator('#cList .item[data-id="pottedPlant"]').bounding_box()
        start = (box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)
        cell = s.ev("__game.cellScreen('1A', 3, 1)")
        target = (cell['x'], cell['y'] + 58)   # Finger unter dem Geist
        mid = (start[0] - 70, start[1] - 10) if dname == 'quer' else (start[0], start[1] - 60)
        pts = lerp(start, mid, 6) + lerp(mid, target, 14)[1:]
        # Zwischenbild mit Geist: Ziehen in zwei Teilen
        cdp = s.ctx.new_cdp_session(s.pg)
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': pts[0][0], 'y': pts[0][1]}]})
        for (x, y) in pts[1:]:
            time.sleep(0.04); cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': x, 'y': y}]})
        time.sleep(0.4); s.shot(f'geist_{dname}', 'play')
        ghost_ok = s.ev("__app.furnish.drag && __app.furnish.drag.ok")
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []}); time.sleep(0.6)
        check(ghost_ok, 'Geist grün beim Ziehen')
        n1 = s.ev("__game.sim().hotel.floors[0].rooms[0].furniture.length")
        check(n1 == n0 + 1, f'Ziehen stellt Möbel hin ({n0}→{n1})')
        check(s.ev("__app.slot.coins") < c0, 'Möbel kostet Münzen')
        s.shot(f'platziert_{dname}', 'play')
        # Drehen, Farbe (Bett ist färbbar) – erst Bett antippen
        bed = s.ev("(() => { const f = __game.sim().hotel.floors[0].rooms[0].furniture.find(x => x.item === 'bedSingle'); return __game.cellScreen('1A', f.gx + 0.5, f.gz + 1, 0.4); })()")
        s.tap_xy(bed['x'], bed['y']); time.sleep(0.3)
        check(s.ev("__app.furnish.sel !== null"), 'Möbel per Tipp ausgewählt')
        s.tap('#sCol'); time.sleep(0.2); s.tap('#palette button:nth-child(2)'); time.sleep(0.3)
        check(s.ev("__game.sim().hotel.floors[0].rooms[0].furniture.find(x => x.item === 'bedSingle').color") == '#9fd3f2', 'Umfärben')
        r0 = s.ev("__game.sim().hotel.floors[0].rooms[0].furniture.find(x => x.item === 'bedSingle').rot")
        s.tap('#sRot'); time.sleep(0.3)
        check(s.ev("__game.sim().hotel.floors[0].rooms[0].furniture.find(x => x.item === 'bedSingle').rot") != r0, 'Drehen')
        s.shot(f'auswahl_{dname}', 'play')
        s.tap('#fUndo'); s.tap('#fUndo'); time.sleep(0.3)
        check(s.ev("__game.sim().hotel.floors[0].rooms[0].furniture.find(x => x.item === 'bedSingle').color") is None, 'Rückgängig (2×)')
        # Tippen auf Katalog = automatisch hinstellen
        n2 = s.ev("__game.sim().hotel.floors[0].rooms[0].furniture.length")
        s.tap('#cList .item[data-id="flowerPot"]'); time.sleep(0.4)
        check(s.ev("__game.sim().hotel.floors[0].rooms[0].furniture.length") == n2 + 1, 'Antippen stellt automatisch hin')
        s.tap('#sDel'); time.sleep(0.3)
        check(s.ev("__game.sim().hotel.floors[0].rooms[0].furniture.length") == n2, 'Entfernen')
        s.tap('#fWall'); time.sleep(0.3)
        s.tap('#fDone'); time.sleep(1.0)
        check(s.ev("__app.mode") == 'hotel', 'Fertig → Hotel')
        check(s.small_buttons() == [], 'Hotel: Tippziele ≥ 48 px ' + str(s.small_buttons()[:3]))
        # Etage bauen über den Knopf in der Leiste
        f0 = s.ev("__game.sim().hotel.floors.length"); s.tap('#bFloor'); time.sleep(1.2)
        check(s.ev("__game.sim().hotel.floors.length") == f0 + 1, 'Anbau gebaut')
        s.ev("__game.closeModal()")
        # Ansicht drehen (Knopf + zwei Finger), Wände werden je Richtung abgesenkt
        y0 = s.ev("__app.camCtl.h.tyaw"); k0 = s.ev("__app.hotelView.viewKey")
        s.tap('#bRotR'); time.sleep(1.2)
        check(abs(s.ev("__app.camCtl.h.tyaw") - y0 - 0.785) < 0.01 and s.ev("__app.hotelView.viewKey") != k0, 'Drehen per Knopf (45°, Wände neu)')
        cdp = s.ctx.new_cdp_session(s.pg); cx, cy = (s.pg.viewport_size['width'] * (0.6 if dname == 'quer' else 0.42), s.pg.viewport_size['height'] * (0.45 if dname == 'quer' else 0.72))
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': cx - 80, 'y': cy, 'id': 1}, {'x': cx + 80, 'y': cy, 'id': 2}]})
        for i in range(1, 11):
            a = 0.09 * i; import math
            time.sleep(0.03); cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': cx - 80 * math.cos(a), 'y': cy - 80 * math.sin(a), 'id': 1}, {'x': cx + 80 * math.cos(a), 'y': cy + 80 * math.sin(a), 'id': 2}]})
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []}); time.sleep(1.0)
        yaw = s.ev("__app.camCtl.h.tyaw")
        check(abs(yaw / 0.7854 - round(yaw / 0.7854)) < 0.01 and abs(yaw - y0 - 0.785) > 0.1, f'Zwei-Finger-Drehen rastet auf 45° ein ({yaw:.2f})')
        s.shot(f'gedreht_{dname}', 'play')
        s.ev("__game.setCam({yaw: 0})"); time.sleep(0.5)
        # leeres Zimmer → Zimmer-Typ wählen
        bb = s.ev("""(() => { for (const e of document.querySelectorAll('#overlay .badge.build')) { if (!e.textContent.includes('Zimmer') || e.style.display === 'none') continue;
            const r = e.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2; const h = document.elementFromPoint(x, y); if (h && (h === e || e.contains(h))) return { x, y }; } return null; })()""")
        if not bb:
            s.ev("__game.setCam({dist: 30})"); time.sleep(1.0)
            bb = s.ev("""(() => { for (const e of document.querySelectorAll('#overlay .badge.build')) { if (!e.textContent.includes('Zimmer') || e.style.display === 'none') continue; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; } return null; })()""")
        s.tap_xy(bb['x'], bb['y']); time.sleep(0.4)
        check(s.ev("!document.getElementById('modal').classList.contains('hidden')"), 'Zimmer-Typ-Auswahl offen')
        s.shot(f'zimmertyp_{dname}', 'play')
        s.tap('#modal .opt[data-t="schlaf"]'); time.sleep(0.5)
        check(s.ev("__game.sim().hotel.floors.some(f => f.rooms.filter(r => r.type).length >= 2)"), 'Schlafzimmer gebaut')
        # Album / Welten öffnen
        s.tap('#bAlbum'); time.sleep(0.5); s.shot(f'album_{dname}', 'play'); s.ev("__game.closeModal()"); time.sleep(0.3)
        s.tap('#bWorlds'); time.sleep(0.5); s.shot(f'welten_{dname}', 'play'); s.ev("__game.closeModal()")
        # Gast antippen → Reaktion
        # Speichern + Neu laden
        s.ev("__app.save()")
        coins = s.ev("__app.slot.coins")
        s.pg.reload(); s.pg.wait_for_selector('#start .slot', timeout=15000); time.sleep(0.5)
        check('Alessia' in s.ev("document.getElementById('start').textContent"), 'Spielstand nach Neuladen da')
        s.tap('#start .slot[data-i="0"] .play'); s.pg.wait_for_function("window.__app.mode === 'hotel'", timeout=30000)
        check(s.ev("__app.slot.coins") == coins and s.ev("__app.slot.avatar") == 'cat', 'Münzen + Avatar gespeichert')
        errs = s.errors + s.ev('window.__errors')
        check(not errs, 'keine Fehler ' + str(errs[:3]))
        s.ctx.clear_cookies(); s.close()
    b.close()
print('FEHLER:', fails if fails else 'keine')
sys.exit(1 if fails else 0)
