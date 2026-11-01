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

    const fs = size * t.size;                       // skriftstørrelse navn
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
