// Kunde-editor for tekstgravering (f.eks. personlig vinåpner) i nettbutikken.
// Kunden skriver én eller to linjer og velger skrift, og ser teksten brent inn i
// produktbildet. Med i handlekurven følger forhåndsvisning, en PNG av graveringen
// (600 DPI) og en oppskrift som admin-siden tekst.html lager SVG fra.
//
// Monteres på [data-tekst-editor]. Data-attributter:
//   data-product  nøkkel i TextEngrave.PRODUCTS (f.eks. korketrekker)
//   data-variants JSON med varianter (som flis-editoren)
//   data-assets   JSON: { "image": url, "fonts": { "script": url, ... } }
//   data-cart-url hvor kunden sendes etter «Legg i handlekurven»
(function () {
  'use strict';
  const TE = window.TextEngrave;
  const EXAMPLE = ['Gunnvor ♥ Steinar', '1985'];

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
  const toBlob = (c, type, q) => new Promise((r) => c.toBlob(r, type, q));

  class TekstEditor {
    constructor(root) {
      this.root = root;
      this.productKey = TE.PRODUCTS[root.dataset.product] ? root.dataset.product : 'korketrekker';
      this.product = TE.PRODUCTS[this.productKey];
      this.assets = JSON.parse(root.dataset.assets || '{}');
      this.variants = JSON.parse(root.dataset.variants || '[]');
      this.variantId = (this.variants.find((v) => v.available) || this.variants[0] || {}).id;
      this.cartUrl = root.dataset.cartUrl || '/cart';
      this.fonts = ['script', 'serif'];
      if (this.assets.fonts) TE.setFontUrls((k) => this.assets.fonts[k]);
      this.build();
      this.loadFontFaces();
      const img = new Image();
      img.onload = () => { this.img = img; this.schedule(); };
      img.src = this.assets.image || ('shop/img/' + this.product.image);
    }

    // Vis skriftknappene i sin egen skrift
    loadFontFaces() {
      if (!window.FontFace || !this.assets.fonts) return;
      for (const [k, url] of Object.entries(this.assets.fonts)) {
        const ff = new FontFace('te-' + k, `url(${url})`);
        ff.load().then((f) => document.fonts.add(f)).catch(() => {});
      }
    }

    build() {
      const r = this.root;
      r.classList.add('flis-editor', 'tekst-editor');
      r.innerHTML = '';
      this.canvas = h('canvas', { class: 'te-canvas', 'aria-label': 'Forhåndsvisning av graveringen' });
      this.badge = h('span', { class: 'te-badge' }, 'Eksempel');
      const preview = h('div', { class: 'te-preview' }, this.canvas, this.badge);

      const lineBlock = (i, label, ph) => {
        const input = h('input', { type: 'text', maxlength: 40, placeholder: ph, oninput: () => this.schedule() });
        const heart = h('button', { type: 'button', class: 'fe-btn te-heart', title: 'Sett inn hjerte', onclick: () => {
          const pos = input.selectionStart ?? input.value.length;
          input.value = (input.value.slice(0, pos) + ' ♥ ' + input.value.slice(input.selectionEnd ?? pos)).replace(/\s{2,}/g, ' ').trimStart();
          input.focus(); this.schedule();
        } }, '♥');
        const chips = Object.entries(TE.FONTS).map(([k, f]) => h('button', {
          type: 'button', class: 'fe-chip te-font', 'data-v': k, style: `font-family:'te-${k}',serif`,
          onclick: () => { this.fonts[i] = k; this.syncChips(); this.schedule(); },
        }, f.label));
        this['input' + i] = input;
        this['chips' + i] = chips;
        return h('div', { class: 'fe-section' },
          h('label', { class: 'fe-field' }, label, h('div', { class: 'te-inputrow' }, input, heart)),
          h('div', { class: 'fe-row te-fonts' }, chips));
      };

      let variantEl = null;
      if (this.variants.length > 1) {
        variantEl = h('label', { class: 'fe-field' }, 'Variant',
          h('select', { onchange: (e) => { this.variantId = +e.target.value; this.updateButton(); } },
            this.variants.map((v) => h('option', { value: v.id, disabled: !v.available, selected: v.id === this.variantId }, `${v.title} – ${v.price}`))));
      }
      this.info = h('p', { class: 'fe-hint' });
      this.addBtn = h('button', { type: 'button', class: 'fe-add', onclick: () => this.addToCart() });
      this.msg = h('p', { class: 'fe-msg', role: 'status' });

      r.append(...[
        preview,
        this.info,
        lineBlock(0, 'Linje 1', 'f.eks. ' + EXAMPLE[0]),
        lineBlock(1, 'Linje 2 (valgfri)', 'f.eks. ' + EXAMPLE[1]),
        variantEl,
        h('p', { class: 'fe-note' }, `Teksten tilpasses automatisk graveringsfeltet (${this.product.field.w} × ${this.product.field.h} mm). Vi sjekker hver tekst før gravering.`),
        this.addBtn, this.msg,
      ].filter(Boolean));
      this.syncChips();
      this.updateButton();
    }

    syncChips() {
      for (const i of [0, 1]) for (const c of this['chips' + i]) c.classList.toggle('active', c.dataset.v === this.fonts[i]);
    }

    lines() { return [this.input0.value.trim(), this.input1.value.trim()]; }
    isEmpty() { return !this.lines().some(Boolean); }

    layoutOpts(example) {
      return { lines: example ? EXAMPLE : this.lines(), fonts: this.fonts, ratio: 0.6, gap: 0.06, align: 'center', field: this.product.field };
    }

    schedule() {
      if (this.pending) return;
      this.pending = true;
      requestAnimationFrame(async () => { this.pending = false; await this.render(); });
    }

    async render() {
      const example = this.isEmpty();
      try {
        this.res = await TE.layout(this.layoutOpts(example));
      } catch (e) {
        console.error(e); this.msg.textContent = 'Klarte ikke å laste skriftene. Last siden på nytt.'; return;
      }
      this.badge.hidden = !example;
      if (this.img) TE.renderMock(this.canvas, this.img, this.product, this.res, { zoom: 'tight', scale: 3 });
      const small = !example && this.res.sizes.some((s) => s.heightMm < 2.5);
      this.info.textContent = small ? 'Teksten blir ganske liten. Kortere tekst gir større bokstaver.' : '';
      this.updateButton();
    }

    updateButton() {
      const v = this.variants.find((x) => x.id === this.variantId);
      if (v && !v.available) { this.addBtn.textContent = 'Utsolgt'; this.addBtn.disabled = true; return; }
      this.addBtn.disabled = false;
      this.addBtn.textContent = this.isEmpty() ? 'Skriv teksten først' : `Legg i handlekurven${v ? ' – ' + v.price : ''}`;
    }

    recipe() {
      const o = this.layoutOpts(false);
      return { v: 1, type: 'tekst', product: this.productKey, lines: o.lines, fonts: o.fonts, ratio: o.ratio, gap: o.gap, align: o.align, field: o.field };
    }

    async addToCart() {
      if (this.isEmpty()) { this.input0.focus(); return; }
      if (!this.variantId) { this.msg.textContent = 'Produktet mangler variant. Kontakt butikken.'; return; }
      this.addBtn.disabled = true; this.addBtn.textContent = 'Legger i handlekurven …'; this.msg.textContent = '';
      try {
        const r = this.recipe();
        const res = await TE.layout(r);
        const fd = new FormData();
        fd.append('id', this.variantId);
        fd.append('quantity', 1);
        const [l1, l2] = r.lines;
        if (l1) fd.append('properties[Linje 1]', l1);
        if (l2) fd.append('properties[Linje 2]', l2);
        fd.append('properties[Skrift]', l2 ? `${TE.FONTS[r.fonts[0]].label} / ${TE.FONTS[r.fonts[1]].label}` : TE.FONTS[r.fonts[0]].label);
        const c = document.createElement('canvas');
        TE.renderMock(c, this.img, this.product, res, { zoom: true, scale: 2 });
        fd.append('properties[Forhåndsvisning]', new File([await toBlob(c, 'image/jpeg', 0.88)], 'forhandsvisning.jpg', { type: 'image/jpeg' }));
        fd.append('properties[_Gravering]', new File([await TE.toPNG(res, 600)], 'gravering-600dpi.png', { type: 'image/png' }));
        fd.append('properties[_Oppskrift]', JSON.stringify(r));
        const root = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
        const resp = await fetch(root + 'cart/add.js', { method: 'POST', body: fd, headers: { Accept: 'application/json' } });
        if (!resp.ok) {
          let desc = ''; try { desc = (await resp.json()).description || ''; } catch (e) { /* ignorer */ }
          throw new Error(desc || `HTTP ${resp.status}`);
        }
        this.addBtn.textContent = 'Lagt i handlekurven ✔';
        window.location.href = this.cartUrl;
      } catch (e) {
        console.error(e);
        this.msg.textContent = `Noe gikk galt: ${e.message}. Prøv igjen, eller kontakt oss.`;
        this.updateButton();
      }
    }
  }

  function mountAll() {
    document.querySelectorAll('[data-tekst-editor]:not(.tekst-editor)').forEach((el) => {
      try { el._tekstEditor = new TekstEditor(el); } catch (e) {
        console.error('Tekst-editor:', e);
        el.innerHTML = '<p style="color:#b00020;text-align:center">Graveringsverktøyet kunne ikke starte: ' + String(e && e.message || e).replace(/[<>&]/g, '') + '</p>';
      }
    });
  }
  window.TekstEditor = TekstEditor;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountAll);
  else mountAll();
  document.addEventListener('shopify:section:load', mountAll);
})();
