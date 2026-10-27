import fs from 'fs';
import { newSlot, migrate, SAVE_VERSION } from '../../src/core/save.js';
import { WORLD_LIST } from '../../src/worlds/index.js';
import { ok, eq } from './util.mjs';

export function testRoundTrip() {
  const s = newSlot('Emilia', 'cat', WORLD_LIST); s.coins = 77; s.album.bunny = 1;
  const back = migrate(JSON.parse(JSON.stringify(s)), WORLD_LIST);
  eq(back.coins, 77, 'Münzen'); eq(back.name, 'Emilia', 'Name'); eq(back.v, SAVE_VERSION, 'Version');
  eq(Object.keys(back.worlds).sort(), ['blumenwiese', 'mond'], 'Welten');
}
export function testOldSaveLoads() {
  const old = JSON.parse(fs.readFileSync(new URL('./fixtures/save_v0.json', import.meta.url)));
  const s = migrate(old, WORLD_LIST);
  eq(s.v, SAVE_VERSION, 'auf aktuelle Version gehoben'); eq(s.coins, 321, 'alte Münzen (geld) übernommen'); eq(s.name, 'Alessia', 'Name');
  ok(s.album.bunny && s.album.pig, 'Album übernommen');
  eq(s.worlds.blumenwiese.floors.length, 2, 'altes Hotel übernommen');
  ok(s.worlds.blumenwiese.floors[0].rooms[0].furniture.every((f) => f.uid > 0), 'Möbel bekommen IDs');
  ok(s.worlds.mond, 'neue Welt ergänzt');
  const again = migrate(JSON.parse(JSON.stringify(s)), WORLD_LIST); eq(again, s, 'Migration idempotent');
}
export function testGarbageIsNull() { eq(migrate(null, WORLD_LIST), null, 'kaputt → null'); }
