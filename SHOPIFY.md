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
* Temakopien **«Vessel – med flis-editor (TEST)»** er laget fra det publiserte temaet. Den er ikke publisert. Den har:
  `assets/flis-editor.js`, `assets/flis-editor.css`, `sections/flis-editor.liquid`,
  `templates/product.flis-hund.json` og `templates/product.flis-hytte.json`.
* Produktene **«Hundeflis med eget bilde»** og **«Hytteflis med eget bilde»** er laget som utkast til 399 kr, uten lagersporing, og er koblet til malene.
* Malene lages med `python3 tools/make-templates.py`.

Gjenstår: bilder på produktene, testbestilling, og å publisere temakopien og produktene.

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
