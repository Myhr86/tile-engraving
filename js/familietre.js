// Familietre: bunntekst (f.eks. «Oldemor») og opptil 16 navnehjerter.
// Gir realistisk forhåndsvisning på produktbildet (ubehandlet MDF eller lakkert)
// og et samlet SVG-ark i mm til LightBurn. Bygger på window.TextEngrave.
(function () {
  'use strict';
  const TE = window.TextEngrave;

  const PRODUCT = {
    label: 'Familietre',
    maxNames: 16,
    bottomField: { w: 190, h: 40 },     // mm, bunnteksten
    nameField: { w: 26, h: 7 },         // mm, navn på hjertet
    heart: { w: 35, h: 31 },            // mm, hjertet
    nameMaxEm: 6.5,                     // mm per em: maks skriftstørrelse for navn (like høye navn)
    variants: {
      mdf: {
        label: 'Ubehandlet MDF', image: 'familietre-mdf.jpg', pxPerMm: 1.47,
        bottom: { cx: 299, cy: 445, angle: 0 }, burn: [85, 59, 37],
        // [x, y] i bildet (beskåret), i rekkefølgen hjertene fylles
        slots: [[280, 58], [210, 65], [340, 68], [162, 107], [400, 103], [112, 142], [438, 165], [220, 153], [333, 150],
                [105, 207], [465, 230], [95, 270], [455, 298], [113, 332], [385, 215], [165, 190]],
      },
      lakk: {
        label: 'Lakkert', image: 'familietre-lakk.jpg', pxPerMm: 1.63,
        bottom: { cx: 310, cy: 500, angle: 0 }, burn: [66, 36, 19],
        slots: [[320, 82], [245, 90], [390, 95], [188, 123], [448, 142], [133, 160], [482, 210], [250, 180], [372, 180],
                [113, 228], [510, 278], [100, 298], [498, 344], [107, 367], [415, 250], [180, 250]],
      },
    },
    // Små, faste vinkler gir et naturlig, håndlaget uttrykk
    angles: [3, -6, 8, -10, 10, -8, 6, 4, -4, -12, 10, -6, 8, -10, 5, -5],
    nameBurn: [52, 38, 30],
  };

  const clean = (names) => (names || []).map((n) => (n || '').trim()).filter(Boolean).slice(0, PRODUCT.maxNames);

  // Oppsett av all tekst (mm). recipe: { bottom: {text, font}, names: [...], nameFont }
  async function layout(recipe) {
    const bottomText = (recipe.bottom && recipe.bottom.text || '').trim();
    const bottom = bottomText
      ? await TE.layout({ lines: [bottomText], fonts: [recipe.bottom.font || 'script'], field: PRODUCT.bottomField, margin: 1 })
      : { paths: [], field: PRODUCT.bottomField, sizes: [], empty: true };
    const names = await Promise.all(clean(recipe.names).map((n) =>
      TE.layout({ lines: [n.toUpperCase()], fonts: [recipe.nameFont || 'sans'], field: PRODUCT.nameField, margin: 0.4, maxEm: PRODUCT.nameMaxEm })));
    return { bottom, names };
  }

  // Hjerte i et koordinatsystem med sentrum i (0,0), bredde w, høyde h
  function heartD(w, h) {
    const x = -w / 2, top = -h / 2;
    const p = (fx, fy) => `${(x + fx * w).toFixed(3)} ${(top + fy * h).toFixed(3)}`;
    return `M${p(0.5, 0.28)} C${p(0.5, 0)} ${p(0, 0)} ${p(0, 0.3)} C${p(0, 0.62)} ${p(0.38, 0.8)} ${p(0.5, 1)} ` +
           `C${p(0.62, 0.8)} ${p(1, 0.62)} ${p(1, 0.3)} C${p(1, 0)} ${p(0.5, 0)} ${p(0.5, 0.28)} Z`;
  }

  // Tegn et ferdig tekstlag (mm) inn i ctx med brennfarge og laserens glorie
  function burnInto(ctx, w, h, drawFn, burn, k) {
    const layer = document.createElement('canvas'); layer.width = w; layer.height = h;
    drawFn(layer.getContext('2d'));
    const [r, g, b] = burn;
    const tint = (alpha, blur) => {
      const t = document.createElement('canvas'); t.width = w; t.height = h;
      const tc = t.getContext('2d'); tc.filter = `blur(${blur}px)`; tc.drawImage(layer, 0, 0); tc.filter = 'none';
      tc.globalCompositeOperation = 'source-in'; tc.fillStyle = `rgba(${r},${g},${b},${alpha})`; tc.fillRect(0, 0, w, h);
      return t;
    };
    ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(tint(0.3, 1.0 * k), 0, 0); ctx.restore();
    ctx.drawImage(tint(0.92, 0.3 * k), 0, 0);
  }

  const fillPaths = (ctx, res, ppm, extra = 0.1) => {
    ctx.save(); ctx.scale(ppm, ppm); const p = new Path2D(TE.pathData(res.paths, 3));
    ctx.fillStyle = '#000'; ctx.fill(p); ctx.lineWidth = extra; ctx.lineJoin = 'round'; ctx.strokeStyle = '#000'; ctx.stroke(p); ctx.restore();
  };

  // Forhåndsvisning på produktbildet
  function renderMock(canvas, img, variantKey, lay, { scale = 1 } = {}) {
    const v = PRODUCT.variants[variantKey] || PRODUCT.variants.mdf;
    const k = scale, W = Math.round(img.naturalWidth * k), H = Math.round(img.naturalHeight * k);
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, W, H);
    const ppm = v.pxPerMm * k;

    // Bunntekst brent inn i treverket
    if (!lay.bottom.empty) {
      const f = lay.bottom.field;
      burnInto(ctx, W, H, (lc) => {
        lc.translate(v.bottom.cx * k, v.bottom.cy * k); lc.rotate(v.bottom.angle * Math.PI / 180);
        lc.translate(-f.w / 2 * ppm, -f.h / 2 * ppm); fillPaths(lc, lay.bottom, ppm, 0.25);
      }, v.burn, k);
    }

    // Hjertene: hvitt tre med skygge og brent kant, navnet gravert
    const hw = PRODUCT.heart.w * ppm, hh = PRODUCT.heart.h * ppm;
    const heart = new Path2D(heartD(hw, hh));
    lay.names.forEach((res, i) => {
      const [sx, sy] = v.slots[i], a = PRODUCT.angles[i] * Math.PI / 180;
      ctx.save();
      ctx.translate(sx * k, sy * k); ctx.rotate(a);
      ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 4 * k; ctx.shadowOffsetX = 1.5 * k; ctx.shadowOffsetY = 2.5 * k;
      ctx.fillStyle = '#f3f1ec'; ctx.fill(heart);
      ctx.shadowColor = 'transparent';
      const grad = ctx.createLinearGradient(0, -hh / 2, 0, hh / 2);
      grad.addColorStop(0, 'rgba(255,255,255,.35)'); grad.addColorStop(1, 'rgba(0,0,0,.06)');
      ctx.fillStyle = grad; ctx.fill(heart);
      ctx.lineWidth = Math.max(1, 0.6 * k); ctx.strokeStyle = 'rgba(70,50,35,.85)'; ctx.stroke(heart);   // brent snittkant
      ctx.restore();
    });
    burnInto(ctx, W, H, (lc) => {
      lay.names.forEach((res, i) => {
        const [sx, sy] = v.slots[i], a = PRODUCT.angles[i] * Math.PI / 180, f = res.field;
        lc.save(); lc.translate(sx * k, sy * k); lc.rotate(a);
        lc.translate(-f.w / 2 * ppm, (-f.h / 2 - PRODUCT.heart.h * 0.04) * ppm);
        fillPaths(lc, res, ppm, 0.08); lc.restore();
      });
    }, PRODUCT.nameBurn, k);
  }

  // Samlet SVG-ark (mm): bunnteksten øverst, navnehjertene under i rader på 5.
  // Rød hårstrek = hjerteomriss/felt for plassering (kan skrus av i LightBurn).
  function sheet(lay, { outlines = true } = {}) {
    const m = 5, gap = 3, cols = 5, B = PRODUCT.bottomField, Hh = PRODUCT.heart, F = PRODUCT.nameField;
    const rows = Math.ceil(lay.names.length / cols);
    const width = Math.max(B.w, cols * Hh.w + (cols - 1) * gap) + 2 * m;
    const namesTop = m + B.h + 8;
    const height = namesTop + rows * (Hh.h + gap) - (rows ? gap : 0) + m;
    const items = [];
    const bx = (width - B.w) / 2;
    items.push({ res: lay.bottom, x: bx, y: m, outline: `<rect x="${bx}" y="${m}" width="${B.w}" height="${B.h}" fill="none" stroke="#ff0000" stroke-width="0.1"/>`, label: 'Bunntekst' });
    const gridW = cols * Hh.w + (cols - 1) * gap, gx = (width - gridW) / 2;
    lay.names.forEach((res, i) => {
      const cx = gx + (i % cols) * (Hh.w + gap) + Hh.w / 2, cy = namesTop + Math.floor(i / cols) * (Hh.h + gap) + Hh.h / 2;
      items.push({ res, x: cx - F.w / 2, y: cy - F.h / 2 - Hh.h * 0.04,
        outline: `<path transform="translate(${cx.toFixed(3)} ${cy.toFixed(3)})" d="${heartD(Hh.w, Hh.h)}" fill="none" stroke="#ff0000" stroke-width="0.1"/>`, label: `Hjerte ${i + 1}` });
    });
    return { width, height, items, outlines };
  }

  function toSVG(lay, opts = {}) {
    const s = sheet(lay, opts);
    const groups = s.items.map((it) => {
      const d = TE.pathData(it.res.paths, 4);
      return `  <g id="${it.label.replace(/\s+/g, '-').toLowerCase()}">\n` +
        (s.outlines ? `    ${it.outline}\n` : '') +
        (d ? `    <path transform="translate(${it.x.toFixed(3)} ${it.y.toFixed(3)})" d="${d}" fill="#000000"/>\n` : '') + '  </g>';
    }).join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${s.width.toFixed(2)}mm" height="${s.height.toFixed(2)}mm" viewBox="0 0 ${s.width.toFixed(3)} ${s.height.toFixed(3)}">
  <title>Familietre: bunntekst ${PRODUCT.bottomField.w} × ${PRODUCT.bottomField.h} mm og ${lay.names.length} navnehjerter</title>
${groups}
</svg>
`;
  }

  // Tegn arket på et canvas (forhåndsvisning av graveringsfilen)
  function drawSheet(canvas, lay, ppm = 4, opts = {}) {
    const s = sheet(lay, opts);
    canvas.width = Math.round(s.width * ppm); canvas.height = Math.round(s.height * ppm);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (const it of s.items) {
      ctx.save(); ctx.scale(ppm, ppm);
      if (s.outlines) {
        const tmp = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); tmp.innerHTML = it.outline;
        const el = tmp.firstChild, tr = el.getAttribute('transform');
        ctx.save();
        if (tr) { const [tx, ty] = tr.match(/[-\d.]+/g).map(Number); ctx.translate(tx, ty); }
        ctx.strokeStyle = '#e33'; ctx.lineWidth = 0.25;
        if (el.tagName === 'rect') ctx.strokeRect(+el.getAttribute('x'), +el.getAttribute('y'), +el.getAttribute('width'), +el.getAttribute('height'));
        else ctx.stroke(new Path2D(el.getAttribute('d')));
        ctx.restore();
      }
      ctx.translate(it.x, it.y);
      if (it.res.paths.length) { ctx.fillStyle = '#000'; ctx.fill(new Path2D(TE.pathData(it.res.paths, 3))); }
      ctx.restore();
    }
    return s;
  }

  async function toPNG(lay, dpi = 600, opts = {}) {
    const c = document.createElement('canvas');
    drawSheet(c, lay, dpi / 25.4, opts);
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    return window.Engrave && Engrave.pngWithDpi ? Engrave.pngWithDpi(blob, dpi) : blob;
  }

  window.FamilyTree = { PRODUCT, layout, renderMock, toSVG, toPNG, drawSheet, clean };
})();
