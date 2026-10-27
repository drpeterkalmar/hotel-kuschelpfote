# 🐾 Hotel Kuschelpfote

Ein niedliches Hotel-Aufbauspiel mit Tier-Gästen – gebaut für Alessia, Emilia und Livia.
Handy zuerst (hoch und quer), läuft auch am Computer. Spielen: **https://drpeterkalmar.github.io/hotel-kuschelpfote/**
(„Zum Startbildschirm hinzufügen" → läuft wie eine App, auch offline).

## Spielidee
- Das Hotel ist ein **aufgeschnittenes Puppenhaus**: Etagen stapeln sich, jede Etage hat zwei Zimmer und einen Aufzug.
- **Gäste** reisen an (Blumen-Zug bzw. Mond-Shuttle), warten fröhlich in der Lobby und zeigen ihre **Wünsche als Bilder**
  (🛏️ weiches Bett, 🌸 Blumen, 🍰 Kuchen, 🛁 Baden …). Gast antippen → Zimmer mit ❤️ antippen → der Gast läuft hin (Aufzug!),
  benutzt die Möbel (essen, tanzen, schlafen), reist ab und gibt **1–5 Herzen + Münzen**.
- **Einrichten**: Zimmer antippen → Möbel aus der Leiste ins Zimmer ziehen (grün = passt), antippen = drehen, umfärben,
  wegnehmen, Rückgängig. Tapete wechseln. Wegnehmen gibt das Geld zurück.
- **Bauen**: neue Etagen (🏗️), Zimmer-Typen (Schlafzimmer, Restaurant, Bad & Spa, Spielzimmer), Ausflugsort.
- **Sterne**: Herzen bringen Hotel-Sterne → neue Möbel, mehr Etagen und neue Welten.
- **Ausflüge mit Mitmach-Spiel** (45 s, man kann nicht verlieren): Blumenpicknick (Schmetterlinge und Leckereien antippen)
  und Mond-Ausflug im Raumanzug (Tippen = riesiger Mondsprung, ~5 s in der Luft, Mondsteine und Sternenstaub sammeln).
- **Welten**: Blumenwiese (Start mit kurzer Bild-Anleitung) und **Mondhotel** (1/6 Schwerkraft: Gäste hüpfen in langsamen,
  hohen Bögen). Ski-Resort, Beach-Resort, Unterwasserhotel und Kreuzfahrtschiff kommen in Teil 2.
- **Sammelalbum** mit allen 24 Tieren, **3 Spielstände** (jede Tochter ihren eigenen, mit Tier-Bild), Speichern automatisch.
- Kein Verlieren, keine Strafen, kein Zeitdruck.

## URL-Schalter (zum Ausprobieren)
| Schalter | Wirkung |
|---|---|
| `?alles=1` | alles frei (Welten, Möbel, Etagen), Münzen unbegrenzt |
| `?geld=500` | Startmünzen eines **neuen** Spielstands |
| `?tempo=3` | Spielzeit 3× schneller |
| `?schwerkraft=0.1667` | Mond-Schwerkraft als Anteil von g (Standard 1/6; `1` = Erde) |
| `?welt=mond` | direkt in eine Welt (wenn freigeschaltet oder mit `alles=1`) |
| `?tutorial=0` | Anleitung aus |
| `?ton=0` | Ton aus |
| `?slot=0&name=Test` | Spielstand direkt öffnen (für Tests) |
| `?nosw` | ohne Service-Worker (Entwicklung) |

Beispiel: `…/hotel-kuschelpfote/?alles=1&welt=mond`

## Technik
three.js r186 ohne Build (ES-Module, Import-Map), eigene Puppenhaus-Geometrie mit gebackener Umgebungsverdeckung,
instanzierte Möbel/Tiere (wenige Draw-Calls), weiche Kontaktschatten, Bloom + Pastell-Grading, PWA mit Service-Worker
(Version = Inhalts-Hash, im Menü sichtbar). Ton wird im Browser erzeugt (iPhone: `audioSession = 'ambient'`, Lautlos-Schalter wird respektiert).

```
src/core/      Spiel-Logik ohne Grafik (Hotel, Wegfindung, Gäste, Wünsche, Wirtschaft, Speichern, Autopilot) – Node-getestet
src/worlds/    eine Datei je Welt (nur Daten) + index.js
src/excursions/ ein Mitmach-Spiel je Ausflug
src/gfx/       Renderer/Nachbearbeitung, Puppenhaus, Kulissen (env_<welt>.js), Tiere, Partikel
src/game/      Kamera, Eingabe, Einrichten, Ausflug-System, Anleitung
src/ui/        Sprechblasen/Marken, Fenster und Bildschirme
tools/         Asset-Pipeline (build_assets.mjs), Service-Worker (update_sw.py), Tier-Bilder (thumbs.html)
tests/         Node-Tests, Browser-Tests (Playwright), Mess-Gate
```

### Neue Welt hinzufügen in 5 Schritten
1. `src/worlds/<welt>.js` anlegen (Vorlage `mond.js`): Name, Gäste + Wunsch-Listen, Fahrzeug, Physik (`schwerkraft`),
   Look (Himmel, Licht, Farben, Dachform), Lobby-Deko, Ausflug (`modul`, Preis, Ort), Musik (Tonleiter, Tempo, Klang),
   Freischaltung (`frei: { welt, sterne }`).
2. In `src/worlds/index.js` eintragen (und aus `SOON` entfernen).
3. Kulisse `src/gfx/env_<umgebung>.js` mit `build(ctx)` → `{ group, lights, setAusflug(on), update(dt, t, vehicle) }`
   (Vorlagen `env_wiese.js`, `env_mond.js`); in `src/main.js` beim dynamischen Import ergänzen.
4. Mitmach-Spiel `src/excursions/<modul>.js` mit `create(ctx)` → `{ scene, cam, update, down, up, debug }`
   (Vorlagen `picknick.js`, `mondsprung.js`).
5. Welt-Möbel/Modelle in `tools/asset_list.mjs` ergänzen (Katalog-Einträge mit `welt: '<id>'` in `src/core/catalog.js`),
   `node tools/build_assets.mjs`, dann `python3 tools/update_sw.py` und die Tests.

## Tests
```
npm install                      # nur für die Asset-Pipeline
node tests/node/run_all.mjs      # Logik inkl. Gate 1 (Autopilot 10 Spielminuten, 5 Seeds), Speichern/Migration, Wegfindung
python3 tests/test_play.py       # Bedienung mit echten Touch-Gesten, hoch + quer, Tippziele ≥ 48 px
python3 tests/gate1_browser.py   # Gate 1 über die echte Spielschleife
python3 tests/trip_shots.py      # Ausflüge + Burst-Fotos vom Mondsprung (Flugzeit/Höhe)
python3 tests/vision_shots.py    # Bilder für die Optik-Prüfung
python3 tests/perf_gate.py --szenen tests/perf_szenen.json --stand X   # Mess-Gate Mittelklasse-Android
python3 tests/test_pwa.py [URL]  # Service-Worker, Version, offline
```

## Credits & Lizenzen
- 3D-Modelle: **Kenney** (www.kenney.nl) – Cube Pets, Furniture Kit, Space Kit, Nature Kit, Food Kit – alle **CC0**.
  Details: [assets/LICENSES.md](assets/LICENSES.md). Danke, Kenney!
- three.js: MIT-Lizenz.
- Gebäude, Rezeption, Aufzug, Raumanzug, Blumen-Zug, Töne und Musik: selbst gebaut bzw. im Spiel erzeugt.
