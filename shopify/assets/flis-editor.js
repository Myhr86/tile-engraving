/* Flis-editor for Myhr Tre og Design. GENERERT av tools/build-shopify.mjs – ikke rediger her. */

/* ---- js/presets.js ---- */
// Forhåndsinnstillinger ("presets").
//
// `target` er tonekurven vi vil at motivet skal få: 17 kvantiler (0 %, 6.25 %, … 100 %)
// av gråtonene. De er målt fra midtpartiet av to graveringer som ble ekstra bra:
//   - Hund : puddel-portrettet (mye mellomtoner, lyse krøller, sort bakgrunn)
//   - Hytte: fiskeren ved elva (dype sorte, lyse høylys, mye lokal kontrast)
// Bildet til kunden "tvinges" mot denne fordelingen med histogram-matching.
window.PRESETS = {
  hund: {
    label: 'Hund',
    target: [0, 2, 10, 21, 33, 47, 61, 76, 91, 107, 124, 142, 160, 179, 200, 223, 255],
    params: {
      bgMode: 'vignette', vignetteSize: 0.92, vignetteFeather: 0.35,
      clahe: 0.55, claheClip: 2.5,
      match: 0.85,
      sharpen: 0.9, sharpenRadius: 1.2,
      brightness: 0, contrast: 0, gamma: 1.0,
      blackPoint: 8, whitePoint: 250,
    },
    // Standard tekstoppsett: navnet under hunden, i klassisk serif.
    text: { position: 'bottom', font: 'playfair', size: 0.11, ornament: true, shade: 0.85 },
  },
  hytte: {
    label: 'Hytte',
    target: [0, 0, 1, 2, 6, 9, 16, 24, 36, 49, 64, 82, 102, 127, 154, 187, 255],
    params: {
      bgMode: 'vignette', vignetteSize: 1.25, vignetteFeather: 0.5,
      clahe: 0.7, claheClip: 3.0,
      match: 0.8,
      sharpen: 1.1, sharpenRadius: 1.0,
      brightness: 0, contrast: 0, gamma: 1.0,
      blackPoint: 6, whitePoint: 248,
    },
    // Standard tekstoppsett: hyttenavnet øverst med romerske versaler og ornament.
    text: { position: 'top', font: 'cinzel', size: 0.1, ornament: true, shade: 0.9 },
  },
};

/* ---- js/processing.js ---- */
// Bildebehandling for gravering av lakkerte flis.
// Alt jobber på et kvadratisk gråtonebilde (Float32Array, 0..255).
(function () {
  'use strict';

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  // RGBA ImageData -> luminans. Alfa (fra bakgrunnsfjerning) gjør pikselen sort.
  function toGray(imageData) {
    const d = imageData.data, n = d.length / 4;
    const g = new Float32Array(n), alpha = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const a = d[i * 4 + 3] / 255;
      g[i] = (0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]) * a;
      alpha[i] = a;
    }
    return { g, alpha };
  }

  // Elliptisk vignett: 1 i midten, myk overgang til 0 (sort lakk) mot kantene.
  function vignette(size, radius, feather) {
    const w = new Float32Array(size * size);
    const c = (size - 1) / 2, inner = Math.max(0, radius - feather);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = (x - c) / c, dy = (y - c) / c;
        const r = Math.sqrt(dx * dx + dy * dy);
        let v = r <= inner ? 1 : r >= radius ? 0 : 1 - (r - inner) / (radius - inner);
        w[y * size + x] = v * v * (3 - 2 * v); // smoothstep
      }
    }
    return w;
  }

  // CLAHE (kontrastbegrenset adaptiv histogramutjevning): henter fram struktur i
  // pels, tre, vann osv. – det som gir "gravert" følelse.
  function clahe(g, size, clipLimit, tiles) {
    const bins = 256, ts = size / tiles;
    const maps = new Array(tiles * tiles);
    for (let ty = 0; ty < tiles; ty++) {
      for (let tx = 0; tx < tiles; tx++) {
        const hist = new Float32Array(bins);
        const x0 = Math.floor(tx * ts), x1 = Math.floor((tx + 1) * ts);
        const y0 = Math.floor(ty * ts), y1 = Math.floor((ty + 1) * ts);
        for (let y = y0; y < y1; y++)
          for (let x = x0; x < x1; x++) hist[g[y * size + x] | 0]++;
        const count = (x1 - x0) * (y1 - y0);
        const limit = Math.max(1, (clipLimit * count) / bins);
        let excess = 0;
        for (let i = 0; i < bins; i++) if (hist[i] > limit) { excess += hist[i] - limit; hist[i] = limit; }
        const add = excess / bins;
        const map = new Float32Array(bins);
        let acc = 0;
        for (let i = 0; i < bins; i++) { acc += hist[i] + add; map[i] = (acc / count) * 255; }
        maps[ty * tiles + tx] = map;
      }
    }
    const out = new Float32Array(g.length);
    for (let y = 0; y < size; y++) {
      const fy = clamp(y / ts - 0.5, 0, tiles - 1);
      const ty0 = Math.floor(fy), ty1 = Math.min(ty0 + 1, tiles - 1), wy = fy - ty0;
      for (let x = 0; x < size; x++) {
        const fx = clamp(x / ts - 0.5, 0, tiles - 1);
        const tx0 = Math.floor(fx), tx1 = Math.min(tx0 + 1, tiles - 1), wx = fx - tx0;
        const v = g[y * size + x] | 0;
        const a = maps[ty0 * tiles + tx0][v], b = maps[ty0 * tiles + tx1][v];
        const c = maps[ty1 * tiles + tx0][v], d = maps[ty1 * tiles + tx1][v];
        out[y * size + x] = (a * (1 - wx) + b * wx) * (1 - wy) + (c * (1 - wx) + d * wx) * wy;
      }
    }
    return out;
  }

  // Vektet histogram-matching mot målkurven (kvantiler). Vekten gjør at sort
  // bakgrunn/vignett ikke teller med når vi måler motivet.
  function matchHistogram(g, weight, target) {
    const hist = new Float64Array(256);
    let total = 0;
    for (let i = 0; i < g.length; i++) {
      const w = weight ? weight[i] : 1;
      if (w > 0.5) { hist[clamp(g[i] | 0, 0, 255)] += 1; total++; }
    }
    if (total < 100) return g.slice();
    const lut = new Float32Array(256), segs = target.length - 1;
    let acc = 0;
    for (let v = 0; v < 256; v++) {
      const p = (acc + hist[v] / 2) / total; // midtpunkt-CDF
      acc += hist[v];
      const f = p * segs, k = Math.min(Math.floor(f), segs - 1), t = f - k;
      lut[v] = target[k] * (1 - t) + target[k + 1] * t;
    }
    const out = new Float32Array(g.length);
    for (let i = 0; i < g.length; i++) {
      const v = clamp(g[i], 0, 255), v0 = Math.floor(v), v1 = Math.min(v0 + 1, 255);
      out[i] = lut[v0] + (lut[v1] - lut[v0]) * (v - v0);
    }
    return out;
  }

  // Rask tilnærmet gauss-blur (3 x boks-blur, horisontalt + vertikalt).
  function boxBlur(src, size, r) {
    if (r < 1) return src.slice();
    const tmp = new Float32Array(src.length), out = new Float32Array(src.length);
    const norm = 1 / (2 * r + 1);
    const pass = (a, b, horiz) => {
      for (let l = 0; l < size; l++) {
        let s = 0;
        const at = (k) => (horiz ? a[l * size + clamp(k, 0, size - 1)] : a[clamp(k, 0, size - 1) * size + l]);
        for (let k = -r; k <= r; k++) s += at(k);
        for (let k = 0; k < size; k++) {
          if (horiz) b[l * size + k] = s * norm; else b[k * size + l] = s * norm;
          s += at(k + r + 1) - at(k - r);
        }
      }
    };
    pass(src, tmp, true); pass(tmp, out, false);
    return out;
  }
  function gaussBlur(src, size, sigma) {
    const r = Math.max(1, Math.round(sigma * 0.85));
    return boxBlur(boxBlur(boxBlur(src, size, r), size, r), size, r);
  }

  // Hele løypa. `scale` = størrelse / forhåndsvisningsstørrelse, så skarphet
  // ser lik ut i forhåndsvisning og i eksport.
  function process(imageData, size, p, target, scale) {
    let { g, alpha } = toGray(imageData);
    const hasAlpha = alpha.some((a) => a < 0.99);

    let weight = null;
    if (p.bgMode === 'vignette') weight = vignette(size, p.vignetteSize, p.vignetteFeather);
    if (hasAlpha) {
      weight = weight || new Float32Array(size * size).fill(1);
      for (let i = 0; i < weight.length; i++) weight[i] *= alpha[i];
    }

    if (p.clahe > 0) {
      const c = clahe(g, size, p.claheClip, 8);
      for (let i = 0; i < g.length; i++) g[i] = g[i] + (c[i] - g[i]) * p.clahe;
    }

    if (p.match > 0 && target) {
      const m = matchHistogram(g, weight, target);
      for (let i = 0; i < g.length; i++) g[i] = g[i] + (m[i] - g[i]) * p.match;
    }

    if (p.sharpen > 0) {
      const b = gaussBlur(g, size, p.sharpenRadius * scale);
      for (let i = 0; i < g.length; i++) g[i] = g[i] + (g[i] - b[i]) * p.sharpen;
    }

    // Nivåer: lysstyrke, kontrast, gamma, sortpunkt/hvitpunkt.
    const bp = p.blackPoint, wp = Math.max(p.whitePoint, bp + 1);
    const cf = (259 * (p.contrast + 255)) / (255 * (259 - p.contrast));
    for (let i = 0; i < g.length; i++) {
      let v = g[i] + p.brightness * 2.55;
      v = cf * (v - 128) + 128;
      v = clamp((v - bp) / (wp - bp), 0, 1);
      v = Math.pow(v, 1 / p.gamma) * 255;
      if (weight) v *= weight[i];
      g[i] = v;
    }
    return g;
  }

  // Floyd–Steinberg til ren sort/hvitt (for lasere som vil ha 1-bit).
  function dither(g, size) {
    const a = Float32Array.from(g);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = y * size + x, o = a[i], n = o < 128 ? 0 : 255, e = o - n;
        a[i] = n;
        if (x + 1 < size) a[i + 1] += (e * 7) / 16;
        if (y + 1 < size) {
          if (x > 0) a[i + size - 1] += (e * 3) / 16;
          a[i + size] += (e * 5) / 16;
          if (x + 1 < size) a[i + size + 1] += e / 16;
        }
      }
    }
    return a;
  }

  // Gråtone -> ImageData. `tone` gir en svak varm tone kun i forhåndsvisningen.
  function toImageData(g, size, { invert = false, tone = false } = {}) {
    const img = new ImageData(size, size), d = img.data;
    for (let i = 0; i < g.length; i++) {
      let v = clamp(g[i], 0, 255);
      if (invert) v = 255 - v;
      d[i * 4] = tone ? Math.min(255, v * 1.03) : v;
      d[i * 4 + 1] = v;
      d[i * 4 + 2] = tone ? v * 0.93 : v;
      d[i * 4 + 3] = 255;
    }
    return img;
  }

  // Lag en målkurve (17 kvantiler) fra et referansebilde. Ser bort fra nesten
  // sort bakgrunn ved å bare bruke midtpartiet av bildet.
  function targetFromImageData(imageData, size) {
    const { g } = toGray(imageData);
    const vals = [];
    const m = Math.floor(size * 0.24);
    for (let y = m; y < size - m; y++) for (let x = m; x < size - m; x++) vals.push(g[y * size + x]);
    vals.sort((a, b) => a - b);
    const q = [];
    for (let k = 0; k <= 16; k++) q.push(Math.round(vals[Math.min(vals.length - 1, Math.floor((k / 16) * (vals.length - 1)))]));
    return q;
  }

  // Legg inn DPI (pHYs) i PNG så lasereprogrammet får riktig 20x20 cm.
  const CRC = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  function crc32(bytes) { let c = 0xffffffff; for (const b of bytes) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
  async function pngWithDpi(blob, dpi) {
    const src = new Uint8Array(await blob.arrayBuffer());
    const ppm = Math.round(dpi / 0.0254);
    const data = new Uint8Array(13);
    const dv = new DataView(data.buffer);
    data.set([0x70, 0x48, 0x59, 0x73]); // "pHYs"
    dv.setUint32(4, ppm); dv.setUint32(8, ppm); data[12] = 1;
    const chunk = new Uint8Array(21), cv = new DataView(chunk.buffer);
    cv.setUint32(0, 9); chunk.set(data, 4); cv.setUint32(17, crc32(data));
    const ihdrEnd = 8 + 25; // signatur + IHDR
    const out = new Uint8Array(src.length + 21);
    out.set(src.subarray(0, ihdrEnd)); out.set(chunk, ihdrEnd); out.set(src.subarray(ihdrEnd), ihdrEnd + 21);
    return new Blob([out], { type: 'image/png' });
  }

  window.Engrave = { process, dither, toImageData, targetFromImageData, pngWithDpi };
})();

/* ---- js/crop.js ---- */
// Felles utsnitt-logikk (brukes av både admin-verktøyet og nettbutikk-editoren,
// så kundens utsnitt blir nøyaktig likt når du åpner bestillingen).
// En "view" er { zoom, cx, cy }: zoom 1 = bildet fyller ruten, cx/cy = midtpunkt (0..1).
(function () {
  'use strict';
  const dims = (img) => [img.naturalWidth || img.width, img.naturalHeight || img.height];

  // Zoom der hele bildet får plass i den kvadratiske ruten.
  function fitZoom(img) {
    const [w, h] = dims(img);
    return Math.min(w, h) / Math.max(w, h);
  }

  // Holder midtpunktet innenfor lovlig område for gjeldende zoom.
  function clamp(view, img) {
    const [w, h] = dims(img);
    const side = Math.min(w, h) / view.zoom;
    const lim = (v, m) => Math.min(Math.max(v, Math.min(m, 1 - m)), Math.max(m, 1 - m));
    view.cx = lim(view.cx, side / 2 / w);
    view.cy = lim(view.cy, side / 2 / h);
    return view;
  }

  // Flytt med (dx, dy) skjermpiksler på en rute som er `cssW` piksler bred.
  function pan(view, img, dx, dy, cssW) {
    const [w, h] = dims(img);
    const k = Math.min(w, h) / view.zoom / cssW;
    view.cx -= (dx * k) / w;
    view.cy -= (dy * k) / h;
    return clamp(view, img);
  }

  // Zoom slik at punktet (fx, fy) – andel 0..1 av ruten – blir stående stille.
  function zoomAt(view, img, z, fx = 0.5, fy = 0.5, minZoom = 0.5, maxZoom = 5) {
    const [w, h] = dims(img);
    const oldSide = Math.min(w, h) / view.zoom;
    const px = view.cx * w + (fx - 0.5) * oldSide, py = view.cy * h + (fy - 0.5) * oldSide;
    view.zoom = Math.min(maxZoom, Math.max(minZoom, z));
    const side = Math.min(w, h) / view.zoom;
    view.cx = (px - (fx - 0.5) * side) / w;
    view.cy = (py - (fy - 0.5) * side) / h;
    return clamp(view, img);
  }

  // Hvor stor del av bredden/høyden som er med (1 = alt).
  function coverage(view, img) {
    const [w, h] = dims(img);
    const side = Math.min(w, h) / view.zoom;
    return { w: Math.min(1, side / w), h: Math.min(1, side / h) };
  }

  // Tegn kvadratisk utsnitt i ønsket størrelse. Tomrom blir gjennomsiktig (= sort
  // på flisen), med myk overgang der bildekanten er synlig inne i ruten.
  function cropTo(img, size, view) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    const [w, h] = dims(img);
    const side = Math.min(w, h) / view.zoom;
    const fit = (v, lim) => Math.min(Math.max(v, Math.min(0, lim)), Math.max(0, lim));
    const sx = fit(view.cx * w - side / 2, w - side);
    const sy = fit(view.cy * h - side / 2, h - side);
    const k = size / side;
    const dx = -sx * k, dy = -sy * k, dw = w * k, dh = h * k;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, dx, dy, dw, dh);
    const data = ctx.getImageData(0, 0, size, size);
    const band = size * 0.04;
    const edges = [dx > 0.5, dy > 0.5, dx + dw < size - 0.5, dy + dh < size - 0.5];
    if (edges.some(Boolean)) {
      const d = data.data;
      const ss = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
      for (let y = 0; y < size; y++) {
        let fy = 1;
        if (edges[1]) fy *= ss((y - dy) / band);
        if (edges[3]) fy *= ss((dy + dh - y) / band);
        for (let x = 0; x < size; x++) {
          let f = fy;
          if (edges[0]) f *= ss((x - dx) / band);
          if (edges[2]) f *= ss((dx + dw - x) / band);
          if (f < 1) d[(y * size + x) * 4 + 3] *= f;
        }
      }
    }
    return data;
  }

  window.EngraveCrop = { fitZoom, clamp, pan, zoomAt, coverage, cropTo };
})();

/* ---- js/text.js ---- */
// Navn/tekst på flisen: navn med pen skrift, valgfri ornament-linje og undertekst.
// Tegnes etter bildebehandlingen slik at teksten alltid blir skarp og ren hvit,
// og bildet under teksten tones mykt ned mot sort så teksten står fram.
(function () {
  'use strict';

  const FONTS = {
    playfair: { label: 'Klassisk (Playfair)', family: '"Playfair Display", Georgia, serif', weight: 700, upper: false, spacing: 0.01 },
    cinzel: { label: 'Romersk (Cinzel)', family: 'Cinzel, "Trajan Pro", Georgia, serif', weight: 700, upper: false, spacing: 0.06 },
    script: { label: 'Håndskrift (Great Vibes)', family: '"Great Vibes", "Brush Script MT", cursive', weight: 400, upper: false, spacing: 0, scale: 1.4 },
    georgia: { label: 'Enkel serif (Georgia)', family: 'Georgia, "Times New Roman", serif', weight: 700, upper: false, spacing: 0.02 },
  };
  const SUB_FONT = 'Cinzel, Georgia, serif';

  // Sørg for at webfontene er lastet før vi tegner (ellers blir første tegning feil font).
  function loadFonts() {
    if (!document.fonts) return Promise.resolve();
    const list = Object.values(FONTS).map((f) => `${f.weight} 40px ${f.family}`).concat([`600 40px ${SUB_FONT}`]);
    return Promise.all(list.map((f) => document.fonts.load(f).catch(() => null)));
  }

  // Ornament: tynne linjer som smalner av mot endene, med en liten krusedull i midten.
  function ornament(ctx, cx, cy, width, s, flip) {
    const half = width / 2, lw = Math.max(1, s * 0.035);
    ctx.save();
    ctx.translate(cx, cy);
    if (flip) ctx.scale(1, -1);
    // Avsmalnende linjer
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(dir * s * 0.55, -lw);
      ctx.lineTo(dir * half, 0);
      ctx.lineTo(dir * s * 0.55, lw);
      ctx.closePath();
      ctx.fill();
    }
    // Midtsymbol: rute + to krøller
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.22); ctx.lineTo(s * 0.12, 0); ctx.lineTo(0, s * 0.22); ctx.lineTo(-s * 0.12, 0);
    ctx.closePath(); ctx.fill();
    ctx.lineWidth = lw * 1.3;
    ctx.lineCap = 'round';
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(dir * s * 0.16, 0);
      ctx.bezierCurveTo(dir * s * 0.3, s * 0.28, dir * s * 0.5, s * 0.2, dir * s * 0.45, s * 0.04);
      ctx.bezierCurveTo(dir * s * 0.42, -s * 0.06, dir * s * 0.32, -s * 0.02, dir * s * 0.34, s * 0.06);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(dir * s * 0.62, 0, lw * 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Returnerer { text, color, shade } som Float32Array (0..1) i bildets størrelse, eller null.
  function render(size, t) {
    const name = (t.name || '').trim(), sub = (t.subtitle || '').trim();
    if (!t.enabled || (!name && !sub)) return null;
    const font = FONTS[t.font] || FONTS.playfair;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';

    let fs = size * t.size;                         // skriftstørrelse navn
    // Krymp skriften automatisk hvis et langt navn ikke får plass i bredden.
    {
      const maxW = size * 0.86;
      const nfs = fs * (font.scale || 1);
      ctx.font = `${font.weight} ${nfs}px ${font.family}`;
      ctx.letterSpacing = `${font.spacing * nfs}px`;
      const wName = name ? ctx.measureText(font.upper ? name.toUpperCase() : name).width : 0;
      ctx.font = `600 ${fs * 0.36}px ${SUB_FONT}`;
      ctx.letterSpacing = `${fs * 0.36 * 0.25}px`;
      const wSub = sub ? ctx.measureText(sub.toUpperCase()).width : 0;
      const widest = Math.max(wName, wSub);
      if (widest > maxW) fs *= maxW / widest;
    }
    const subFs = fs * 0.36;
    const orn = t.ornament ? fs * 0.5 : 0;           // høyde ornament
    const gap = fs * 0.14;
    const margin = size * 0.045;
    const cx = size / 2;

    const setName = () => {
      const nfs = fs * (font.scale || 1);
      ctx.font = `${font.weight} ${nfs}px ${font.family}`;
      ctx.letterSpacing = `${font.spacing * nfs}px`;
    };
    const setSub = () => {
      ctx.font = `600 ${subFs}px ${SUB_FONT}`;
      ctx.letterSpacing = `${subFs * 0.25}px`;
    };

    // Mål opp linjene
    setName();
    const nm = name ? ctx.measureText(font.upper ? name.toUpperCase() : name) : null;
    const nAsc = nm ? nm.actualBoundingBoxAscent : 0, nDesc = nm ? nm.actualBoundingBoxDescent : 0;
    setSub();
    const sm = sub ? ctx.measureText(sub.toUpperCase()) : null;
    const sAsc = sm ? sm.actualBoundingBoxAscent : 0, sDesc = sm ? sm.actualBoundingBoxDescent : 0;
    const textW = Math.max(nm ? nm.width : 0, sm ? sm.width : 0);
    const ornW = Math.min(size * 0.86, Math.max(textW * 1.15, fs * 2.8));

    // Bygg blokken ovenfra og ned: over = navn, ornament, undertekst. under = ornament, navn, undertekst.
    const items = [];
    const pushName = () => name && items.push({ kind: 'name', h: nAsc + nDesc, asc: nAsc });
    const pushOrn = () => orn && items.push({ kind: 'orn', h: orn });
    const pushSub = () => sub && items.push({ kind: 'sub', h: sAsc + sDesc, asc: sAsc });
    if (t.position === 'top') { pushName(); pushOrn(); pushSub(); } else { pushOrn(); pushName(); pushSub(); }
    const blockH = items.reduce((a, it) => a + it.h, 0) + gap * (items.length - 1);

    let y = t.position === 'top' ? margin : size - margin - blockH;
    const top = y;

    // Litt "metallisk" fyll: lys topp, svakt mørkere bunn – som de graverte bokstavene.
    const grad = ctx.createLinearGradient(0, top, 0, top + blockH);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(1, '#d4d4d4');
    ctx.fillStyle = grad;
    ctx.strokeStyle = grad;

    for (const it of items) {
      if (it.kind === 'name') {
        setName();
        ctx.fillText(font.upper ? name.toUpperCase() : name, cx, y + it.asc);
      } else if (it.kind === 'sub') {
        setSub();
        ctx.fillText(sub.toUpperCase(), cx, y + it.asc);
      } else {
        ornament(ctx, cx, y + it.h / 2, ornW, orn, t.position !== 'top');
      }
      y += it.h + gap;
    }

    const d = ctx.getImageData(0, 0, size, size).data;
    const text = new Float32Array(size * size), color = new Float32Array(size * size);
    for (let i = 0; i < text.length; i++) { text[i] = d[i * 4 + 3] / 255; color[i] = d[i * 4]; }

    // Mørk "skygge-sone" bak teksten: myk vertikal overgang over hele bredden,
    // pluss en tettere glorie rundt selve bokstavene.
    const shade = new Float32Array(size * size);
    const pad = fs * 0.45, fade = fs * 0.9;
    const y0 = top - pad, y1 = top + blockH + pad;
    const xHalf = Math.max(ornW, textW) / 2 + fs * 0.6;
    for (let yy = 0; yy < size; yy++) {
      let vy = yy < y0 ? 1 - (y0 - yy) / fade : yy > y1 ? 1 - (yy - y1) / fade : 1;
      if (vy <= 0) continue;
      vy = vy * vy * (3 - 2 * vy);
      for (let xx = 0; xx < size; xx++) {
        const dx = Math.abs(xx - cx);
        let vx = dx < xHalf ? 1 : 1 - (dx - xHalf) / (fade * 2);
        if (vx <= 0) continue;
        vx = vx * vx * (3 - 2 * vx);
        shade[yy * size + xx] = vy * vx;
      }
    }
    return { text, color, shade };
  }

  // Legg teksten inn i gråtonebildet.
  function apply(g, size, t) {
    const r = render(size, t);
    if (!r) return g;
    const k = t.shade;
    for (let i = 0; i < g.length; i++) {
      let v = g[i] * (1 - r.shade[i] * k);
      const a = r.text[i];
      g[i] = v * (1 - a) + r.color[i] * a;
    }
    return g;
  }

  window.EngraveText = { FONTS, loadFonts, apply };
})();

/* ---- shop/editor.js ---- */
// Enkel kunde-editor for nettbutikken (Shopify).
// Kunden laster opp bilde, plasserer det og skriver navn. Med i handlekurven
// følger originalbildet, en forhåndsvisning og en «oppskrift» som admin-verktøyet
// kan åpne for å lage graveringsfilen i full kvalitet.
//
// Monteres på alle elementer med [data-flis-editor]. Data-attributter:
//   data-preset     hund | hytte
//   data-variants   JSON: [{ "id": 123, "title": "...", "price": "399,00 kr", "available": true }]
//   data-cart-url   hvor kunden sendes etter "Legg i handlekurv" (standard: /cart)
(function () {
  'use strict';

  const PREVIEW = 520;          // oppløsning på forhåndsvisningen i nettbutikken
  const ORIGINAL_MAX = 3000;    // originalbildet krympes til maks dette før opplasting
  const PROOF_SIZE = 1000;      // størrelse på forhåndsvisningsbildet som følger ordren
  const SHOP_FONTS = ['playfair', 'cinzel', 'script'];
  const FONT_NAMES = { playfair: 'Klassisk', cinzel: 'Romersk', script: 'Håndskrift' };

  const h = (tag, attrs = {}, ...kids) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid != null) el.append(kid);
    return el;
  };

  const toBlob = (canvas, type, q) => new Promise((r) => canvas.toBlob(r, type, q));

  class FlisEditor {
    constructor(root) {
      this.root = root;
      this.presetKey = window.PRESETS[root.dataset.preset] ? root.dataset.preset : 'hund';
      this.preset = window.PRESETS[this.presetKey];
      this.variants = JSON.parse(root.dataset.variants || '[]');
      this.variantId = (this.variants.find((v) => v.available) || this.variants[0] || {}).id;
      this.cartUrl = root.dataset.cartUrl || '/cart';
      this.img = null;
      this.file = null;
      this.view = { zoom: 1, cx: 0.5, cy: 0.5 };
      this.minZoom = 0.5;
      this.text = {
        enabled: false, name: '', subtitle: '',
        position: 'bottom', font: 'playfair', size: 0.11, ornament: true, shade: 0.85,
        ...(this.preset.text || {}),
      };
      this.build();
      EngraveText.loadFonts().then(() => this.schedule());
    }

    // ---------- Oppbygging ----------
    build() {
      const r = this.root;
      r.classList.add('flis-editor');
      r.innerHTML = '';
      const isHytte = this.presetKey === 'hytte';

      this.fileInput = h('input', { type: 'file', accept: 'image/*', hidden: true, onchange: (e) => this.load(e.target.files[0]) });
      this.canvas = h('canvas', { width: PREVIEW, height: PREVIEW, class: 'fe-canvas', 'aria-label': 'Forhåndsvisning av flisen' });
      this.empty = h('button', { type: 'button', class: 'fe-empty', onclick: () => this.fileInput.click() },
        h('span', { class: 'fe-empty-icon' }, '+'),
        h('strong', {}, isHytte ? 'Last opp bilde av hytta' : 'Last opp bilde av hunden'),
        h('small', {}, 'Velg et skarpt bilde med godt lys'));
      this.tile = h('div', { class: 'fe-tile' }, this.canvas, this.empty);

      this.zoomRange = h('input', { type: 'range', min: 0.5, max: 4, step: 0.01, value: 1, 'aria-label': 'Zoom',
        oninput: (e) => this.zoomTo(parseFloat(e.target.value)) });
      this.tools = h('div', { class: 'fe-tools', hidden: true },
        h('button', { type: 'button', class: 'fe-btn fe-icon', 'aria-label': 'Zoom ut', onclick: () => this.zoomTo(this.view.zoom / 1.2) }, '−'),
        this.zoomRange,
        h('button', { type: 'button', class: 'fe-btn fe-icon', 'aria-label': 'Zoom inn', onclick: () => this.zoomTo(this.view.zoom * 1.2) }, '+'),
        h('button', { type: 'button', class: 'fe-btn fe-small', onclick: () => this.fit() }, 'Vis hele'),
        h('button', { type: 'button', class: 'fe-btn fe-small', onclick: () => this.fileInput.click() }, 'Bytt bilde'));
      this.hint = h('p', { class: 'fe-hint', hidden: true }, 'Dra i bildet for å flytte det. Klyp eller bruk + og − for å zoome.');

      // Tekst
      this.nameInput = h('input', { type: 'text', maxlength: 30, placeholder: isHytte ? 'f.eks. Fjellro' : 'f.eks. Bella',
        oninput: (e) => this.setText({ name: e.target.value }) });
      this.subInput = h('input', { type: 'text', maxlength: 40, placeholder: isHytte ? 'f.eks. Est. 1987' : 'f.eks. 2014 – 2026',
        oninput: (e) => this.setText({ subtitle: e.target.value }) });
      this.posButtons = ['top', 'bottom'].map((pos) => h('button', { type: 'button', class: 'fe-chip', 'data-v': pos,
        onclick: () => this.setText({ position: pos }) }, pos === 'top' ? 'Over bildet' : 'Under bildet'));
      this.fontButtons = SHOP_FONTS.map((f) => {
        const font = EngraveText.FONTS[f];
        return h('button', { type: 'button', class: 'fe-chip fe-font', 'data-v': f, style: `font-family:${font.family};font-weight:${font.weight}`,
          onclick: () => this.setText({ font: f }) }, FONT_NAMES[f]);
      });

      // Variant (hvis produktet har flere, f.eks. størrelse)
      let variantEl = null;
      if (this.variants.length > 1) {
        variantEl = h('label', { class: 'fe-field' }, 'Variant',
          h('select', { onchange: (e) => { this.variantId = +e.target.value; this.updateButton(); } },
            this.variants.map((v) => h('option', { value: v.id, disabled: !v.available, selected: v.id === this.variantId }, `${v.title} – ${v.price}`))));
      }

      this.addBtn = h('button', { type: 'button', class: 'fe-add', onclick: () => this.addToCart() });
      this.msg = h('p', { class: 'fe-msg', role: 'status' });

      r.append(...[
        this.fileInput,
        this.tile, this.tools, this.hint,
        h('div', { class: 'fe-section' },
          h('h3', {}, isHytte ? 'Navn på hytta (valgfritt)' : 'Navn på hunden (valgfritt)'),
          h('label', { class: 'fe-field' }, 'Navn', this.nameInput),
          h('label', { class: 'fe-field' }, 'Undertekst (valgfri)', this.subInput),
          h('div', { class: 'fe-row' }, this.posButtons),
          h('div', { class: 'fe-row' }, this.fontButtons)),
        variantEl,
        h('p', { class: 'fe-note' }, 'Vi går gjennom og finjusterer hvert bilde for hånd før gravering. Forhåndsvisningen viser omtrent hvordan flisen blir.'),
        this.addBtn, this.msg,
      ].filter(Boolean));

      this.setupGestures();
      this.syncText();
      this.updateButton();
    }

    // ---------- Bilde ----------
    async load(file) {
      if (!file || !file.type.startsWith('image/')) return;
      this.msg.textContent = '';
      const img = new Image();
      img.src = URL.createObjectURL(file);
      try { await img.decode(); } catch (e) {
        this.msg.textContent = 'Klarte ikke å lese bildet. Prøv et JPG- eller PNG-bilde.';
        return;
      }
      this.img = img;
      this.file = file;
      const fz = EngraveCrop.fitZoom(img);
      this.minZoom = Math.min(0.5, fz * 0.8);
      this.zoomRange.min = this.minZoom.toFixed(3);
      this.fitZoomValue = fz;
      this.tile.classList.add('has-image');
      this.tools.hidden = false;
      this.hint.hidden = false;
      // Stående/kvadratiske bilder fyller ruten, brede bilder vises i sin helhet.
      this.view = { zoom: fz < 0.8 ? fz : 1, cx: 0.5, cy: 0.5 };
      this.afterView();
      this.updateButton();
    }

    fit() { if (!this.img) return; this.view = { zoom: this.fitZoomValue, cx: 0.5, cy: 0.5 }; this.afterView(); }

    zoomTo(z, fx, fy) {
      if (!this.img) return;
      EngraveCrop.zoomAt(this.view, this.img, z, fx, fy, this.minZoom, 4);
      this.afterView();
    }

    afterView() {
      EngraveCrop.clamp(this.view, this.img);
      this.zoomRange.value = this.view.zoom;
      this.schedule();
    }

    setupGestures() {
      const cv = this.canvas, pointers = new Map();
      let pinch = null;
      cv.addEventListener('pointerdown', (e) => {
        if (!this.img) return;
        cv.setPointerCapture(e.pointerId);
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.size === 2) {
          const [a, b] = [...pointers.values()];
          pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: this.view.zoom };
        }
      });
      cv.addEventListener('pointermove', (e) => {
        const prev = pointers.get(e.pointerId);
        if (!prev || !this.img) return;
        const cur = { x: e.clientX, y: e.clientY };
        pointers.set(e.pointerId, cur);
        const rect = cv.getBoundingClientRect();
        if (pointers.size === 2 && pinch) {
          const [a, b] = [...pointers.values()];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          EngraveCrop.zoomAt(this.view, this.img, pinch.zoom * (d / pinch.dist),
            ((a.x + b.x) / 2 - rect.left) / rect.width, ((a.y + b.y) / 2 - rect.top) / rect.height, this.minZoom, 4);
          EngraveCrop.pan(this.view, this.img, (cur.x - prev.x) / 2, (cur.y - prev.y) / 2, rect.width);
        } else if (pointers.size === 1) {
          EngraveCrop.pan(this.view, this.img, cur.x - prev.x, cur.y - prev.y, rect.width);
        }
        this.afterView();
      });
      const end = (e) => { pointers.delete(e.pointerId); if (pointers.size < 2) pinch = null; };
      cv.addEventListener('pointerup', end);
      cv.addEventListener('pointercancel', end);
      cv.addEventListener('wheel', (e) => {
        if (!this.img) return;
        e.preventDefault();
        const rect = cv.getBoundingClientRect();
        this.zoomTo(this.view.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1), (e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height);
      }, { passive: false });
      // Dra og slipp en fil på ruten
      this.tile.addEventListener('dragover', (e) => e.preventDefault());
      this.tile.addEventListener('drop', (e) => { e.preventDefault(); this.load(e.dataTransfer.files[0]); });
    }

    // ---------- Tekst ----------
    setText(patch) {
      Object.assign(this.text, patch);
      this.text.enabled = !!(this.text.name.trim() || this.text.subtitle.trim());
      this.syncText();
      this.schedule();
    }

    syncText() {
      for (const b of this.posButtons) b.classList.toggle('active', b.dataset.v === this.text.position);
      for (const b of this.fontButtons) b.classList.toggle('active', b.dataset.v === this.text.font);
    }

    // ---------- Tegning ----------
    schedule() {
      if (this.pending || !this.img) return;
      this.pending = true;
      requestAnimationFrame(() => { this.pending = false; this.render(); });
    }

    renderGray(size) {
      const src = EngraveCrop.cropTo(this.img, size, this.view);
      const g = Engrave.process(src, size, this.preset.params, this.preset.target, size / 700);
      EngraveText.apply(g, size, this.text);
      return g;
    }

    render() {
      const g = this.renderGray(PREVIEW);
      this.canvas.getContext('2d').putImageData(Engrave.toImageData(g, PREVIEW, { tone: true }), 0, 0);
    }

    // ---------- Handlekurv ----------
    updateButton() {
      const v = this.variants.find((x) => x.id === this.variantId);
      const price = v ? ` – ${v.price}` : '';
      if (v && !v.available) { this.addBtn.textContent = 'Utsolgt'; this.addBtn.disabled = true; return; }
      this.addBtn.disabled = false;
      this.addBtn.textContent = this.img ? `Legg i handlekurven${price}` : 'Last opp et bilde først';
    }

    recipe() {
      const { enabled, name, subtitle, position, font } = this.text;
      const round = (x) => Math.round(x * 10000) / 10000;
      return { v: 1, preset: this.presetKey, zoom: round(this.view.zoom), cx: round(this.view.cx), cy: round(this.view.cy),
        text: { enabled, name: name.trim(), subtitle: subtitle.trim(), position, font } };
    }

    // Krymper originalbildet (beholder proporsjoner, så utsnittet stemmer fortsatt).
    async originalFile() {
      const w = this.img.naturalWidth, hgt = this.img.naturalHeight;
      const k = Math.min(1, ORIGINAL_MAX / Math.max(w, hgt));
      if (k === 1 && /jpe?g/i.test(this.file.type) && this.file.size < 15e6) return this.file;
      const c = document.createElement('canvas');
      c.width = Math.round(w * k); c.height = Math.round(hgt * k);
      const ctx = c.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(this.img, 0, 0, c.width, c.height);
      return new File([await toBlob(c, 'image/jpeg', 0.92)], 'originalbilde.jpg', { type: 'image/jpeg' });
    }

    async proofFile() {
      const g = this.renderGray(PROOF_SIZE);
      const c = document.createElement('canvas');
      c.width = c.height = PROOF_SIZE;
      c.getContext('2d').putImageData(Engrave.toImageData(g, PROOF_SIZE, { tone: true }), 0, 0);
      return new File([await toBlob(c, 'image/jpeg', 0.85)], 'forhandsvisning.jpg', { type: 'image/jpeg' });
    }

    async addToCart() {
      if (!this.img) { this.fileInput.click(); return; }
      if (!this.variantId) { this.msg.textContent = 'Produktet mangler variant. Kontakt butikken.'; return; }
      this.addBtn.disabled = true;
      this.addBtn.textContent = 'Laster opp bildet …';
      this.msg.textContent = '';
      try {
        const r = this.recipe();
        const fd = new FormData();
        fd.append('id', this.variantId);
        fd.append('quantity', 1);
        fd.append('properties[Motiv]', this.preset.label);
        if (r.text.name) fd.append('properties[Navn]', r.text.name);
        if (r.text.subtitle) fd.append('properties[Undertekst]', r.text.subtitle);
        if (r.text.enabled) {
          fd.append('properties[Tekst]', `${r.text.position === 'top' ? 'Over' : 'Under'} bildet, skrift: ${FONT_NAMES[r.text.font]}`);
        }
        fd.append('properties[Forhåndsvisning]', await this.proofFile());
        fd.append('properties[_Originalbilde]', await this.originalFile());
        fd.append('properties[_Oppskrift]', JSON.stringify(r));

        const root = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
        const res = await fetch(root + 'cart/add.js', { method: 'POST', body: fd, headers: { Accept: 'application/json' } });
        if (!res.ok) {
          let desc = '';
          try { desc = (await res.json()).description || ''; } catch (e) { /* ignorer */ }
          throw new Error(desc || `HTTP ${res.status}`);
        }
        this.addBtn.textContent = 'Lagt i handlekurven ✔';
        window.location.href = this.cartUrl;
      } catch (e) {
        console.error(e);
        this.msg.textContent = `Noe gikk galt: ${e.message}. Prøv igjen, eller kontakt oss.`;
        this.addBtn.disabled = false;
        this.updateButton();
      }
    }
  }

  function mountAll() {
    document.querySelectorAll('[data-flis-editor]:not(.flis-editor)').forEach((el) => {
      el._flisEditor = new FlisEditor(el);
    });
  }
  window.FlisEditor = FlisEditor;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountAll);
  else mountAll();
  // Shopify sin tema-editor laster seksjoner på nytt uten å laste siden.
  document.addEventListener('shopify:section:load', mountAll);
})();
