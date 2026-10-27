# Schreibt sw.js neu: Vorab-Cache aller Spieldateien + Inhalts-Hash als Version (Cache-Busting), dazu src/build.js.
# Nach jeder Änderung an Spieldateien: python3 tools/update_sw.py
import hashlib, os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
files = ['index.html', 'manifest.webmanifest', 'css/style.css']
for d in ['src', 'lib', 'icons', 'assets']:
    for dp, dn, fn in os.walk(os.path.join(ROOT, d)):
        for f in sorted(fn):
            rel = os.path.relpath(os.path.join(dp, f), ROOT)
            # Tiere: nur die Blumenwiese-Gäste vorab, der Rest kommt beim ersten Bedarf in den Cache
            if rel.startswith(os.path.join('assets', 'pets') + os.sep) and f[:-4] not in ('bunny', 'chick', 'cow', 'pig', 'bee', 'cat', 'panda', 'dog', 'penguin'): continue
            if f.endswith(('.js', '.png', '.css', '.webp', '.json', '.glb')) and not f.startswith('.'):
                files.append(rel)
files = sorted(set(files))
# modulepreload für alle statisch importierten Module ab src/main.js
def _modul(dep, von):
    if dep == 'three': return 'lib/three.module.min.js'
    if dep.startswith('three/addons/'): return 'lib/addons/' + dep[len('three/addons/'):]
    if dep.startswith('.'): return os.path.normpath(os.path.join(os.path.dirname(von), dep)).replace(os.sep, '/')
    return None
RX = re.compile(r'''(?:\bfrom\s*|^\s*import\s*)["']([^"']+\.js|three)["']''', re.M)
graph, todo = [], ['src/main.js']
while todo:
    f = todo.pop()
    if f in graph or not os.path.isfile(os.path.join(ROOT, f)): continue
    graph.append(f)
    src = re.sub(r'(?m)^\s*//.*$', '', open(os.path.join(ROOT, f), encoding='utf-8').read())
    for dep in RX.findall(src):
        m = _modul(dep, f)
        if m and m not in graph: todo.append(m)
graph = sorted(graph, key=lambda x: (not x.startswith('lib/three'), x))
ix = os.path.join(ROOT, 'index.html'); html = open(ix, encoding='utf-8').read()
a, b = '<!-- n42-modulepreload', '<!-- /n42-modulepreload -->'
if a in html and b in html:
    i = html.index(a); i = html.index('-->', i) + 3; j = html.index(b)
    html = html[:i] + '\n' + ''.join(f'<link rel="modulepreload" href="{g}">\n' for g in graph) + html[j:]
    open(ix, 'w', encoding='utf-8').write(html)
hashed = sorted(set(files + [os.path.relpath(os.path.join(dp, f), ROOT) for dp, dn, fn in os.walk(os.path.join(ROOT, 'assets', 'pets')) for f in fn]))
h = hashlib.sha256()
for f in hashed:
    if f == 'src/build.js': continue
    h.update(f.encode()); h.update(open(os.path.join(ROOT, f), 'rb').read())
ver = h.hexdigest()[:10]
tpl = open(os.path.join(ROOT, 'tools', 'sw.template.js')).read()
open(os.path.join(ROOT, 'sw.js'), 'w').write(tpl.replace('__VERSION__', ver).replace('__ASSETS__', ',\n  '.join("'" + f + "'" for f in files)))
open(os.path.join(ROOT, 'src', 'build.js'), 'w').write(f"export const BUILD = '{ver}';\n")
size = sum(os.path.getsize(os.path.join(ROOT, f)) for f in files)
print('sw.js Version', ver, len(files), 'Dateien', round(size / 1e6, 2), 'MB, modulepreload', len(graph))
