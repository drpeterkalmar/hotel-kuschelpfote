// Hotel-Grundriss (Meter) für die 3D-Draufsicht. Vorn (+z) die Lobby über die ganze Breite, dahinter ein Mittelgang,
// links/rechts davon je ein Zimmer pro „Flügel" (Bauabschnitt). Das Hotel wächst nach hinten in die Fläche:
// Flügel 1–4 im Erdgeschoss, Flügel 5–8 als 1. Stock über 1–4 (Aufzug am Gang-Anfang).
import { CELL } from './catalog.js';

export const RW = 6, RD = 5;                 // Zimmer-Raster (Zellen)
export const FH = 3.0;                       // Stockwerkshöhe
export const LIFT = 1.6;                     // Gangbreite (Name aus der Puppenhaus-Zeit, Aufzug steht im Gang)
export const CORR = LIFT;
export const ROOM_W = RW * CELL, ROOM_D = RD * CELL;
export const HALF_W = CORR / 2 + ROOM_W;     // halbe Hotelbreite (5.6)
export const LOBBY_Z0 = -2, LOBBY_Z1 = 2;    // Lobby von hinten nach vorn
export const ROWS_PER_LEVEL = 4;
export const Z0 = LOBBY_Z0;                  // (Kompatibilität) Rückwand der Lobby
export const DOOR_GZ = 2;                    // Türzeile (Mitte)

export function wingLevel(w) { return Math.floor((w - 1) / ROWS_PER_LEVEL); }
export function wingRow(w) { return (w - 1) % ROWS_PER_LEVEL + 1; }
export function wingY(w) { return wingLevel(w) * FH; }
export function roomZ0(w) { return LOBBY_Z0 - wingRow(w) * ROOM_D; }        // hintere Kante des Zimmers
export function wingZc(w) { return roomZ0(w) + ROOM_D / 2; }
export function roomX0(side) { return side === 0 ? -HALF_W : CORR / 2; }
export function doorCell(side) { return side === 0 ? [RW - 1, DOOR_GZ] : [0, DOOR_GZ]; }
// Zellen, die frei bleiben müssen (Tür + Zelle davor), damit jeder Gast hineinkommt
export function reservedCells(side) { const [x, z] = doorCell(side); return [[x, z], [side === 0 ? x - 1 : x + 1, z]]; }
export function cellCenter(w, side, gx, gz) {
  return { x: roomX0(side) + (gx + 0.5) * CELL, y: wingY(w), z: roomZ0(w) + (gz + 0.5) * CELL };
}
export function roomCenter(w, side) { return { x: roomX0(side) + ROOM_W / 2, y: wingY(w), z: wingZc(w) }; }
export function backZ(nWings) { return LOBBY_Z0 - Math.min(nWings, ROWS_PER_LEVEL) * ROOM_D; }

// Feste Wegpunkte (draußen, Lobby). Ankunft links (Eingang in der linken Lobbywand), Ausflugsort rechts vorn.
export const LOBBY = {
  stop: { x: -10.2, y: 0, z: 3.6 }, outDoor: { x: -6.5, y: 0, z: 0.6 }, door: { x: -4.9, y: 0, z: 0.6 },
  mid: { x: -0.2, y: 0, z: 0.6 },
  queue: [{ x: 3.7, y: 0, z: 0.45 }, { x: 2.5, y: 0, z: 1.05 }, { x: 1.3, y: 0, z: 1.25 }, { x: 0.1, y: 0, z: 1.35 }, { x: -1.1, y: 0, z: 1.35 }, { x: -2.3, y: 0, z: 1.3 }],
  desk: { x: 4.3, z: -0.9 },
  host: { x: 4.3, z: -1.62 },     // Gastgeber hinter der Theke: Schnauze vor der Theken-Rückkante, Rücken vor der Wand (−2)
  hall: { x: 0, y: 0, z: -1.4 },
  frontL: { x: -6.8, y: 0, z: 4.4 }, frontR: { x: 6.8, y: 0, z: 4.4 },
};
// Rezeptionstheke (Vorderkante z, Tiefe). Peter 29.10.: vorher −0,55/0,75 → Gastgeber steckte in der Theke
export const DESK_FRONT = -0.35, DESK_DEPTH = 0.45;
// Aufzug am Gang-Anfang (Ebene L), Gangpunkt vor den Türen eines Flügels, Türen in den Gangwänden
export function liftPoint(level) { return { x: 0, y: level * FH, z: LOBBY_Z0 - 0.7 }; }
export function corrPoint(w) { return { x: 0, y: wingY(w), z: wingZc(w) }; }
export const landingPoint = corrPoint;
export function doorPoint(w, side) { return { x: side === 0 ? -CORR / 2 : CORR / 2, y: wingY(w), z: roomZ0(w) + (DOOR_GZ + 0.5) * CELL }; }
