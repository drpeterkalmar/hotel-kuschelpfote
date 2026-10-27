# Hotel Kuschelpfote – Bericht Teil 1 (n1), 27.10.2026

**Live:** https://drpeterkalmar.github.io/hotel-kuschelpfote/ (Version im Menü ☰ unten; geprüft: HTTP 200, Version live = lokal
`2612a164f1`, 0 Fehler, offline neu laden startet das Spiel, Manifest installierbar). Repo: drpeterkalmar/hotel-kuschelpfote.

## Was geht
- **Startbildschirm** mit 3 Spielständen (Name selbst eintippen, Tier-Avatar wählen); der Avatar steht im Spiel hinter der
  Rezeption. Speichern automatisch (localStorage, Versionsfeld + Migration; alter Prototyp-Stand lädt im Test).
- **Hotel in 3D-Draufsicht** (seit Nachtrag 1, siehe unten; vorher Puppenhaus-Querschnitt).
- **Gäste**: Anreise per Blumen-Zug bzw. Mond-Shuttle, fröhliches Warten in der Lobby (max. 4, nie Ärger), Wunsch-
  Sprechblasen nur mit Bildern, Zuweisen per Tipp (Gast → Zimmer mit ❤️-Vorschau) oder Blase aufs Zimmer ziehen,
  Wegfindung (Gebäude-Graph + Raster-A* um Möbel, Aufzug), Möbel benutzen (essen/tanzen/schlafen mit Zzz, baden),
  Einrichtungen anderer Zimmer besuchen, Ausflug, Abreise mit 1–5 Herzen + Münzen, Gast antippen = Tanz/Kopfschütteln + Ton.
- **Einrichten** (schräg von oben, Etagen darüber ausgeblendet): Katalog in 7 Bild-Reitern, Ziehen mit Geist (grüne/rote
  Fläche, Finger-Versatz, Einrasten zur nächsten freien Zelle), Antippen = automatisch hinstellen, Drehen, 8 Pastellfarben +
  Original, Weg (volles Geld zurück), Rückgängig, Tapete wechseln, Tür-Zellen bleiben frei (kein Gast sperrt sich aus),
  passende Möbel für aktuelle Wünsche grün markiert, Hüpf-/Quetsch-Animation beim Hinstellen.
- **Wirtschaft gemütlich**: kein Verlieren, keine Strafen; erste Gäste mit nur einem Wunsch; Sterne aus Herzen schalten Möbel,
  Etagen und den Mond (3 ⭐ in der Blumenwiese) frei. Alle Werte in `src/config.js`, URL-Schalter `?geld= ?tempo= ?alles=1 ?schwerkraft=`.
- **Ausflug-System generisch** (`src/game/trip.js` + `src/excursions/<modul>.js`, Welt-Datei nennt das Modul):
  - Blumenpicknick: Gäste picknicken, Schmetterlinge/Leckereien antippen → fliegen in den Korb.
  - **Mond-Ausflug**: Gast im Raumanzug (Glaskugelhelm, Rucksack, Ring), Tippen = Mondsprung, Rover mit zwei Gästen,
    Flagge, Rakete, Krater, Mondsteine + leuchtender Sternenstaub. Gemessen: **Flugzeit 5,0 s, Höhe 4,9 m** (hoch und quer).
  - Im Hotel gehen Gäste von selbst auf Ausflug (Mond: im Raumanzug in hohen Bögen um die Luftschleuse hüpfend).
- **Mondhotel**: 1/6 g (`?schwerkraft=`), Gäste hüpfen beim Laufen in Bögen (Höhe aus h = g·T²/8), landen mit Staubwölkchen,
  drinnen leicht schwebend. Gäste Panda, Katze, Hund, Pinguin; Mond-Möbel (Kapselbett, Sternen-Sofa, Kristall-Lampe,
  Teleskop, Spielrakete, Mondstein, Astronauten-Figur).
- **Blumenwiese**: Hase, Küken, Kuh, Schwein + Biene als Überraschungsgast; Anleitung in 6 kurzen Bild-Schritten mit Zeige-Hand,
  überspringbar, geht bei der passenden Handlung von selbst weiter.
- **Sammelalbum**: 24 Tiere (Silhouetten, entdeckte farbig – selbst gerenderte Bilder aus den Modellen), 6 Welten-Kacheln
  (4 als „bald" mit Farbvorschau).
- **Ton**: alle Klänge + leise Spieluhr-/Glas-Musik im Browser erzeugt (Mittelton, nur in der Hotel-Ansicht, nie im Menü),
  `audioSession = 'ambient'`, Ton-Schalter im Menü. Vibration 30 ms nur bei neuem Stern / Welt frei, ≥ 4 s Abstand.

## Gates
| Gate | Ergebnis |
|---|---|
| **1 Autopilot 10 Spielminuten** | **bestanden.** Node (5 Seeds): 15–21 glückliche Gäste, je 3 Etagen gebaut, 0 Hänger. Browser über die echte Spielschleife (`tests/gate1_browser.py`, ?tempo=8): 16 glücklich abgereist, 3 Etagen, 3 Sterne, max. 0 hängende Gäste, 0 Fehler. Mond spielt ebenso (20 glücklich). Erste 5 Minuten (Test): ≥ 3 glückliche Gäste + 1 Etage. |
| **2 Optik (eigene Vision-Prüfung)** | Lobby ~7,5/10, Einrichten ~8/10, Mond-Ausflug quer ~8/10, hoch ~7,5/10. Drei Nachbesserungsrunden gemacht (warme Deckenlampen mit Lichtschein; Grauschleier = zu dichter Nebel; diagonale Schattenstreifen = Möbel-Schatten fielen durch die Decken → weiche Kontaktschatten unter Möbeln und Tieren; Farben satter; Sternenstaub als leuchtende Sterne; Mond-Kamera). **Ehrlich: das Ziel 8/10 ist noch nicht überall erreicht** – v. a. die Lobby (wirkt etwas leer/flach) und der Mondboden im Hochformat. Bilder: `tests/shots/gate2/`. |
| **3 Mess-Gate Mittelklasse-Android** | CPU ×4, DPR 2,6, 412×915 hoch + quer (Mac-GPU, Bildtakt ungedeckelt): Hotel Blumenwiese p50 3,5 / p95 4,8 ms (quer 5,2 / 7,1), Hotel Mond 3,3 / 4,6 (quer 3,8 / 6,1), Einrichten 3,4 / 4,7, Mondsprung 3,6 / 5,4. **Draw-Calls 47–96** (inkl. Nachbearbeitung), 35–80 Tsd. Dreiecke. **Erstladung 0,53 MB gzip** (1,6 MB roh, 0 externe Anfragen), alle Assets 2,7 MB. Messwerte: `tests/perf/2026-10-27_n1.json`. Achtung: GPU ist die des Macs – echte Handy-GPU-Zeit ist nicht gemessen (Render-Auflösung ist auf DPR 1,75 gedeckelt). |

Weitere Belege: `tests/test_play.py` (echte Touch-Gesten, hoch + quer, alle Tippziele ≥ 48 px, Speichern/Neuladen) grün;
`node tests/node/run_all.mjs` grün (Wegfindung, Wünsche/Herzen, Preise, Sterne, Rückerstattung, Warteschlange, Spielstand +
Migration, Gate 1); Rauchtest hoch/quer/Desktop 0 Fehler; Ton entsperrt erst durch echten Fingertipp (ohne Autoplay-Flag geprüft).

## Offene Punkte
- Optik-Gate 8/10 in Lobby und Mond-Hochformat noch nicht sicher erreicht (siehe oben); Ideen: wärmeres Innenlicht
  (Lampen-Lichtkegel), mehr Lobby-Leben (Gäste auf dem Sofa, Gepäck), Mondboden mit Spuren/Kratertextur.
- Tiere blinzeln nur über ein kurzes Stauchen (die Augen sind Teil der Textur, kein eigenes Teil).
- Nicht am echten Handy gemessen (nur Emulation). iPhone: keine Vibration (keine API).
- Zimmer-Typen sind nach dem Bau nicht mehr änderbar (nur umräumen); Lobby-Deko fest.
- Gäste werden nicht gespeichert (nach dem Neuladen kommen neue).
- Teil 1 bewusst ohne: Ski/Beach/Unterwasser/Schiff, Accessoires, Fotomodus, Tag/Nacht.

## Bitte am Handy testen (Peter + Kinder)
1. Startbildschirm: Namen eintippen, Tier wählen – passt die Tastatur, ist alles groß genug?
2. Erster Gast: Blase antippen → Zimmer mit ❤️ antippen. Verstehen die Kinder die Anleitung ohne Hilfe?
3. Einrichten: Möbel aus der Leiste ins Zimmer **ziehen** (hoch und quer!), drehen, umfärben, Rückgängig. Frust?
4. Etage bauen, Restaurant/Spa/Spielzimmer bauen, Ausflug bauen und „Mitmachen".
5. Mond (schnell mit `?alles=1&welt=mond`): Hüpfen der Gäste, Mond-Ausflug – ist der Sprung üppig genug? Sonst
   `?schwerkraft=0.1` (noch höher/länger) zum Vergleichen.
6. Ton am Handy-Lautsprecher (leise genug? Lautlos-Schalter am iPhone stumm?), ruckelt etwas?

## Vorschlag für n2
- Je Welt eine Datei + Kulisse + Mitmach-Spiel: **Ski-Resort** (Rodeln: Tippen = Sprung über Schneehügel),
  **Beach-Resort** (Surfen auf Wellen), **Unterwasserhotel** (U-Boot-Tauchgang, Fische sammeln, Blasen-Physik),
  **Kreuzfahrtschiff** (Hotel als Schiffsquerschnitt mit Decks, Landgang). Gäste aus den restlichen 16 Tieren.
- Optik-Runde zuerst (Gate 2 sicher ≥ 8): Innenlicht/Lampen-Lichtkegel, Lobby-Leben, Mondboden.
- Danach n3: Accessoires (Hütchen/Schleifen), Fotomodus, Tag/Nacht, Stammgäste.

## Nachtrag 1 (Peter, 27.10.): 3D-Draufsicht statt Puppenhaus – umgesetzt
- **Ansicht:** Kamera schräg von oben (≈ 55°, weit raus flacher, nah steiler), perspektivisch. Man sieht Lobby, Gang, Zimmer,
  Garten, Zug/Shuttle und alle Gäste gleichzeitig. Ein Finger verschiebt, Pinch zoomt (weit = ganze Anlage, nah = ein Zimmer),
  zwei Finger drehen (rastet weich auf 45° ein) und kippen; Knöpfe ⟲ ⟳; Desktop Maus/Rad/Q-E/R-F.
- **Grundriss:** Lobby vorn, Mittelgang nach hinten, je Anbau ein Flügel mit zwei Zimmern; das Hotel wächst in die Fläche,
  ab dem 5. Anbau 1. Stock (Aufzug am Gang-Anfang, Etagen-Knöpfe ▲ EG/1. OG ▼, obere Etage ausblendbar). Nächster
  Bauplatz gestrichelt auf dem Rasen.
- **Sims-Cutaway:** Wände, die zwischen Kamera und einem Raum stehen, werden abgesenkt (je 45°-Richtung neu gebaut), nur
  Außenwände auf der abgewandten Seite bleiben hoch (mit Fenstern). Keine Decken.
- **Einrichten in derselben Ansicht:** Zimmer antippen → Kamera fliegt aufs Zimmer (Blickrichtung bleibt), Raster erscheint.
- **Gäste** laufen sichtbar vom Zug/Shuttle durch den Eingang zur Rezeption und über den Gang ins Zimmer (Wegfindung neu:
  Gang-Graph + Raster im Zimmer). **Mond:** Glaskuppeln über den Räumen, beim Heranzoomen ausgeblendet.
- **Belege nach dem Umbau:** Node-Tests grün (Gate 1: 18–20 glückliche Gäste, 3 Anbauten, 0 Hänger); Gate 1 im Browser
  bestanden (20 glücklich, 0 Hänger, 0 Fehler); Touch-Bedientest hoch + quer grün inkl. Drehen per Knopf und zwei Fingern;
  Mess-Gate: p95 4,6–6,0 ms, 48–104 Draw-Calls, Erstladung 0,48 MB gzip (`tests/perf/2026-10-27_n1_draufsicht.json`).
- **Vision (eigene Wertung) „Sieht man in der Draufsicht klar in die Zimmer und die Gäste?“: ja.** Blumenwiese-Übersicht und
  Einrichten ~8/10, Mondhotel ~7,5/10 (Kuppeln geben einen leichten Schleier), Mond-Ausflug unverändert ~7,5–8/10.
- Offen: Garten/Pool als eigene Bauteile (n2), Wände senken sich nur in 45°-Stufen (während des Drehens springt die Wandhöhe
  beim Überschreiten der Stufe), Erde am Mondhimmel sieht man nur weit herausgezoomt bzw. stark gekippt.
