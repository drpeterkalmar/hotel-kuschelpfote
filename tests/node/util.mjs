export function ok(c, msg) { if (!c) throw new Error('Erwartung verfehlt: ' + msg); }
export function eq(a, b, msg) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`); }
