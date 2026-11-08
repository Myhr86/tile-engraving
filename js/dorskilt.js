// Dørskilt i akryl (146 × 96 mm): topptekst, motiv i midten og navn nederst.
// Motivene er tegnet som vektorer (mm) i samme stil som skiltene: hvite, enkle
// silhuetter. Gir forhåndsvisning (sort akryl, hvit gravering, stålholdere) og
// SVG av hele skiltet til LightBurn. Bygger på window.TextEngrave.
(function () {
  'use strict';
  const TE = window.TextEngrave;

  const SIGN = {
    label: 'Dørskilt i akryl',
    w: 146, h: 96, r: 3,
    holes: [[8, 8], [138, 8], [8, 88], [138, 88]], holeR: 2.5, capR: 6.5,
    fields: {
      top1:  { cx: 73, cy: 18.5, w: 112, h: 16 },
      top2:  { cx: 73, cy: 35,   w: 104, h: 9 },
      motif: { cx: 73, cy: 52.5, w: 104, h: 20 },
      names: { cx: 73, cy: 76,   w: 112, h: 19 },
    },
  };

  // ---------- Små tegnehjelpere (mm, y nedover). Positive former med klokka,
  // hull mot klokka, så de fungerer med vanlig «nonzero»-fyll i SVG og LightBurn.
  const f = (v) => (+v.toFixed(3)).toString();
  function area(pts) { let a = 0; for (let i = 0; i < pts.length; i++) { const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length]; a += x1 * y2 - x2 * y1; } return a / 2; }
  function poly(pts, hole = false) {
    const cw = area(pts) > 0;              // med y nedover betyr positivt areal «med klokka»
    if (cw === hole) pts = pts.slice().reverse();
    return 'M' + pts.map(([x, y]) => f(x) + ' ' + f(y)).join(' L') + ' Z';
  }
  function circle(cx, cy, r, hole = false, n = 20) {
    const pts = []; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
    return poly(pts, hole);
  }
  // Kurve samplet til polygon (enklere å orientere riktig)
  function quad(p0, p1, p2, n = 10) { const out = []; for (let i = 1; i <= n; i++) { const t = i / n, u = 1 - t; out.push([u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]]); } return out; }
  // Avsmalnende strek (som en penselstrek): tykkest på midten
  function taper(x1, x2, y, t) { return poly([[x1, y], [(x1 + x2) / 2, y - t / 2], [x2, y], [(x1 + x2) / 2, y + t / 2]]); }
  function star(cx, cy, r) { return poly([[cx, cy - r], [cx + r * 0.22, cy - r * 0.22], [cx + r, cy], [cx + r * 0.22, cy + r * 0.22], [cx, cy + r], [cx - r * 0.22, cy + r * 0.22], [cx - r, cy], [cx - r * 0.22, cy - r * 0.22]]); }
  function pine(x, base, h) {
    const w = h * 0.5, parts = [];
    parts.push(poly([[x - h * 0.035, base], [x + h * 0.035, base], [x + h * 0.035, base - h * 0.14], [x - h * 0.035, base - h * 0.14]]));
    const tiers = 4;
    for (let i = 0; i < tiers; i++) {
      const tb = base - h * 0.1 - i * h * 0.2, tw = w * (1 - i * 0.2), tt = tb - h * 0.34;
      parts.push(poly([[x - tw / 2, tb], [x + tw / 2, tb], [x, Math.max(tt, base - h)]]));
    }
    return parts.join(' ');
  }
  function bird(x, y, s) {
    const l = [[x - 2.4 * s, y - 0.6 * s], ...quad([x - 2.4 * s, y - 0.6 * s], [x - 1.2 * s, y - 1.2 * s], [x, y], 6), ...quad([x, y], [x + 1.3 * s, y - 1.5 * s], [x + 2.8 * s, y - 1.1 * s], 6),
      ...quad([x + 2.8 * s, y - 1.1 * s], [x + 1.3 * s, y - 0.9 * s], [x, y + 0.45 * s], 6), ...quad([x, y + 0.45 * s], [x - 1.2 * s, y - 0.6 * s], [x - 2.4 * s, y - 0.6 * s], 6)];
    return poly(l);
  }
  function cubic(p0, p1, p2, p3, n = 12) { const o = []; for (let i = 1; i <= n; i++) { const t = i / n, u = 1 - t; o.push([u*u*u*p0[0] + 3*u*u*t*p1[0] + 3*u*t*t*p2[0] + t*t*t*p3[0], u*u*u*p0[1] + 3*u*u*t*p1[1] + 3*u*t*t*p2[1] + t*t*t*p3[1]]); } return o; }
  function heart(cx, cy, w) {
    const h = w * 0.9, x = cx - w / 2, t = cy - h / 2, P = (fx, fy) => [x + fx * w, t + fy * h];
    const pts = [P(0.5, 0.28), ...cubic(P(0.5, 0.28), P(0.5, 0), P(0, 0), P(0, 0.3)), ...cubic(P(0, 0.3), P(0, 0.62), P(0.38, 0.8), P(0.5, 1)),
      ...cubic(P(0.5, 1), P(0.62, 0.8), P(1, 0.62), P(1, 0.3)), ...cubic(P(1, 0.3), P(1, 0), P(0.5, 0), P(0.5, 0.28))];
    return poly(pts);
  }
  // Halvmåne: del av sirkel A som ligger utenfor sirkel B
  function crescent(cx, cy, r, ox, oy, r2) {
    const pts = [], n = 60, inB = (x, y) => (x - ox) ** 2 + (y - oy) ** 2 < r2 * r2;
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, x = cx + r * Math.cos(a), y = cy + r * Math.sin(a); if (!inB(x, y)) pts.push([x, y, a]); }
    // start ved et punkt rett etter et hopp, så buen blir sammenhengende
    let k = 0; for (let i = 1; i < pts.length; i++) if (pts[i][2] - pts[i - 1][2] > (Math.PI * 2) / n * 1.5) k = i;
    const outer = pts.slice(k).concat(pts.slice(0, k)).map(([x, y]) => [x, y]);
    const [sx, sy] = outer[0], [ex, ey] = outer[outer.length - 1];
    const a0 = Math.atan2(ey - oy, ex - ox), a1 = Math.atan2(sy - oy, sx - ox);
    let da = a1 - a0; while (da > 0) da -= Math.PI * 2;          // indre bue (sirkel B) tilbake
    const inner = []; for (let i = 1; i < 30; i++) { const a = a0 + da * (i / 30); inner.push([ox + r2 * Math.cos(a), oy + r2 * Math.sin(a)]); }
    return poly(outer.concat(inner));
  }
  const dots = (x1, x2, y, r = 0.32, step = 1.7) => { const o = []; for (let x = x1; x <= x2 + 0.01; x += step) o.push(circle(x, y, r, false, 10)); return o.join(' '); };
  function waves(x1, x2, y, amp, len, t) {
    const top = [], bot = [];
    for (let x = x1; x <= x2 + 0.01; x += 0.5) {
      const k = (x - x1) / (x2 - x1), w = t * Math.sin(Math.PI * k);          // tynnere i endene
      const yy = y + amp * Math.sin((x - x1) / len * Math.PI * 2);
      top.push([x, yy - w / 2]); bot.push([x, yy + w / 2]);
    }
    return poly(top.concat(bot.reverse()));
  }

  // ---------- Motivene (boks 104 × 20 mm, origo øverst til venstre) ----------
  const MOTIFS = {
    fjell: { label: 'Fjell', build() {
      const g = 17.2, p = [];
      // fjellet med en mørk rygglinje (hull)
      const m = [[10, g], ...quad([10, g], [22, 13], [28, 9], 8), [33, 4.2], [35, 3.4], ...quad([35, 3.4], [40, 7.5], [47, 11], 8), ...quad([47, 11], [54, 14.5], [62, g], 8)];
      p.push(poly(m));
      p.push(poly([[34.6, 4.6], [32.5, 7.6], [30.2, 10.6], [27.6, 13.3], [25.2, 15.4], [26.0, 15.5], [28.4, 13.5], [31.0, 10.9], [33.3, 8.0], [35.1, 5.2]], true));
      p.push(taper(4, 100, g + 0.15, 0.7));
      p.push(pine(70, g, 15.5));
      p.push(poly([[75.5, g], [76.2, 15.8], [76.6, g], [77.2, 15.4], [77.7, g]]));     // gresstust
      p.push(bird(88, 6.5, 1.15));
      p.push(star(15, 6, 1.1), star(19.5, 9.5, 0.6), star(95, 11.5, 0.9));
      p.push(dots(6, 98, 19.6));
      return p.join(' ');
    } },
    hjerte: { label: 'Hjerte', build() {
      return [taper(14, 46, 10.6, 0.9), taper(58, 90, 10.6, 0.9), heart(52, 10.4, 6.6)].join(' ');
    } },
    hytte: { label: 'Hytte', build() {
      const g = 17.2, p = [];
      p.push(taper(8, 96, g + 0.15, 0.7));
      // hytta: vegg med dør og vinduer som hull, tak med utstikk og pipe
      p.push(poly([[43, g], [61, g], [61, 9.6], [43, 9.6]]));
      p.push(poly([[50.7, g - 0.01], [53.3, g - 0.01], [53.3, 12.4], [50.7, 12.4]], true));
      p.push(poly([[45.2, 14.6], [48.6, 14.6], [48.6, 11.6], [45.2, 11.6]], true));
      p.push(poly([[55.4, 14.6], [58.8, 14.6], [58.8, 11.6], [55.4, 11.6]], true));
      p.push(poly([[40.5, 10.2], [63.5, 10.2], [52, 3.2]]));
      p.push(poly([[56.5, 6.8], [58.4, 6.8], [58.4, 3.6], [56.5, 3.6]]));
      p.push(pine(33, g, 12.5), pine(27, g, 9), pine(71, g, 14.5), pine(78, g, 10));
      p.push(circle(63.5, 2.3, 0.55), circle(64.6, 1.1, 0.4));                      // røyk
      p.push(star(16, 6, 1.0), star(88, 5, 1.1), star(93, 9.5, 0.6));
      return p.join(' ');
    } },
    skog: { label: 'Skog', build() {
      const g = 17.2, p = [taper(8, 96, g + 0.15, 0.7)];
      for (const [x, h] of [[24, 9], [31, 13], [38, 10.5], [46, 15.5], [54, 12], [61, 14], [69, 10], [76, 12.5], [83, 8.5]]) p.push(pine(x, g, h));
      // halvmåne (sirkel minus forskjøvet sirkel) og stjerner
      p.push(crescent(92, 4.6, 2.4, 93.2, 3.8, 2.0));
      p.push(star(14, 5, 1.0), star(18.5, 9, 0.6), star(86, 9, 0.6));
      return p.join(' ');
    } },
    fyr: { label: 'Fyrlykt', build() {
      const p = [];
      // tårn (trapes) med to mørke striper, lanterne, tak og lysstråler
      p.push(poly([[48.2, 16.4], [55.8, 16.4], [54.4, 6.2], [49.6, 6.2]]));
      p.push(poly([[48.65, 13.0], [55.35, 13.0], [55.15, 11.6], [48.85, 11.6]], true));
      p.push(poly([[49.1, 9.6], [54.9, 9.6], [54.75, 8.4], [49.25, 8.4]], true));
      p.push(poly([[49.0, 5.9], [55.0, 5.9], [55.0, 5.2], [49.0, 5.2]]));
      p.push(poly([[49.8, 5.0], [54.2, 5.0], [54.2, 3.3], [49.8, 3.3]]));
      p.push(poly([[50.6, 4.6], [53.4, 4.6], [53.4, 3.7], [50.6, 3.7]], true));
      p.push(poly([[49.2, 3.2], [54.8, 3.2], [52, 1.2]]));
      p.push(poly([[55.6, 3.6], [72, 1.2], [72, 6.2]]), poly([[48.4, 3.6], [32, 1.2], [32, 6.2]]));
      p.push(poly([[45, 16.9], [59, 16.9], [57.5, 15.9], [46.5, 15.9]]));               // klippe
      p.push(waves(10, 94, 17.7, 0.45, 6, 0.8));
      p.push(bird(80, 7, 0.9), bird(86.5, 10, 0.7));
      return p.join(' ');
    } },
    ingen: { label: 'Uten motiv', build: () => '' },
  };
  const motifCache = {};
  const motifD = (key) => (motifCache[key] = motifCache[key] || (MOTIFS[key] || MOTIFS.ingen).build());

  // ---------- Oppsett ----------
  // recipe: { top1: {text, font}, top2, motif, names: [l1, l2] }
  async function layout(r) {
    const F = SIGN.fields;
    const one = async (text, font, field, extra = {}) => (text ? TE.layout({ lines: [text], fonts: [font], field, margin: 0.3, ...extra }) : null);
    const top1 = await one((r.top1 && r.top1.text || '').trim(), (r.top1 && r.top1.font) || 'dancing', F.top1);
    const top2 = await one((r.top2 || '').trim().toUpperCase(), 'serif', F.top2);
    const nl = (r.names || []).map((n) => (n || '').trim().toUpperCase());
    const names = nl.some(Boolean) ? await TE.layout({ lines: nl, fonts: ['serif', 'serif'], ratio: 1, gap: 0.16, field: F.names, margin: 0.3 }) : null;
    return { top1, top2, names, motif: r.motif || 'fjell' };
  }

  // Alle graverte former i skiltets koordinater (mm): [{d, label}]
  function shapes(lay) {
    const F = SIGN.fields, out = [];
    const place = (res, fld, label) => {
      if (!res || !res.paths.length) return;
      const x0 = fld.cx - fld.w / 2, y0 = fld.cy - fld.h / 2;
      out.push({ label, d: TE.pathData(res.paths, 4), x: x0, y: y0 });
    };
    place(lay.top1, F.top1, 'topptekst');
    place(lay.top2, F.top2, 'undertekst');
    const md = motifD(lay.motif);
    if (md) out.push({ label: 'motiv', d: md, x: F.motif.cx - F.motif.w / 2, y: F.motif.cy - F.motif.h / 2 });
    place(lay.names, F.names, 'navn');
    return out;
  }

  // ---------- Forhåndsvisning ----------
  function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  function render(canvas, lay, { ppm = 5, pad = 10 } = {}) {
    const W = Math.round((SIGN.w + pad * 2) * ppm), H = Math.round((SIGN.h + pad * 2) * ppm);
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ebe9e5'; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.translate(pad * ppm, pad * ppm); ctx.scale(ppm, ppm);
    // plate med skygge
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 3 * ppm; ctx.shadowOffsetX = 0.8 * ppm; ctx.shadowOffsetY = 1.4 * ppm;
    roundRect(ctx, 0, 0, SIGN.w, SIGN.h, SIGN.r); ctx.fillStyle = '#111'; ctx.fill(); ctx.restore();
    const gl = ctx.createLinearGradient(0, 0, SIGN.w, SIGN.h);
    gl.addColorStop(0, 'rgba(255,255,255,.07)'); gl.addColorStop(0.5, 'rgba(255,255,255,0)'); gl.addColorStop(1, 'rgba(255,255,255,.03)');
    roundRect(ctx, 0, 0, SIGN.w, SIGN.h, SIGN.r); ctx.fillStyle = gl; ctx.fill();
    // gravering: hvit/sølvgrå, svakt matt
    ctx.fillStyle = '#e9e9e6';
    for (const s of shapes(lay)) { ctx.save(); ctx.translate(s.x, s.y); ctx.fill(new Path2D(s.d)); ctx.restore(); }
    // stålholdere
    for (const [x, y] of SIGN.holes) {
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 1.2 * ppm; ctx.shadowOffsetX = 0.4 * ppm; ctx.shadowOffsetY = 0.6 * ppm;
      const g = ctx.createRadialGradient(x - 1.8, y - 1.8, 0.5, x, y, SIGN.capR);
      g.addColorStop(0, '#f4f4f4'); g.addColorStop(0.55, '#b9bbbd'); g.addColorStop(1, '#7c7f82');
      ctx.beginPath(); ctx.arc(x, y, SIGN.capR / 2, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill(); ctx.restore();
      ctx.beginPath(); ctx.arc(x, y, SIGN.capR / 2 - 0.4, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 0.2; ctx.stroke();
    }
    ctx.restore();
  }

  // ---------- SVG til LightBurn: hele skiltet i mm ----------
  function toSVG(lay, { outline = true } = {}) {
    const { w, h, r } = SIGN;
    const parts = shapes(lay).map((s) => `  <path id="${s.label}" transform="translate(${f(s.x)} ${f(s.y)})" d="${s.d}" fill="#000000"/>`).join('\n');
    const ref = outline ? `  <g id="plate" fill="none" stroke="#ff0000" stroke-width="0.1">
    <rect x="0" y="0" width="${w}" height="${h}" rx="${r}" ry="${r}"/>
${SIGN.holes.map(([x, y]) => `    <circle cx="${x}" cy="${y}" r="${SIGN.holeR}"/>`).join('\n')}
  </g>\n` : '';
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}mm" height="${h}mm" viewBox="0 0 ${w} ${h}">
  <title>Dørskilt ${w} × ${h} mm</title>
${ref}${parts}
</svg>
`;
  }

  async function toPNG(lay, dpi = 600) {
    const ppm = dpi / 25.4, c = document.createElement('canvas');
    c.width = Math.round(SIGN.w * ppm); c.height = Math.round(SIGN.h * ppm);
    const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.scale(ppm, ppm); ctx.fillStyle = '#000';
    for (const s of shapes(lay)) { ctx.save(); ctx.translate(s.x, s.y); ctx.fill(new Path2D(s.d)); ctx.restore(); }
    const blob = await new Promise((res) => c.toBlob(res, 'image/png'));
    return window.Engrave && Engrave.pngWithDpi ? Engrave.pngWithDpi(blob, dpi) : blob;
  }

  // Lite ikon av et motiv (SVG-markup) til valgknappene
  function motifIcon(key) {
    const d = motifD(key), F = SIGN.fields.motif;
    if (!d) return '';
    return `<svg viewBox="0 0 ${F.w} ${F.h}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="${d}" fill="currentColor"/></svg>`;
  }

  window.DoorSign = { SIGN, MOTIFS, layout, render, toSVG, toPNG, motifIcon };
})();
