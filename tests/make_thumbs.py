# Rendert assets/thumbs/<tier>.png (192 px, transparent) und icons/*.png (Hase auf Rosa) aus den echten Modellen.
import sys, os, base64
sys.path.insert(0, os.path.dirname(__file__))
from util import *
PETS = ['bunny', 'chick', 'cow', 'pig', 'bee', 'panda', 'cat', 'dog', 'penguin', 'beaver', 'caterpillar', 'crab', 'deer', 'elephant', 'fish', 'fox', 'giraffe', 'hog', 'koala', 'lion', 'monkey', 'parrot', 'polar', 'tiger']
with Server() as srv, sync_playwright() as pw:
    b = pw.chromium.launch(args=GPU_ARGS); pg = b.new_page()
    pg.goto(srv.base + 'tools/thumbs.html'); pg.wait_for_function('window.ready')
    def save(path, url):
        open(os.path.join(ROOT, path), 'wb').write(base64.b64decode(url.split(',')[1]))
    for p in PETS: save(f'assets/thumbs/{p}.png', pg.evaluate(f"render('{p}', 192, null)"))
    for n, sz in [('icon-192', 192), ('icon-512', 512), ('apple-touch-icon', 180), ('icon-maskable-512', 512)]:
        save(f'icons/{n}.png', pg.evaluate(f"render('bunny', {sz}, '#ffd9df')"))
    b.close()
print('ok')
