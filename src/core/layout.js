// Hotel-Geometrie (Meter). Puppenhaus von vorn offen (+z = zur Kamera), Etagen stapeln sich nach oben.
// Je Etage: Zimmer A (links) | Aufzug | Zimmer B (rechts). Erdgeschoss = Lobby über die ganze Breite.
import { CELL } from './catalog.js';

export const RW = 6, RD = 5;                 // Zimmer-Raster (Zellen)
export const FH = 3.2;                       // Etagenhöhe
export const LIFT = 1.6;                     // Aufzugbreite
export const ROOM_W = RW * CELL, ROOM_D = RD * CELL;
export const HALF_W = LIFT / 2 + ROOM_W;     // halbe Hotelbreite (5.6)
export const Z0 = -ROOM_D / 2;               // Rückwand
export const DOOR_GZ = 2;                    // Türzeile (Mitte)

export function roomX0(side) { return side === 0 ? -HALF_W : LIFT / 2; }
export function doorCell(side) { return side === 0 ? [RW - 1, DOOR_GZ] : [0, DOOR_GZ]; }
// Zellen, die frei bleiben müssen (Tür + Zelle davor), damit jeder Gast hineinkommt
export function reservedCells(side) { const [x, z] = doorCell(side); return [[x, z], [side === 0 ? x - 1 : x + 1, z]]; }
export function cellCenter(floor, side, gx, gz) {
  return { x: roomX0(side) + (gx + 0.5) * CELL, y: floor * FH, z: Z0 + (gz + 0.5) * CELL };
}
export function roomCenter(floor, side) { return { x: roomX0(side) + ROOM_W / 2, y: floor * FH, z: 0 }; }

// Feste Wegpunkte (Lobby, draußen, Aufzug). Ankunft links, Ausflugsort rechts.
export const LOBBY = {
  stop: { x: -10.2, y: 0, z: 3.6 }, outDoor: { x: -6.5, y: 0, z: 0.6 }, door: { x: -4.9, y: 0, z: 0.6 },
  mid: { x: -0.2, y: 0, z: 0.6 },
  queue: [{ x: 3.7, y: 0, z: 0.35 }, { x: 2.5, y: 0, z: 1.05 }, { x: 1.3, y: 0, z: 1.25 }, { x: 0.1, y: 0, z: 1.35 }, { x: -1.1, y: 0, z: 1.35 }, { x: -2.3, y: 0, z: 1.3 }],
  desk: { x: 4.3, z: -0.9 },
  frontL: { x: -6.8, y: 0, z: 4.4 }, frontR: { x: 6.8, y: 0, z: 4.4 },
};
export function liftPoint(floor) { return { x: 0, y: floor * FH, z: -1.15 }; }
export function landingPoint(floor) { return { x: 0, y: floor * FH, z: 0.35 }; }
export function doorPoint(floor, side) { return { x: side === 0 ? -LIFT / 2 : LIFT / 2, y: floor * FH, z: Z0 + (DOOR_GZ + 0.5) * CELL }; }
