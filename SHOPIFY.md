# Kunde-editor i Shopify (Vessel-temaet)

Kunden laster opp bilde av hunden eller hytta si, plasserer det i flisen og skriver eventuelt et navn.
Når kunden trykker **Legg i handlekurven**, følger dette med på ordrelinjen:

| Egenskap | Innhold | Synlig for kunden |
|---|---|---|
| Motiv, Navn, Undertekst, Tekst | Det kunden valgte | Ja |
| Forhåndsvisning | JPG av flisen slik kunden så den | Ja (lenke) |
| _Originalbilde | Kundens bilde, krympet til maks 3000 px | Nei, bare i admin |
| _Oppskrift | Utsnitt, zoom, tekst og skrift (JSON) | Nei, bare i admin |

Egenskaper som starter med `_`, skjules for kunden, men står på ordren i Shopify-admin.

## Status i butikken (installert 1. november 2026)
* Temaet **«Vessel – med flis-editor (TEST)»** er en kopi av det tidligere publiserte temaet, og er nå publisert. Det har:
  `assets/flis-editor.js`, `assets/flis-editor.css`, `sections/flis-editor.liquid`,
  `templates/product.flis-hund.json` og `templates/product.flis-hytte.json`.
* Produktene **«Hundeflis med eget bilde»** (`/products/hundeflis-med-eget-bilde`) og **«Hytteflis med eget bilde»** (`/products/hytteflis-med-eget-bilde`) er aktive i nettbutikken. De koster 499 kr, har produktbilder (Lissi og Fjelltun), har ikke lagersporing og er koblet til malene.
* Malene lages med `python3 tools/make-templates.py`.

* Begge produktene har to bilder: motivet (Lissi og Fjelltun) og flisen i ramme på veggen. Rammebildene er laget med `tools/make-mockup.py`.
* Kolleksjonen **«Personlige fliser – eget bilde»** (`/collections/personlige-fliser`) tar automatisk med alle produkter merket «Eget bilde». Hytteflisen ligger også i kolleksjonen **Hytte**.

* Temaet **«Vessel – flis-editor + mobilforside»** (ikke publisert ennå) er en kopi av det publiserte temaet. I tillegg har det:
  - ny forside (`templates/index.json`, laget med `tools/make-index.py`): bare flisbildet øverst på mobil, og hvit tekst med skygge over bildet,
  - ny editor-versjon som viser «Laster bildeverktøyet …» og eventuelle feilmeldinger.

* Temaet «Vessel – flis-editor + mobilforside» ble publisert 1.–3. november.
* Temaet **«Vessel – flis-editor + familie»** (publisert 3. november) er en kopi av det, og har i tillegg:
  - stilen **Familie / portrett** (samme innstillinger som Hytte, bildet over hele flisen som standard),
  - valget «Bildet over hele flisen» eller «Myk mørk kant» i editoren for alle motiver,
  - malen `templates/product.flis-familie.json`.
* Produktet **«Familieflis med eget bilde»** (`/products/familieflis-med-eget-bilde`) er aktivt i nettbutikken, til 499 kr, og koblet til malen `flis-familie`. Det har to bilder: Skjærseth-flisen i ramme på veggen, og selve motivet. Det ligger i kolleksjonen «Personlige fliser».

* Temaet **«Vessel – flis + tekst-editor»** (publisert 8. november) er en kopi av «flis-editor + familie», og har i tillegg tekst-editoren:
  `assets/tekst-editor.js`, de fem skriftene (`.woff`), `assets/korketrekker-tom.jpg`, `sections/tekst-editor.liquid` og `templates/product.tekst-vinapner.json`.
* **«Personlig vinåpner»** (`/products/personlig-vinapner`, 209 kr) er koblet til malen `tekst-vinapner`. Den vises først når temaet over er publisert. Til da ser kundene den gamle siden.
* «Slik bestiller du» i beskrivelsen er oppdatert til editoren.
* Temaet **«Vessel – tekst-editor fiks skrifter»** (ikke publisert ennå) er en kopi av «flis + tekst-editor», med ny `tekst-editor.js` der skriftene og produktbildet er bakt inn. Den første versjonen fikk ikke lastet skriftfilene i butikken.

### Tekstbestillinger (vinåpner)
På ordren står *Linje 1*, *Linje 2*, *Skrift*, *Forhåndsvisning*, *_Gravering* (PNG ved 600 DPI), *_Oppskrift* og **_SVG-fil**.
**_SVG-fil** er en lenke til den skjulte siden `/pages/svg-eksport`. Den viser graveringen og har knapper for **SVG** (vektor, riktig størrelse i mm) og PNG, klare for LightBurn.
Oppskriften ligger i selve lenken, og siden er skjult for søkemotorer og ikke lagt i menyen.
Bilder Shopify viser i nettleseren, kan komme som webp. SVG-filen fra eksportsiden er alltid en ekte vektorfil.
Bestillinger fra før SVG-lenken fantes: lim inn *_Oppskrift* på eksportsiden eller i `tekst.html`.

* Temaet **«Vessel – tekst-editor + SVG-eksport»** (ikke publisert ennå) er en kopi av «tekst-editor fiks skrifter», med SVG-lenken og eksportsiden.

### Familietre
* **«Familietre»** (`/products/familietre`) har fått opsjonen **Utførelse**: *Ubehandlet MDF* (489 kr, samme variant-ID som før) og *Lakkert* (539 kr). Begge lages på bestilling, uten lagerstyring. Produktet er koblet til malen `familietre`.
* Editoren: utførelse, tekst nederst (190 × 40 mm, fem skrifter) og opptil 16 navn (26 × 7 mm på hjertene, store bokstaver). På ordren står *Tekst nederst*, *Skrift*, *Antall hjerter*, *Navn*, *Forhåndsvisning*, *_Oppskrift* og **_SVG-fil**. Lenken gir et SVG-ark med bunnteksten øverst og navnene i hjerter under, med røde hårstreker for felt og omriss.
* Feltmålene er et anslag ut fra bildene. De justeres i `js/familietre.js` (`bottomField`, `nameField`, `heart`).
* Temaet **«Vessel – familietre-editor»** (ikke publisert ennå) er en kopi av «tekst-editor + SVG-eksport», og har familietre-editoren og en rettelse for vinåpneren: tekst i Løkkeskrift med B, O og noen andre bokstaver forsvant før.
* Etter publisering: «Slik bestiller du» i beskrivelsen sier fortsatt «Trykk på spesielle instruksjoner», og må oppdateres.

### Dørskilt i akryl
* **«Personlig dørskilt i akryl»** (`/products/dorskilt-i-akryl`) har nå én variant (439 kr) i stedet for «Fjellmotiv» og «Tekst med hjerte», fordi motivet velges i editoren. Variant-ID-en til «Fjellmotiv» beholdes. Lagerstyringen er som før, med 5 på lager (1 + 4 fra de to gamle variantene).
* Editoren: topptekst (fem skrifter), valgfri linje 2 (store bokstaver), motiv (Fjell, Hjerte, Hytte, Skog, Fyrlykt eller Uten motiv) og navn på to linjer. Skiltet tegnes rett forfra, 146 × 96 mm.
* Motivene er tegnet som vektorer i `js/dorskilt.js` (`MOTIFS`), og feltene ligger i `SIGN.fields`. Plasseringen er anslått ut fra bildene.
* På ordren står *Topptekst*, *Linje 2*, *Motiv*, *Navn*, *Skrift*, *Forhåndsvisning*, *_Oppskrift* og **_SVG-fil** (hele skiltet i mm, med røde hårstreker for plate og hull).
* «Farge» i beskrivelsen er rettet til «Sort akryl med hvit gravering». «Slik bestiller du» sier fortsatt «spesielle instruksjoner», og må oppdateres når editoren er publisert.
* Temaet **«Vessel – dørskilt-editor»** er publisert.
* Temaet **«Vessel – dørskilt linje 2 skrift»** (ikke publisert ennå) har skriftvalg for linje 2 og en grense for navnestørrelsen.

Gjenstår: publisere «dørskilt linje 2 skrift», oppdatere «Slik bestiller du» på dørskiltet, og legge kolleksjonen i menyen.

> **Viktig etter forhåndsvisning:** Nettleseren husker forhåndsviste temaer. Åpne `https://myhrtreogdesign.com/?preview_theme_id=` (tom verdi) for å se det publiserte temaet igjen.

## Installasjon (ca. 15 min)

> **Tips:** Gjør det først på en kopi av temaet: *Nettbutikk → Temaer → … → Dupliser*. Test der, og publiser når alt virker.

### 1. Last opp filene til temaet
*Nettbutikk → Temaer → … → Rediger kode*
1. Under **Assets**, velg *Legg til ny ressurs*. Last opp `shopify/assets/flis-editor.js` og `shopify/assets/flis-editor.css`.
2. Under **Sections**, velg *Legg til en ny seksjon*. Kall den `flis-editor`, og erstatt innholdet med `shopify/sections/flis-editor.liquid`.

### 2. Lag produktene
For eksempel **«Hundeflis med eget bilde»** og **«Hytteflis med eget bilde»**. Gi dem pris, bilder og beskrivelse som vanlig.
Siden hver flis lages på bestilling, kan du slå av lagersporing. Ellers huker du av for *Fortsett å selge når varen er utsolgt*.

### 3. Lag en produktmal med editoren
*Nettbutikk → Tilpass*. Velg **Produkter** i menyen øverst, og deretter **Opprett mal**, for eksempel `flis-hund`.
1. Velg **Legg til seksjon → Flis-editor (eget bilde)**, og velg *Motiv/stil: Hund*.
2. I temaets produktseksjon fjerner eller skjuler du blokken **Kjøp-knapper**, og eventuelt **Antall**. Da bruker kundene editorens egen knapp.
3. Dra editor-seksjonen dit du vil ha den, for eksempel rett under produktinfoen.
4. Lagre. Gjenta med malen `flis-hytte` og *Motiv/stil: Hytte*.

### 4. Koble produktene til malen
Åpne produktet i admin. Under **Temamal** til høyre velger du `flis-hund` eller `flis-hytte`.

### 5. Test
Legg inn en testordre. Bruk gjerne en rabattkode på 100 %, eller testmodus for betaling. Sjekk at ordren har *Forhåndsvisning*, *_Originalbilde* og *_Oppskrift*.

## Når en bestilling kommer
1. Åpne ordren i Shopify. Klikk på **_Originalbilde** og last ned bildet.
2. Åpne graveringsverktøyet (`index.html`), og klikk **Åpne bestilling fra nettbutikken**.
3. Lim inn teksten fra **_Oppskrift**, og velg originalbildet.

Bildet, utsnittet og teksten blir som kunden laget det. Finjuster om nødvendig, og last ned laserfilen.

## Endre editoren
Kildekoden ligger i `shop/editor.js` og `shop/editor.css`, og bruker de samme filene i `js/` som admin-verktøyet.
Når du har endret noe, bygger du Shopify-filene på nytt og laster dem opp igjen:

```bash
node tools/build-shopify.mjs
```

`shop/demo.html` viser editoren lokalt uten Shopify. Knappen for handlekurv virker bare i butikken.
