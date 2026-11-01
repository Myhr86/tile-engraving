# Flisgravering – bildeforberedelse

En nettside som gjør et kundebilde klart for laser­gravering på hvite flis (20×20 cm) som er lakkert sorte.
Målet er at nye motiver skal få samme kontrast, lysstyrke og tonefordeling som de graveringene som ble best.

Alt kjører lokalt i nettleseren, så bildene sendes ikke til noen server.

## Bruk
1. Åpne `index.html` i nettleseren. Du kan også legge den ut med GitHub Pages: Settings → Pages → Branch.
2. Last opp bildet. Du kan dra det inn, velge fil eller lime inn med Ctrl+V.
3. Velg stil: **Hund** eller **Hytte**.
4. Juster utsnittet: dra i bildet og zoom med musehjulet.
5. Velg bakgrunn: *Mørk vignett*, eller *Fjern bakgrunn (AI)*, som krever internett.
6. Finjuster med glidebryterne om nødvendig.
7. Last ned PNG. Filen får riktig DPI for 20 cm. Huk av for *Inverter* hvis laserprogrammet brenner der bildet er sort, slik LightBurn gjør som standard.

## Slik fungerer det
1. **Gråtoner og beskjæring** til et kvadrat.
2. **Lokal kontrast (CLAHE)** henter fram struktur i pels, treverk og vann, og gir det «graverte» uttrykket.
3. **Histogram-matching**: Motivets toner tvinges mot en tonekurve som er målt fra de vellykkede graveringene. Målingen gjelder bare motivet, ikke den sorte bakgrunnen.
4. **Skarphet** (uskarp maske), deretter **nivåer** (sortpunkt og hvitpunkt, gamma, kontrast).
5. **Vignett eller maske**: Bakgrunnen går mykt over i sort, slik at lakken blir stående der.

## Egne stiler
* **«+ Ny stil fra vellykket gravering»**: Last opp et bilde som ble bra. Appen måler tonekurven i det og lagrer den som en ny stil, for eksempel «Katt» eller «Portrett».
* **«Lagre innstillinger som stil»**: Lagrer glidebryterne du har stilt inn.

Egne stiler lagres i nettleseren (localStorage). Høyreklikk på en egen stil for å slette den.
