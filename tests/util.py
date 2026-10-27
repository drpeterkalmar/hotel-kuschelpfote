# Test-Helfer: eingebauter HTTP-Server (Thread), Playwright mit Pixel-7-Emulation (hoch/quer), WebGL über die GPU (ANGLE/Metal),
# stumm (--mute-audio), Fehler-Sammlung, Screenshots nach tests/shots/.
import os, sys, time, threading, socket, functools
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UA = "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36"
HOCH = dict(viewport={"width": 412, "height": 915}, device_scale_factor=2.625, is_mobile=True, has_touch=True, user_agent=UA)
QUER = dict(viewport={"width": 915, "height": 412}, device_scale_factor=2.625, is_mobile=True, has_touch=True, user_agent=UA)
DESKTOP = dict(viewport={"width": 1280, "height": 760}, device_scale_factor=1)
GPU_ARGS = ["--use-angle=metal", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl", "--mute-audio"]

class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store'); super().end_headers()
class BigQueueServer(ThreadingHTTPServer):
    request_queue_size = 128; daemon_threads = True
class Server:
    def __init__(self, root=ROOT): self.root = root
    def __enter__(self):
        s = socket.socket(); s.bind(('127.0.0.1', 0)); port = s.getsockname()[1]; s.close()
        self.httpd = BigQueueServer(('127.0.0.1', port), functools.partial(Quiet, directory=self.root))
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()
        self.base = f'http://127.0.0.1:{port}/'
        return self
    def __exit__(self, *a): self.httpd.shutdown(); self.httpd.server_close()

class Session:
    def __init__(self, pw, base, device=HOCH, browser=None, storage=None):
        self.base = base; self.own = browser is None
        self.b = browser or pw.chromium.launch(args=GPU_ARGS)
        opts = dict(device)
        self.ctx = self.b.new_context(**opts)
        self.pg = self.ctx.new_page()
        self.errors = []
        self.pg.on("pageerror", lambda e: self.errors.append("PAGEERROR " + str(e)))
        self.pg.on("console", lambda m: self.errors.append("CONSOLE " + m.text) if m.type == "error" else None)
        self.pg.on("requestfailed", lambda r: self.errors.append("REQFAIL " + r.url + " " + str(r.failure)) if 'ERR_ABORTED' not in str(r.failure) else None)
    def open(self, q='?nosw', wait_world=True, timeout=90):
        self.pg.goto(self.base + 'index.html' + q)
        t0 = time.time()
        cond = "window.__app && window.__app.ready && window.__app.frames > 3" + (" && window.__app.mode === 'hotel'" if wait_world else "")
        while True:
            try: self.pg.wait_for_function(cond, timeout=15000); break
            except Exception:
                errs = self.ev("window.__errors || []")
                if errs or any(e.startswith('PAGEERROR') for e in self.errors): print('BOOT FEHLER', self.errors[:5], errs[:5]); raise
                if time.time() - t0 > timeout: print('BOOT TIMEOUT', self.errors[:5]); raise
        self.boot_s = time.time() - t0
    def ev(self, js, arg=None): return self.pg.evaluate(js, arg) if arg is not None else self.pg.evaluate(js)
    def shot(self, name, sub=''):
        d = os.path.join(ROOT, 'tests', 'shots', sub); os.makedirs(d, exist_ok=True)
        p = os.path.join(d, f'{name}.png'); self.pg.screenshot(path=p); return p
    def frames(self, n=3, timeout=30000):
        f0 = self.ev("window.__app.frames"); self.pg.wait_for_function(f"window.__app.frames >= {f0 + n}", timeout=timeout)
    def tap_xy(self, x, y):
        try: self.pg.touchscreen.tap(x, y)
        except Exception: self.pg.mouse.click(x, y)
        time.sleep(0.15)
    def tap(self, sel):
        el = self.pg.locator(sel).first; el.wait_for(state='visible', timeout=10000)
        try: el.scroll_into_view_if_needed(timeout=3000)
        except Exception: pass
        box = el.bounding_box(); self.tap_xy(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)
    def state(self): return self.ev("__game.state()")
    def small_buttons(self):
        return self.ev("""() => { const out=[]; const W=innerWidth,H=innerHeight;
          for (const b of document.querySelectorAll('button, .bub, .badge, .item')) { const r=b.getBoundingClientRect(); const st=getComputedStyle(b);
            if (!r.width || st.display==='none' || st.visibility==='hidden' || b.offsetParent===null && st.position!=='fixed') continue;
            if (b.closest('.hidden')) continue;
            const scroller = b.closest('#cList, #cTabs, #modal .card, #start');
            if (r.width < 47.5 || r.height < 47.5 || (!scroller && (r.left < -1 || r.top < -1 || r.right > W+1 || r.bottom > H+1))) out.push({t:(b.textContent||'').trim().slice(0,24), w:Math.round(r.width), h:Math.round(r.height), x:Math.round(r.left), y:Math.round(r.top)}); }
          return out; }""")
    def close(self):
        self.ctx.close()
        if self.own: self.b.close()
