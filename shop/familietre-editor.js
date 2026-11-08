// Kunde-editor for familietreet: velg utførelse (MDF/lakkert), skriv bunntekst
// (f.eks. «Oldemor») og opptil 16 navn, og se resultatet på produktbildet.
// Monteres på [data-familietre-editor] med data-variants, data-cart-url og data-export-url.
(function () {
  'use strict';
  const TE = window.TextEngrave, FT = window.FamilyTree, P = FT.PRODUCT;
  const EXAMPLE = { bottom: 'Oldemor', names: ['Emma', 'Lillie', 'Alfred', 'Margit', 'Petter', 'Jon W.', 'Emilie', 'Syver'] };

  const h = (tag, attrs = {}, ...kids) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') el.className = v; else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid != null) el.append(kid);
    return el;
  };
  const toBlob = (c, t, q) => new Promise((r) => c.toBlob(r, t, q));

  // Finn varianten for utførelsen ut fra navnet i Shopify (f.eks. «Lakkert»)
  const variantKeyOf = (v) => (/lakk/i.test(v.title) ? 'lakk' : 'mdf');

  class FamilietreEditor {
    constructor(root) {
      this.root = root;
      this.variants = JSON.parse(root.dataset.variants || '[]');
      this.cartUrl = root.dataset.cartUrl || '/cart';
      this.exportUrl = root.dataset.exportUrl || '';
      this.finish = 'mdf';
      this.font = 'dancing';
      this.imgs = {};
      this.build();
      this.loadFontFaces();
      for (const k of Object.keys(P.variants)) {
        const img = new Image();
        img.onload = () => { this.imgs[k] = img; this.schedule(); };
        img.src = TE.imageSrc({ image: P.variants[k].image }, 'shop/img/' + P.variants[k].image);
      }
    }

    loadFontFaces() {
      if (!window.FontFace) return;
      for (const k of Object.keys(TE.FONTS)) {
        TE.fontBuffer(k).then((buf) => new FontFace('te-' + k, buf).load()).then((f) => document.fonts.add(f)).catch(() => {});
      }
    }

    variant() { return this.variants.find((v) => variantKeyOf(v) === this.finish) || this.variants[0]; }

    build() {
      const r = this.root;
      r.classList.add('flis-editor', 'tekst-editor', 'familietre-editor');
      r.innerHTML = '';
      this.canvas = h('canvas', { class: 'te-canvas', 'aria-label': 'Forhåndsvisning av familietreet' });
      this.badge = h('span', { class: 'te-badge' }, 'Eksempel');

      this.finishChips = Object.entries(P.variants).map(([k, v]) => h('button', { type: 'button', class: 'fe-chip', 'data-v': k,
        onclick: () => { this.finish = k; this.sync(); this.schedule(); } }, v.label));
      this.finishPrices = {};

      this.bottomInput = h('input', { type: 'text', maxlength: 24, placeholder: 'f.eks. Oldemor, Bestemor eller Familien Hansen', oninput: () => this.schedule() });
      this.fontChips = Object.entries(TE.FONTS).map(([k, f]) => h('button', { type: 'button', class: 'fe-chip te-font', 'data-v': k,
        style: `font-family:'te-${k}',serif`, onclick: () => { this.font = k; this.sync(); this.schedule(); } }, f.label));

      this.namesBox = h('div', { class: 'ft-names' });
      this.count = h('span', { class: 'ft-count' });
      this.nameInputs = [];
      for (let i = 0; i < 4; i++) this.addNameInput();

      let variantNote = null;
      this.info = h('p', { class: 'fe-hint' });
      this.addBtn = h('button', { type: 'button', class: 'fe-add', onclick: () => this.addToCart() });
      this.msg = h('p', { class: 'fe-msg', role: 'status' });

      r.append(...[
        h('div', { class: 'te-preview' }, this.canvas, this.badge),
        h('div', { class: 'fe-section' }, h('h3', {}, 'Utførelse'), h('div', { class: 'fe-row' }, this.finishChips)),
        h('div', { class: 'fe-section' },
          h('h3', {}, 'Tekst nederst'),
          h('label', { class: 'fe-field' }, 'Tekst', this.bottomInput),
          h('div', { class: 'fe-row te-fonts' }, this.fontChips)),
        h('div', { class: 'fe-section' },
          h('h3', {}, 'Navn på hjertene ', this.count),
          h('p', { class: 'fe-hint' }, `Opptil ${P.maxNames} navn, ett per hjerte. Navnene graveres med store bokstaver.`),
          this.namesBox),
        variantNote, this.info,
        h('p', { class: 'fe-note' }, 'Vi sjekker hver tekst før gravering. Forhåndsvisningen viser omtrent hvordan familietreet blir.'),
        this.addBtn, this.msg,
      ].filter(Boolean));
      this.sync();
    }

    addNameInput() {
      if (this.nameInputs.length >= P.maxNames) return;
      const i = this.nameInputs.length;
      const input = h('input', { type: 'text', maxlength: 14, placeholder: `Navn ${i + 1}`, 'aria-label': `Navn ${i + 1}`,
        oninput: () => { this.ensureEmptyInput(); this.schedule(); } });
      this.nameInputs.push(input);
      this.namesBox.append(input);
    }

    // Det skal alltid finnes et tomt felt å skrive i (til maks 16)
    ensureEmptyInput() {
      if (this.nameInputs.every((x) => x.value.trim()) && this.nameInputs.length < P.maxNames) this.addNameInput();
    }

    names() { return FT.clean(this.nameInputs.map((x) => x.value)); }
    isEmpty() { return !this.bottomInput.value.trim() && !this.names().length; }

    sync() {
      for (const c of this.finishChips) {
        c.classList.toggle('active', c.dataset.v === this.finish);
        const v = this.variants.find((x) => variantKeyOf(x) === c.dataset.v);
        c.textContent = P.variants[c.dataset.v].label + (v ? ` – ${v.price}` : '');
        c.disabled = v ? !v.available : false;
      }
      for (const c of this.fontChips) c.classList.toggle('active', c.dataset.v === this.font);
      this.updateButton();
    }

    recipe(example) {
      return { v: 1, type: 'familietre', product: 'familietre', finish: this.finish,
        bottom: { text: example ? EXAMPLE.bottom : this.bottomInput.value.trim(), font: this.font },
        names: example ? EXAMPLE.names : this.names(), nameFont: 'sans' };
    }

    schedule() {
      if (this.pending) return;
      this.pending = true;
      requestAnimationFrame(async () => { this.pending = false; await this.render(); });
    }

    async render() {
      const example = this.isEmpty();
      try { this.lay = await FT.layout(this.recipe(example)); } catch (e) {
        console.error(e); this.msg.textContent = `Klarte ikke å laste skriftene (${e.message}). Last siden på nytt.`; return;
      }
      this.badge.hidden = !example;
      const img = this.imgs[this.finish];
      if (img) FT.renderMock(this.canvas, img, this.finish, this.lay, { scale: 1.6 });
      const n = this.names().length;
      this.count.textContent = `(${n} av ${P.maxNames})`;
      const long = !example && this.lay.names.some((r) => r.sizes[0] && r.sizes[0].heightMm < 3);
      this.info.textContent = long ? 'Noen navn er lange og blir mindre på hjertet. Forkortelser kan gi større bokstaver.' : '';
      this.updateButton();
    }

    updateButton() {
      const v = this.variant();
      if (v && !v.available) { this.addBtn.textContent = 'Utsolgt'; this.addBtn.disabled = true; return; }
      this.addBtn.disabled = false;
      this.addBtn.textContent = this.isEmpty() ? 'Skriv tekst og navn først' : `Legg i handlekurven${v ? ' – ' + v.price : ''}`;
    }

    async addToCart() {
      if (this.isEmpty()) { this.bottomInput.focus(); return; }
      const v = this.variant();
      if (!v) { this.msg.textContent = 'Produktet mangler variant. Kontakt butikken.'; return; }
      this.addBtn.disabled = true; this.addBtn.textContent = 'Legger i handlekurven …'; this.msg.textContent = '';
      try {
        const r = this.recipe(false);
        const lay = await FT.layout(r);
        const fd = new FormData();
        fd.append('id', v.id);
        fd.append('quantity', 1);
        if (r.bottom.text) fd.append('properties[Tekst nederst]', r.bottom.text);
        fd.append('properties[Skrift]', TE.FONTS[r.bottom.font].label);
        fd.append('properties[Antall hjerter]', String(r.names.length));
        if (r.names.length) fd.append('properties[Navn]', r.names.map((n) => n.toUpperCase()).join(', '));
        const c = document.createElement('canvas');
        FT.renderMock(c, this.imgs[this.finish], this.finish, lay, { scale: 1.6 });
        fd.append('properties[Forhåndsvisning]', new File([await toBlob(c, 'image/jpeg', 0.88)], 'forhandsvisning.jpg', { type: 'image/jpeg' }));
        fd.append('properties[_Oppskrift]', JSON.stringify(r));
        if (this.exportUrl && window.TekstOppskrift) fd.append('properties[_SVG-fil]', this.exportUrl + '#' + window.TekstOppskrift.encode(r));
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
    document.querySelectorAll('[data-familietre-editor]:not(.familietre-editor)').forEach((el) => {
      try { el._ftEditor = new FamilietreEditor(el); } catch (e) {
        console.error('Familietre-editor:', e);
        el.innerHTML = '<p style="color:#b00020;text-align:center">Verktøyet kunne ikke starte: ' + String(e && e.message || e).replace(/[<>&]/g, '') + '</p>';
      }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountAll); else mountAll();
  document.addEventListener('shopify:section:load', mountAll);
})();
