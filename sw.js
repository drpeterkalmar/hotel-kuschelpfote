// Service-Worker: offline spielbar, Cache-Busting über Inhalts-Hash (tools/update_sw.py)
const VERSION = '466c6c7e14';
const CACHE = 'kuschelpfote-' + VERSION;
const ASSETS = [
  './',
  'assets/models/moebel.glb',
  'assets/models/moebel.json',
  'assets/models/mond.glb',
  'assets/models/mond.json',
  'assets/models/wiese.glb',
  'assets/models/wiese.json',
  'assets/pets/bee.glb',
  'assets/pets/bunny.glb',
  'assets/pets/cat.glb',
  'assets/pets/chick.glb',
  'assets/pets/cow.glb',
  'assets/pets/dog.glb',
  'assets/pets/panda.glb',
  'assets/pets/penguin.glb',
  'assets/pets/pig.glb',
  'assets/thumbs/beaver.png',
  'assets/thumbs/bee.png',
  'assets/thumbs/bunny.png',
  'assets/thumbs/cat.png',
  'assets/thumbs/caterpillar.png',
  'assets/thumbs/chick.png',
  'assets/thumbs/cow.png',
  'assets/thumbs/crab.png',
  'assets/thumbs/deer.png',
  'assets/thumbs/dog.png',
  'assets/thumbs/elephant.png',
  'assets/thumbs/fish.png',
  'assets/thumbs/fox.png',
  'assets/thumbs/giraffe.png',
  'assets/thumbs/hog.png',
  'assets/thumbs/koala.png',
  'assets/thumbs/lion.png',
  'assets/thumbs/monkey.png',
  'assets/thumbs/panda.png',
  'assets/thumbs/parrot.png',
  'assets/thumbs/penguin.png',
  'assets/thumbs/pig.png',
  'assets/thumbs/polar.png',
  'assets/thumbs/tiger.png',
  'css/style.css',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'index.html',
  'lib/addons/libs/meshopt_decoder.module.js',
  'lib/addons/loaders/GLTFLoader.js',
  'lib/addons/utils/BufferGeometryUtils.js',
  'lib/addons/utils/SkeletonUtils.js',
  'lib/three.core.min.js',
  'lib/three.module.min.js',
  'manifest.webmanifest',
  'src/audio/sound.js',
  'src/build.js',
  'src/config.js',
  'src/core/autoplay.js',
  'src/core/catalog.js',
  'src/core/hotel.js',
  'src/core/layout.js',
  'src/core/path.js',
  'src/core/save.js',
  'src/core/sim.js',
  'src/core/sizes.js',
  'src/excursions/mondsprung.js',
  'src/excursions/picknick.js',
  'src/game/camera.js',
  'src/game/furnish.js',
  'src/game/input.js',
  'src/game/trip.js',
  'src/game/tutorial.js',
  'src/gfx/assets.js',
  'src/gfx/atlas.js',
  'src/gfx/batch.js',
  'src/gfx/blobs.js',
  'src/gfx/env_common.js',
  'src/gfx/env_mond.js',
  'src/gfx/env_wiese.js',
  'src/gfx/fx.js',
  'src/gfx/geo.js',
  'src/gfx/hotel.js',
  'src/gfx/pets.js',
  'src/gfx/renderer.js',
  'src/main.js',
  'src/ui/overlay.js',
  'src/ui/screens.js',
  'src/worlds/blumenwiese.js',
  'src/worlds/index.js',
  'src/worlds/mond.js'
];
self.addEventListener('install', (e) => {
  // n42: 'no-cache' statt 'reload' – fragt mit ETag nach (304 ohne Inhalt, wenn die Datei schon im HTTP-Cache liegt, z. B.
  // gerade vom ersten Spielstart geladen); vorher lud der Vorab-Cache alles ein zweites Mal
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'no-cache' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('kuschelpfote-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(caches.match('index.html', { cacheName: CACHE }).then((r) => r || fetch(req)));
    return;
  }
  e.respondWith(caches.match(req, { cacheName: CACHE, ignoreSearch: true }).then((r) => r || fetch(req).then((res) => {
    if (res.ok) { const cp = res.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); }
    return res;
  })));
});
