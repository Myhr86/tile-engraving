// Admin-side for tekstgravering (tekst.html).
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const TE = window.TextEngrave;
  const imgs = {};
  let res = null;

  function loadImage(src) {
    if (!imgs[src]) {
      imgs[src] = new Promise((ok, fail) => { const i = new Image(); i.onload = () => ok(i); i.onerror = fail; i.src = src; });
    }
    return imgs[src];
  }

  const product = () => TE.PRODUCTS[$('product').value];

  function opts() {
    return {
      lines: [$('l1').value, $('l2').value],
      fonts: [$('f1').value, $('f2').value],
      ratio: parseFloat($('ratio').value),
      gap: parseFloat($('gap').value),
      align: $('align').value,
      field: { w: parseFloat($('fw').value), h: parseFloat($('fh').value) },
    };
  }

  // Oppskrift: samme format som kunde-editoren legger på ordren.
  function recipe() {
    const o = opts();
    return { v: 1, type: 'tekst', product: $('product').value, lines: o.lines, fonts: o.fonts, ratio: o.ratio, gap: o.gap, align: o.align, field: o.field };
  }

  let pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(async () => { pending = false; await render(); });
  }

  async function render() {
    $('o_ratio').textContent = Math.round($('ratio').value * 100) + ' %';
    $('o_gap').textContent = Math.round($('gap').value * 100) + ' %';
    res = await TE.layout(opts());
    const p = product();
    const img = await loadImage('shop/img/' + p.image);
    TE.renderMock($('zoom'), img, p, res, { zoom: true, scale: 2.5, showField: $('showField').checked });
    TE.renderMock($('full'), img, p, res, { zoom: false, scale: 1 });

    // Teknisk visning: hvitt felt med stiplet ramme, 16 px per mm
    const c = $('tech'), ppm = 16, pad = 10;
    c.width = res.field.w * ppm + pad * 2; c.height = res.field.h * ppm + pad * 2;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.save(); ctx.translate(pad, pad);
    TE.draw(ctx, res, ppm, '#000');
    ctx.setLineDash([6, 4]); ctx.strokeStyle = '#d33'; ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, res.field.w * ppm, res.field.h * ppm);
    ctx.restore();

    $('sizes').innerHTML = res.empty ? 'Skriv en tekst.' : res.sizes.map((s) => {
      const small = s.heightMm < 2.5;
      return `<span class="${small ? 'warn' : ''}">Linje ${s.line}: ${s.widthMm.toFixed(1)} × ${s.heightMm.toFixed(1)} mm${small ? ' – liten, vurder kortere tekst' : ''}</span>`;
    }).join(' &nbsp;·&nbsp; ') + ` &nbsp;·&nbsp; Felt: ${res.field.w} × ${res.field.h} mm`;
  }

  function fileName(ext) {
    const base = [$('l1').value, $('l2').value].join(' ').replace(/[♥❤]/g, 'og').replace(/[^\wæøåÆØÅ ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 40) || 'gravering';
    return `${product().label.toLowerCase()}_${base}.${ext}`;
  }

  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; a.click();
  }

  function setProduct(key, keepField) {
    $('product').value = key;
    if (!keepField) { $('fw').value = TE.PRODUCTS[key].field.w; $('fh').value = TE.PRODUCTS[key].field.h; }
  }

  function applyRecipe(r) {
    if (r.product && TE.PRODUCTS[r.product]) setProduct(r.product);
    if (r.field) { $('fw').value = r.field.w; $('fh').value = r.field.h; }
    $('l1').value = (r.lines && r.lines[0]) || '';
    $('l2').value = (r.lines && r.lines[1]) || '';
    if (r.fonts) { $('f1').value = r.fonts[0] || 'script'; $('f2').value = r.fonts[1] || r.fonts[0] || 'serif'; }
    if (r.ratio) $('ratio').value = r.ratio;
    if (r.gap != null) $('gap').value = r.gap;
    if (r.align) $('align').value = r.align;
    schedule();
  }

  function init() {
    document.body.classList.add('has-image');   // vis forhåndsvisningene (style.css skjuler dem ellers)
    $('product').innerHTML = Object.entries(TE.PRODUCTS).map(([k, p]) => `<option value="${k}">${p.label}</option>`).join('');
    const fontOpts = Object.entries(TE.FONTS).map(([k, f]) => `<option value="${k}">${f.label}</option>`).join('');
    $('f1').innerHTML = fontOpts; $('f2').innerHTML = fontOpts;
    $('f1').value = 'script'; $('f2').value = 'serif';
    setProduct('korketrekker');

    for (const id of ['l1', 'l2', 'f1', 'f2', 'ratio', 'gap', 'align', 'fw', 'fh', 'showField']) {
      $(id).addEventListener('input', schedule);
      $(id).addEventListener('change', schedule);
    }
    $('product').addEventListener('change', () => { setProduct($('product').value); schedule(); });
    document.querySelectorAll('.heart').forEach((b) => b.addEventListener('click', () => {
      const inp = $(b.dataset.for), pos = inp.selectionStart ?? inp.value.length;
      inp.value = inp.value.slice(0, pos) + ' ♥ ' + inp.value.slice(inp.selectionEnd ?? pos);
      inp.value = inp.value.replace(/\s{2,}/g, ' ');
      inp.focus(); schedule();
    }));
    $('svgBtn').onclick = () => {
      if (!res || res.empty) return;
      download(new Blob([TE.toSVG(res, { frame: $('frame').checked })], { type: 'image/svg+xml' }), fileName('svg'));
    };
    $('pngBtn').onclick = async () => {
      if (!res || res.empty) return;
      download(await TE.toPNG(res, parseInt($('dpi').value, 10), { transparent: $('transp').checked }), fileName('png'));
    };
    $('recipe').addEventListener('input', () => {
      const raw = $('recipe').value.trim();
      if (!raw) return;
      try {
        const r = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
        if (r.type !== 'tekst') throw new Error();
        applyRecipe(r);
        $('orderStatus').textContent = '✔ Bestillingen er åpnet. Last ned SVG eller PNG.';
      } catch (e) {
        $('orderStatus').textContent = '⚠ Klarte ikke å lese oppskriften. Kopier hele teksten fra «_Oppskrift».';
      }
    });
    window.tekstApp = { recipe, applyRecipe, get res() { return res; } };
    schedule();
  }

  window.addEventListener('DOMContentLoaded', init);
})();
