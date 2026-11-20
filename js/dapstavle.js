// Dåpstavle i tre: «Velkommen til verden»-banner, navn, fødselsdato (med ukedag),
// klokkeslett med urskive, tekstboks («Lille skatten»), vekt og lengde.
// Alt tegnes som vektorer i mm, etter tavlen på produktbildet. Gir forhåndsvisning
// (beiset tre med lys gravering) og SVG av hele tavlen til LightBurn.
// Bygger på window.TextEngrave.
(function () {
  'use strict';
  const TE = window.TextEngrave;

  // Skriftene på tavlen: slab-serif til navnet og smal, fet skrift til resten.
  TE.FONTS.slab = TE.FONTS.slab || { label: 'Slab', file: 'roboto-slab-latin-700-normal.woff', hidden: true };
  TE.FONTS.cond = TE.FONTS.cond || { label: 'Smal', file: 'roboto-condensed-latin-700-normal.woff', hidden: true };

  // Tavlen er 130 × 170 mm. Oppsettet er tegnet i et designrom på 200 × 230 (målt fra
  // produktbildet) og skaleres likt i begge retninger (S). Den ekstra høyden fordeles ved
  // at hver rad flyttes etter sitt ankerpunkt (K), så skriften aldri strekkes.
  const PLATE = { label: 'Dåpstavle', w: 130, h: 170, r: 3 };
  const DESIGN = { w: 200, h: 230 };
  const S = PLATE.w / DESIGN.w, K = PLATE.h / DESIGN.h;
  const ROW = { banner: 25, 'banner-haler': 25, navn: 61, kvister: 61,
    datoboks: 124, født: 124, ukedag: 124, dag: 124, måned: 124, år: 124, klokkeslett: 124, klokke: 124, tekstboks: 124,
    'vekt-tittel': 182, vekt: 182, 'vekt-ikon': 182, 'lengde-tittel': 182, lengde: 182, målebånd: 182 };
  // Hvert element: designkoordinater -> tavlens mm: x' = S·x, y' = S·y + (K − S)·anker
  const placeOf = (s) => ({ ty: (K - S) * (ROW[s.label] != null ? ROW[s.label] : DESIGN.h / 2), s: S });
  const WEEKDAYS = ['SØNDAG', 'MANDAG', 'TIRSDAG', 'ONSDAG', 'TORSDAG', 'FREDAG', 'LØRDAG'];
  const EXAMPLE = { banner: 'Velkommen til verden', name: 'Peder', date: '2024-04-26', time: '09:15', weight: '3450', length: '49', box: 'Lille skatten' };

  // ---------- Tegnehjelpere (mm, y nedover). Former med klokka, hull mot klokka ----------
  const f = (v) => { const r = +v.toFixed(3); return Object.is(r, -0) ? '0' : String(r); };
  const area = (pts) => { let a = 0; for (let i = 0; i < pts.length; i++) { const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length]; a += x1 * y2 - x2 * y1; } return a / 2; };
  function poly(pts, hole = false) {
    if ((area(pts) > 0) === hole) pts = pts.slice().reverse();
    return 'M' + pts.map(([x, y]) => f(x) + ' ' + f(y)).join(' L') + ' Z';
  }
  const arcPts = (cx, cy, rx, ry, a0, a1, n) => { const o = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * (i / n); o.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]); } return o; };
  const circle = (cx, cy, r, hole = false) => poly(arcPts(cx, cy, r, r, 0, Math.PI * 2 * (1 - 1 / 48), 47), hole);
  const ring = (cx, cy, r, t) => circle(cx, cy, r) + ' ' + circle(cx, cy, r - t, true);
  function rrectPts(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    const q = Math.PI / 2, n = 6;
    return [...arcPts(x + w - r, y + r, r, r, -q, 0, n), ...arcPts(x + w - r, y + h - r, r, r, 0, q, n),
      ...arcPts(x + r, y + h - r, r, r, q, 2 * q, n), ...arcPts(x + r, y + r, r, r, 2 * q, 3 * q, n)];
  }
  const rrect = (x, y, w, h, r, hole = false) => poly(rrectPts(x, y, w, h, r), hole);
  const rrectRing = (x, y, w, h, r, t) => rrect(x, y, w, h, r) + ' ' + rrect(x + t, y + t, w - 2 * t, h - 2 * t, Math.max(0.2, r - t), true);
  // Rett strek med runde ender
  function seg(x1, y1, x2, y2, t, hole = false) {
    const a = Math.atan2(y2 - y1, x2 - x1), r = t / 2;
    return poly([...arcPts(x2, y2, r, r, a - Math.PI / 2, a + Math.PI / 2, 6), ...arcPts(x1, y1, r, r, a + Math.PI / 2, a + Math.PI * 1.5, 6)], hole);
  }
  // Blad (spiss i begge ender) fra (x1,y1) til (x2,y2), bredde w
  function leaf(x1, y1, x2, y2, w) {
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L, pts = [];
    for (let i = 0; i <= 10; i++) { const t = i / 10, s = Math.sin(Math.PI * t) * w / 2; pts.push([x1 + dx * t + nx * s, y1 + dy * t + ny * s]); }
    for (let i = 9; i >= 1; i--) { const t = i / 10, s = Math.sin(Math.PI * t) * w / 2; pts.push([x1 + dx * t - nx * s, y1 + dy * t - ny * s]); }
    return poly(pts);
  }
  // Kvist med to blader, peker utover (dir = -1 venstre, 1 høyre)
  function sprig(x, y, dir) {
    const L = 15, e = x + dir * L, p = [seg(x, y, e, y + 0.6, 1.1)];
    p.push(leaf(x + dir * 5.5, y + 0.2, x + dir * 10, y - 3.4, 2.6), leaf(x + dir * 9, y + 0.4, x + dir * 13.5, y + 3.6, 2.6));
    p.push(leaf(x + dir * 2, y + 0.1, x + dir * 6, y + 3.2, 2.2));
    return p.join(' ');
  }

  // ---------- Banner (bue) ----------
  const BANNER = { cx: 100, cy: 20, R: 215, t: 14, half: 72 };
  const warp = (x, y) => {           // x: avstand langs buen fra midten, y: avstand under midtlinjen
    const B = BANNER, th = x / B.R, r = B.R - y;
    return [B.cx + r * Math.sin(th), B.cy + B.R - r * Math.cos(th)];
  };
  function bannerShape() {
    const B = BANNER, th = B.half / B.R, n = 40, top = [], bot = [];
    for (let i = 0; i <= n; i++) { const a = -th + 2 * th * (i / n); top.push(warp(a * B.R, -B.t / 2)); bot.push(warp(a * B.R, B.t / 2)); }
    return poly(top.concat(bot.reverse()));
  }
  // Haler bak bannerendene, med svalehale-utsnitt
  function bannerTails() {
    const B = BANNER, out = [];
    for (const dir of [-1, 1]) {
      const th = dir * B.half / B.R, ux = Math.cos(th) * dir, uy = Math.sin(th) * dir;   // utover langs buen
      const vx = -Math.sin(th), vy = Math.cos(th);                                            // nedover (normal)
      const [ex, ey] = warp(dir * B.half, 0);
      const P = (u, v) => [ex + ux * u + vx * v, ey + uy * u + vy * v];
      out.push(poly([P(-9, B.t / 2 + 0.9), P(13, B.t / 2 + 0.9), P(9, B.t / 2 + 7), P(13, B.t / 2 + 13.1), P(-3, B.t / 2 + 13.1)]));
      // fold: liten trekant som binder halen til banneret
      out.push(poly([P(-9, B.t / 2 + 0.9), P(-3, B.t / 2 + 0.9), P(-3, B.t / 2 + 13.1)]));
    }
    return out.join(' ');
  }
  function warpPath(path, x0, y0) {   // tekststi (mm i feltet) -> buet, i tavlens koordinater
    const out = new opentype.Path();
    for (const c of path.commands) {
      const n = { type: c.type };
      for (const [kx, ky] of [['x', 'y'], ['x1', 'y1'], ['x2', 'y2']]) {
        if (kx in c) { const [X, Y] = warp(c[kx] + x0, c[ky] + y0); n[kx] = X; n[ky] = Y; }
      }
      out.commands.push(n);
    }
    return out;
  }

  function shiftPath(path, dx, dy) {
    const out = new opentype.Path();
    for (const c of path.commands) {
      const n = { type: c.type };
      for (const k of ['x', 'x1', 'x2']) if (k in c) n[k] = c[k] + dx;
      for (const k of ['y', 'y1', 'y2']) if (k in c) n[k] = c[k] + dy;
      out.commands.push(n);
    }
    return out;
  }

  // ---------- Kjøkkenvekt og målebånd ----------
  function scaleIcon() {
    const p = [], cx = 158, T = 1.3;
    // skål (halv ellipse, kontur)
    const bowl = (rx, ry, dy) => [[cx - rx, 177 + dy], [cx + rx, 177 + dy], ...arcPts(cx, 177 + dy, rx, ry, 0, Math.PI, 24).slice(1)];
    p.push(poly(bowl(20, 12, 0)), poly([[cx - 18.4, 178.3], [cx + 18.4, 178.3], ...arcPts(cx, 178.3, 18.4, 9.6, 0, Math.PI, 24).slice(1)], true));
    p.push(rrect(cx - 2.6, 188.5, 5.2, 4.2, 0.6));                                   // fot under skålen
    // kropp (trapes, kontur)
    const body = (inset) => [[143 + inset, 192.5 + inset], [173 - inset, 192.5 + inset], [178.5 - inset * 1.1, 217.5 - inset], [137.5 + inset * 1.1, 217.5 - inset]];
    p.push(poly(body(0)), poly(body(T), true));
    // skive med streker og viser
    p.push(ring(cx, 205.5, 8, 1.2));
    for (let i = 0; i < 9; i++) { const a = Math.PI * (1.15 + 0.7 * i / 8); p.push(seg(cx + 5.2 * Math.cos(a), 205.5 + 5.2 * Math.sin(a), cx + 6.3 * Math.cos(a), 205.5 + 6.3 * Math.sin(a), 0.6)); }
    p.push(seg(cx, 205.5, cx + 3.6, 201.4, 1), circle(cx, 205.5, 1.2));
    p.push(rrect(136, 218.4, 44, 3.4, 1.2));                                          // sokkel
    // bevegelsesstreker til venstre
    p.push(seg(128.5, 191.5, 133, 193, 1), seg(127.5, 197, 132.5, 197, 1), seg(128.5, 202.5, 133, 201, 1));
    return p.join(' ');
  }
  function tapeIcon() {
    const p = [], x = 30, y = 213.5, w = 84, h = 8.2;
    p.push(rrectRing(x, y, w, h, 1.4, 1.1));
    for (let i = 1; x + i * 4 < x + w - 2; i++) { const xx = x + i * 4, long = i % 2 === 0; p.push(seg(xx, y + 1, xx, y + (long ? 4.2 : 2.8), 0.6)); }
    p.push(ring(119.2, y + h / 2, 5.6, 1.1), ring(119.2, y + h / 2, 2.9, 0.9), circle(119.2, y + h / 2, 0.9));
    return p.join(' ');
  }

  // ---------- Klokke ----------
  // Fylt, lys urskive med mørke streker og visere (hull). Hullene overlapper ikke
  // hverandre, så fyllet blir riktig både i SVG og LightBurn.
  function clock(time) {
    const cx = 100.5, cy = 114, R = 15, p = [circle(cx, cy, R)];
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2, big = i % 3 === 0, r1 = R - 2.2, r2 = R - (big ? 5.4 : 4.0);
      p.push(seg(cx + r1 * Math.sin(a), cy - r1 * Math.cos(a), cx + r2 * Math.sin(a), cy - r2 * Math.cos(a), big ? 1.2 : 0.8, true));
    }
    const m = /^(\d{1,2}):(\d{2})/.exec(time || '') || [0, 9, 15];
    const hh = +m[1] % 12, mm = +m[2];
    const ah = (hh + mm / 60) / 12 * Math.PI * 2, am = mm / 60 * Math.PI * 2;
    const hand = (a, len, t) => seg(cx + 2.6 * Math.sin(a), cy - 2.6 * Math.cos(a), cx + len * Math.sin(a), cy - len * Math.cos(a), t, true);
    p.push(hand(ah, 6.6, 1.7), hand(am, 9.2, 1.3));
    // Viserne møtes ikke helt i midten (ellers overlapper hullene); en liten mørk ring binder dem sammen
    p.push(circle(cx, cy, 1.9, true), circle(cx, cy, 0.8));
    return p.join(' ');
  }

  // ---------- Oppsett ----------
  // recipe: { banner, name, date: 'ÅÅÅÅ-MM-DD', time: 'TT:MM', weight, length, box }
  const clean = (s) => String(s == null ? '' : s).trim();
  function dateParts(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(clean(iso));
    if (!m) return null;
    const d = new Date(+m[1], +m[2] - 1, +m[3]);
    return { y: m[1], m: m[2], d: m[3], weekday: WEEKDAYS[d.getDay()] };
  }
  const splitBox = (t) => {        // tekstboksen: to linjer, delt på linjeskift eller midterste mellomrom
    t = clean(t).toUpperCase();
    if (!t) return [];
    if (t.includes('\n')) return t.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 2);
    const words = t.split(/\s+/);
    if (words.length < 2) return [t];
    let best = 1, bestDiff = Infinity;
    for (let i = 1; i < words.length; i++) { const diff = Math.abs(words.slice(0, i).join(' ').length - words.slice(i).join(' ').length); if (diff < bestDiff) { bestDiff = diff; best = i; } }
    return [words.slice(0, best).join(' '), words.slice(best).join(' ')];
  };
  const fmtNum = (s) => clean(s).replace(/\s+/g, '').replace('.', ',');

  async function layout(r) {
    // Tekst i et felt { x, y, w, h } (øverste venstre hjørne), store bokstaver fyller høyden
    const text = async (t, font, fld, opts = {}) => {
      t = clean(t);
      if (!t) return null;
      const res = await TE.layout({ lines: [t], fonts: [font], field: { w: fld.w, h: fld.h }, margin: 0, capFit: true, ...opts });
      return res.empty ? null : { d: TE.pathData(res.paths, 3), x: fld.x, y: fld.y, size: res.sizes[0] };
    };
    const dp = dateParts(r.date);
    const out = { recipe: r, items: [] };
    const add = (o, label) => { if (o) out.items.push({ ...o, label }); };

    // Banner med teksten skåret ut (buet)
    const bt = clean(r.banner).toUpperCase();
    let bannerD = bannerShape();
    if (bt) {
      const fw = BANNER.half * 2 - 14, capH = 7.4;
      const res = await TE.layout({ lines: [bt], fonts: ['cond'], field: { w: fw, h: capH }, margin: 0, capFit: true });
      if (!res.empty) bannerD += ' ' + res.paths.map((p) => TE.toD(warpPath(p, -fw / 2, -capH / 2), 3)).join(' ');
    }
    out.items.push({ label: 'banner', d: bannerD, x: 0, y: 0, rule: 'evenodd' });
    out.items.push({ label: 'banner-haler', d: bannerTails(), x: 0, y: 0 });

    // Navn, med kvister på hver side når det er plass
    const name = await text(r.name, 'slab', { x: 33, y: 48.5, w: 134, h: 26 }, { maxEm: 38 });
    add(name, 'navn');
    if (name) {
      const half = name.size.widthMm / 2, y = 71.5;
      if (100 - half - 4 - 15 >= 6) out.items.push({ label: 'kvister', d: sprig(100 - half - 4, y, -1) + ' ' + sprig(100 + half + 4, y, 1), x: 0, y: 0 });
    }

    // Datoboks
    const bx = 19, by = 85, bw = 56, rowH = 20, T = 1.3;
    const box = [rrectRing(bx, by, bw, rowH * 4, 3.2, T)];
    for (let i = 1; i < 4; i++) box.push(rrect(bx + T, by + rowH * i - T / 2, bw - 2 * T, T, 0.1));
    box.push(rrect(bx + bw / 2 - T / 2, by + rowH * 2, T, rowH, 0.1));
    out.items.push({ label: 'datoboks', d: box.join(' '), x: 0, y: 0 });
    const cell = (t, x, i, w = bw) => text(t, 'cond', { x: x + 4, y: by + rowH * i + (rowH - 9.5) / 2, w: w - 8, h: 9.5 });
    add(await cell('FØDT', bx, 0), 'født');
    if (dp) {
      add(await cell(dp.weekday, bx, 1), 'ukedag');
      add(await cell(dp.d, bx, 2, bw / 2), 'dag');
      add(await cell(dp.m, bx + bw / 2, 2, bw / 2), 'måned');
      add(await cell(dp.y, bx, 3), 'år');
    }

    // Klokkeslett og urskive
    const time = /^\d{1,2}:\d{2}/.test(clean(r.time)) ? clean(r.time).slice(0, 5).padStart(5, '0') : '';
    add(await text(time, 'cond', { x: 86, y: 88, w: 29, h: 8 }), 'klokkeslett');
    out.items.push({ label: 'klokke', d: clock(time || '09:15'), x: 0, y: 0 });

    // Tekstboks (fylt, teksten skåret ut)
    const lines = splitBox(r.box);
    let boxD = rrect(134, 86, 49.5, 40, 3.2);
    if (lines.length) {
      const res = await TE.layout({ lines, fonts: ['cond', 'cond'], ratio: 1, gap: 0.12, field: { w: 41.5, h: lines.length > 1 ? 29 : 13 }, margin: 0, capFit: true, maxEm: 14 });
      if (!res.empty) {
        const fy = 86 + (40 - (lines.length > 1 ? 29 : 13)) / 2;
        boxD += ' ' + res.paths.map((p) => TE.toD(shiftPath(p, 138, fy), 3)).join(' ');
      }
    }
    out.items.push({ label: 'tekstboks', d: boxD, x: 0, y: 0, rule: 'evenodd' });

    // Vekt
    add(await text('VEKT', 'cond', { x: 120, y: 142.5, w: 60, h: 9.5 }, { align: 'right' }), 'vekt-tittel');
    const w = fmtNum(r.weight);
    add(await text(w ? `${w} GRAM` : '', 'cond', { x: 86, y: 157, w: 94, h: 13 }, { align: 'right' }), 'vekt');
    out.items.push({ label: 'vekt-ikon', d: scaleIcon(), x: 0, y: 0 });

    // Lengde
    add(await text('LENGDE', 'cond', { x: 30, y: 184, w: 60, h: 9 }, { align: 'left' }), 'lengde-tittel');
    const l = fmtNum(r.length);
    add(await text(l ? `${l} CENTIMETER` : '', 'cond', { x: 30, y: 197.5, w: 94, h: 12.5 }, { align: 'left' }), 'lengde');
    out.items.push({ label: 'målebånd', d: tapeIcon(), x: 0, y: 0 });
    out.name = name;
    return out;
  }

  // ---------- Forhåndsvisning: beiset tre med lys gravering ----------
  function rand(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
  function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function grain(ctx, w, h, ppm, seed, alpha) {
    const rnd = rand(seed);
    for (let i = 0; i < 260; i++) {
      const x0 = rnd() * w, amp = 0.6 + rnd() * 2.2, ph = rnd() * 6.28, freq = 0.01 + rnd() * 0.025, a = alpha * (0.25 + rnd() * 0.75);
      ctx.beginPath();
      for (let y = 0; y <= h; y += 3) { const x = x0 + amp * Math.sin(y * freq + ph); if (y === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
      ctx.strokeStyle = rnd() < 0.55 ? `rgba(40,14,2,${a})` : `rgba(255,190,120,${a * 0.5})`;
      ctx.lineWidth = (0.15 + rnd() * 0.7);
      ctx.stroke();
    }
  }
  function render(canvas, lay, { ppm = 4, pad = 8 } = {}) {
    const W = Math.round((PLATE.w + pad * 2) * ppm), H = Math.round((PLATE.h + pad * 2) * ppm);
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ece8e2'; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.translate(pad * ppm, pad * ppm); ctx.scale(ppm, ppm);
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 4 * ppm; ctx.shadowOffsetX = 1 * ppm; ctx.shadowOffsetY = 2 * ppm;
    roundRect(ctx, 0, 0, PLATE.w, PLATE.h, PLATE.r);
    const g = ctx.createLinearGradient(0, 0, PLATE.w, PLATE.h);
    g.addColorStop(0, '#83431b'); g.addColorStop(0.5, '#6e3414'); g.addColorStop(1, '#5c2a10');
    ctx.fillStyle = g; ctx.fill(); ctx.restore();
    ctx.save(); roundRect(ctx, 0, 0, PLATE.w, PLATE.h, PLATE.r); ctx.clip();
    grain(ctx, PLATE.w, PLATE.h, ppm, 7, 0.35);
    // gravering: lyst, ubehandlet tre
    ctx.fillStyle = '#e9cc9c';
    for (const s of lay.items) { const P = placeOf(s); ctx.save(); ctx.translate(0, P.ty); ctx.scale(P.s, P.s); ctx.translate(s.x, s.y); ctx.fill(new Path2D(s.d), s.rule || 'nonzero'); ctx.restore(); }
    // svake årer også over graveringen
    ctx.globalCompositeOperation = 'multiply'; grain(ctx, PLATE.w, PLATE.h, ppm, 11, 0.12);
    ctx.restore();
    ctx.restore();
  }

  // ---------- SVG til LightBurn ----------
  function toSVG(lay, { outline = true } = {}) {
    const { w, h, r } = PLATE;
    const parts = lay.items.map((s) => { const P = placeOf(s); return `  <path id="${s.label}" transform="matrix(${f(P.s)} 0 0 ${f(P.s)} ${f(P.s * s.x)} ${f(P.ty + P.s * s.y)})" d="${s.d}" fill="#000000"${s.rule === 'evenodd' ? ' fill-rule="evenodd"' : ''}/>`; }).join('\n');
    const ref = outline ? `  <rect id="plate" x="0" y="0" width="${w}" height="${h}" rx="${r}" ry="${r}" fill="none" stroke="#ff0000" stroke-width="0.1"/>\n` : '';
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}mm" height="${h}mm" viewBox="0 0 ${w} ${h}">
  <title>Dåpstavle ${w} × ${h} mm</title>
${ref}${parts}
</svg>
`;
  }
  async function toPNG(lay, dpi = 600) {
    const ppm = dpi / 25.4, c = document.createElement('canvas');
    c.width = Math.round(PLATE.w * ppm); c.height = Math.round(PLATE.h * ppm);
    const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.scale(ppm, ppm); ctx.fillStyle = '#000';
    for (const s of lay.items) { const P = placeOf(s); ctx.save(); ctx.translate(0, P.ty); ctx.scale(P.s, P.s); ctx.translate(s.x, s.y); ctx.fill(new Path2D(s.d), s.rule || 'nonzero'); ctx.restore(); }
    const blob = await new Promise((res) => c.toBlob(res, 'image/png'));
    return window.Engrave && Engrave.pngWithDpi ? Engrave.pngWithDpi(blob, dpi) : blob;
  }

  window.BaptismBoard = { PLATE, DESIGN, EXAMPLE, WEEKDAYS, dateParts, splitBox, layout, render, toSVG, toPNG };
})();
