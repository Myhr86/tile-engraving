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
