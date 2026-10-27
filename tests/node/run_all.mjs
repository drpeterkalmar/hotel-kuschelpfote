// Alle Node-Tests (Logik ohne Browser): node tests/node/run_all.mjs
import fs from 'fs';
const files = fs.readdirSync(new URL('.', import.meta.url)).filter((f) => f.startsWith('test_') && f.endsWith('.mjs')).sort();
let fail = 0;
for (const f of files) {
  const m = await import('./' + f);
  for (const [name, fn] of Object.entries(m)) {
    if (!name.startsWith('test')) continue;
    const t0 = Date.now();
    try { await fn(); console.log('✓', f, name, (Date.now() - t0) + ' ms'); }
    catch (e) { fail++; console.log('✗', f, name, '\n   ', e.stack.split('\n').slice(0, 4).join('\n    ')); }
  }
}
console.log(fail ? `${fail} Fehler` : 'alles grün');
process.exit(fail ? 1 : 0);
