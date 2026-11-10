# Bilflis – bildetjeneste (Cloudflare Worker)

Kunden laster opp et bilde av bilen sin og velger stil. Denne lille serveren sender bildet
og stilbildet til OpenAI (`gpt-image-2`, bilderedigering), og strømmer resultatet tilbake til
nettbutikken. OpenAI-nøkkelen ligger bare her, aldri i nettbutikken.

* **Stil 1 – Røyk og brostein:** 1024 × 1024 (Mustang-bildet som mal).
* **Stil 2 – Stormnatt:** 1536 × 1024 (Volvo Amazon-bildet som mal).
* Stilbildene ligger i Shopify under *Innhold → Filer* (`bilflis-stil1.png`, `bilflis-stil2.png`).
* Instruksjonene til AI-en (prompt) står i `src/index.js` (`STYLES`).

## Kostnad og tak

* Hvert forsøk koster omtrent 2–3 kr i høy kvalitet (anslag, se OpenAI-fakturaen). `QUALITY = "medium"` er billigere og raskere (ca. 30 s mot 60–90 s), men litt mindre detaljert.
* `MAX_PER_IP` (standard 3) er antall forsøk per kunde per døgn, og `MAX_PER_DAY` (standard 60) er taket for hele butikken per døgn. 60 forsøk koster høyst ca. 150 kr per døgn.
* Sett også en månedlig grense hos OpenAI: *platform.openai.com → Settings → Limits*.

## Oppsett i Cloudflare (gratisplanen holder)

1. Lag en konto på dash.cloudflare.com.
2. **Workers & Pages → Create → Create Worker.** Kall den `bilflis` og trykk *Deploy*.
3. **Edit code:** lim inn hele `src/index.js` og trykk *Deploy*.
4. **Storage & Databases → KV → Create:** kall den `bilflis-limits`.
5. I workeren: **Settings → Bindings → Add → KV namespace**. Variabelnavn `LIMITS`, velg `bilflis-limits`.
6. **Settings → Variables and Secrets:**
   * *Secret* `OPENAI_API_KEY` = OpenAI-nøkkelen din.
   * *Text* `ALLOWED_ORIGINS` = `https://myhrtreogdesign.com,https://www.myhrtreogdesign.com,https://uxac0y-us.myshopify.com`
   * *Text* `STYLE_URL_STIL1` og `STYLE_URL_STIL2` = adressene i `wrangler.toml`.
   * Valgfritt: `MODEL`, `QUALITY`, `MAX_PER_IP` og `MAX_PER_DAY` (standardverdiene står i `wrangler.toml`).
7. Kopier adressen til workeren, for eksempel `https://bilflis.dittnavn.workers.dev`. Lim den inn i temaet: **Tilpass → produktmalen «bilflis» → Bilflis-editor (AI) → Adresse til bildetjenesten**.
8. Test: åpne `https://bilflis.dittnavn.workers.dev/status`. Siden skal vise `{"error":"Ikke tillatt."}`, fordi den bare svarer nettbutikken. Det er riktig.

Med kommandolinjen i stedet: sett KV-id-en i `wrangler.toml`, og kjør `npx wrangler secret put OPENAI_API_KEY` og `npx wrangler deploy`.

## Bestillingen

På ordren står *Stil*, **Bilde** (det ferdige bildet som PNG, klart for LightBurn med dine vanlige innstillinger) og *Bilfoto* (kundens originalbilde).
