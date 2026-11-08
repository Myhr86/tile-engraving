// Tekstgravering: legger én eller to linjer tekst inn i et felt (mm), som ekte
// vektorer (opentype.js). Brukes av både kunde-editoren og admin-siden, og gir
// SVG (mm) og PNG (DPI) klare for LightBurn.
//
// Krever window.opentype (vendor/opentype.min.js).
(function () {
  'use strict';

  const FONTS = {
    script:  { label: 'Håndskrift',  file: 'great-vibes-latin-400-normal.woff' },
    dancing: { label: 'Løkkeskrift', file: 'dancing-script-latin-700-normal.woff' },
    serif:   { label: 'Klassisk',    file: 'playfair-display-latin-700-normal.woff' },
    roman:   { label: 'Romersk',     file: 'cinzel-latin-700-normal.woff' },
    sans:    { label: 'Moderne',     file: 'montserrat-latin-600-normal.woff' },
  };

  // Produkter med gravérfelt. `mock` beskriver hvor feltet ligger i produktbildet.
  const PRODUCTS = {
    korketrekker: {
      label: 'Korketrekker',
      field: { w: 50, h: 9 },                     // mm
      image: 'korketrekker-tom.jpg',
      mock: { cx: 371, cy: 397, pxPerMm: 5.04, angle: 1.06 },   // i bildets piksler, grader
      zoom: { x: 180, y: 330, w: 600, h: 140 },  // utsnitt for nærbilde
      zoomTight: { x: 215, y: 350, w: 315, h: 95 }, // tett utsnitt rundt feltet (kunde-editor)
      burn: [50, 16, 6],                          // farge på brent tre (RGB, målt fra ekte gravering)
    },
  };

  // ---------- Skrifter ----------
  const cache = {};
  let fontUrl = (key) => 'fonts/' + FONTS[key].file;
  function setFontUrls(fn) { fontUrl = fn; }
  // I nettbutikken er skriftene bakt inn i skriptet (window.TextEngraveEmbedded), så de
  // ikke må hentes som egne filer. Ellers hentes de med fetch (admin-siden og demoen).
  function fontBuffer(key) {
    const emb = window.TextEngraveEmbedded && window.TextEngraveEmbedded.fonts && window.TextEngraveEmbedded.fonts[key];
    if (emb) {
      const bin = atob(emb), buf = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
      return Promise.resolve(buf.buffer);
    }
    const url = fontUrl(key);
    return fetch(url)
      .catch((e) => { throw new Error(`kunne ikke hente ${url} (${e.message})`); })
      .then((r) => { if (!r.ok) throw new Error(`${url} svarte ${r.status}`); return r.arrayBuffer(); });
  }
  function loadFont(key) {
    if (!FONTS[key]) return Promise.reject(new Error('ukjent skrift: ' + key));
    if (!cache[key]) {
      cache[key] = fontBuffer(key)
        .then((buf) => {
          const font = opentype.parse(buf);
          // Noen skrifter (f.eks. Great Vibes) har kontekst-varianter (GSUB) som opentype.js
          // ikke støtter. De trengs ikke for gravering, så de fjernes hvis de feiler.
          try { font.getPath('Aa æøå 19', 0, 0, 1, GLYPH_OPTS); } catch (e) { delete font.tables.gsub; }
          return font;
        })
        .catch((e) => { delete cache[key]; throw new Error(`Skriften «${FONTS[key].label}»: ${e.message}`); });
    }
    return cache[key];
  }

  // ---------- Hjelpere for stier ----------
  // Ny sti med alle punkter transformert: x' = x*s + dx, y' = y*s + dy
  function transform(path, s, dx, dy) {
    const out = new opentype.Path();
    for (const c of path.commands) {
      const n = { type: c.type };
      for (const k of ['x', 'x1', 'x2']) if (k in c) n[k] = c[k] * s + dx;
      for (const k of ['y', 'y1', 'y2']) if (k in c) n[k] = c[k] * s + dy;
      out.commands.push(n);
    }
    return out;
  }

  function bbox(path) {
    const b = path.getBoundingBox();
    return { x1: b.x1, y1: b.y1, x2: b.x2, y2: b.y2, w: b.x2 - b.x1, h: b.y2 - b.y1 };
  }

  // Hjerte (for ♥, ❤ og <3): tegnet selv, så det finnes i alle skrifter.
  // Bredde w, øverste punkt y = top, baseline under.
  function heartPath(x, top, w) {
    const p = new opentype.Path();
    const h = w * 0.9, cx = x + w / 2;
    p.moveTo(cx, top + h * 0.28);
    p.curveTo(cx, top, x, top, x, top + h * 0.3);
    p.curveTo(x, top + h * 0.6, cx - w * 0.1, top + h * 0.78, cx, top + h);
    p.curveTo(cx + w * 0.1, top + h * 0.78, x + w, top + h * 0.6, x + w, top + h * 0.3);
    p.curveTo(x + w, top, cx, top, cx, top + h * 0.28);
    p.close();
    return p;
  }

  const HEART = /(♥|❤️?|<3)/;
  // Kerning på, ligaturer av (opentype.js støtter ikke alle kontekst-ligaturer i skriftene)
  const GLYPH_OPTS = { kerning: true, features: { liga: false, rlig: false } };

  // Høyde på store bokstaver i em (fra skriftens metrikk)
  // Måles på bokstaven H, fordi skrivestiler ofte oppgir feil verdi (Great Vibes: 0,75 oppgitt, 0,98 faktisk).
  const capHeight = (font) => {
    if (!font._capH) {
      const b = font.getPath('H', 0, 0, 1, GLYPH_OPTS).getBoundingBox();
      font._capH = b.y2 - b.y1 || 0.7;
    }
    return font._capH;
  };

  // Én linje i skriftstørrelse 1 (enheter = em), baseline y = 0.
  function linePath(font, text) {
    const path = new opentype.Path();
    const parts = text.split(HEART).filter((s) => s !== '');
    const capH = capHeight(font);
    let x = 0;
    for (const part of parts) {
      if (HEART.test(part)) {
        const w = capH * 0.72;
        x += 0.06;
        path.extend(heartPath(x, -capH * 0.78, w));
        x += w + 0.06;
      } else {
        path.extend(font.getPath(part, x, 0, 1, GLYPH_OPTS));
        x += font.getAdvanceWidth(part, 1, GLYPH_OPTS);
      }
    }
    return path;
  }

  // ---------- Oppsett i feltet ----------
  // opts: { lines: [t1, t2], fonts: [k1, k2], ratio (linje 2 i forhold til linje 1),
  //         align: 'center'|'left'|'right', field: {w, h} (mm), margin (mm), gap (andel av h) }
  async function layout(opts) {
    const W = opts.field.w, H = opts.field.h;
    const margin = opts.margin != null ? opts.margin : 0.3;
    const lines = opts.lines.map((t) => (t || '').trim()).filter((t, i) => t || i === 0);
    const fonts = await Promise.all(lines.map((_, i) => loadFont(opts.fonts[i] || opts.fonts[0])));
    const raw = lines.map((t, i) => (t ? linePath(fonts[i], t) : null));
    const used = raw.map((p, i) => (p && p.commands.length ? { p, b: bbox(p), i } : null)).filter(Boolean);
    if (!used.length) return { paths: [], field: opts.field, sizes: [], empty: true };

    // Linje 2 sin størrelse er en andel av linje 1, målt i høyde på store bokstaver,
    // så «60 %» ser likt ut uansett hvilke skrifter som er valgt.
    const ratio = used.length > 1 ? (opts.ratio || 0.6) : 1;
    const cap0 = capHeight(fonts[used[0].i]);
    const scales = used.map((u, k) => (k === 0 ? 1 : ratio * cap0 / capHeight(fonts[u.i])));
    const gap = used.length > 1 ? H * (opts.gap != null ? opts.gap : 0.06) : 0;
    const iw = W - 2 * margin, ih = H - 2 * margin - gap;
    // Felles skala s (mm per em) som får alle linjer til å passe i bredde og høyde.
    let s = Infinity;
    for (let k = 0; k < used.length; k++) s = Math.min(s, iw / (used[k].b.w * scales[k]));
    const totalH = used.reduce((a, u, k) => a + u.b.h * scales[k], 0);
    s = Math.min(s, ih / totalH);
    if (opts.maxEm) s = Math.min(s, opts.maxEm);

    const blockH = used.reduce((a, u, k) => a + u.b.h * scales[k] * s, 0) + gap;
    let y = (H - blockH) / 2;
    const paths = [];
    const sizes = [];
    for (let k = 0; k < used.length; k++) {
      const u = used[k], sc = s * scales[k];
      const w = u.b.w * sc, h = u.b.h * sc;
      let x = (W - w) / 2;
      if (opts.align === 'left') x = margin;
      if (opts.align === 'right') x = W - margin - w;
      paths.push(transform(u.p, sc, x - u.b.x1 * sc, y - u.b.y1 * sc));
      sizes.push({ line: u.i + 1, heightMm: h, widthMm: w, fontMm: sc });
      y += h + gap;
    }
    return { paths, field: opts.field, sizes };
  }

  // Egen SVG-stiserialisering. opentype.js 2.0 sin toPathData() gir NaN når en kontur
  // starter med to like punkter (f.eks. B og O i Dancing Script), og da forkastes hele stien.
  function toD(path, dec = 3) {
    const f = (v) => { const r = +v.toFixed(dec); return Object.is(r, -0) ? '0' : String(r); };
    let d = '';
    for (const c of path.commands) {
      if (c.type === 'M' || c.type === 'L') d += c.type + f(c.x) + ' ' + f(c.y);
      else if (c.type === 'Q') d += 'Q' + f(c.x1) + ' ' + f(c.y1) + ' ' + f(c.x) + ' ' + f(c.y);
      else if (c.type === 'C') d += 'C' + f(c.x1) + ' ' + f(c.y1) + ' ' + f(c.x2) + ' ' + f(c.y2) + ' ' + f(c.x) + ' ' + f(c.y);
      else if (c.type === 'Z') d += 'Z';
    }
    return d;
  }
  const pathData = (paths, dec = 3) => paths.map((p) => toD(p, dec)).join(' ');

  // ---------- Eksport ----------
  // SVG i millimeter: LightBurn leser width/height i mm og plasserer i riktig størrelse.
  function toSVG(res, { frame = false } = {}) {
    const { w, h } = res.field;
    const d = pathData(res.paths, 4);
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}mm" height="${h}mm" viewBox="0 0 ${w} ${h}">
  <title>Gravering ${w} × ${h} mm</title>
${frame ? `  <rect x="0" y="0" width="${w}" height="${h}" fill="none" stroke="#ff0000" stroke-width="0.05"/>\n` : ''}  <path d="${d}" fill="#000000" fill-rule="nonzero"/>
</svg>
`;
  }

  // Tegn teksten på et canvas-kontekst (mm-koordinater skaleres med pxPerMm).
  function draw(ctx, res, pxPerMm, color = '#000') {
    ctx.save();
    ctx.scale(pxPerMm, pxPerMm);
    ctx.fillStyle = color;
    ctx.fill(new Path2D(pathData(res.paths, 3)));
    ctx.restore();
  }

  // PNG i ønsket DPI, svart tekst på hvit eller gjennomsiktig bakgrunn.
  async function toPNG(res, dpi = 600, { transparent = false } = {}) {
    const pxPerMm = dpi / 25.4;
    const c = document.createElement('canvas');
    c.width = Math.round(res.field.w * pxPerMm);
    c.height = Math.round(res.field.h * pxPerMm);
    const ctx = c.getContext('2d');
    if (!transparent) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); }
    draw(ctx, res, pxPerMm, '#000');
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    return window.Engrave && Engrave.pngWithDpi ? Engrave.pngWithDpi(blob, dpi) : blob;
  }

  // ---------- Realistisk forhåndsvisning på produktbildet ----------
  // Tegner produktbildet (img) og "brenner" teksten inn i feltet. `zoom` = nærbilde.
  function renderMock(canvas, img, product, res, { zoom = false, scale = 1, showField = false } = {}) {
    const z = zoom === 'tight' ? product.zoomTight : zoom ? product.zoom : { x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight };
    const k = scale;                                   // utgangspiksler per bildepiksel
    canvas.width = Math.round(z.w * k);
    canvas.height = Math.round(z.h * k);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, z.x, z.y, z.w, z.h, 0, 0, canvas.width, canvas.height);

    const m = product.mock, ppm = m.pxPerMm * k;
    const { w, h } = res.field;
    // Tekstmaske i eget lag
    const layer = document.createElement('canvas');
    layer.width = canvas.width; layer.height = canvas.height;
    const lc = layer.getContext('2d');
    lc.translate((m.cx - z.x) * k, (m.cy - z.y) * k);
    lc.rotate((m.angle * Math.PI) / 180);
    lc.translate(-w / 2 * ppm, -h / 2 * ppm);
    if (res.paths.length) {
      draw(lc, res, ppm, '#000');
      // Laseren brenner litt bredere enn streken (ca. 0,1 mm), så forhåndsvisningen gjør det også
      lc.save(); lc.scale(ppm, ppm); lc.lineWidth = 0.1; lc.lineJoin = 'round'; lc.strokeStyle = '#000';
      lc.stroke(new Path2D(pathData(res.paths, 3))); lc.restore();
    }

    // Brent tre: mørk brun i midten, litt mykere kant (laserens glorie)
    const [r, g, b] = product.burn;
    const tint = (alpha, blur) => {
      const t = document.createElement('canvas'); t.width = layer.width; t.height = layer.height;
      const tc = t.getContext('2d');
      tc.filter = `blur(${blur}px)`;
      tc.drawImage(layer, 0, 0);
      tc.filter = 'none';
      tc.globalCompositeOperation = 'source-in';
      tc.fillStyle = `rgba(${r},${g},${b},${alpha})`;
      tc.fillRect(0, 0, t.width, t.height);
      return t;
    };
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(tint(0.35, 1.2 * k), 0, 0);            // glorie
    ctx.restore();
    ctx.drawImage(tint(0.9, 0.35 * k), 0, 0);             // selve brenningen
    if (showField) {                                     // stiplet ramme som viser feltet
      ctx.save();
      ctx.translate((m.cx - z.x) * k, (m.cy - z.y) * k);
      ctx.rotate((m.angle * Math.PI) / 180);
      ctx.setLineDash([4, 3]); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,.85)';
      ctx.strokeRect(-w / 2 * ppm, -h / 2 * ppm, w * ppm, h * ppm);
      ctx.restore();
    }
  }

  // Produktbilde: innebygd (data-URL) i nettbutikken, ellers vanlig URL.
  function imageSrc(product, fallback) {
    const emb = window.TextEngraveEmbedded && window.TextEngraveEmbedded.images && window.TextEngraveEmbedded.images[product.image];
    return emb || fallback;
  }

  window.TextEngrave = { toD, pathData, FONTS, PRODUCTS, setFontUrls, loadFont, fontBuffer, imageSrc, layout, toSVG, toPNG, draw, renderMock };
})();
