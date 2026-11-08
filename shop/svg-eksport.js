// SVG-eksport for tekstbestillinger: en skjult side i nettbutikken som leser
// oppskriften fra lenken (#…) på ordren, viser graveringen og laster ned SVG/PNG.
// Monteres på [data-svg-eksport]. Bruker skrifter og bilde som er bakt inn i skriptet.
(function () {
  'use strict';
  const TE = window.TextEngrave;

  // Oppskrift <-> lenke (base64url av UTF-8-JSON)
  function encode(r) {
    const bytes = new TextEncoder().encode(JSON.stringify(r));
    let bin = ''; bytes.forEach((b) => { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function decode(s) {
    const b = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(b, (c) => c.charCodeAt(0))));
  }
  window.TekstOppskrift = { encode, decode };

  const h = (tag, attrs = {}, ...kids) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') el.className = v; else if (k.startsWith('on')) el.addEventListener(k.slice(2), v); else el.setAttribute(k, v);
    }
    for (const kid of kids.flat()) if (kid != null) el.append(kid);
    return el;
  };

  function fileName(r, ext) {
    const base = (r.lines || []).join(' ').replace(/[♥❤]/g, 'og').replace(/[^\wæøåÆØÅ ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 40) || 'gravering';
    return `${r.product || 'gravering'}_${base}.${ext}`;
  }
  function download(blob, name) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
  }

  async function mount(root) {
    root.classList.add('flis-editor', 'svg-eksport');
    const mock = h('canvas', { class: 'te-canvas' });
    const tech = h('canvas', { class: 'te-canvas', style: 'background:#fff;border:1px solid #ddd;border-radius:6px' });
    const info = h('p', { class: 'fe-hint' });
    const msg = h('p', { class: 'fe-msg' });
    const svgBtn = h('button', { type: 'button', class: 'fe-add' }, 'Last ned SVG (vektor, mm)');
    const pngBtn = h('button', { type: 'button', class: 'fe-btn', style: 'margin-top:8px;width:100%;padding:12px' }, 'Last ned PNG (600 DPI)');
    const paste = h('textarea', { rows: 3, placeholder: 'Eller lim inn «_Oppskrift» fra ordren her', style: 'width:100%;margin-top:12px;font:13px monospace;padding:8px;border:1px solid #ccc;border-radius:6px' });
    root.innerHTML = '';
    root.append(h('div', { class: 'te-preview' }, mock), h('div', { style: 'margin-top:12px' }, tech), info, svgBtn, pngBtn, msg, paste);

    const img = new Image();
    const imgReady = new Promise((ok) => { img.onload = ok; img.onerror = ok; });
    let r = null, res = null;

    let tree = null;   // familietre-oppsett
    async function show(recipe) {
      r = recipe;
      if (r.type === 'familietre' && window.FamilyTree) {
        tree = await FamilyTree.layout(r); res = null;
        mock.hidden = true;
        FamilyTree.drawSheet(tech, tree, 4);
        info.textContent = `Familietre (${(FamilyTree.PRODUCT.variants[r.finish] || {}).label || ''}): «${r.bottom.text}» og ${tree.names.length} navnehjerter. ` +
          'SVG-arket har bunnteksten øverst og navnene i hjerter under. Røde hårstreker viser felt og hjerteomriss.';
        msg.textContent = '';
        return;
      }
      tree = null; mock.hidden = false;
      const product = TE.PRODUCTS[r.product] || TE.PRODUCTS.korketrekker;
      if (!img.src) img.src = TE.imageSrc(product, '');
      res = await TE.layout({ lines: r.lines, fonts: r.fonts, ratio: r.ratio, gap: r.gap, align: r.align, field: r.field || product.field });
      await imgReady;
      if (img.naturalWidth) TE.renderMock(mock, img, product, res, { zoom: 'tight', scale: 3 });
      const ppm = 14, pad = 8;
      tech.width = res.field.w * ppm + pad * 2; tech.height = res.field.h * ppm + pad * 2;
      const ctx = tech.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, tech.width, tech.height);
      ctx.save(); ctx.translate(pad, pad); TE.draw(ctx, res, ppm, '#000');
      ctx.setLineDash([5, 4]); ctx.strokeStyle = '#d33'; ctx.strokeRect(0, 0, res.field.w * ppm, res.field.h * ppm); ctx.restore();
      info.textContent = `«${(r.lines || []).filter(Boolean).join(' / ')}» · ${res.sizes.map((s) => `linje ${s.line}: ${s.widthMm.toFixed(1)} × ${s.heightMm.toFixed(1)} mm`).join(', ')} · felt ${res.field.w} × ${res.field.h} mm`;
      msg.textContent = '';
    }

    svgBtn.onclick = () => {
      if (tree) download(new Blob([FamilyTree.toSVG(tree)], { type: 'image/svg+xml' }), fileName({ product: 'familietre', lines: [r.bottom.text] }, 'svg'));
      else if (res) download(new Blob([TE.toSVG(res)], { type: 'image/svg+xml' }), fileName(r, 'svg'));
    };
    pngBtn.onclick = async () => {
      if (tree) download(await FamilyTree.toPNG(tree, 600), fileName({ product: 'familietre', lines: [r.bottom.text] }, 'png'));
      else if (res) download(await TE.toPNG(res, 600), fileName(r, 'png'));
    };
    paste.addEventListener('input', () => {
      const raw = paste.value.trim(); if (!raw) return;
      try { show(JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1))); } catch (e) { msg.textContent = 'Klarte ikke å lese oppskriften.'; }
    });

    const hash = location.hash.slice(1);
    if (hash) {
      try { await show(decode(hash)); } catch (e) { console.error(e); msg.textContent = 'Lenken inneholder ingen gyldig gravering. Lim inn «_Oppskrift» fra ordren under.'; }
    } else {
      info.textContent = 'Åpne denne siden fra lenken «_SVG-fil» på ordren, eller lim inn «_Oppskrift» under.';
    }
  }

  function mountAll() { document.querySelectorAll('[data-svg-eksport]:not(.svg-eksport)').forEach((el) => mount(el)); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountAll); else mountAll();
  document.addEventListener('shopify:section:load', mountAll);
})();
